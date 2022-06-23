import { Construct } from "constructs";
import { App, TerraformStack, Fn } from "cdktf";
import { AwsProvider } from "@cdktf/provider-aws";
import { Vpc } from '../gen/modules/vpc';
import { Rds } from '../gen/modules/rds';
import { SecurityGroup } from '../gen/modules/security-group';

import {
    EcsTaskDefinition,
    EcsCluster,
    EcsService,
} from "../gen/providers/aws/ecs";
import {
    IamRole,
    IamRolePolicyAttachment,
    IamPolicy
} from '../gen/providers/aws/iam';

import { readInput } from "../lib/readInput";
import {
    getPublicSubnetCidrBlocks,
    getPrivateSubnetCidrBlocks
} from '../lib/util';

const cidrPrefix = "10.0.0.0/16";
const vpcName = "PLG Ghost VPC";
const rdsName = "plg-ghost-rds";
const securityGroup = "plg-gh-sg";

/**
 * Terraform stack
 */
class MyStack extends TerraformStack {
    userInput: any;
    vpcOutput: Vpc | {
        vpcIdOutput: string
        privateSubnetsOutput: string[]
    };
    securityGroupOutput: SecurityGroup | {
        thisSecurityGroupIdOutput: string
    };
    iamRole: IamRole | {

    };

    /**
     * Constructor for the terraform stack
     *
     * @param {Construct} scope
     * @param {string} name
     */
    constructor(scope: Construct, name: string) {
        super(scope, name);

        this.userInput = {};
        this.vpcOutput = {
            vpcIdOutput: '',
            privateSubnetsOutput: []
        };
        this.securityGroupOutput = {
            thisSecurityGroupIdOutput: ''
        };
        this.iamRole = {};
    }

    /**
     * Main performer of the class.
     *
     */
    async perform() {
        this.userInput = readInput();

        this._setAwsProvider();

        this._createVpc();

        this._createSecurityGroup();

        // this._createRdsInstance();

        this._createIamRoleAndPolicy();

        // this._performEcsOperations();
    }

    /**
     * Set AWS provider
     *
     * @private
     */
    _setAwsProvider() {
        new AwsProvider(this, "AWS", {
            region: this.userInput.aws.awsDefaultRegion,
            accessKey: this.userInput.aws.awsAccessKeyId,
            secretKey: this.userInput.aws.awsSecretAccessKey
        });
    }

    /**
     * Create VPC
     *
     * @sets this.vpcOutput - output from the created vpc
     * @private
     */
    _createVpc() {
        const privateSubnetCidrBlocks = getPrivateSubnetCidrBlocks(
            cidrPrefix,
            2,
            2
        );

        const vpcOptions = {
            name: vpcName,
            azs: ["us-east-1a", "us-east-1b"],
            cidr: cidrPrefix,
            publicSubnets: getPublicSubnetCidrBlocks(cidrPrefix),
            publicSubnetTags: {
                "Name": vpcName + " public"
            },
            privateSubnets: privateSubnetCidrBlocks,
            privateSubnetTags: {
                "Name": vpcName + " private"
            },
            enableNatGateway: true,
            singleNatGateway: true,
            enableDnsHostnames: true
        };

        this.vpcOutput = new Vpc(this, vpcName, vpcOptions);
    }

    /**
     * Create vpc security group
     *
     * @sets this.securityGroupOutput - output of the created security group
     * @private
     */
    _createSecurityGroup() {
        this.securityGroupOutput = new SecurityGroup(this, securityGroup, {
            name: "PLG Ghost VPC Security Group",
            description: "Security Group managed by Terraform",
            vpcId: this.vpcOutput.vpcIdOutput,
            useNamePrefix: false
        });
    }

