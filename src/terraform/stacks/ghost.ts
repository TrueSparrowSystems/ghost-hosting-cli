import { Construct } from 'constructs';
import { S3Backend, TerraformStack } from 'cdktf';
import { AwsProvider } from '@cdktf/provider-aws';

import { VpcResource } from '../vpc';
import { RdsResource } from '../rds';
import { EcsResource } from '../ecs';
import { AlbResource } from '../alb';
import { S3Resource } from '../s3';
import { IamResource } from '../iam';
import { AcmResource } from '../acm';
import { S3Upload } from '../s3_upload';
import { AutoScaling } from '../auto_scaling';
import { CloudfrontResource } from '../cloudfront';

import { StringResource } from '../../gen/providers/random';
import { S3Bucket, S3Object, S3BucketWebsiteConfiguration } from '../../gen/providers/aws/s3';
import { RandomProvider } from '../../gen/providers/random';
import { EcsCluster, EcsService } from '../../gen/providers/aws/ecs';

import s3Config from '../../config/s3.json';

interface Options {
  bucketName: string;
  dynamoTableName: string;
  userInput: any;
}

class GhostStack extends TerraformStack {
  options: Options;
  userInput: any;
  randomString: string;
  vpcId: string;
  vpcSubnets: string[];
  vpcPublicSubnets: string[];
  rdsHost: string;
  rdsDbUserName: string;
  rdsDbPassword: string;
  rdsDbName: string;
  rdsSecurityGroupId: string;

  /**
   * @dev Constructor for the terraform stack
   *
   * @param {Construct} scope
   * @param {string} name
   */
  constructor(scope: Construct, name: string, options: Options) {
    super(scope, name);

    this.options = options;
    this.userInput = options.userInput;

    this.randomString = '';
    this.vpcId = '';
    this.vpcSubnets = [];
    this.vpcPublicSubnets = [];
    this.rdsHost = '';
    this.rdsDbUserName = '';
    this.rdsDbPassword = '';
    this.rdsDbName = '';
    this.rdsSecurityGroupId = '';
  }

  /**
   * @dev Main performer of the class
   *
   * @returns {void}
   */
  perform(): void {
    this._setProviders();

    this._s3Backend();

    this._createVpc();

    this._generateRandomString();

    this._createRdsInstance();

    const { certificateArn } = this._createAcmCertificate();

    const { blogBucket, staticBucket, configsBucket, s3BucketWebsiteConfiguration } = this._createS3Buckets();

    const { cloudfrontDomainName } = this._createCloudfrontDistribution(blogBucket);

    const { ghostEnvUpload, nginxEnvUpload } = this._s3Upload(
      blogBucket,
      configsBucket,
      staticBucket,
      s3BucketWebsiteConfiguration,
      cloudfrontDomainName,
    );

    const { albSecurityGroups, listenerArn } = this._createAlb(certificateArn);

    const { customExecutionRoleArn, customTaskRoleArn, ecsAutoScalingRoleArn } = this._createIamRolePolicies(
      blogBucket,
      configsBucket,
    );

    const { ecsCluster, ecsService } = this._createEcs(
      albSecurityGroups,
      listenerArn,
      customExecutionRoleArn,
      customTaskRoleArn,
      configsBucket,
      ghostEnvUpload,
      nginxEnvUpload,
    );

    this._autoScale(ecsCluster, ecsService, ecsAutoScalingRoleArn);
  }

  /**
   * @dev Set up S3 backend for terraform state locking
   *
   * @returns {void}
   */
  _s3Backend(): void {
    new S3Backend(this, {
      bucket: s3Config.tfStateBucketName,
      key: s3Config.tfStateBucketKey,
      region: this.userInput.aws.region,
      encrypt: true,
      dynamodbTable: s3Config.dynamoDbTableName,
      accessKey: this.userInput.aws.accessKeyId,
      secretKey: this.userInput.aws.secretAccessKey,
    });
  }

  /**
   * @dev Generate random string append with resource name and identifier
   *
   * @returns {void}
   */
  _generateRandomString(): void {
    const stringResource = new StringResource(this, 'random_string', {
      length: 8,
      lower: true,
      upper: false,
      special: false,
      numeric: true,
      minNumeric: 2,
      keepers: {
        vpc_id: this.vpcId,
      },
    });

    this.randomString = stringResource.result;
  }

  /**
   * @dev Set required providers.
   *
   * @returns {void}
   */
  _setProviders(): void {
    // AWS provider
    new AwsProvider(this, 'aws_provider', {
      region: this.userInput.aws.region,
      accessKey: this.userInput.aws.accessKeyId,
      secretKey: this.userInput.aws.secretAccessKey,
    });

    // Random provider
    new RandomProvider(this, 'random_provider', {
      alias: 'random_provider',
    });
  }

  /**
   * @dev Create aws vpc
   *
   * @returns {void}
   */
  _createVpc(): void {
    const { vpcId, vpcSubnets, vpcPublicSubnets } = new VpcResource(this, 'vpc', {
      useExistingVpc: this.userInput.vpc.useExistingVpc,
      vpcSubnets: this.userInput.vpc.vpcSubnets || [],
      vpcPublicSubnets: this.userInput.vpc.vpcPublicSubnets || [],
    }).perform();

    this.vpcId = vpcId;
    this.vpcSubnets = vpcSubnets;
    this.vpcPublicSubnets = vpcPublicSubnets;
  }

