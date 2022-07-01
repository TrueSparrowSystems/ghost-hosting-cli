import { Construct } from "constructs";
import { App, TerraformStack, Fn, TerraformOutput } from "cdktf";
import { AwsProvider, datasources } from "@cdktf/provider-aws";
import { Vpc } from '../gen/modules/vpc';
import { Rds } from '../gen/modules/rds';
import { Alb } from '../gen/modules/alb';
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
const nameLabel = "PLG Ghost";
const nameIdentifier = "plg-ghost";
const ghostImageUri = "docker.io/ghost:alpine";
const nginxImageUri = "public.ecr.aws/j0d2y7t1/plg-nginx-ghost:latest";

/**
 * Terraform stack
 */
class MyStack extends TerraformStack {
    userInput: any;
    vpcOutput: Vpc | {
        vpcIdOutput: string
        privateSubnetsOutput: string[]
        publicSubnetsOutput: string[]
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
            privateSubnetsOutput: [],
            publicSubnetsOutput: []
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

        // this._createSecurityGroup();

        // this._createRdsInstance();

        this._createIamRoleAndPolicy();

        // this._performEcsOperations();

        this._setupAlb();
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

        const zones = new datasources.DataAwsAvailabilityZones(this, 'zones', {
            state: 'available'
        });

        new TerraformOutput(this, "first_zone", {
            value: Fn.element(zones.names, 0)
        });

        new TerraformOutput(this, "second_zone", {
            value: Fn.element(zones.names, 1)
        });

        const vpcOptions = {
            name: nameLabel,
            azs: [Fn.element(zones.names, 0), Fn.element(zones.names, 1)],
            cidr: cidrPrefix,
            publicSubnets: getPublicSubnetCidrBlocks(cidrPrefix),
            publicSubnetTags: {
                "Name": nameLabel + " public"
            },
            privateSubnets: privateSubnetCidrBlocks,
            privateSubnetTags: {
                "Name": nameLabel + " private"
            },
            enableNatGateway: true,
            singleNatGateway: true,
            enableDnsHostnames: true
        };

        this.vpcOutput = new Vpc(this, nameIdentifier, vpcOptions);
    }

    /**
     * Create vpc security group
     *
     * @sets this.securityGroupOutput - output of the created security group
     * @private
     */
    _createSecurityGroup() {
        this.securityGroupOutput = new SecurityGroup(this, 'rds_sg', {
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

        const rdsSg = new SecurityGroup(this, 'rds_sg', {
            name: 'rds-sg',
            description: 'Firewall for RDS instance',
            vpcId: this.vpcOutput.vpcIdOutput,
            useNamePrefix: false,
            ingressRules: ["mysql-tcp"],
            ingressCidrBlocks: [cidrPrefix],
            egressRules: ["all-all"],
            tags: {
                'Name': nameLabel
            }
        });

        const rdsOptions = {
            identifier: nameIdentifier,
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
            vpcSecurityGroupIds: [rdsSg.thisSecurityGroupIdOutput]
        };

        new Rds(this, 'rds', rdsOptions);
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

        this._createEcsService(ecsCluster, ecsTaskDefinition);
    }

    /**
     * Setup ALB - create ALB with listeners and target groups
     *
     * @private
     */
    _setupAlb() {
        // Security group for ALB
        const albSg = new SecurityGroup(this, 'alb_sg', {
            name: 'alb-sg',
            description: 'Firewall for internet traffic',
            vpcId: this.vpcOutput.vpcIdOutput,
            useNamePrefix: false,
            ingressRules: ["https-443-tcp", "http-80-tcp"],
            ingressCidrBlocks: ["0.0.0.0/0"],
            egressRules: ["all-all"],
            tags: {
                'Name': nameLabel
            }
        });

        new Alb(this, 'alb', {
            name: nameIdentifier,
            loadBalancerType: 'application',
            vpcId: this.vpcOutput.vpcIdOutput,
            subnets: Fn.tolist(this.vpcOutput.publicSubnetsOutput),
            securityGroups: [albSg.thisSecurityGroupIdOutput],
            tags: {
                'Name': nameLabel
            }
        });
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
                        "name": "ghost-container",
                        "image": ghostImageUri,
                        "cpu": 4,
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
    _createEcsService(ecsCluster: EcsCluster, ecsTaskDefinition: EcsTaskDefinition) {
        new EcsService(this, "plg-gh-ecs-service", {
            name: "plg-gh-ecs-service",
            cluster: ecsCluster.arn,
            taskDefinition: ecsTaskDefinition.arn
        })
    }
}

const app = new App();
new MyStack(app, "plg-gh")
    .perform()
    .then()
    .catch();

app.synth();
