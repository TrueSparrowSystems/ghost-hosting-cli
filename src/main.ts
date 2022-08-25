import { Construct } from "constructs";
import { App, TerraformStack, Fn, TerraformOutput } from "cdktf";
import { AwsProvider } from "@cdktf/provider-aws";

import { VpcResource } from "./vpc";
import { RdsResource } from "./rds";
import { EcsResource} from "./ecs";
import { AlbResource } from "./alb";
import { S3Resource } from "./s3";
import { IamResource } from "./iam";
import { AcmResource } from "./acm";

import { readInput } from "../lib/readInput";
import { AlbTargetGroup } from "../.gen/providers/aws/elb";
import { S3Bucket, S3BucketObject } from "../.gen/providers/aws/s3";
import { RandomProvider } from "../.gen/providers/random";
import { File, LocalProvider } from "../.gen/providers/local";

const ecsConfig = require("../config/ecs.json");

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

        const certificateArn = this._createAcmCertificate();

        const { alb, targetGroup } = this._createAlb(certificateArn);

        const { blogBucket, staticBucket, configsBucket } = this._createS3Buckets();

        const { ecsEnvUploadS3, nginxEnvUploadS3 } = this._s3EnvUpload(
            blogBucket,
            configsBucket,
            staticBucket
        );

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
            ecsEnvUploadS3,
            nginxEnvUploadS3
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
            certificateArn: certificateArn
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

    _s3EnvUpload(
        blogBucket: S3Bucket,
        configsBucket: S3Bucket,
        staticBucket: S3Bucket
    ) {
        // upload ghost env
        const ecsEnvFileContent = `database__client=mysql\ndatabase__connection__host=${this.rdsHost}\ndatabase__connection__user=${this.rdsDbUserName}\ndatabase__connection__password=${this.rdsDbPassword}\ndatabase__connection__database=${this.rdsDbName}\nstorage__active=s3\nstorage__s3__region=${this.userInput.aws.awsDefaultRegion}\nstorage__s3__bucket=${blogBucket.bucket}\nstorage__s3__pathPrefix=blog/images\nstorage__s3__acl=public-read\nstorage__s3__forcePathStyle=true\nurl=${this.userInput.ghostHostingUrl}`;

        const ecsEnvFile = new File(this, "plg-gh-ecs-configs", {
            filename: "ghost.env",
            content: ecsEnvFileContent,
            dependsOn: [configsBucket]
        });

        const ecsEnvUploadS3 = new S3BucketObject(this, "plg-gh-ecs-env", {
            key: "ghost.env",
            bucket: configsBucket.bucket,
            acl: "private",
            source: "ghost.env",
            dependsOn: [ecsEnvFile]
        });

        // upload nginx env
        const nginxEnvFileContent = `GHOST_SERVER_NAME=ghost\nGHOST_STATIC_SERVER_NAME=ghost-static\nPROXY_PASS_HOST=127.0.0.1\nPROXY_PASS_PORT=${ecsConfig.ghostContainerPort}\nS3_STATIC_BUCKET_HOST=${staticBucket.bucketDomainName}\nS3_STATIC_BUCKET=${staticBucket.bucket}`;

        const nginxEnvFile = new File(this, "plg-gh-nginx-configs", {
            filename: "nginx.env",
            content: nginxEnvFileContent,
            dependsOn: [configsBucket, staticBucket]
        });

        const nginxEnvUploadS3 = new S3BucketObject(this, "plg-gh-nginx-env", {
            key: "nginx.env",
            bucket: configsBucket.bucket,
            acl: "private",
            source: "nginx.env",
            dependsOn: [nginxEnvFile]
        });

        return { ecsEnvUploadS3, nginxEnvUploadS3 };
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
     * @param ecsEnvUploadS3
     * @param nginxEnvUploadS3
     * @private
     */
    _createEcs(
        albSecurityGroupId: string,
        targetGroup: AlbTargetGroup,
        customExecutionRoleArn: string,
        customTaskRoleArn: string,
        configBucket: S3Bucket,
        ecsEnvUploadS3: S3BucketObject,
        nginxEnvUploadS3: S3BucketObject
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
            ecsEnvUploadS3,
            nginxEnvUploadS3
        }).perform();
    }
}

const app = new App();
new GhostStack(app, "plg-ghost")
    .perform()
    .then()
    .catch(function (err) {
        console.error('GhostStack Error: ', err);
        process.exit(1);
    });

app.synth();
