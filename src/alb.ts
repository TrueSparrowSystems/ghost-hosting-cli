import { Resource } from "cdktf";
import { Construct } from "constructs";
import { SecurityGroup } from "../gen/modules/security-group";

/**
 * Class to deploy ALB.
 */
class AlbResource extends Resource {
    options: { vpcId: string };

    constructor(scope: Construct, name: string, options: { vpcId: string }) {
        super(scope, name);

        this.options = options;
    }

    /**
     * Main performer.
     */
    perform() {
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

        // TODO: add alb creation steps
    }
}

export { AlbResource };
