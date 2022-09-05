import { Resource, Fn } from 'cdktf';
import { Construct } from 'constructs';
import { IamPolicy, IamRole, IamRolePolicyAttachment } from '../gen/providers/aws/iam';
import { S3Bucket } from '../gen/providers/aws/s3';

import ecsConfig from '../config/ecs.json';
import commonConfig from '../config/common.json';

interface Options {
  randomString: string;
  blogBucket: S3Bucket;
  configsBucket: S3Bucket;
}

interface Response {
  customExecutionRoleArn: string;
  customTaskRoleArn: string;
  ecsAutoScalingRoleArn: string;
}

/**
 * @dev Class to create custom IAM roles
 * - This creates two custom IAM roles
 *    1. Task Execution Role - required by ECS
 *    2. Task Role - required by ECS
 */
class IamResource extends Resource {
  options: Options;

  /**
   * @dev Constructor for the IAM resource class
   *
   * @param scope - scope in which to define this construct
   * @param name - name of the resource
   * @param options - options required by the resource
   */
  constructor(scope: Construct, name: string, options: Options) {
    super(scope, name);

    this.options = options;
  }

  /**
   * @dev Main performer of the class
   *
   * @returns { Response }
   */
  perform(): Response {
    const customExecutionRoleArn = this._ecsExecutionCustom();

    const customTaskRoleArn = this._ecsTaskCustom();

    const ecsAutoScalingRoleArn = this._ecsAutoScalingRole();

    return { customExecutionRoleArn, customTaskRoleArn, ecsAutoScalingRoleArn };
  }

  /**
   * @dev Create a custom execution role for ECS tasks
   * - This role has two policies attached
   *    1. Custom policy
   *    2. AmazonECSTaskExecutionRolePolicy - provided by aws
   *
   * @returns { string } - arn of the ecs execution role created
   */
  _ecsExecutionCustom(): string {
    // Create policy
    const policy = new IamPolicy(this, 'ecs_execution_custom', {
      name: commonConfig.nameIdentifier + '-execution',
      path: '/',
      policy: Fn.jsonencode({
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Action: ['s3:GetBucketLocation', 's3:ListAllMyBuckets'],
            Resource: '*',
          },
          {
            Effect: 'Allow',
            Action: 's3:ListBucket',
            Resource: [this.options.configsBucket.arn],
          },
          {
            Effect: 'Allow',
            Action: 's3:*',
            Resource: [this.options.configsBucket.arn + '/*'],
          },
          {
            Effect: 'Allow',
            Action: ['logs:CreateLogStream', 'logs:PutLogEvents'],
            Resource: '*',
          },
        ],
      }),
    });

    // Create role
    const role = new IamRole(this, 'ecs_execution_role_custom', {
      name: commonConfig.nameIdentifier + '-execution',
      assumeRolePolicy: Fn.jsonencode({
        Version: '2012-10-17',
        Statement: [
          {
            Action: 'sts:AssumeRole',
            Effect: 'Allow',
            Sid: '',
            Principal: {
              Service: 'ecs-tasks.amazonaws.com',
            },
          },
        ],
      }),
    });

    // Role-policy attachment
    new IamRolePolicyAttachment(this, 'ecs_execution_custom_policy_role_attachment', {
      role: role.name,
      policyArn: policy.arn,
    });

    new IamRolePolicyAttachment(this, 'ecs_execution_default_policy_role_attachment', {
      role: role.name,
      policyArn: 'arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy',
    });

    return role.arn;
  }

  /**
   * @dev Create a task role for ecs tasks
   * - This role allows ecs tasks to consume other aws resources like cloudwatch log groups and s3 buckets
   *
   * @returns { string } - arn of the ecs execution role created
   */
  _ecsTaskCustom(): string {
    // Create policy
    const policy = new IamPolicy(this, 'ecs_task_custom', {
      name: commonConfig.nameIdentifier + '-task',
      path: '/',
      policy: Fn.jsonencode({
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Action: ['s3:GetBucketLocation', 's3:ListAllMyBuckets'],
            Resource: '*',
          },
          {
            Effect: 'Allow',
            Action: 's3:ListBucket',
            Resource: [this.options.blogBucket.arn],
          },
          {
            Effect: 'Allow',
            Action: 's3:*',
            Resource: [this.options.blogBucket.arn + '/*'],
          }
        ],
      }),
    });

    // Create role
    const role = new IamRole(this, 'ecs_task_role_custom', {
      name: commonConfig.nameIdentifier + '-task',
      assumeRolePolicy: Fn.jsonencode({
        Version: '2012-10-17',
        Statement: [
          {
            Action: 'sts:AssumeRole',
            Effect: 'Allow',
            Sid: '',
            Principal: {
              Service: 'ecs-tasks.amazonaws.com',
            },
          },
        ],
      }),
    });

    // Role-policy attachment
    new IamRolePolicyAttachment(this, 'ecs_custom_task_role_attachment', {
      role: role.name,
      policyArn: policy.arn,
    });

    return role.arn;
  }

  _ecsAutoScalingRole(): string {
    const role = new IamRole(this, 'ecs_auto_scaling_role', {
      name: commonConfig.nameIdentifier + '-auto-scaling',
      assumeRolePolicy: Fn.jsonencode({
        Version: '2012-10-17',
        Statement: [
          {
            Action: 'sts:AssumeRole',
            Effect: 'Allow',
            Sid: '',
            Principal: {
              Service: 'application-autoscaling.amazonaws.com',
            },
          },
        ],
      }),
    });

    new IamRolePolicyAttachment(this, 'ecs_auto_scaling_role_attachment', {
      role: role.name,
      policyArn: ecsConfig.amazonEC2ContainerServiceAutoscaleRole,
    });

    return role.arn;
  }
}

export { IamResource };
