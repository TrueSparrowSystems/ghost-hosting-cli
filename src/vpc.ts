import { Fn, Resource, TerraformOutput } from "cdktf";
import { Construct } from "constructs";
import { Vpc } from "../.gen/modules/vpc";
import { SecurityGroup } from "../gen/modules/security-group";
import { DataAwsAvailabilityZones } from "../.gen/providers/aws/datasources";

import { getPrivateSubnetCidrBlocks, getPublicSubnetCidrBlocks } from "../lib/util";

const cidrPrefix = "23.0.0.0/16";
const nameLabel = "PLG Ghost Test";
const nameIdentifier = "plg-ghost-test";

/**
 * Class to deploy VPC.
 */
class VpcResource extends Resource {
    options: {};

    constructor(scope: Construct, name: string, options: any) {
        super(scope, name);

        this.options = options;
    }

    /**
     * Main performer.
     */
    perform() {
        const privateSubnetCidrBlocks = this._getSubnetCidr();

        const zones = this._getZones();

        return this._createVpc(privateSubnetCidrBlocks, zones);
    }

    /**
     * Get required private subnet cidr blocks.
     *
     * @private
     */
    _getSubnetCidr() {
        return getPrivateSubnetCidrBlocks(
            cidrPrefix,
            2,
            2
        );
    }

    /**
     * Get available zones for the VPC.
     *
     * @private
     */
    _getZones() {
        const zones = new DataAwsAvailabilityZones(this, 'zones', {
            state: 'available'
        });

        new TerraformOutput(this, "first_zone", {
            value: Fn.element(zones.names, 0)
        });

        new TerraformOutput(this, "second_zone", {
            value: Fn.element(zones.names, 1)
        });

        return zones;
    }

    /**
     * Create VPC and the VPC security group.
     *
     * @param privateSubnetCidrBlocks
     * @param zones
     * @private
     */
    _createVpc(privateSubnetCidrBlocks: string[], zones: DataAwsAvailabilityZones) {
        const vpcOptions = {
            name: nameLabel,
            azs: [Fn.element(zones.names, 0), Fn.element(zones.names, 1)],
            cidr: cidrPrefix,
            publicSubnets: getPublicSubnetCidrBlocks(cidrPrefix),
            publicSubnetTags: {
                "Name": nameLabel + " public"
            },
            privateSubnets: privateSubnetCidrBlocks,
            privateSubnetTags: {
                "Name": nameLabel + " private"
            },
            enableNatGateway: true,
            singleNatGateway: true,
            enableDnsHostnames: true
        };

        const vpc = new Vpc(this, nameIdentifier, vpcOptions);

        const securityGroupOutput = new SecurityGroup(this, 'vpc_sg', {
            name: "PLG Ghost VPC Security Group",
            description: "Security Group managed by Terraform",
            vpcId: vpc.vpcIdOutput,
            useNamePrefix: false,
            ingressCidrBlocks: ["0.0.0.0/0"],
            ingressRules: [
                "ssh-tcp"
            ],
            egressRules: ["all-all"]
        });

        return { vpcOutput: vpc, vpcSg: securityGroupOutput};
    }
}

export { VpcResource };
