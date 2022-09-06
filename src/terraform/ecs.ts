import { Resource, Fn, TerraformOutput } from 'cdktf';
import { Construct } from 'constructs';
import { EcsCluster, EcsClusterCapacityProviders, EcsService, EcsTaskDefinition } from '../gen/providers/aws/ecs';
import { SecurityGroup, SecurityGroupRule } from '../gen/providers/aws/vpc';
import { CloudwatchLogGroup } from '../gen/providers/aws/cloudwatch';
import { AlbListenerRule, AlbTargetGroup } from '../gen/providers/aws/elb';
import { S3Bucket, S3Object } from '../gen/providers/aws/s3';
import { getDomainFromUrl, getPathSuffixFromUrl } from '../lib/util';

import ecsConfig from '../config/ecs.json';
import commonConfig from '../config/common.json';

const GHOST_ENV_FILE_NAME = ecsConfig.ghostContainerName + '.env';
const NGINX_ENV_FILE_NAME = ecsConfig.nginxContainerName + '.env';

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
  region: string;
  staticWebsiteUrl: string | undefined;
}

interface Response {
  ecsService: EcsService;
  ecsCluster: EcsCluster;
}

/**
 * @dev Class to create ECS tasks
 * - This resource creates
 *    1. Security group - to allow traffic to ecs tasks
 *    2. Target group -
 *    3. ECS cluster
 *    4. Capacity Provider
 *    5. ECS Task Definition
 *    6. ECS Service
 */
class EcsResource extends Resource {
  options: Options;

  /**
   * @dev Constructor for the ECS resource class
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
    this._createLogGroup();

    const ecsSg = this._createSecurityGroup();

    const targetGroup = this._createTargetGroup();

    const ecsCluster = this._createEcsCluster();

    this._addCapacityProvider(ecsCluster);

    const ecsTaskDefinition = this._createEcsTaskDefinition();

    const ecsService = this._createEcsService(ecsCluster, ecsTaskDefinition, ecsSg, targetGroup);

    return { ecsCluster, ecsService };
  }

  /**
   * @dev Create a target group
   *
   * @returns { AlbTargetGroup }
   */
  _createTargetGroup(): AlbTargetGroup {
    const urlPath = getPathSuffixFromUrl(this.options.ghostHostingUrl);
    const targetGroup = new AlbTargetGroup(this, 'alb_tg', {
      name: commonConfig.nameIdentifier,
      port: 80,
      protocol: 'HTTP',
      targetType: 'ip',
      vpcId: this.options.vpcId,
      protocolVersion: 'HTTP1',
      healthCheck: {
        protocol: 'HTTP',
        path: urlPath ? `/${urlPath}/ghost` : '/ghost',
        timeout: 5,
        matcher: '200,202,301',
        healthyThreshold: 2,
        interval: 10,
      },
      tags: commonConfig.tags,
    });

    // Attach target group to the listener
    const pathSuffixes = [`/${getPathSuffixFromUrl(this.options.ghostHostingUrl)}*`];
    const hostDomains = [getDomainFromUrl(this.options.ghostHostingUrl)];
    if (this.options.staticWebsiteUrl) {
      hostDomains.push(getDomainFromUrl(this.options.staticWebsiteUrl));
    }
    new AlbListenerRule(this, 'listener_rule', {
      listenerArn: this.options.listenerArn,
      priority: 50,
      condition: [
        {
          pathPattern: {
            values: Fn.tolist(pathSuffixes),
          },
        },
        {
          hostHeader: {
            values: Fn.tolist(hostDomains),
          },
        },
      ],
      action: [
        {
          type: 'forward',
          targetGroupArn: targetGroup.arn,
        },
      ],
      tags: commonConfig.tags,
    });

    return targetGroup;
  }

  /**
   * @dev Create security group for ecs
   * - This will allow traffic to ECS from ALB only
   *
   * @returns { SecurityGroup }
   */
  _createSecurityGroup() {
    const ecsSg = new SecurityGroup(this, 'ecs_sg', {
      name: commonConfig.nameIdentifier + '-ecs',
      description: 'Firewall for ECS traffic',
      vpcId: this.options.vpcId,
      ingress: [
        {
          description: 'Traffic to ECS',
          fromPort: ecsConfig.nginxContainerPort,
          toPort: ecsConfig.nginxContainerPort,
          protocol: 'tcp',
          securityGroups: this.options.albSecurityGroups,
        },
      ],
      egress: [
        {
          fromPort: 0,
          toPort: 0,
          protocol: '-1',
          cidrBlocks: ['0.0.0.0/0'],
        },
      ],
      tags: commonConfig.tags,
    });

    // Allow DB connection
    if (this.options.rdsSecurityGroupId) {
      new SecurityGroupRule(this, 'rds_sg_rule', {
        type: 'ingress',
        fromPort: 3306,
        toPort: 3306,
        protocol: 'tcp',
        securityGroupId: this.options.rdsSecurityGroupId,
        sourceSecurityGroupId: ecsSg.id,
      });
    }

    return ecsSg;
  }

  /**
   * @dev Create ECS cluster
   *
   * @returns { EcsCluster }
   */
  _createEcsCluster(): EcsCluster {
    return new EcsCluster(this, 'cluster', {
      name: ecsConfig.clusterName,
      tags: commonConfig.tags,
    });
  }

