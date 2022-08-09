import { Resource, Fn } from "cdktf";
import { Construct } from "constructs";
import { IamInstanceProfile, IamPolicy, IamRole, IamRolePolicyAttachment} from "../.gen/providers/aws/iam";
import { DataAwsAmi, Instance } from "../.gen/providers/aws/ec2";
import { EcsCluster, EcsService, EcsTaskDefinition } from "../.gen/providers/aws/ecs";
import { SecurityGroup, SecurityGroupRule } from "../.gen/providers/aws/vpc";
import { CloudwatchLogGroup } from "../.gen/providers/aws/cloudwatch";

const ecsConfig = require("../config/ecs.json");
const rdsConfig = require("../config/rds.json");

const plgTags = {
    Name: "PLG Ghost"
};

interface Options {
    vpcId: string,
    subnets: string[],
    vpcSecurityGroupId: string,
    dbInstanceEndpoint: string,
    albSecurityGroupId: string,
    targetGroupArn: string,
    albDnsName: string,
    rdsSecurityGroupId: string
}

/**
 * Class to deploy ECS tasks.
 */
class EcsResource extends Resource {
    options: Options;

    constructor(scope: Construct, name: string, options: Options) {
        super(scope, name);

        this.options = options;
    }

    /**
     * Main performer.
     */
    perform() {
        // const instanceProfile = this._performEcsInstanceRoleAndProfile();

        this._createLogGroup();

        const ecsSg = this._createSecurityGroup();

        // const ec2Instance = this._createEC2ECSInstance(instanceProfile, ecsSecurityGroup);

        const ecsCluster = this._createEcsCluster();

        const executionRole = this._createAndAttachEcsExecutionRole();

        const taskRole = this._createAndAttachEcsTaskRole();

        const ecsTaskDefinition = this._createEcsTaskDefinition(executionRole, taskRole);

        this._createEcsService(ecsCluster, ecsTaskDefinition, ecsSg);
    }

    /**
     * Create ecs instance role and profile with AmazonEC2ContainerServiceforEC2Role policy,
     *
     * @private
     */
    _performEcsInstanceRoleAndProfile() {
        const ecsInstanceRole = this._createEcsInstanceRole();

        new IamRolePolicyAttachment(this, "ecs-instance-role-attachment", {
            role: ecsInstanceRole.name,
            policyArn: "arn:aws:iam::aws:policy/service-role/AmazonEC2ContainerServiceforEC2Role",
        });

        return this._createEcsInstanceProfile(ecsInstanceRole);
    }

