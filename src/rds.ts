import { Resource} from "cdktf";
import { Construct } from "constructs";
import { Rds } from "../gen/modules/rds";
import { SecurityGroup } from "../.gen/providers/aws/vpc";
const rdsConfig = require("../config/rds.json");

interface Options {
    vpcId: string,
    privateSubnets: string[]
}

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
     * Main performer.
     */
    perform() {
        const nameIdentifier = 'plg-ghost';

        const rdsSgOutput = new SecurityGroup(this, "rds_sg", {
            name: nameIdentifier,
            vpcId: this.options.vpcId,
            egress: [
                {
                    fromPort: 0,
                    toPort: 0,
                    protocol: "-1",
                    cidrBlocks: ["0.0.0.0/0"]
                }
            ],
            tags: {
                Name: "PLG Ghost"
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
            password: rdsConfig.dbPassword,
            availabilityZone: rdsConfig.availabilityZone,
            instanceClass: rdsConfig.dbInstanceClass,
            subnetIds: this.options.privateSubnets,
            createDbSubnetGroup: true,
            parameterGroupName: nameIdentifier,
            optionGroupName: nameIdentifier,
            dbSubnetGroupName: nameIdentifier,
            vpcSecurityGroupIds: [rdsSgOutput.id],
            dbSubnetGroupUseNamePrefix: false,
            parameterGroupUseNamePrefix: false,
            optionGroupUseNamePrefix: false,
            skipFinalSnapshot: true,
            skipFinalBackup: true
        };

        const rdsOutput =  new Rds(this, 'rds', rdsOptions);

        return {rdsOutput, rdsSgOutput}
    }
}

export { RdsResource };
