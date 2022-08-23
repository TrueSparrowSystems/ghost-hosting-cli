import { Resource } from "cdktf";
import { Construct } from "constructs";
import { Rds } from "../.gen/modules/rds";
import { SecurityGroup } from "../.gen/providers/aws/vpc";
import { Password } from "../.gen/providers/random";

const rdsConfig = require("../config/rds.json");

interface Options {
    vpcId: string,
    privateSubnets: string[],
    publicSubnets: string[]
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
    perform() {
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

        // TODO: ask user for - whether existing RDS instance or use from rds config
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
            subnetIds: this.options.publicSubnets,
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

        return { rds, rdsSg }
    }
}

export { RdsResource };