    /**
     * Create role for ecs instance.
     *
     * @private
     */
    _createEcsInstanceRole() {
        return new IamRole(this, "ecs-instance-role", {
            name: ecsConfig.nameIdentifier + "-instance-role",
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
            }),
            tags: plgTags
        });
    }

    /**
     * Create instance profile for EC2 ECS optimised instance.
     *
     * @param ecsInstanceRole
     * @private
     */
    _createEcsInstanceProfile(ecsInstanceRole: IamRole) {
        return new IamInstanceProfile(this, "ecs-instance-profile", {
            name: ecsConfig.nameIdentifier,
            path: "/",
            role: ecsInstanceRole.id,
            tags: plgTags
        });
    }

    /**
     * Create security group for ecs - this will allow traffic to ECS from ALB only.
     *
     * @private
     */
    _createSecurityGroup() {
        const ecsSg = new SecurityGroup(this, "plg-gh-ecs", {
            name: "plg-gh-ecs-security-group",
            description: "Firewall for ECS traffic",
            vpcId: this.options.vpcId,
            ingress: [
                {
                    description: "Traffic to ECS",
                    fromPort: ecsConfig.containerPort,
                    toPort: ecsConfig.containerPort,
                    protocol: "tcp",
                    securityGroups: [this.options.albSecurityGroupId]
                }
            ],
            egress: [
                {
                    fromPort: 0,
                    toPort: 0,
                    protocol: "-1",
                    cidrBlocks: ["0.0.0.0/0"]
                }
            ],
            tags: plgTags
        });

        // Allow DB connection
        new SecurityGroupRule(this, "rds_sg_rule", {
            type: "ingress",
            fromPort: 3306,
            toPort: 3306,
            protocol: "tcp",
            securityGroupId: this.options.rdsSecurityGroupId,
            sourceSecurityGroupId: ecsSg.id
        });

        return ecsSg;
    }

    /**
     * Create EC2 ECS optimised instance for ECS container.
     *
     * @param instanceProfile
     * @param ecsSecurityGroup
     * @private
     */
    _createEC2ECSInstance(instanceProfile: IamInstanceProfile, ecsSecurityGroup: SecurityGroup) {
        const dataAwsAmiOutput = new DataAwsAmi(this, "data-aws-ami", {
            mostRecent: true,
            owners: ["amazon"],
            filter: [{
                name: "name",
                values: ["amzn2-ami-ecs-hvm-2.0.202*-x86_64-ebs"]
            }]
        });

        const privateSubnetId = Fn.element(this.options.subnets, 0);
        return new Instance(this, "ec2-ecs-instance", {
            ami: dataAwsAmiOutput.id,
            subnetId: privateSubnetId,
            instanceType: "t3.small",
            ebsOptimized: true,
            securityGroups: [ecsSecurityGroup.id],
            userData: "#!/bin/bash \n" +
                "cat <<'EOF' >> /etc/ecs/ecs.config \n" +
                "ECS_CLUSTER=plg-gh-ecs-cluster \n" +
                "EOF",
            iamInstanceProfile: instanceProfile.name,
            tags: plgTags,
        });
    }

    /**
     * Create ECS cluster.
     *
     * @private
     */
    _createEcsCluster(): EcsCluster {
        return new EcsCluster(this, "plg-ghost", {
            name: ecsConfig.clusterName,
        });
    }

    /**
     * Create iam role for ecs task execution and attach it to policy - AmazonECSTaskExecutionRolePolicy
     *
     * @private
     */
    _createAndAttachEcsExecutionRole(): IamRole {
        const ecsExecutionRole = new IamRole(this, "plg-gh-ecs-execution-role", {
            name: "plg-gh-ecs-execution-role",
            assumeRolePolicy: Fn.jsonencode({
                "Version": "2012-10-17",
                "Statement": [
                    {
                        "Sid": "",
                        "Effect": "Allow",
                        "Principal": {
                            "Service": "ecs-tasks.amazonaws.com"
                        },
                        "Action": "sts:AssumeRole"
                    }
                ]
            }),
            tags: plgTags
        });

        new IamRolePolicyAttachment(this, 'execution-role-attachment', {
            role: ecsExecutionRole.name,
            policyArn: ecsConfig.executionPolicyArn,
        });

        return ecsExecutionRole;
    }

    /**
     * Create and attach ecs task role to access other aws resources.
     * Here, allowing access to use S3
     *
     * @private
     */
    _createAndAttachEcsTaskRole(): IamRole {
        const taskPolicy = new IamPolicy(this, "plg-gh-task-policy", {
            name: "plg-gh-task",
            policy: Fn.jsonencode(
                {
                    "Version": "2012-10-17",
                    "Statement": [
                        {
                            "Sid": "",
                            "Effect": "Allow",
                            "Action": "s3:ListBucket",
                            "Resource": `arn:aws:s3:::${ecsConfig.s3BucketName}`
                        },
                        {
                            "Sid": "",
                            "Effect": "Allow",
                            "Action": [
                                "s3:PutObject",
                                "s3:GetObject",
                                "s3:PutObjectVersionAcl",
                                "s3:DeleteObject",
                                "s3:PutObjectAcl"
                            ],
                            "Resource": `arn:aws:s3:::${ecsConfig.s3BucketName}/*`
                        }
                    ]
                }
            )
        });

        const taskRole = new IamRole(this, "plg-gh-ecs-task-role", {
            name: "plg-gh-ecs-task-role",
            assumeRolePolicy: Fn.jsonencode({
                "Version": "2012-10-17",
                "Statement": [
                    {
                        "Sid": "",
                        "Effect": "Allow",
                        "Principal": {
                            "Service": "ecs-tasks.amazonaws.com"
                        },
                        "Action": "sts:AssumeRole"
                    }
                ]
            }),
            tags: plgTags
        });

        new IamRolePolicyAttachment(this, 'task-role-attachment', {
            role: taskRole.name,
            policyArn: taskPolicy.arn,
        });

        return taskRole;
    }

    /**
     * Create log group for ecs tasks.
     *
     * @private
     */
    _createLogGroup(): void {
        new CloudwatchLogGroup(this, "plg-gh-log-group", {
            name: ecsConfig.logGroupName
        });
    }

    /**
     * Create task definition for ecs tasks.
     *
     * @private
     */
    _createEcsTaskDefinition(executionRole: IamRole, taskRole: IamRole): EcsTaskDefinition {
        return new EcsTaskDefinition(this, "ecs-task-definition", {
            family: "ghost-task",
            memory: ecsConfig.taskDefinition.memory,
            cpu: ecsConfig.taskDefinition.cpu,
            networkMode: "awsvpc",
            runtimePlatform: {
                operatingSystemFamily: "LINUX"
            },
            requiresCompatibilities: ["FARGATE"],
            executionRoleArn: executionRole.arn,
            taskRoleArn: taskRole.arn,
            containerDefinitions: Fn.jsonencode(
                [
                    this._getGhostContainerDefinition()
                ]
            ),
            volume: [
                {
                    name: "ghost"
                }
            ]
        });
    }

    _getGhostContainerDefinition() {
        return {
            "name": "ghost",
            "image": ecsConfig.ghostImageUri,
            "essential": true,
            "portMappings": [
                {
                    "containerPort": ecsConfig.containerPort
                }
            ],
            "mountPoints": [
                {
                    "containerPath": "/var/lib/ghost/content",
                    "sourceVolume": "ghost"
                }
            ],
            "environment": [
                {
                    "name": "database__client",
                    "value": "mysql"
                },
                {
                    "name": "database__connection__database",
                    "value": rdsConfig.dbName
                },
                {
                    "name": "database__connection__host",
                    "value": this.options.dbInstanceEndpoint
                },
                {
                    "name": "database__connection__password",
                    "value": rdsConfig.dbPassword
                },
                {
                    "name": "database__connection__user",
                    "value": rdsConfig.dbUserName
                },
                {
                    "name": "storage__active",
                    "value": "s3"
                },
                {
                    "name": "storage__s3__acl",
                    "value": "public-read"
                },
                {
                    "name": "storage__s3__bucket",
                    "value": ecsConfig.s3BucketName
                },
                {
                    "name": "storage__s3__forcePathStyle",
                    "value": "true"
                },
                {
                    "name": "storage__s3__pathPrefix",
                    "value": ecsConfig.s3StoragePathPrefix
                },
                {
                    "name": "storage__s3__region",
                    "value": ecsConfig.s3StorageRegion
                },
                {
                    "name": "url",
                    "value": "http://" + this.options.albDnsName
                }
             ],
            "logConfiguration": {
                "logDriver": "awslogs",
                "secretOptions": null,
                "options": {
                    "awslogs-group": ecsConfig.logGroupName,
                    "awslogs-region": ecsConfig.logGroupRegion,
                    "awslogs-stream-prefix": ecsConfig.logStreamPrefix
                }
            }
        };
    }

    _getNginxContainerDefinition() {
        return {
            "name": "nginx",
            "image": ecsConfig.nginxImageUri,
            "cpu": 0,
            "memory": null,
            "essential": true,
            "portMappings": [
                {
                    "hostPort": 0,
                    "protocol": "tcp",
                    "containerPort": 8080
                }
            ],
            "dependsOn": [
                {
                    "containerName": "ghost",
                    "condition": "START"
                }
            ],
            "links": [
                "ghost"
            ],
            "environment": [
                {
                    "name": "GHOST_CONTAINER_NAME",
                    "value": "ghost"
                },
                {
                    "name": "GHOST_CONTAINER_PORT",
                    "value": ecsConfig.containerPort
                },
                {
                    "name": "S3_STATIC_BUCKET",
                    "value": "plg-ghost"
                }
            ],
            "logConfiguration": {
                "logDriver": "awslogs",
                "secretOptions": null,
                "options": {
                    "awslogs-group": ecsConfig.logGroupName,
                    "awslogs-region": "us-east-1",
                    "awslogs-stream-prefix": "ecs"
                }
            }
        };
    }

    /**
     * Create ECS service to run tasks.
     *
     * @param ecsCluster
     * @param ecsTaskDefinition
     * @param ecsSecurityGroup
     * @private
     */
    _createEcsService(
        ecsCluster: EcsCluster,
        ecsTaskDefinition: EcsTaskDefinition,
        ecsSecurityGroup: SecurityGroup
    ): EcsService {
        return new EcsService(this, "plg-gh-ecs-service", {
            name: "plg-gh-ecs-service",
            cluster: ecsCluster.arn,
            taskDefinition: ecsTaskDefinition.arn,
            launchType: "FARGATE",
            desiredCount: 1,
            loadBalancer: [
                {
                    containerName: "ghost",
                    containerPort: ecsConfig.containerPort,
                    targetGroupArn: this.options.targetGroupArn
                }
            ],
            networkConfiguration: {
                assignPublicIp: false,
                securityGroups: [ecsSecurityGroup.id],
                subnets: this.options.subnets
            }
        });
    }
}

export { EcsResource };
