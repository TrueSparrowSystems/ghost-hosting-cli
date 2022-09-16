import { Fn, Resource } from 'cdktf';
import { Construct } from 'constructs';

import { Vpc } from '../../gen/modules/vpc';
import { DataAwsSubnet } from '../../gen/providers/aws/vpc';
import { DataAwsAvailabilityZones } from '../../gen/providers/aws/datasources';

import { getPrivateSubnetCidrBlocks, getPublicSubnetCidrBlocks } from '../../lib/util';
import vpcConfig from '../../config/vpc.json';
import commonConfig from '../../config/common.json';

interface Options {
  useExistingVpc: boolean;
  vpcSubnets: string[];
  vpcPublicSubnets: string[];
}

interface Response {
  vpcId: string;
  vpcSubnets: string[];
  vpcPublicSubnets: string[];
}

/**
 * @dev Class to create VPC resource with the subnets
 * - VPC and subnet creation will be dependent on the choice provided
 */
class VpcResource extends Resource {
  options: Options;

  /**
   * @dev Constructor for the VPC resource class
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
    const privateSubnetCidrBlocks = this._getSubnetCidr();

    const zones = this._getZones();

    return this._getOrCreateVpc(privateSubnetCidrBlocks, zones);
  }

  /**
   * @dev Get required private subnet cidr blocks
   *
   * @returns { string[] } - list of private subnet cidr blocks
   */
  _getSubnetCidr(): string[] {
    if (this.options.useExistingVpc) {
      return [];
    }

    return getPrivateSubnetCidrBlocks(vpcConfig.cidrPrefix, vpcConfig.numberOfPrivateSubnets, 2);
  }

  /**
   * @dev Get available zones for the vpc
   *
   * @returns { DataAwsAvailabilityZones } - available zones
   */
  _getZones(): DataAwsAvailabilityZones {
    const zones = new DataAwsAvailabilityZones(this, 'zones', {
      state: 'available',
    });

    return zones;
  }

  /**
   * @dev Get or create VPC
   * - This will create new vpc and subnets based on the choice provided
   *
   * @param privateSubnetCidrBlocks - list of private subnet's cidr blocks
   * @param zones - available zones
   * @returns { Response }
   */
  _getOrCreateVpc(privateSubnetCidrBlocks: string[], zones: DataAwsAvailabilityZones): Response {
    let vpcId, vpcSubnets, vpcPublicSubnets: string[];

    if (this.options.useExistingVpc) {
      const subnetData = new DataAwsSubnet(this, 'subnet', {
        id: this.options.vpcSubnets[0],
      });
      vpcId = subnetData.vpcId;
      vpcSubnets = this.options.vpcSubnets;
      vpcPublicSubnets = this.options.vpcPublicSubnets;
    } else {
      const vpcOptions = {
        name: commonConfig.nameIdentifier,
        azs: [Fn.element(zones.names, 0), Fn.element(zones.names, 1)],
        cidr: vpcConfig.cidrPrefix,
        publicSubnets: getPublicSubnetCidrBlocks(vpcConfig.cidrPrefix),
        publicSubnetTags: {
          Name: commonConfig.nameLabel + ' public',
        },
        privateSubnets: privateSubnetCidrBlocks,
        privateSubnetTags: {
          Name: commonConfig.nameLabel + ' private',
        },
        enableNatGateway: true,
        singleNatGateway: true,
        enableDnsHostnames: true,
        tags: commonConfig.tags,
      };

      const vpc = new Vpc(this, 'vpc', vpcOptions);

      vpcId = vpc.vpcIdOutput;
      vpcSubnets = Fn.tolist(vpc.privateSubnetsOutput);
      vpcPublicSubnets = Fn.tolist(vpc.publicSubnetsOutput);
    }

    return { vpcId, vpcSubnets, vpcPublicSubnets };
  }
}

export { VpcResource };
