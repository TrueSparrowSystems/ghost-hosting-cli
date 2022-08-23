import { Construct } from "constructs";
import { App, TerraformStack, Fn } from "cdktf";
import { AwsProvider } from "@cdktf/provider-aws";
import { Vpc } from "../.gen/modules/vpc";

import { VpcResource } from "./vpc";
import { RdsResource } from "./rds";
import { EcsResource} from "./ecs";
import { AlbResource } from "./alb";
import { S3Resource } from "./s3";
import { IamResource } from "./iam";

import { Rds } from "../.gen/modules/rds";

import { readInput } from "../lib/readInput";
import { AlbTargetGroup } from "../.gen/providers/aws/elb";
import { S3Bucket, S3BucketObject } from "../.gen/providers/aws/s3";
import { RandomProvider } from "../.gen/providers/random";
import { File, LocalProvider } from "../.gen/providers/local";

const rdsConfig = require("../config/rds.json");
const ecsConfig = require("../config/ecs.json");

/**
 * Terraform stack
 */
class MyStack extends TerraformStack {
    userInput: any;

    /**
     * Constructor for the terraform stack
     *
     * @param {Construct} scope
     * @param {string} name
     */
    constructor(scope: Construct, name: string) {
        super(scope, name);

        this.userInput = {};
    }

    /**
     * Main performer of the class.
     */
    async perform() {
        this.userInput = readInput();

        this._setProviders();

        const { vpc, vpcSg } = this._createVpc();

        const { rds, rdsSg } = this._createRdsInstance(vpc);

        const { alb, targetGroup } = this._createAlb(vpc);

        const { blogBucket, staticBucket, configsBucket } = this._createS3Buckets(vpc);

        const { ecsEnvUploadS3, nginxEnvUploadS3 } = this._s3EnvUpload(
            rds,
            blogBucket,
            configsBucket,
            staticBucket,
            alb.dnsName
        );

        const { customExecutionRole, customTaskRole } = this._createIamRolePolicies(
            blogBucket,
            configsBucket
        );

        const albSecurityGroupId = alb.securityGroups[0];

        this._createEcs(
            vpc.vpcIdOutput,
            vpc.privateSubnetsOutput,
            vpcSg.id,
            rds.dbInstanceAddressOutput,
            albSecurityGroupId,
            targetGroup,
            alb.dnsName,
            rdsSg.id,
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
        return new VpcResource(this, "plg-gh-vpc", {}).perform();
    }

    /**
     * Create aws rds instance in private subnet.
     *
     * @param vpc
     * @private
     */
    _createRdsInstance(vpc: Vpc) {
        return new RdsResource(this, "plg-gh-rds", {
            vpcId: vpc.vpcIdOutput,
            privateSubnets: Fn.tolist(vpc.privateSubnetsOutput),
            publicSubnets: Fn.tolist(vpc.publicSubnetsOutput)
        }).perform();
    }

    /**
     * Create application load balancer
     *
     * @param vpc
     * @private
     */
    _createAlb(vpc: Vpc) {
        return new AlbResource(this, "plg-gh-alb", {
            vpcId: vpc.vpcIdOutput,
            publicSubnets: Fn.tolist(vpc.publicSubnetsOutput),
            isExistingAlb: false,
            listenerArn: "",
            isConfiguredDomain: ""
        }).perform();
    }

    /**
     * Create required s3 buckets
     *
     * @private
     */
    _createS3Buckets(vpc: Vpc) {
        return new S3Resource(this, "plg-gh-s3", { vpcId: vpc.vpcIdOutput }).perform();
    }

    _s3EnvUpload(
        rds: Rds,
        blogBucket: S3Bucket,
        configsBucket: S3Bucket,
        staticBucket: S3Bucket,
        albDnsName: string
    ) {
        // upload ecs env
        const ecsEnvFileContent = `database__client=mysql\ndatabase__connection__host=${rds.dbInstanceAddressOutput}\ndatabase__connection__user=${rdsConfig.dbUserName}\ndatabase__connection__password=${rds.password}\ndatabase__connection__database=${rdsConfig.dbName}\nstorage__active=s3\nstorage__s3__accessKeyId=${this.userInput.aws.awsAccessKeyId}\nstorage__s3__secretAccessKey=${this.userInput.aws.awsSecretAccessKey}\nstorage__s3__region=${this.userInput.aws.awsDefaultRegion}\nstorage__s3__bucket=${blogBucket.bucket}\nstorage__s3__pathPrefix=blog/images\nstorage__s3__acl=public-read\nstorage__s3__forcePathStyle=true\nurl=${"http://" + albDnsName}`;

        const ecsEnvFile = new File(this, "plg-gh-ecs-configs", {
            filename: "ecs.env",
            content: ecsEnvFileContent,
            dependsOn: [configsBucket]
        });

        const ecsEnvUploadS3 = new S3BucketObject(this, "plg-gh-ecs-env", {
            key: "ecs.env",
            bucket: configsBucket.bucket,
            acl: "private",
            source: "./ecs.env",
            dependsOn: [ecsEnvFile]
        });

        // upload nginx env
        // const s3StaticHost = "https://" + staticBucket.bucketDomainName;
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
            source: "./nginx.env",
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
     * @param vpcId
     * @param subnets
     * @param securityGroupId
     * @param dbInstanceAddress
     * @param albSecurityGroupId
     * @param targetGroup
     * @param albDnsName
     * @param rdsSecurityGroupId
     * @param customExecutionRoleArn
     * @param customTaskRoleArn
     * @param configBucket
     * @param ecsEnvUploadS3
     * @param nginxEnvUploadS3
     * @private
     */
    _createEcs(
        vpcId: string,
        subnets: string,
        securityGroupId: string,
        dbInstanceAddress: string,
        albSecurityGroupId: string,
        targetGroup: AlbTargetGroup,
        albDnsName: string,
        rdsSecurityGroupId: string,
        customExecutionRoleArn: string,
        customTaskRoleArn: string,
        configBucket: S3Bucket,
        ecsEnvUploadS3: S3BucketObject,
        nginxEnvUploadS3: S3BucketObject
    ) {
        return new EcsResource(this, "plg-gh-ecs", {
            vpcId,
            subnets: Fn.tolist(subnets),
            vpcSecurityGroupId: securityGroupId,
            dbInstanceEndpoint: dbInstanceAddress,
            albSecurityGroupId,
            targetGroup,
            albDnsName,
            rdsSecurityGroupId,
            customExecutionRoleArn,
            customTaskRoleArn,
            configBucket,
            ecsEnvUploadS3,
            nginxEnvUploadS3
        }).perform();
    }
}

const app = new App();
new MyStack(app, "plg-ghost")
    .perform()
    .then()
    .catch();

app.synth();
