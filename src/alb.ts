import { Resource, Fn } from 'cdktf';
import { Construct } from 'constructs';
import { SecurityGroup } from '../.gen/providers/aws/vpc';
import { Alb, AlbListener, DataAwsLb, DataAwsLbListener } from '../.gen/providers/aws/elb';

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

const plgTags = {
  Name: 'PLG Ghost',
};

/**
 * Class to deploy ALB.
 */
class AlbResource extends Resource {
  options: Options;

  constructor(scope: Construct, name: string, options: Options) {
    super(scope, name);

    this.options = options;
  }

  /**
   * Main performer.
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

  _createAlbSecurityGroup(): SecurityGroup {
    return new SecurityGroup(this, 'plg-gh-alb-sg', {
      name: 'alb-sg',
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
      tags: plgTags,
    });
  }

  _createAlb(securityGroup: SecurityGroup): Alb {
    return new Alb(this, 'plg-gh-alb', {
      loadBalancerType: 'application',
      name: 'plg-gh-alb',
      internal: false,
      ipAddressType: 'ipv4',
      subnets: this.options.publicSubnets,
      securityGroups: [securityGroup.id],
      idleTimeout: 60,
      tags: plgTags,
    });
  }

  _addHttpListener(alb: Alb): void {
    new AlbListener(this, 'plg-gh-http-listener', {
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
      tags: plgTags,
    });
  }

  _addHttpsListener(alb: Alb): string {
    const albListener = new AlbListener(this, 'plg-gh-https-listener', {
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
      tags: plgTags,
    });

    return albListener.arn;
  }
}

export { AlbResource };
