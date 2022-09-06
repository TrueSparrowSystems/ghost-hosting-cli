import { Resource, TerraformOutput } from 'cdktf';
import { Construct } from 'constructs';
import { Rds } from '../gen/modules/rds';
import { SecurityGroup } from '../gen/providers/aws/vpc';
import { Password } from '../gen/providers/random';

import rdsConfig from '../config/rds.json';
import commonConfig from '../config/common.json';

interface Options {
  vpcId: string;
  vpcSubnets: string[];
  useExistingRds: boolean;
  rdsHost: string | undefined;
  rdsDbUserName: string | undefined;
  rdsDbPassword: string | undefined;
  rdsDbName: string | undefined;
  region: string;
}

interface Response {
  rdsHost: string;
  rdsDbUserName: string;
  rdsDbPassword: string;
  rdsDbName: string;
  rdsSecurityGroupId: string;
}

/**
 * @dev Class to create RDS instance
 * - This will create
 *    1. RDS instance with randomly generated password
 *    2. Security group to allow traffic to RDS instance
 */
class RdsResource extends Resource {
  options: Options;

  /**
   * @dev Constructor for the RDS instance resource class
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
   * - This creates RDS instance based on choices provided.
   *
   * @returns { Response }
   */
  perform(): Response {
    const responseData = {
      rdsHost: this.options.rdsHost || '',
      rdsDbUserName: this.options.rdsDbUserName || '',
      rdsDbPassword: this.options.rdsDbPassword || '',
      rdsDbName: this.options.rdsDbName || '',
      rdsSecurityGroupId: '',
    };

    if (this.options.useExistingRds) {
      return responseData;
    }

    if (!this.options.useExistingRds) {
      const rdsSg = new SecurityGroup(this, 'rds_sg', {
        name: commonConfig.nameIdentifier + '-rds',
        vpcId: this.options.vpcId,
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

      const password = new Password(this, 'rds_pw', {
        length: 8,
        special: true,
        minLower: 4,
        minUpper: 2,
        minNumeric: 1,
        overrideSpecial: '@#',
        keepers: {
          vpc_id: this.options.vpcId,
        },
      });

      const rdsOptions = {
        identifier: commonConfig.nameIdentifier,
        family: 'mysql8.0',
        engine: 'mysql',
        engineVersion: '8.0',
        majorEngineVersion: '8.0',
        allocatedStorage: rdsConfig.dbStorageSizeInGB,
        dbName: rdsConfig.dbName,
        username: rdsConfig.dbUserName,
        password: password.result,
        availabilityZone: `${this.options.region}a`,
        instanceClass: rdsConfig.dbInstanceClass,
        subnetIds: this.options.vpcSubnets,
        parameterGroupName: commonConfig.nameIdentifier,
        optionGroupName: commonConfig.nameIdentifier,
        dbSubnetGroupName: commonConfig.nameIdentifier,
        vpcSecurityGroupIds: [rdsSg.id],
        createDbSubnetGroup: true,
        dbSubnetGroupUseNamePrefix: false,
        parameterGroupUseNamePrefix: false,
        optionGroupUseNamePrefix: false,
        createRandomPassword: false,
        skipFinalSnapshot: true,
        skipFinalBackup: true,
        publiclyAccessible: false,
        tags: commonConfig.tags,
      };

      const rds = new Rds(this, 'rds', rdsOptions);

      responseData.rdsHost = rds.dbInstanceAddressOutput;
      responseData.rdsDbUserName = rdsConfig.dbUserName;
      responseData.rdsDbPassword = password.result;
      responseData.rdsDbName = rdsConfig.dbName;
      responseData.rdsSecurityGroupId = rdsSg.id;

      new TerraformOutput(this, 'rds_host', {
        value: rds.dbInstanceAddressOutput,
      });

      new TerraformOutput(this, 'rds_user', {
        value: rdsConfig.dbUserName,
      });

      new TerraformOutput(this, 'rds_password', {
        value: password.result,
        sensitive: true,
      });

      new TerraformOutput(this, 'rds_database', {
        value: rdsConfig.dbName,
      });
    }

    return responseData;
  }
}

export { RdsResource };
