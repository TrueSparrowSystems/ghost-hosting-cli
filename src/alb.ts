import { Resource } from "cdktf";
import { Construct } from "constructs";
import { SecurityGroup } from "../gen/modules/security-group";
import { Alb, AlbListener, AlbTargetGroup } from "../.gen/providers/aws/elb";

interface Options {
    vpcId: string,
    publicSubnets: string[],
    isExistingAlb: boolean,
    listenerArn: string,
    isConfiguredDomain: string
};

/**
 * Class to deploy ALB.
 */
class AlbResource extends Resource {
    options: Options;
    listenerArn: string;

    constructor(scope: Construct, name: string, options: Options) {
        super(scope, name);

        this.options = options;
        this.listenerArn = "";
    }

    /**
     * Main performer.
     */
    perform() {
        // TODO: logic based on user input
        const ablSg = this._createSecurityGroup();

        const alb = this._createAlb(ablSg);

        this._addHttpListener(alb);

        this._addHttpsListener(alb);
    }

    _createSecurityGroup() {
        return new SecurityGroup(this, 'alb_sg', {
            name: 'alb-sg',
            description: 'Firewall for internet traffic',
            vpcId: this.options.vpcId,
            useNamePrefix: false,
            ingressRules: ["https-443-tcp", "http-80-tcp"],
            ingressCidrBlocks: ["0.0.0.0/0"],
            egressRules: ["all-all"],
            tags: {
                'Name': "PLG Ghost"
            }
        });
    }

    _createAlb(ablSg: SecurityGroup) {
        return new Alb(this, "alb", {
            loadBalancerType: "application",
            securityGroups: [ablSg.thisSecurityGroupIdOutput],
            subnets: this.options.publicSubnets
        });
    }

    _addHttpListener(alb: Alb) {
        return new AlbListener(this, "http-listener", {
            port: 80,
            protocol: "HTTP",
            loadBalancerArn: alb.arn,
            defaultAction: [
                {
                    type: "redirect",
                    redirect: {
                        statusCode: "HTTPS_301",
                        port: "443",
                        protocol: "HTTPS"
                    }
                }
            ]
        });
    }

    _addHttpsListener(alb: Alb) {
        const targetGroup = new AlbTargetGroup(this, "alb_tg", {
            name: "plg-alb-target-group",
            port: 443,
            protocol: "HTTPS",
            targetType: "instance",
            vpcId: this.options.vpcId
        });

        return new AlbListener(this, "http-listener", {
            port: 443,
            protocol: "HTTPS",
            loadBalancerArn: alb.arn,
            sslPolicy: "ELBSecurityPolicy-TLS-1-2-2017-01",
            defaultAction: [
                {
                    type: "forward",
                    forward: {
                        targetGroup: [
                            {
                                arn: targetGroup.arn
                            }
                        ]
                    }
                }
            ]
        });
    }
}

export { AlbResource };
