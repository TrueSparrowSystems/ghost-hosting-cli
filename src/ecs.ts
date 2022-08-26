import { Resource, Fn, TerraformOutput } from "cdktf";
import { Construct } from "constructs";
import { IamInstanceProfile, IamPolicy, IamRole, IamRolePolicyAttachment } from "../.gen/providers/aws/iam";
import { DataAwsAmi, Instance } from "../.gen/providers/aws/ec2";
import {
    EcsCluster,
    EcsClusterCapacityProviders,
    EcsService,
    EcsTaskDefinition
} from "../.gen/providers/aws/ecs";
import { SecurityGroup, SecurityGroupRule } from "../.gen/providers/aws/vpc";
import { CloudwatchLogGroup } from "../.gen/providers/aws/cloudwatch";
import { AlbListenerRule, AlbTargetGroup } from "../.gen/providers/aws/elb";
import { S3Bucket, S3Object } from "../.gen/providers/aws/s3";
import { getDomainFromUrl, getPathSuffixFromUrl } from "../lib/util";

const ecsConfig = require("../config/ecs.json");

const plgTags = {
    Name: "PLG Ghost"
};

interface Options {
    vpcId: string;
    subnets: string[];
    dbInstanceEndpoint: string;
    albSecurityGroups: string[];
    listenerArn: string;
    rdsSecurityGroupId: string;
    customExecutionRoleArn: string;
    customTaskRoleArn: string;
    configBucket: S3Bucket;
    ghostEnvUpload: S3Object;
    nginxEnvUpload: S3Object;
    ghostHostingUrl: string;
    staticWebsiteUrl: string | undefined;
}

