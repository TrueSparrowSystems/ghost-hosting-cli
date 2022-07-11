import { Construct } from "constructs";
import { App, TerraformStack, Fn, TerraformOutput } from "cdktf";
import { AwsProvider, datasources } from "@cdktf/provider-aws";
import { Vpc } from '../gen/modules/vpc';
import { Rds } from '../gen/modules/rds';
import { Alb } from '../gen/modules/alb';
import { SecurityGroup } from '../gen/modules/security-group';

import { DataAwsAmi } from '../.gen/providers/aws/ec2';
import {
    EcsTaskDefinition,
    EcsCluster,
    EcsService
} from "../gen/providers/aws/ecs";
import {
    IamRole,
    IamRolePolicyAttachment,
    IamInstanceProfile
} from '../gen/providers/aws/iam';

import { Instance } from '../.gen/providers/aws/ec2';

import { readInput } from "../lib/readInput";
import {
    getPublicSubnetCidrBlocks,
    getPrivateSubnetCidrBlocks
} from '../lib/util';

const cidrPrefix = "23.0.0.0/16";
const nameLabel = "PLG Ghost Test";
const nameIdentifier = "plg-ghost-test";
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
    dbInstanceEndpointOutput: string;
    instanceProfile: IamInstanceProfile | {
        name: ''
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
        this.dbInstanceEndpointOutput = '';
        this.instanceProfile = {
            name: ''
        };
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

        this._performEcsOperations();

        // this._setupAlb();
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
        const securityGroupOutput = new SecurityGroup(this, 'vpc_sg', {
            name: "PLG Ghost VPC Security Group",
            description: "Security Group managed by Terraform",
            vpcId: this.vpcOutput.vpcIdOutput,
            useNamePrefix: false,
            ingressCidrBlocks: ["0.0.0.0/0"],
            ingressRules: [
                "ssh-tcp"
            ],
            egressRules: ["all-all"]
        });

        this.securityGroupOutput = {
            thisSecurityGroupIdOutput: securityGroupOutput.thisSecurityGroupIdOutput
        };
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
            engineVersion: "8.1",
            allocatedStorage: "10",
            name: "test_db",
            username: "username",
            password: "password",
            availabilityZone: "us-east-1a",
            instanceClass: "db.t3.micro",
            subnetIds: Fn.tolist(this.vpcOutput.privateSubnetsOutput),
            createDbSubnetGroup: true,
            majorEngineVersion: "8.1",
            parameterGroupName: "parameter-group-test-terraform",
            parameterGroupDescription: "Parameter group for plg cdk",
            family: "mysql8.1",
            optionGroupName: "option-group-test-terraform",
            dbSubnetGroupName: "db-group-test-terraform",
            dbSubnetGroupUseNamePrefix: false,
            parameterGroupUseNamePrefix: false,
            optionGroupUseNamePrefix: false,
            vpcSecurityGroupIds: [rdsSg.thisSecurityGroupIdOutput]
        };

        const rdsOutput = new Rds(this, 'rds', rdsOptions);
        this.dbInstanceEndpointOutput = rdsOutput.dbInstanceEndpointOutput;
    }

    /**
     * Create IAM role and policy for ECS tasks
     *
     * @private
     */
    async _createIamRoleAndPolicy() {
        const ecsInstanceRole = this._createEcsInstanceRole();

        // const ecsInstancePolicy = this._createEcsInstancePolicy();

        this._attachIamRoleAndPolicy(
            ecsInstanceRole,
            "ecs-instance-role-policy-attachment"
        );

        // Create IAM instance profile
        this.instanceProfile = this._createEcsInstanceProfile(ecsInstanceRole);
    }

    _createEcsInstanceRole() {
        return new IamRole(this, "plg-gh-ecs-instance-role", {
            name: "plg-gh-ecs-instance-role",
            assumeRolePolicy: Fn.jsonencode({
                "Version": "2012-10-17",
                "Statement": [
                    {
                        "Action": "sts:AssumeRole",
                        "Principal": {
                            "Service": "ec2.amazonaws.com"
                        },
                        "Effect": "Allow",
                        "Sid": ""
                    }
                ]
            })
        });
    }

    _createEcsInstanceProfile(ecsInstanceRole: IamRole) {
        return new IamInstanceProfile(this, "ecs-instance-profile", {
            name: "ecs-instance-profile",
            path: "/",
            role: ecsInstanceRole.id
        })
    }

    /**
     * Attach IAM role and IAM policy
     *
     * @param iamRole
     * @param attachmentId
     * @private
     */
    _attachIamRoleAndPolicy(iamRole: IamRole, attachmentId: string) {
        new IamRolePolicyAttachment(this, attachmentId, {
            role: iamRole.name,
            policyArn: "arn:aws:iam::aws:policy/service-role/AmazonEC2ContainerServiceforEC2Role"
        });
    }

    /**
     * Perform ECS operations - create cluster, add task definition and service
     *
     * @private
     */
    _performEcsOperations() {
        const ec2EcsInstance = this._createEC2ECSInstance();

        const ecsCluster = this._createEcsCluster();

        const ecsTaskDefinition = this._createEcsTaskDefinition();

        const ecsService = this._createEcsService(ecsCluster, ecsTaskDefinition);

        // this._createEcsTaskSet(ecsCluster, ecsTaskDefinition, ecsService);
    }

    _createEC2ECSInstance() {
        const dataAwsAmiOutput = new DataAwsAmi(this, "data-aws-ami", {
            mostRecent: true,
            owners: ["amazon"],
            filter: [{
                name: "name",
                values: ["amzn2-ami-ecs-hvm-2.0.202*-x86_64-ebs"]
            }]
        });

        const subnetId = Fn.element(Fn.tolist(this.vpcOutput.publicSubnetsOutput), 0);
        return new Instance(this, "ec2-ecs-instance", {
            ami: dataAwsAmiOutput.id,
            subnetId,
            instanceType: "t3.micro",
            ebsOptimized: true,
            userData: "#!/bin/bash \n" +
                "cat <<'EOF' >> /etc/ecs/ecs.config \n" +
                "ECS_CLUSTER=plg-gh-ecs-cluster \n" +
                "EOF",
            iamInstanceProfile: this.instanceProfile.name,
            securityGroups: [this.securityGroupOutput.thisSecurityGroupIdOutput],
            tags: {
                Name: "Test EC2 ECS instance"
            },
            keyName: "infra" // TODO: remove this later,
        });
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
                // provisionedVia
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
            family: "ghost-task-def",
            memory: "512",
            cpu: "256",
            networkMode: "bridge",
            requiresCompatibilities: ["EC2"],
            executionRoleArn: '',
            taskRoleArn: '', // TODO - add here
            volume: [
                {
                    name: "ghost",
                    hostPath: "/mnt/ghost"
                }
            ],
            containerDefinitions: Fn.jsonencode(
                [
                    {
                        "name": "ghost",
                        "image": ghostImageUri,
                        "cpu": 0,
                        "memory": null,
                        "essential": true,
                        "entryPoint": [ "sh", "-c" ],
                        "command": [
                            // TODO: add command
                        ],
                        "portMappings": [
                            {
                                "hostPort": 2368,
                                "containerPort": 2368,
                                "protocol": "tcp"
                            }
                        ],
                        "environment": [
                            {
                                "name": "database__client",
                                "value": "mysql"
                            },
                            {
                                "name": "database__connection__database",
                                "value": "test_db"
                            },
                            {
                                "name": "database__connection__host",
                                "value": this.dbInstanceEndpointOutput
                            },
                            {
                                "name": "database__connection__password",
                                "value": "password"
                            },
                            {
                                "name": "database__connection__user",
                                "value": "username"
                            }
                        ],
                        "mountPoints": [
                            {
                                "readOnly": null,
                                "containerPath": "/var/lib/ghost/content",
                                "sourceVolume": "ghost"
                            }
                        ],
                        "logConfiguration": {
                            "logDriver": "awslogs",
                            "secretOptions": null,
                            "options": {
                                "awslogs-group": "/ecs/ghost",
                                "awslogs-region": "us-east-1",
                                "awslogs-stream-prefix": "ecs"
                            }
                        },
                    },
                    {
                        "name": "nginx",
                        "image": nginxImageUri,
                        "cpu": 0,
                        "memory": null,
                        "essential": true,
                        "portMappings": [
                            {
                                "hostPort": 80,
                                "protocol": "tcp",
                                "containerPort": 80
                            }
                        ],
                        "links": [
                            "ghost"
                        ],
                        "dependsOn": [
                            {
                                "containerName": "ghost",
                                "condition": "START"
                            }
                        ],
                        "logConfiguration": {
                            "logDriver": "awslogs",
                            "secretOptions": null,
                            "options": {
                                "awslogs-group": "/ecs/ghost",
                                "awslogs-region": "us-east-1",
                                "awslogs-stream-prefix": "ecs"
                            }
                        },
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
    _createEcsService(ecsCluster: EcsCluster, ecsTaskDefinition: EcsTaskDefinition): EcsService {
        return new EcsService(this, "plg-gh-ecs-service", {
            name: "plg-gh-ecs-service",
            cluster: ecsCluster.arn,
            taskDefinition: ecsTaskDefinition.arn,
            launchType: "EC2"
        })
    }
}

const app = new App();
new MyStack(app, "plg-gh")
    .perform()
    .then()
    .catch();

app.synth();
