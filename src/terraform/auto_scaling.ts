import { Resource } from 'cdktf';
import { Construct } from 'constructs';
import { AppautoscalingPolicy, AppautoscalingTarget } from '../gen/providers/aws/appautoscaling';
import { EcsCluster, EcsService } from '../gen/providers/aws/ecs';

import ecsConfig from '../config/ecs.json';
import commonConfig from '../config/common.json';

interface Options {
  autoScaleRoleArn: string;
  ecsCluster: EcsCluster;
  ecsService: EcsService;
}

/**
 * @dev Class to create required auto scaling target and policies
 */
class AutoScaling extends Resource {
  options: Options;

  /**
   * @dev Constructor for the auto scaling resource class
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
   * @returns { void }
   */
  perform(): void {
    const ecsTarget = this._createAppAutoScalingTarget();

    this._createAppAutoScalingPolicies(ecsTarget);
  }

  /**
   * @dev Create auto scaling target
   *
   * @returns { AppautoscalingTarget }
   */
  _createAppAutoScalingTarget(): AppautoscalingTarget {
    return new AppautoscalingTarget(this, 'auto_scaling_target', {
      maxCapacity: ecsConfig.autoScalingMaxCapacity,
      minCapacity: ecsConfig.autoScalingMinCapacity,
      resourceId: `service/${this.options.ecsCluster.name}/${this.options.ecsService.name}`,
      scalableDimension: 'ecs:service:DesiredCount',
      serviceNamespace: 'ecs',
      roleArn: this.options.autoScaleRoleArn,
      dependsOn: [this.options.ecsService],
    });
  }

  /**
   * @dev Create auto scaling policies for memory and cpu
   * @param ecsTarget
   *
   * @returns { void }
   */
  _createAppAutoScalingPolicies(ecsTarget: AppautoscalingTarget): void {
    new AppautoscalingPolicy(this, 'auto_scaling_policy_cpu', {
      name: commonConfig.nameIdentifier,
      policyType: 'TargetTrackingScaling',
      resourceId: ecsTarget.resourceId,
      scalableDimension: ecsTarget.scalableDimension,
      serviceNamespace: ecsTarget.serviceNamespace,
      targetTrackingScalingPolicyConfiguration: {
        predefinedMetricSpecification: {
          predefinedMetricType: 'ECSServiceAverageCPUUtilization',
        },
        targetValue: 50,
        scaleInCooldown: 30,
        scaleOutCooldown: 60,
      },
      dependsOn: [ecsTarget],
    });

    new AppautoscalingPolicy(this, 'auto_scaling_policy_memory', {
      name: commonConfig.nameIdentifier,
      policyType: 'TargetTrackingScaling',
      resourceId: ecsTarget.resourceId,
      scalableDimension: ecsTarget.scalableDimension,
      serviceNamespace: ecsTarget.serviceNamespace,
      targetTrackingScalingPolicyConfiguration: {
        predefinedMetricSpecification: {
          predefinedMetricType: 'ECSServiceAverageMemoryUtilization',
        },
        targetValue: 75,
        scaleInCooldown: 30,
        scaleOutCooldown: 60,
      },
      dependsOn: [ecsTarget],
    });
  }
}

export { AutoScaling };