  /**
   * @dev Add capacity provider
   *
   * @returns { EcsClusterCapacityProviders }
   */
  _addCapacityProvider(ecsCluster: EcsCluster): void {
    new EcsClusterCapacityProviders(this, 'capacity_provider', {
      clusterName: ecsCluster.name,
      capacityProviders: ['FARGATE', 'FARGATE_SPOT'],
    });
  }

  /**
   * @dev Create a log group to store ecs task logs
   *
   * @returns { void }
   */
  _createLogGroup(): void {
    new CloudwatchLogGroup(this, 'log_group', {
      name: ecsConfig.logGroupName,
    });
  }

  /**
   * @dev Create task definition for ecs tasks.
   * - This is creating a task definition with two containers registered to it.
   *    1. Ghost container
   *    2. Nginx container
   *
   * @returns { EcsTaskDefinition }
   */
  _createEcsTaskDefinition(): EcsTaskDefinition {
    return new EcsTaskDefinition(this, 'task_definition', {
      family: 'ghost-task',
      memory: ecsConfig.taskDefinition.memory,
      cpu: ecsConfig.taskDefinition.cpu,
      networkMode: 'awsvpc',
      runtimePlatform: {
        operatingSystemFamily: 'LINUX',
      },
      requiresCompatibilities: ['FARGATE'],
      executionRoleArn: this.options.customExecutionRoleArn,
      taskRoleArn: this.options.customTaskRoleArn,
      containerDefinitions: Fn.jsonencode([this._getGhostContainerDefinition(), this._getNginxContainerDefinition()]),
      volume: [
        {
          name: 'ghost',
        },
      ],
      dependsOn: [this.options.ghostEnvUpload, this.options.nginxEnvUpload],
      tags: commonConfig.tags,
    });
  }

  /**
   * @dev Get container definition for ghost container
   *
   * @returns { object }
   */
  _getGhostContainerDefinition(): object {
    const envFileArn = `arn:aws:s3:::${this.options.configBucket.bucket}/${GHOST_ENV_FILE_NAME}`;

    new TerraformOutput(this, 'ghost_env_file_arn', {
      value: envFileArn,
    });

    return {
      name: ecsConfig.ghostContainerName,
      image: ecsConfig.ghostImageUri,
      essential: true,
      portMappings: [
        {
          containerPort: ecsConfig.ghostContainerPort,
        },
      ],
      environmentFiles: [
        {
          value: envFileArn,
          type: 's3',
        },
      ],
      logConfiguration: {
        logDriver: 'awslogs',
        secretOptions: null,
        options: {
          'awslogs-group': ecsConfig.logGroupName,
          'awslogs-region': this.options.region,
          'awslogs-stream-prefix': ecsConfig.logStreamPrefix,
        },
      },
    };
  }

  /**
   * @dev Get container definition for nginx container
   *
   * @returns { object }
   */
  _getNginxContainerDefinition(): object {
    const envFileArn = `arn:aws:s3:::${this.options.configBucket.bucket}/${NGINX_ENV_FILE_NAME}`;

    new TerraformOutput(this, 'nginx_env_file_arn', {
      value: envFileArn,
    });

    return {
      name: ecsConfig.nginxContainerName,
      image: ecsConfig.nginxImageUri,
      cpu: 0,
      memory: null,
      essential: true,
      portMappings: [
        {
          hostPort: ecsConfig.nginxContainerPort,
          protocol: 'tcp',
          containerPort: ecsConfig.nginxContainerPort,
        },
      ],
      dependsOn: [
        {
          containerName: 'ghost',
          condition: 'START',
        },
      ],
      environmentFiles: [
        {
          value: envFileArn,
          type: 's3',
        },
      ],
      logConfiguration: {
        logDriver: 'awslogs',
        secretOptions: null,
        options: {
          'awslogs-group': ecsConfig.logGroupName,
          'awslogs-region': this.options.region,
          'awslogs-stream-prefix': ecsConfig.logStreamPrefix,
        },
      },
    };
  }

  /**
   * @dev Create ECS service to run tasks
   *
   * @param ecsCluster
   * @param ecsTaskDefinition
   * @param ecsSecurityGroup
   * @param targetGroup
   * @returns { EcsService }
   */
  _createEcsService(
    ecsCluster: EcsCluster,
    ecsTaskDefinition: EcsTaskDefinition,
    ecsSecurityGroup: SecurityGroup,
    targetGroup: AlbTargetGroup
  ): EcsService {
    return new EcsService(this, 'ecs_service', {
      name: commonConfig.nameIdentifier,
      cluster: ecsCluster.arn,
      taskDefinition: ecsTaskDefinition.arn,
      desiredCount: ecsConfig.autoScalingMinCapacity,
      capacityProviderStrategy: [
        {
          capacityProvider: 'FARGATE_SPOT',
          base: 1,
          weight: 1,
        },
        {
          capacityProvider: 'FARGATE',
          weight: 1,
        },
      ],
      loadBalancer: [
        {
          containerName: ecsConfig.nginxContainerName,
          containerPort: ecsConfig.nginxContainerPort,
          targetGroupArn: targetGroup.arn,
        },
      ],
      dependsOn: [targetGroup],
      networkConfiguration: {
        assignPublicIp: false,
        securityGroups: [ecsSecurityGroup.id],
        subnets: this.options.subnets,
      },
      tags: commonConfig.tags,
    });
  }
}

export { EcsResource };
