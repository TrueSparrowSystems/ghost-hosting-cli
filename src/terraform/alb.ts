import { Resource, Fn } from 'cdktf';
import { Construct } from 'constructs';
import { SecurityGroup } from '../gen/providers/aws/vpc';
import { Alb, AlbListener, DataAwsLb, DataAwsLbListener } from '../gen/providers/aws/elb';

import commonConfig from '../config/common.json';

interface Options {
  vpcId: string;
  publicSubnets: string[];
  useExistingAlb: boolean;
  listenerArn: string | undefined;
  certificateArn: string | undefined;
}

interface Response {
  albSecurityGroups: string[];
  listenerArn: string;
}

/**
 * @dev Class to an application load balancer
 */
class AlbResource extends Resource {
  options: Options;

  /**
   * @dev Constructor for the ALB resource class
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
    let listenerArn: string;
    if (this.options.listenerArn) {
      listenerArn = this.options.listenerArn;

      const dataAwsLbListenerDefaultAction = new DataAwsLbListener(this, 'listener', { arn: listenerArn });

      const dataAwsLb = new DataAwsLb(this, 'lb', {
        arn: dataAwsLbListenerDefaultAction.loadBalancerArn,
      });

      return { albSecurityGroups: Fn.tolist(dataAwsLb.securityGroups), listenerArn };
    }

    const securityGroup = this._createAlbSecurityGroup();

    const alb = this._createAlb(securityGroup);

    this._addHttpListener(alb);

    listenerArn = this._addHttpsListener(alb);

    return { albSecurityGroups: Fn.tolist(alb.securityGroups), listenerArn };
  }

  /**
   * @dev Create a security group for the ALB
   * - This will allow traffic to ALB from the internet
   * 
   * @returns { SecurityGroup }
   */
  _createAlbSecurityGroup(): SecurityGroup {
    return new SecurityGroup(this, 'alb_sg', {
      name: commonConfig.nameIdentifier + '-alb',
      description: 'Firewall for internet traffic',
      vpcId: this.options.vpcId,
      ingress: [
        {
          description: 'HTTP Internet to ALB',
          fromPort: 80,
          toPort: 80,
          protocol: 'tcp',
          cidrBlocks: ['0.0.0.0/0'],
        },
        {
          description: 'HTTPS Internet to ALB',
          fromPort: 443,
          toPort: 443,
          protocol: 'tcp',
          cidrBlocks: ['0.0.0.0/0'],
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
  }

  /**
   * @dev Create application load balancer
   *
   * @param securityGroup - security group created for alb
   * @returns { Alb }
   */
  _createAlb(securityGroup: SecurityGroup): Alb {
    return new Alb(this, 'alb', {
      loadBalancerType: 'application',
      name: commonConfig.nameIdentifier,
      internal: false,
      ipAddressType: 'ipv4',
      subnets: this.options.publicSubnets,
      securityGroups: [securityGroup.id],
      idleTimeout: 60,
      tags: commonConfig.tags,
    });
  }

  /**
   * @dev Create an HTTP listener and attach it to the load balancer
   * - This will redirect any traffic routed to PORT 80 of the load balancer to PORT 443
   * 
   * @param alb
   */
  _addHttpListener(alb: Alb): void {
    new AlbListener(this, 'http_listener', {
      port: 80,
      protocol: 'HTTP',
      loadBalancerArn: alb.arn,
      defaultAction: [
        {
          type: 'redirect',
          redirect: {
            port: '443',
            protocol: 'HTTPS',
            statusCode: 'HTTP_301',
          },
        },
      ],
      tags: commonConfig.tags,
    });
  }

  /**
   * @dev Create and attach an HTTPS listener to the load balancer
   * 
   * @param alb 
   * @returns { string }
   */
  _addHttpsListener(alb: Alb): string {
    const albListener = new AlbListener(this, 'https_listener', {
      port: 443,
      protocol: 'HTTPS',
      loadBalancerArn: alb.arn,
      certificateArn: this.options.certificateArn,
      sslPolicy: 'ELBSecurityPolicy-TLS-1-2-2017-01',
      defaultAction: [
        {
          type: 'fixed-response',
          fixedResponse: {
            contentType: 'text/html',
            messageBody: 'Not Found',
            statusCode: '404',
          },
        },
      ],
      tags: commonConfig.tags,
    });

    return albListener.arn;
  }
}

export { AlbResource };