interface Response {
    ecsService: EcsService;
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
    perform(): Response {
        // const instanceProfile = this._performEcsInstanceRoleAndProfile();

        this._createLogGroup();

        const ecsSg = this._createSecurityGroup();

        const targetGroup = this._createTargetGroup();

        // const ec2Instance = this._createEC2ECSInstance(instanceProfile, ecsSecurityGroup);

        const ecsCluster = this._createEcsCluster();

        // const executionRole = this._createAndAttachEcsExecutionRole();

        // const taskRole = this._createAndAttachEcsTaskRole();

        this._addCapacityProvider();

        const ecsTaskDefinition = this._createEcsTaskDefinition();

        const ecsService = this._createEcsService(ecsCluster, ecsTaskDefinition, ecsSg, targetGroup);

        return { ecsService };
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

    _createTargetGroup(): AlbTargetGroup {
        const urlPath = getPathSuffixFromUrl(this.options.ghostHostingUrl);
        const targetGroup = new AlbTargetGroup(this, "plg-gh-alb-tg", {
            name: "plg-gh-alb-tg",
            port: 80,
            protocol: "HTTP",
            targetType: "ip",
            vpcId: this.options.vpcId,
            protocolVersion: "HTTP1",
            healthCheck: {
                protocol: "HTTP",
                path: urlPath ? `/${urlPath}/ghost` : '/ghost',
                timeout: 5,
                matcher: "200,202,301",
                healthyThreshold: 2,
                interval: 10
            },
            tags: plgTags
        });

        // Attach target group to the listener
        const pathSuffixes = [ `/${getPathSuffixFromUrl(this.options.ghostHostingUrl)}*` ];
        const hostDomains = [ getDomainFromUrl(this.options.ghostHostingUrl) ];
        if (this.options.staticWebsiteUrl) {
            hostDomains.push(getDomainFromUrl(this.options.staticWebsiteUrl));
        }
        new AlbListenerRule(this, "listener_rule", {
            listenerArn: this.options.listenerArn,
            priority: 50,
            condition: [
                {
                    pathPattern: {
                        values: Fn.tolist(pathSuffixes)
                    }
                },
                {
                    hostHeader: {
                        values: Fn.tolist(hostDomains)
                    }
                }
            ],
            action: [
                {
                    type: "forward",
                    targetGroupArn: targetGroup.arn
                }
            ]
        });

        return targetGroup;
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
                    fromPort: ecsConfig.nginxContainerPort,
                    toPort: ecsConfig.nginxContainerPort,
                    protocol: "tcp",
                    securityGroups: this.options.albSecurityGroups
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
        if(this.options.rdsSecurityGroupId){
            new SecurityGroupRule(this, "rds_sg_rule", {
                type: "ingress",
                fromPort: 3306,
                toPort: 3306,
                protocol: "tcp",
                securityGroupId: this.options.rdsSecurityGroupId,
                sourceSecurityGroupId: ecsSg.id
            });
        }

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
            policyArn: ecsConfig.amazonECSTaskExecutionRolePolicy,
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

    _addCapacityProvider(): void {
        new EcsClusterCapacityProviders(this, "plg-gh-capacity-provider", {
           clusterName: ecsConfig.clusterName,
            capacityProviders: ["FARGATE", "FARGATE_SPOT"]
        });
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
    _createEcsTaskDefinition(): EcsTaskDefinition {
        return new EcsTaskDefinition(this, "ecs-task-definition", {
            family: "ghost-task",
            memory: ecsConfig.taskDefinition.memory,
            cpu: ecsConfig.taskDefinition.cpu,
            networkMode: "awsvpc",
            runtimePlatform: {
                operatingSystemFamily: "LINUX"
            },
            requiresCompatibilities: ["FARGATE"],
            executionRoleArn: this.options.customExecutionRoleArn,
            taskRoleArn: this.options.customTaskRoleArn,
            containerDefinitions: Fn.jsonencode(
                [
                    this._getGhostContainerDefinition(),
                    this._getNginxContainerDefinition()
                ]
            ),
            volume: [
                {
                    name: "ghost"
                }
            ],
            dependsOn: [this.options.ghostEnvUpload, this.options.nginxEnvUpload]
        });
    }

    _getGhostContainerDefinition(): any {
        const envFileArn = `arn:aws:s3:::${this.options.configBucket.bucket}/ghost.env`;

        new TerraformOutput(this, "ecs-env-file-arn", {
            value: envFileArn
        });

        return {
            "name": ecsConfig.ghostContainerName,
            "image": ecsConfig.ghostImageUri,
            "essential": true,
            "portMappings": [
                {
                    "containerPort": ecsConfig.ghostContainerPort
                }
            ],
            "mountPoints": [
                {
                    "containerPath": "/var/lib/ghost/content",
                    "sourceVolume": "ghost"
                }
            ],
            "environmentFiles": [
                {
                    "value": envFileArn,
                    "type": "s3"
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

    /**
     * Nginx server task definition.
     *
     * @private
     */
    _getNginxContainerDefinition(): any {
        const envFileArn = `arn:aws:s3:::${this.options.configBucket.bucket}/nginx.env`;

        new TerraformOutput(this, "nginx-env-file-arn", {
            value: envFileArn
        });

        return {
            "name": ecsConfig.nginxContainerName,
            "image": ecsConfig.nginxImageUri,
            "cpu": 0,
            "memory": null,
            "essential": true,
            "portMappings": [
                {
                    "hostPort": ecsConfig.nginxContainerPort,
                    "protocol": "tcp",
                    "containerPort": ecsConfig.nginxContainerPort
                }
            ],
            "dependsOn": [
                {
                    "containerName": "ghost",
                    "condition": "START"
                }
            ],
            "environmentFiles": [
                {
                    "value": envFileArn,
                    "type": "s3"
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
     * @param targetGroup
     * @private
     */
    _createEcsService (
        ecsCluster: EcsCluster,
        ecsTaskDefinition: EcsTaskDefinition,
        ecsSecurityGroup: SecurityGroup,
        targetGroup: AlbTargetGroup
    ): EcsService {
        return new EcsService(this, "plg-gh-ecs-service", {
            name: "plg-gh-ecs-service",
            cluster: ecsCluster.arn,
            taskDefinition: ecsTaskDefinition.arn,
            desiredCount: 1,
            capacityProviderStrategy: [
                {
                    capacityProvider: "FARGATE_SPOT",
                    base: 1,
                    weight: 1
                },
                {
                    capacityProvider: "FARGATE",
                    weight: 1
                }
            ],
            loadBalancer: [
                {
                    containerName: ecsConfig.nginxContainerName,
                    containerPort: ecsConfig.nginxContainerPort,
                    targetGroupArn: targetGroup.arn
                }
            ],
            dependsOn: [targetGroup],
            networkConfiguration: {
                assignPublicIp: false,
                securityGroups: [ecsSecurityGroup.id],
                subnets: this.options.subnets
            }
        });
    }
}

export { EcsResource };
