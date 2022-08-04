import { Resource} from "cdktf";
import { Construct } from "constructs";
import { Rds } from "../gen/modules/rds";
import { SecurityGroup } from "../.gen/providers/aws/vpc";

const cidrPrefix =  "23.0.0.0/16";

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
        let dbUserName = "ghost";
        let dbPassword = "password";
        let dbName = "ghost_db";
        let dbStorageSizeinGB = "10";
        let awsRegion = "us-east-1";
        let dbInstanceClas = "db.t3.micro";

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
            allocatedStorage: dbStorageSizeinGB,
            dbName: dbName,
            username: dbUserName,
            password: dbPassword,
            availabilityZone: awsRegion,
            instanceClass: dbInstanceClas,
            subnetIds: this.options.privateSubnets,
            createDbSubnetGroup: true,
            majorEngineVersion: "8.0",
            parameterGroupName: nameIdentifier,
            optionGroupName: nameIdentifier,
            dbSubnetGroupName: nameIdentifier,
            dbSubnetGroupUseNamePrefix: false,
            parameterGroupUseNamePrefix: false,
            optionGroupUseNamePrefix: false,
            skipFinalSnapshot: true,
            skipFinalBackup: true,
            publiclyAccessible: true, // TODO: change this later once testing done
            vpcSecurityGroupIds: [rdsSgOutput.id],
        };

        const rdsOutput =  new Rds(this, 'rds', rdsOptions);

        return {rdsOutput, rdsSgOutput}
    }
}

export { RdsResource };
