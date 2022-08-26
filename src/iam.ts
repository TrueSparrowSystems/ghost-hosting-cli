import { Resource, Fn } from "cdktf";
import { Construct } from "constructs";
import { IamPolicy, IamRole, IamRolePolicyAttachment } from "../.gen/providers/aws/iam";
import { S3Bucket } from "../.gen/providers/aws/s3";

const ecsConfig = require("../config/ecs.json");

interface Options {
    blogBucket: S3Bucket,
    configsBucket: S3Bucket
}

/**
 * Class to create required IAM roles for task execution.
 */
class IamResource extends Resource {
    options: Options;

    constructor(scope: Construct, name: string, options: Options) {
        super(scope, name);

        this.options = options;
    }

    perform() {
        const customExecutionRoleArn = this._ecsExecutionCustom();

        const customTaskRoleArn = this._ecsTaskCustom();

        const ecsAutoScalingRoleArn = this._ecsAutoScalingRole();

        return { customExecutionRoleArn, customTaskRoleArn, ecsAutoScalingRoleArn };
    }

    _ecsExecutionCustom(): string {
        // Create policy
        const policy = new IamPolicy(this, "ecs-execution-custom", {
            name: `ECS_TASK_EXECUTION_CUSTOM_${ecsConfig.nameIdentifier}`,
            path: "/",
            policy: Fn.jsonencode({
                    Version: "2012-10-17",
                    Statement: [
                        {
                            Effect: "Allow",
                            Action: [
                                "s3:GetBucketLocation",
                                "s3:ListAllMyBuckets"
                            ],
                            Resource: "*"
                        },
                        {
                            Effect: "Allow",
                            Action: "s3:ListBucket",
                            Resource: [
                                this.options.configsBucket.arn
                            ]
                        },
                        {
                            Effect: "Allow",
                            Action: "s3:*",
                            Resource: [
                                this.options.configsBucket.arn + "/*"
                            ]
                        },
                        {
                            Effect: "Allow",
                            Action: [
                                "logs:CreateLogStream",
                                "logs:PutLogEvents"
                            ],
                            Resource: "*"
                        }
                    ]
                }
            )
        });

        // Create role
        const role = new IamRole(this, "ecs-execution-role-custom", {
            name: `ECS_TASK_EXECUTION_${ecsConfig.nameIdentifier}`,
            assumeRolePolicy: Fn.jsonencode({
                Version: "2012-10-17",
                Statement: [
                    {
                        Action: "sts:AssumeRole",
                        Effect: "Allow",
                        Sid: "",
                        Principal: {
                            Service: "ecs-tasks.amazonaws.com"
                        },

                    }
                ]
            })
        });

        // Role-policy attachment
        new IamRolePolicyAttachment(this, "ecs-execution-custom-policy-role-attachment", {
            role: role.name,
            policyArn: policy.arn
        });

        new IamRolePolicyAttachment(this, "ecs-execution-default-policy-role-attachment1", {
            role: role.name,
            policyArn: "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
        });

        return role.arn;
    }

    _ecsTaskCustom(): string {
        // Create policy
        const policy = new IamPolicy(this, "ecs-task-custom", {
            name: `ECS_TASK_${ecsConfig.nameIdentifier}`,
            path: "/",
            policy: Fn.jsonencode({
                Version: "2012-10-17",
                Statement: [
                    {
                        Effect: "Allow",
                        Action: [
                            "s3:GetBucketLocation",
                            "s3:ListAllMyBuckets"
                        ],
                        Resource: "*"
                    },
                    {
                        Effect: "Allow",
                        Action: "s3:ListBucket",
                        Resource: [
                            this.options.blogBucket.arn
                        ]
                    },
                    {
                        Effect: "Allow",
                        Action: "s3:*",
                        Resource: [
                            this.options.blogBucket.arn + "/"
                        ]
                    },
                    {
                        Effect: "Allow",
                        Action: [
                            "logs:CreateLogStream",
                            "logs:PutLogEvents"
                        ],
                        Resource: "*"
                    }
                ]
            })
        });

        // Create role
        const role = new IamRole(this, "ecs-task-role-custom", {
            name: `ECS_TASK_${ecsConfig.nameIdentifier}`,
            assumeRolePolicy: Fn.jsonencode({
                Version: "2012-10-17",
                Statement: [
                    {
                        Action: "sts:AssumeRole",
                        Effect: "Allow",
                        Sid: "",
                        Principal: {
                            Service: "ecs-tasks.amazonaws.com"
                        },

                    },
                ]
            })
        });

        // Role-policy attachment
        new IamRolePolicyAttachment(this, "ecs-custom-task-role-attachment", {
            role: role.name,
            policyArn: policy.arn
        });

        return role.arn;
    }

    _ecsAutoScalingRole(): string {
        const role = new IamRole(this, "ecs-auto-scaling-role", {
            name: `ECS_TASK_AUTOSCALE_${ecsConfig.nameIdentifier}`,
            assumeRolePolicy: Fn.jsonencode({
                Version: "2012-10-17",
                Statement: [
                    {
                        Action: "sts:AssumeRole",
                        Effect: "Allow",
                        Sid: "",
                        Principal: {
                            Service: "application-autoscaling.amazonaws.com"
                        }
                    }
                ]
            })
        });

        new IamRolePolicyAttachment(this, "ecs-auto-scaling-role-attachment", {
            role: role.name,
            policyArn: ecsConfig.amazonEC2ContainerServiceAutoscaleRole
        });

        return role.arn;
    }
}

export { IamResource };
