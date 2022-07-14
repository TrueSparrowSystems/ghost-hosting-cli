import { Resource, Fn } from "cdktf";
import { Construct } from "constructs";
import { IamInstanceProfile, IamRole, IamRolePolicyAttachment } from "../gen/providers/aws/iam";
import { DataAwsAmi, Instance } from "../.gen/providers/aws/ec2";
import { EcsCluster, EcsService, EcsTaskDefinition, EcsTaskSet } from "../gen/providers/aws/ecs";

const ghostImageUri = "docker.io/ghost:alpine";
const nginxImageUri = "public.ecr.aws/j0d2y7t1/plg-nginx-ghost:latest";

interface Options {
    vpcId: string,
    publicSubnets: string[],
    vpcSecurityGroupId: string,
    dbInstanceEndpoint: string
};

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
        const instanceProfile = this._performRoleAndProfile();

        this._performEcsOperations(instanceProfile);
    }

    /**
     * Create ecs instance role and profile with AmazonEC2ContainerServiceforEC2Role policy,
     *
     * @private
     */
    _performRoleAndProfile() {
        const ecsInstanceRole = this._createEcsInstanceRole();

        new IamRolePolicyAttachment(this, "role-attachment", {
            role: ecsInstanceRole.name,
            policyArn: "arn:aws:iam::aws:policy/service-role/AmazonEC2ContainerServiceforEC2Role"
        });

        return this._createEcsInstanceProfile(ecsInstanceRole);
    }

    /**
     * Create role for ecs instance.
     *
     * @private
     */
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

    /**
     * Create instance profile for EC2 ECS optimised instance.
     *
     * @param ecsInstanceRole
     * @private
     */
    _createEcsInstanceProfile(ecsInstanceRole: IamRole) {
        return new IamInstanceProfile(this, "ecs-instance-profile", {
            name: "ecs-instance-profile",
            path: "/",
            role: ecsInstanceRole.id
        });
    }

    /**
     * Perform ECS related tasks.
     *
     * @param instanceProfile
     * @private
     */
    _performEcsOperations(instanceProfile: IamInstanceProfile) {
        const ec2EcsInstance = this._createEC2ECSInstance(instanceProfile);

        const ecsCluster = this._createEcsCluster();

        const ecsTaskDefinition = this._createEcsTaskDefinition();

        const ecsService = this._createEcsService(ecsCluster, ecsTaskDefinition);

        // this._createEcsTaskSet(ecsCluster, ecsTaskDefinition, ecsService);
    }

    /**
     * Create EC2 ECS optimised instance for ECS container.
     *
     * @param instanceProfile
     * @private
     */
    _createEC2ECSInstance(instanceProfile: IamInstanceProfile) {
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
            instanceType: "t3.micro",
            ebsOptimized: true,
            userData: "#!/bin/bash \n" +
                "cat <<'EOF' >> /etc/ecs/ecs.config \n" +
                "ECS_CLUSTER=plg-gh-ecs-cluster \n" +
                "EOF",
            iamInstanceProfile: instanceProfile.name,
            securityGroups: [this.options.vpcSecurityGroupId],
            tags: {
                Name: "Test EC2 ECS instance"
            },
            keyName: "infra" // TODO: remove this later,
        });
    }

    /**
     * Create ECS cluster.
     *
     * @private
     */
    _createEcsCluster(): EcsCluster {
        return new EcsCluster(this, 'plg-gh-ecs-cluster', {
            name: "plg-gh-ecs-cluster",
        });
    }

    /**
     * Create task definition for ecs tasks.
     *
     * @private
     */
    _createEcsTaskDefinition(): EcsTaskDefinition {
        return new EcsTaskDefinition(this, "ecs-task-definition", {
            family: "ghost-task",
            memory: "512",
            cpu: "256",
            networkMode: "bridge",
            requiresCompatibilities: ["EC2"],
            executionRoleArn: "arn:aws:iam::884276917262:role/ecsTaskExecutionRole", // TODO - change later
            taskRoleArn: "arn:aws:iam::884276917262:role/AWS_ECS_Custom_Role_S3", // TODO - change later
            volume: [
                {
                    name: "ghost",
                    hostPath: "/mnt/ghost"
                }
            ],
            containerDefinitions: Fn.jsonencode(
                [{
                    "name": "ghost",
                    "image": ghostImageUri,
                    "cpu": 0,
                    "memory": null,
                    "essential": true,
                    "entryPoint": [ "sh", "-c" ],
                    "command": [
                        "CMD-SHELL",
                        "npm install ghost-storage-adapter-s3 && mkdir -p ./content/adapters/storage && cp -r ./node_modules/ghost-storage-adapter-s3 ./content/adapters/storage/s3 &&node current/index.js"
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
                            "value": this.options.dbInstanceEndpoint
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
                    }]
            )
        });
    }

    /**
     * Create ECS service to run tasks.
     *
     * @param ecsCluster
     * @param ecsTaskDefinition
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

    /**
     * Create ECS tasks.
     *
     * @param ecsCluster
     * @param ecsTaskDefinition
     * @param ecsService
     * @private
     */
    _createEcsTaskSet(ecsCluster: EcsCluster, ecsTaskDefinition: EcsTaskDefinition, ecsService: EcsService) {
        return new EcsTaskSet(this, "plg-gh-ecs-task", {
            cluster: ecsCluster.arn,
            service: ecsService.id,
            taskDefinition: ecsTaskDefinition.arn,
            launchType: "EC2",
            loadBalancer: [
                {
                    containerName: "",
                    containerPort: 80,
                    loadBalancerName: "",
                    targetGroupArn: ""
                }
            ]
        });
    }
}

export { EcsResource };
