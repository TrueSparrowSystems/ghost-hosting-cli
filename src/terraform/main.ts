import { Construct } from 'constructs';
import { App, TerraformStack } from 'cdktf';
import { AwsProvider } from '@cdktf/provider-aws';

import { VpcResource } from './vpc';
import { RdsResource } from './rds';
import { EcsResource } from './ecs';
import { AlbResource } from './alb';
import { S3Resource } from './s3';
import { IamResource } from './iam';
import { AcmResource } from './acm';
import { S3Upload } from './s3_upload';
import { AutoScaling } from './auto_scaling';

import { StringResource } from '../gen/providers/random';
import { S3Bucket, S3Object } from '../gen/providers/aws/s3';
import { RandomProvider } from '../gen/providers/random';
import { LocalProvider } from '../gen/providers/local';
import { EcsService } from '../gen/providers/aws/ecs';

import { readInput } from '../lib/readInput';

/**
 * Terraform stack
 */
class GhostStack extends TerraformStack {
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
   * Constructor for the terraform stack
   *
   * @param {Construct} scope
   * @param {string} name
   */
  constructor(scope: Construct, name: string) {
    super(scope, name);

    this.userInput = {};

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
   * Main performer of the class.
   */
  async perform() {
    this.userInput = readInput();

    this._setProviders();

    this._createVpc();

    this._generateRandomString();

    this._createRdsInstance();

    const { certificateArn } = this._createAcmCertificate();

    const { blogBucket, staticBucket, configsBucket } = this._createS3Buckets();

    const { ghostEnvUpload, nginxEnvUpload } = this._s3Upload(blogBucket, configsBucket, staticBucket);

    const { albSecurityGroups, listenerArn } = this._createAlb(certificateArn);

    const { customExecutionRoleArn, customTaskRoleArn, ecsAutoScalingRoleArn } = this._createIamRolePolicies(
      blogBucket,
      configsBucket,
    );

    const { ecsService } = this._createEcs(
      albSecurityGroups,
      listenerArn,
      customExecutionRoleArn,
      customTaskRoleArn,
      configsBucket,
      ghostEnvUpload,
      nginxEnvUpload,
    );

    this._autoScale(ecsService, ecsAutoScalingRoleArn);
  }

  /**
   * Generate random string append with resource name and identifier
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
   * Set required providers.
   *
   * @private
   */
  _setProviders(): void {
    // AWS provider
    new AwsProvider(this, 'AWS', {
      region: this.userInput.aws.region,
      accessKey: this.userInput.aws.accessKeyId,
      secretKey: this.userInput.aws.secretAccessKey,
    });

    // Random provider
    new RandomProvider(this, 'random-provider', {
      alias: 'random-provider',
    });

    // Local provider
    new LocalProvider(this, 'local', {
      alias: 'local-provider',
    });
  }

  /**
   * Create aws vpc
   *
   * @private
   */
  _createVpc(): void {
    const { vpcId, vpcSubnets, vpcPublicSubnets } = new VpcResource(this, 'plg-gh-vpc', {
      useExistingVpc: this.userInput.vpc.useExistingVpc,
      vpcSubnets: this.userInput.vpc.vpcSubnets || [],
      vpcPublicSubnets: this.userInput.vpc.vpcPublicSubnets || [],
    }).perform();

    this.vpcId = vpcId;
    this.vpcSubnets = vpcSubnets;
    this.vpcPublicSubnets = vpcPublicSubnets;
  }

  /**
   * Create aws rds instance in private subnet.
   *
   * @private
   */
  _createRdsInstance(): void {
    const { rdsHost, rdsDbUserName, rdsDbPassword, rdsDbName, rdsSecurityGroupId } = new RdsResource(
      this,
      'plg-gh-rds',
      {
        vpcId: this.vpcId,
        vpcSubnets: this.vpcSubnets,
        useExistingRds: this.userInput.rds.useExistingRds,
        rdsHost: this.userInput.rds.rdsHost,
        rdsDbUserName: this.userInput.rds.rdsDbUserName,
        rdsDbPassword: this.userInput.rds.rdsDbPassword,
        rdsDbName: this.userInput.rds.rdsDbName,
        region: this.userInput.aws.region
      },
    ).perform();

    this.rdsHost = rdsHost;
    this.rdsDbUserName = rdsDbUserName;
    this.rdsDbPassword = rdsDbPassword;
    this.rdsDbName = rdsDbName;
    this.rdsSecurityGroupId = rdsSecurityGroupId;
  }

  /**
   * Create application load balancer
   *
   * @private
   */
  _createAlb(certificateArn: string | undefined) {
    return new AlbResource(this, 'plg-gh-alb', {
      vpcId: this.vpcId,
      publicSubnets: this.vpcPublicSubnets,
      useExistingAlb: this.userInput.alb.useExistingAlb,
      listenerArn: this.userInput.alb.listenerArn,
      certificateArn,
    }).perform();
  }

  /**
   * Create required s3 buckets
   *
   * @private
   */
  _createS3Buckets() {
    return new S3Resource(this, 'plg-gh-s3', {
      randomString: this.randomString,
      vpcId: this.vpcId,
      ghostHostingUrl: this.userInput.ghostHostingUrl,
      region: this.userInput.aws.region
    }).perform();
  }

  _createAcmCertificate() {
    if (this.userInput.alb.useExistingAlb) {
      return { certificateArn: '' };
    }

    return new AcmResource(this, 'plg-gh-acm', {
      ghostHostingUrl: this.userInput.ghostHostingUrl,
    }).perform();
  }

  _s3Upload(blogBucket: S3Bucket, configsBucket: S3Bucket, staticBucket: S3Bucket) {
    return new S3Upload(this, 's3-env-upload', {
      region: this.userInput.aws.region,
      blogBucket,
      configsBucket,
      staticBucket,
      rdsDbHost: this.rdsHost,
      rdsDbUserName: this.rdsDbUserName,
      rdsDbPassword: this.rdsDbPassword,
      rdsDbName: this.rdsDbName,
      rdsSecurityGroupId: this.rdsSecurityGroupId,
      ghostHostingUrl: this.userInput.ghostHostingUrl,
      hostStaticWebsite: this.userInput.hostStaticWebsite,
      staticWebsiteUrl: this.userInput.staticWebsiteUrl,
    }).perform();
  }

  _createIamRolePolicies(blogBucket: S3Bucket, configsBucket: S3Bucket) {
    return new IamResource(this, 'plg-gh-iam', {
      randomString: this.randomString,
      blogBucket,
      configsBucket,
    }).perform();
  }

  /**
   * Create ECS container, cluster, task-definition, service and task in EC2-ECS optimized instance
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
  ) {
    return new EcsResource(this, 'plg-gh-ecs', {
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
  _autoScale(ecsService: EcsService, ecsAutoScalingRoleArn: string) {
    return new AutoScaling(this, 'auto-scale', {
      ecsService,
      autoScaleRoleArn: ecsAutoScalingRoleArn,
    }).perform();
  }
}

const app = new App();
new GhostStack(app, 'plg-ghost')
  .perform()
  .then()
  .catch((err) => {
    console.error('GhostStack Error: ', err);
    process.exit(1);
  });

app.synth();