    /**
     * Create RDS MySQL instance
     *
     * @private
     */
    _createRdsInstance() {
        const rdsOptions = {
            identifier: rdsName,
            engine: "mysql",
            engineVersion: "5.7",
            allocatedStorage: "10",
            name: "testDb",
            username: "username",
            password: "password",
            availabilityZone: "us-east-1a",
            instanceClass: "db.t3.micro",
            subnetIds: Fn.tolist(this.vpcOutput.privateSubnetsOutput),
            createDbSubnetGroup: true,
            majorEngineVersion: "5.7",
            parameterGroupName: "parameter-group-test-terraform",
            parameterGroupDescription: "Parameter group for plg cdk",
            family: "mysql5.7",
            optionGroupName: "option-group-test-terraform",
            dbSubnetGroupName: "db-group-test-terraform",
            dbSubnetGroupUseNamePrefix: false,
            parameterGroupUseNamePrefix: false,
            optionGroupUseNamePrefix: false,
            vpcSecurityGroupIds: [this.securityGroupOutput.thisSecurityGroupIdOutput]
        };

        new Rds(this, rdsName, rdsOptions);
    }

    /**
     * Create IAM role and policy for ECS tasks
     *
     * @private
     */
    async _createIamRoleAndPolicy() {
        const iamRole = this._createIamRole();

        const iamPolicy = this._createIamPolicy();

        this._attachIamRoleAndPolicy(iamRole, iamPolicy);
    }

    /**
     * Create IAM role
     *
     * @private
     */
    _createIamRole(): IamRole {
        return new IamRole(this, "plg-gh-ecs-iam-role", {
            name: "plg-gh-ecs-iam-role",
            assumeRolePolicy: Fn.jsonencode({
                "Version": "2012-10-17",
                "Statement": [
                    {
                        "Action": "sts:AssumeRole",
                        "Principal": {
                            "Service": "ecs.amazonaws.com"
                        },
                        "Effect": "Allow",
                        "Sid": ""
                    }
                ]
            })
        });
    }

    /**
     * Create IAM policy
     *
     * @private
     */
    _createIamPolicy(): IamPolicy {
        const iamPolicyConfig = {
            name: "plg-gh-iam-policy",
            policy: Fn.jsonencode({
                "Version": "2012-10-17",
                "Statement": [
                    {
                        "Effect": "Allow",
                        "Action": [
                            "ecr:GetAuthorizationToken",
                            "ecr:BatchCheckLayerAvailability",
                            "ecr:GetDownloadUrlForLayer",
                            "ecr:BatchGetImage",
                            "logs:CreateLogStream",
                            "logs:PutLogEvents"
                        ],
                        "Resource": "*"
                    }
                ]
            })
        };

        return new IamPolicy(this, "plg-gh-iam-policy", iamPolicyConfig);
    }

    /**
     * Attach IAM role and IAM policy
     *
     * @param iamRole
     * @param iamPolicy
     * @private
     */
    _attachIamRoleAndPolicy(iamRole: IamRole, iamPolicy: IamPolicy) {
        new IamRolePolicyAttachment(this, "plg-gh-policy-attachment", {
            role: iamRole.name,
            policyArn: iamPolicy.arn
        });
    }

    /**
     * Perform ECS operations - create cluster, add task definition and service
     *
     * @private
     */
    _performEcsOperations() {
        const ecsCluster = this._createEcsCluster();

        const ecsTaskDefinition = this._createEcsTaskDefinition();

        this._createEcsService();
    }

    /**
     * Create ECS cluster
     * @private
     */
    _createEcsCluster(): EcsCluster {
        return new EcsCluster(this, 'plg-gh-ecs-cluster', {
            name: "plg-gh-ecs-cluster",
        });
    }

    /**
     * Create ECS task definition
     *
     * @private
     */
    _createEcsTaskDefinition(): EcsTaskDefinition {
        return new EcsTaskDefinition(this, "ecs-task-definition", {
            family: "service",
            cpu: "256",
            networkMode: "awsvpc",
            containerDefinitions: Fn.jsonencode(
                [
                    {
                        "name": "iis",
                        "image": "",
                        "cpu": 1024,
                        "memory": 2048,
                        "essential": true
                    }
                ]
            )
        });
    }

    /**
     * Create ECS service
     *
     * @private
     */
    _createEcsService() {
        new EcsService(this, "plg-gh-ecs-service", {
            name: "plg-gh-ecs-service",
            iamRole: Fn.jsonencode(this.iamRole)
        })
    }
}

const app = new App();
new MyStack(app, "plg-gh")
    .perform()
    .then()
    .catch();

app.synth();
