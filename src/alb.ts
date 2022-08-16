import { Resource } from "cdktf";
import { Construct } from "constructs";
import { SecurityGroup } from "../.gen/providers/aws/vpc";
import { Alb, AlbListener, AlbTargetGroup } from "../.gen/providers/aws/elb";

interface Options {
    vpcId: string,
    publicSubnets: string[],
    isExistingAlb: boolean,
    listenerArn: string,
    isConfiguredDomain: string
}

const plgTags = {
    Name: "PLG Ghost"
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
    perform() {
        const securityGroup = this._createAlbSecurityGroup();

        const targetGroup = this._createTargetGroup();

        const alb = this._createAlb(securityGroup);

        this._addHttpListener(alb, targetGroup);

        this._addHttpsListener(alb, targetGroup);

        return { alb, targetGroup };
    }

    _createAlbSecurityGroup() {
        return new SecurityGroup(this, "plg-gh-alb-sg", {
            name: "alb-sg",
            description: "Firewall for internet traffic",
            vpcId: this.options.vpcId,
            ingress: [
                {
                    description: "HTTP Internet to ALB",
                    fromPort: 80,
                    toPort: 80,
                    protocol: "tcp",
                    cidrBlocks: ["0.0.0.0/0"]
                },
                {
                    description: "HTTPS Internet to ALB",
                    fromPort: 443,
                    toPort: 443,
                    protocol: "tcp",
                    cidrBlocks: ["0.0.0.0/0"]
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

    }

    _createTargetGroup() {
        return new AlbTargetGroup(this, "plg-gh-alb-tg", {
            name: "plg-gh-alb-tg",
            port: 80,
            protocol: "HTTP",
            targetType: "ip",
            vpcId: this.options.vpcId,
            protocolVersion: "HTTP1",
            healthCheck: {
                protocol: "HTTP",
                path: "/",
                timeout: 10,
                matcher: "200,202,301",
                healthyThreshold: 2,
                interval: 12
            },
            tags: plgTags
        });
    }

    _createAlb(securityGroup: SecurityGroup) {
        return new Alb(this, "plg-gh-alb", {
            loadBalancerType: "application",
            name: "plg-gh-alb",
            internal: false,
            ipAddressType: "ipv4",
            subnets: this.options.publicSubnets,
            securityGroups: [securityGroup.id],
            idleTimeout: 60,
            tags: plgTags
        });
    }

    _addHttpListener(alb: Alb, targetGroup: AlbTargetGroup) {
        return new AlbListener(this, "plg-gh-http-listener", {
            port: 80,
            protocol: "HTTP",
            loadBalancerArn: alb.arn,
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
            ],
            tags: plgTags
        });
    }

    _addHttpsListener(alb: Alb, targetGroup: AlbTargetGroup) {
        if (!this.options.isConfiguredDomain) {
            return;
        }

        return new AlbListener(this, "plg-gh-https-listener", {
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
            ],
            tags: plgTags
        });
    }
}

export { AlbResource };
