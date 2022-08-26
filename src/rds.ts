import { Resource } from "cdktf";
import { Construct } from "constructs";
import { Rds } from "../.gen/modules/rds";
import { SecurityGroup } from "../.gen/providers/aws/vpc";
import { Password } from "../.gen/providers/random";

const rdsConfig = require("../config/rds.json");

interface Options {
    vpcId: string;
    vpcSubnets: string[];
    useExistingRds: boolean;
    rdsHost: string | undefined;
    rdsDbUserName: string | undefined;
    rdsDbPassword: string | undefined;
    rdsDbName: string | undefined;
}

interface Response {
    rdsHost: string;
    rdsDbUserName: string;
    rdsDbPassword: string;
    rdsDbName: string;
    rdsSecurityGroupId: string;
}

const plgTags = {
    Name: "PLG Ghost"
};

/**
 * Class to deploy RDS instance.
 */
class RdsResource extends Resource {
    options: Options;

    /**
     * Constructor to deploy RDS instance.
     * @param scope
     * @param name
     * @param options
     */
    constructor(scope: Construct, name: string, options: Options) {
        super(scope, name);

        this.options = options;
    }

    /**
     * Main performer of the class.
     */
    perform(): Response {
        const responseData = {
            rdsHost: this.options.rdsHost || '',
            rdsDbUserName: this.options.rdsDbUserName || '',
            rdsDbPassword: this.options.rdsDbPassword || '',
            rdsDbName: this.options.rdsDbName || '',
            rdsSecurityGroupId: ''
        };

        if (this.options.useExistingRds) {
            return responseData;
        }

        if (!this.options.useExistingRds) {
            const nameIdentifier = 'plg-ghost';

            const rdsSg = new SecurityGroup(this, "rds_sg", {
                name: nameIdentifier + "rds-sg",
                vpcId: this.options.vpcId,
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

            const password = new Password(this, "rds-pw", {
                length: 8,
                special: true,
                minLower: 4,
                minUpper: 2,
                minNumeric: 1,
                overrideSpecial: "@#",
                keepers: {
                    "vpc_id": this.options.vpcId
                }
            });

            const rdsOptions = {
                identifier: nameIdentifier,
                family: "mysql8.0",
                engine: "mysql",
                engineVersion: "8.0",
                majorEngineVersion: "8.0",
                allocatedStorage: rdsConfig.dbStorageSizeInGB,
                dbName: rdsConfig.dbName,
                username: rdsConfig.dbUserName,
                password: password.result,
                availabilityZone: rdsConfig.availabilityZone,
                instanceClass: rdsConfig.dbInstanceClass,
                subnetIds: this.options.vpcSubnets,
                parameterGroupName: nameIdentifier,
                optionGroupName: nameIdentifier,
                dbSubnetGroupName: nameIdentifier,
                vpcSecurityGroupIds: [rdsSg.id],
                createDbSubnetGroup: true,
                dbSubnetGroupUseNamePrefix: false,
                parameterGroupUseNamePrefix: false,
                optionGroupUseNamePrefix: false,
                createRandomPassword: false,
                skipFinalSnapshot: true,
                skipFinalBackup: true,
                publiclyAccessible: true,
                tags: plgTags
            };

            const rds =  new Rds(this, 'rds', rdsOptions);

            responseData.rdsHost = rds.dbInstanceAddressOutput;
            responseData.rdsDbUserName = rdsConfig.dbUserName;
            responseData.rdsDbPassword = password.result;
            responseData.rdsDbName = rdsConfig.dbName;
            responseData.rdsSecurityGroupId = rdsSg.id;
        }

        return responseData
    }
}

export { RdsResource };