  /**
   * @dev Create aws rds instance in private subnet.
   *
   * @returns {void}
   */
  _createRdsInstance(): void {
    const { rdsHost, rdsDbUserName, rdsDbPassword, rdsDbName, rdsSecurityGroupId } = new RdsResource(this, 'rds', {
      vpcId: this.vpcId,
      vpcSubnets: this.vpcSubnets,
      useExistingRds: this.userInput.rds.useExistingRds,
      rdsHost: this.userInput.rds.rdsHost,
      rdsDbUserName: this.userInput.rds.rdsDbUserName,
      rdsDbPassword: this.userInput.rds.rdsDbPassword,
      rdsDbName: this.userInput.rds.rdsDbName,
      region: this.userInput.aws.region,
    }).perform();

    this.rdsHost = rdsHost;
    this.rdsDbUserName = rdsDbUserName;
    this.rdsDbPassword = rdsDbPassword;
    this.rdsDbName = rdsDbName;
    this.rdsSecurityGroupId = rdsSecurityGroupId;
  }

  /**
   * @dev Create application load balancer
   *
   * @private
   */
  _createAlb(certificateArn: string | undefined): { albSecurityGroups: string[]; listenerArn: string } {
    return new AlbResource(this, 'alb', {
      vpcId: this.vpcId,
      publicSubnets: this.vpcPublicSubnets,
      useExistingAlb: this.userInput.alb.useExistingAlb,
      listenerArn: this.userInput.alb.listenerArn,
      certificateArn,
    }).perform();
  }

  /**
   * @dev Create required s3 buckets
   *
   * @private
   */
  _createS3Buckets(): {
    blogBucket: S3Bucket;
    staticBucket: S3Bucket;
    configsBucket: S3Bucket;
    s3BucketWebsiteConfiguration: S3BucketWebsiteConfiguration;
  } {
    return new S3Resource(this, 's3', {
      randomString: this.randomString,
      vpcId: this.vpcId,
      ghostHostingUrl: this.userInput.ghostHostingUrl,
      region: this.userInput.aws.region,
    }).perform();
  }

  _createAcmCertificate() {
    if (this.userInput.alb.useExistingAlb) {
      return { certificateArn: '' };
    }

    return new AcmResource(this, 'acm', {
      ghostHostingUrl: this.userInput.ghostHostingUrl,
    }).perform();
  }

  _s3Upload(
    blogBucket: S3Bucket,
    configsBucket: S3Bucket,
    staticBucket: S3Bucket,
    s3BucketWebsiteConfiguration: S3BucketWebsiteConfiguration,
    cloudfrontDomainName: string,
  ): {
    ghostEnvUpload: S3Object;
    nginxEnvUpload: S3Object;
  } {
    return new S3Upload(this, 's3_upload', {
      region: this.userInput.aws.region,
      blogBucket,
      configsBucket,
      staticBucket,
      s3BucketWebsiteConfiguration,
      rdsDbHost: this.rdsHost,
      rdsDbUserName: this.rdsDbUserName,
      rdsDbPassword: this.rdsDbPassword,
      rdsDbName: this.rdsDbName,
      rdsSecurityGroupId: this.rdsSecurityGroupId,
      ghostHostingUrl: this.userInput.ghostHostingUrl,
      hostStaticWebsite: this.userInput.hostStaticWebsite,
      staticWebsiteUrl: this.userInput.staticWebsiteUrl,
      cloudfrontDomainName,
    }).perform();
  }

  _createIamRolePolicies(
    blogBucket: S3Bucket,
    configsBucket: S3Bucket,
  ): {
    customExecutionRoleArn: string;
    customTaskRoleArn: string;
    ecsAutoScalingRoleArn: string;
  } {
    return new IamResource(this, 'iam', {
      randomString: this.randomString,
      blogBucket,
      configsBucket,
    }).perform();
  }

  /**
   * @dev Create ECS container, cluster, task-definition, service and task in EC2-ECS optimized instance
   *
   * @param albSecurityGroups
   * @param listenerArn
   * @param customExecutionRoleArn
   * @param customTaskRoleArn
   * @param configBucket
   * @param ghostEnvUpload
   * @param nginxEnvUpload
   * @private
   */
  _createEcs(
    albSecurityGroups: string[],
    listenerArn: string,
    customExecutionRoleArn: string,
    customTaskRoleArn: string,
    configBucket: S3Bucket,
    ghostEnvUpload: S3Object,
    nginxEnvUpload: S3Object,
  ): {
    ecsService: EcsService;
    ecsCluster: EcsCluster;
  } {
    return new EcsResource(this, 'ecs', {
      vpcId: this.vpcId,
      subnets: this.vpcSubnets,
      dbInstanceEndpoint: this.rdsHost,
      albSecurityGroups,
      listenerArn,
      rdsSecurityGroupId: this.rdsSecurityGroupId,
      customExecutionRoleArn,
      customTaskRoleArn,
      configBucket,
      ghostEnvUpload,
      nginxEnvUpload,
      ghostHostingUrl: this.userInput.ghostHostingUrl,
      region: this.userInput.aws.region,
      staticWebsiteUrl: this.userInput.staticWebsiteUrl,
    }).perform();
  }

  /**
   * @dev Auto scale
   * @param ecsService
   * @param ecsAutoScalingRoleArn
   * @private
   */
  _autoScale(ecsCluster: EcsCluster, ecsService: EcsService, ecsAutoScalingRoleArn: string) {
    return new AutoScaling(this, 'auto_scale', {
      ecsCluster,
      ecsService,
      autoScaleRoleArn: ecsAutoScalingRoleArn,
    }).perform();
  }

  /**
   * @dev Create cloudfront distribution
   *
   * @param blogBucket
   */
  _createCloudfrontDistribution(blogBucket: S3Bucket): { cloudfrontDomainName: string } {
    return new CloudfrontResource(this, 'cloudfront', {
      blogBucket,
    }).perform();
  }
}

export { GhostStack };
