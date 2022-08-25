import { Construct } from "constructs";
import { App, TerraformStack } from "cdktf";
import { AwsProvider } from "@cdktf/provider-aws";

import { VpcResource } from "./vpc";
import { RdsResource } from "./rds";
import { EcsResource} from "./ecs";
import { AlbResource } from "./alb";
import { S3Resource } from "./s3";
import { IamResource } from "./iam";
import { AcmResource } from "./acm";
import { S3Upload } from "./s3_upload";

import { AlbTargetGroup } from "../.gen/providers/aws/elb";
import { S3Bucket, S3BucketObject } from "../.gen/providers/aws/s3";
import { RandomProvider } from "../.gen/providers/random";
import { LocalProvider } from "../.gen/providers/local";

import { readInput } from "../lib/readInput";

/**
 * Terraform stack
 */
class GhostStack extends TerraformStack {
    userInput: any;
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

        this._createRdsInstance();

        // TODO: conditional based on listener arn
        const certificateArn = this._createAcmCertificate();

        const { blogBucket, staticBucket, configsBucket } = this._createS3Buckets();

        const { ghostEnvUpload, nginxEnvUpload } = this._s3Upload(
            blogBucket,
            configsBucket,
            staticBucket
        );

        const { alb, targetGroup } = this._createAlb(certificateArn);

        const { customExecutionRole, customTaskRole } = this._createIamRolePolicies(
            blogBucket,
            configsBucket
        );

        const albSecurityGroupId = alb.securityGroups[0];

        this._createEcs(
            albSecurityGroupId,
            targetGroup,
            customExecutionRole.arn,
            customTaskRole.arn,
            configsBucket,
            ghostEnvUpload,
            nginxEnvUpload
        );
    }

    /**
     * Set required providers.
     *
     * @private
     */
    _setProviders() {
        // AWS provider
        new AwsProvider(this, "AWS", {
            region: this.userInput.aws.awsDefaultRegion,
            accessKey: this.userInput.aws.awsAccessKeyId,
            secretKey: this.userInput.aws.awsSecretAccessKey
        });

        // Random provider
        new RandomProvider(this, "random-provider", {
            alias: "random-provider"
        });

        // Local provider
        new LocalProvider(this, "local", {
            alias: "local-provider"
        });
    }

    /**
     * Create aws vpc
     *
     * @private
     */
    _createVpc() {
        const { vpcId, vpcSubnets, vpcPublicSubnets } = new VpcResource(this, "plg-gh-vpc", {
            useExistingVpc: this.userInput.vpc.useExistingVpc,
            vpcSubnets: this.userInput.vpc.vpcSubnets || [],
            vpcPublicSubnets: this.userInput.vpc.vpcPublicSubnets || []
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
    _createRdsInstance() {
        const { rdsHost, rdsDbUserName, rdsDbPassword, rdsDbName, rdsSecurityGroupId } = new RdsResource(this, "plg-gh-rds", {
            vpcId: this.vpcId,
            vpcSubnets: this.vpcSubnets,
            useExistingRds: this.userInput.rds.useExistingRds,
            rdsHost: this.userInput.rds.rdsHost,
            rdsDbUserName: this.userInput.rds.rdsDbUserName,
            rdsDbPassword: this.userInput.rds.rdsDbPassword,
            rdsDbName: this.userInput.rds.rdsDbName,
        }).perform();

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

        if(this.userInput.alb.useExistingAlb){
            return;
        }

        return new AlbResource(this, "plg-gh-alb", {
            vpcId: this.vpcId,
            publicSubnets: this.vpcPublicSubnets,
            useExistingAlb: this.userInput.alb.useExistingAlb,
            isConfiguredDomain: this.userInput.alb.isConfiguredDomain,
            listenerArn: this.userInput.alb.listenerArn,
            certificateArn
        }).perform();
    }

    /**
     * Create required s3 buckets
     *
     * @private
     */
    _createS3Buckets() {
        return new S3Resource(this, "plg-gh-s3", {
            vpcId: this.vpcId,
            ghostHostingUrl: this.userInput.ghostHostingUrl
        }).perform();
    }

    _createAcmCertificate() {
        if (this.userInput.alb.useExistingAlb) {
            return;
        }

        return new AcmResource(this, "plg-gh-acm", {
            ghostHostingUrl: this.userInput.ghostHostingUrl
        }).perform();
    }

    _s3Upload(
        blogBucket: S3Bucket,
        configsBucket: S3Bucket,
        staticBucket: S3Bucket
    ) {
        return new S3Upload(this, "s3-env-upload", {
            blogBucket,
            configsBucket,
            staticBucket,
            rdsDbHost: this.rdsHost,
            rdsDbUserName: this.rdsDbUserName,
            rdsDbPassword: this.rdsDbPassword,
            rdsDbName: this.rdsDbName,
            rdsSecurityGroupId: this.rdsSecurityGroupId,
            ghostHostingUrl: this.userInput.ghostHostingUrl,
            hostStaticWebsite: this.userInput.hostStaticWebsite
        }).perform();
    }

    _createIamRolePolicies(blogBucket: S3Bucket, configsBucket: S3Bucket) {
        return new IamResource(this, "plg-gh-iam", {
            blogBucket,
            configsBucket
        }).perform();
    }

    /**
     * Create ECS container, cluster, task-definition, service and task in EC2-ECS optimised instance
     *
     * @param albSecurityGroupId
     * @param targetGroup
     * @param customExecutionRoleArn
     * @param customTaskRoleArn
     * @param configBucket
     * @param ghostEnvUpload
     * @param nginxEnvUpload
     * @private
     */
    _createEcs(
        albSecurityGroupId: string,
        targetGroup: AlbTargetGroup,
        customExecutionRoleArn: string,
        customTaskRoleArn: string,
        configBucket: S3Bucket,
        ghostEnvUpload: S3BucketObject,
        nginxEnvUpload: S3BucketObject
    ) {
        return new EcsResource(this, "plg-gh-ecs", {
            vpcId: this.vpcId,
            subnets: this.vpcSubnets,
            dbInstanceEndpoint: this.rdsHost,
            albSecurityGroupId,
            targetGroup,
            rdsSecurityGroupId: this.rdsSecurityGroupId,
            customExecutionRoleArn,
            customTaskRoleArn,
            configBucket,
            ghostEnvUpload,
            nginxEnvUpload
        }).perform();
    }
}

const app = new App();
new GhostStack(app, "plg-ghost")
    .perform()
    .then()
    .catch((err) => {
        console.error('GhostStack Error: ', err);
        process.exit(1);
    });

app.synth();
