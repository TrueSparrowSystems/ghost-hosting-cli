import { Resource } from 'cdktf';
import { Construct } from 'constructs';
import { AppautoscalingPolicy, AppautoscalingTarget } from '../.gen/providers/aws/appautoscaling';
import { EcsService } from '../.gen/providers/aws/ecs';

import ecsConfig from '../config/ecs.json';

interface Options {
  autoScaleRoleArn: string;
  ecsService: EcsService;
}

/**
 * @dev Class to create required auto scaling target and policies.
 */
class AutoScaling extends Resource {
  options: Options;

  constructor(scope: Construct, name: string, options: Options) {
    super(scope, name);

    this.options = options;
  }

  /**
   * @dev Main performer of the class
   */
  perform(): void {
    const ecsTarget = this._createAppAutoScalingTarget();

    this._createAppAutoScalingPolicies(ecsTarget);
  }

  /**
   * @dev Create auto scaling target
   * @private
   */
  _createAppAutoScalingTarget(): AppautoscalingTarget {
    return new AppautoscalingTarget(this, 'auto-scaling-target', {
      maxCapacity: 9,
      minCapacity: 1,
      resourceId: `service/${ecsConfig.clusterName}/${this.options.ecsService.name}`,
      scalableDimension: 'ecs:service:DesiredCount',
      serviceNamespace: 'ecs',
      roleArn: this.options.autoScaleRoleArn,
      dependsOn: [this.options.ecsService],
    });
  }

  /**
   * @dev Create auto scaling policies for memory and cpu
   * @param ecsTarget
   * @private
   */
  _createAppAutoScalingPolicies(ecsTarget: AppautoscalingTarget): void {
    new AppautoscalingPolicy(this, 'auto-scaling-policy-cpu', {
      name: 'application-scaling-policy-cpu',
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

    new AppautoscalingPolicy(this, 'auto-scaling-policy-memory', {
      name: 'application-scaling-policy-memory',
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
