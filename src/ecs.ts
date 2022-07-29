import { Resource, Fn } from "cdktf";
import { Construct } from "constructs";
import { IamInstanceProfile, IamRole, IamRolePolicyAttachment } from "../gen/providers/aws/iam";
import { DataAwsAmi, Instance } from "../.gen/providers/aws/ec2";
import { EcsCluster, EcsService, EcsTaskDefinition } from "../gen/providers/aws/ecs";
import { SecurityGroup } from "../.gen/providers/aws/vpc";
import { CloudwatchLogGroup } from "../.gen/providers/aws/cloudwatch";

const ghostImageUri = "docker.io/ghost:alpine";
const nginxImageUri = "public.ecr.aws/y3c6v0h7/plg-nginx-ghost:latest";
const clusterName = "plg-gh-ecs-cluster";
const nameIdentifier = "plg-ghost";
const executionPolicyArn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy";

const plgTags = {
    Name: "PLG Ghost"
};

interface Options {
    vpcId: string,
    publicSubnets: string[],
    vpcSecurityGroupId: string,
    dbInstanceEndpoint: string,
    albSecurityGroupId: string,
    targetGroupArn: string,
    albDnsName: string
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
        const instanceProfile = this._performEcsInstanceRoleAndProfile();

        const ecsSecurityGroup = this._createSecurityGroup();

        const ec2Instance = this._createEC2ECSInstance(instanceProfile, ecsSecurityGroup);

        const ecsCluster = this._createEcsCluster();

        const ecsTaskDefinition = this._createEcsTaskDefinition();

        this._createEcsService(ecsCluster, ecsTaskDefinition, ec2Instance);
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
            name: nameIdentifier + "-instance-role",
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
            name: nameIdentifier,
            path: "/",
            role: ecsInstanceRole.id,
            tags: plgTags
        });
    }

    _createSecurityGroup() {
        return new SecurityGroup(this, "plg-gh-ecs-security-group", {
            name: "plg-gh-ecs-security-group",
            description: "Firewall for ECS traffic",
            vpcId: this.options.vpcId,
            ingress: [
                {
                    description: "Traffic to ECS",
                    fromPort: 32768,
                    toPort: 65535,
                    protocol: "tcp",
                    securityGroups: [this.options.albSecurityGroupId]
                },
                {
                    description: "SSH access to machine",
                    fromPort: 22,
                    toPort: 22,
                    protocol: "tcp",
                    cidrBlocks: ["0.0.0.0/0"]
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

        const publicSubnetId = Fn.element(this.options.publicSubnets, 0);
        return new Instance(this, "ec2-ecs-instance", {
            ami: dataAwsAmiOutput.id,
            subnetId: publicSubnetId,
            instanceType: "t3.small",
            ebsOptimized: true,
            securityGroups: [ecsSecurityGroup.id],
            userData: "#!/bin/bash \n" +
                "cat <<'EOF' >> /etc/ecs/ecs.config \n" +
                "ECS_CLUSTER=plg-gh-ecs-cluster \n" +
                "EOF",
            iamInstanceProfile: instanceProfile.name,
            tags: plgTags,
            keyName: "ghost" // TODO: remove this later
        });
    }

    /**
     * Create ECS cluster.
     *
     * @private
     */
    _createEcsCluster(): EcsCluster {
        return new EcsCluster(this, "plg-ghost", {
            name: clusterName,
        });
    }

    _createEcsExecutionRole() {
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
            policyArn: executionPolicyArn,
        });

        return ecsExecutionRole;
    }

    _createLogGroup() {
        new CloudwatchLogGroup(this, "plg-gh-log-group", {
            name: "plg-ghost"
        });
    }

    /**
     * Create task definition for ecs tasks.
     *
     * @private
     */
    _createEcsTaskDefinition(): EcsTaskDefinition {
        const executionRole = this._createEcsExecutionRole();

        this._createLogGroup();

        return new EcsTaskDefinition(this, "ecs-task-definition", {
            family: "ghost-task",
            memory: "512",
            cpu: "256",
            networkMode: "bridge",
            requiresCompatibilities: ["EC2"],
            executionRoleArn: executionRole.arn,
            // taskRoleArn: "arn:aws:iam::884276917262:role/AWS_ECS_Custom_Role_S3", // TODO - change later
            containerDefinitions: Fn.jsonencode(
                [
                    this._getGhostContainerDefinition(),
                    this._getNginxContainerDefinition()
                ]
            ),
            volume: [
                {
                    name: "ghost",
                    hostPath: "/mnt/ghost"
                }
            ]
        });
    }

    _getGhostContainerDefinition() {
        return {
            "name": "ghost",
            "image": ghostImageUri,
            "cpu": 0,
            "memory": null,
            "essential": true,
            "portMappings": [
                {
                    "hostPort": 2368,
                    "containerPort": 2368,
                    "protocol": "tcp"
                }
            ],
            "entryPoint": [
                "sh",
                "-c"
            ],
            "command": [
                `/bin/sh -c 'npm install ghost-storage-adapter-s3 && mkdir -p ./content/adapters/storage && cp -r ./node_modules/ghost-storage-adapter-s3 ./content/adapters/storage/s3 && node current/index.js'`
            ],
            "mountPoints": [
                {
                    "readOnly": null,
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
                    "value": "ghost_db"
                },
                {
                    "name": "database__connection__host",
                    "value": this.options.dbInstanceEndpoint
                },
                {
                    "name": "database__connection__password",
                    "value": "password"
                },
                {
                    "name": "database__connection__user",
                    "value": "ghost"
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
                    "value": "plg-ghost"
                },
                {
                    "name": "storage__s3__forcePathStyle",
                    "value": "true"
                },
                {
                    "name": "storage__s3__pathPrefix",
                    "value": "blog/images"
                },
                {
                    "name": "storage__s3__region",
                    "value": "us-east-1"
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
                    "awslogs-group": "plg-ghost",
                    "awslogs-region": "us-east-1",
                    "awslogs-stream-prefix": "ecs"
                }
            },
        };
    }

    _getNginxContainerDefinition() {
        return {
            "name": "nginx",
            "image": nginxImageUri,
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
                    "value": "2368"
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
                    "awslogs-group": "plg-ghost",
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
     * @param ec2Instance
     * @private
     */
    _createEcsService(ecsCluster: EcsCluster, ecsTaskDefinition: EcsTaskDefinition, ec2Instance: Instance): EcsService {
        return new EcsService(this, "plg-gh-ecs-service", {
            name: "plg-gh-ecs-service",
            cluster: ecsCluster.arn,
            taskDefinition: ecsTaskDefinition.arn,
            launchType: "EC2",
            desiredCount: 1,
            loadBalancer: [
                {
                    containerName: "nginx",
                    containerPort: 8080,
                    targetGroupArn: this.options.targetGroupArn
                }
            ],
            orderedPlacementStrategy: [
                {
                    type: "spread",
                    field: "instanceId"
                }
            ],
            dependsOn: [ec2Instance]
        });
    }
}

export { EcsResource };
