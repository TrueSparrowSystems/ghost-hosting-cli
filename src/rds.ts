import { Resource} from "cdktf";
import { Construct } from "constructs";
import { Rds } from "../gen/modules/rds";
import { SecurityGroup } from "../gen/modules/security-group";

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
        const rdsSg = new SecurityGroup(this, 'rds_sg', {
            name: 'rds-sg',
            description: 'Firewall for RDS instance',
            vpcId: this.options.vpcId,
            useNamePrefix: false,
            ingressRules: ["mysql-tcp"],
            ingressCidrBlocks: [cidrPrefix],
            egressRules: ["all-all"],
            tags: {
                'Name': "PLG Ghost"
            }
        });

        const rdsOptions = {
            identifier: "plg-gh-rds",
            family: "mysql8.0",
            engine: "mysql",
            engineVersion: "8.0",
            allocatedStorage: "10",
            dbName: "ghost_db",
            username: "ghost",
            password: "password",
            availabilityZone: "us-east-1a",
            instanceClass: "db.t3.micro",
            subnetIds: this.options.privateSubnets,
            createDbSubnetGroup: true,
            majorEngineVersion: "8.0",
            parameterGroupName: "parameter-group-test-terraform",
            parameterGroupDescription: "Parameter group for plg cdk",
            optionGroupName: "option-group-test-terraform",
            dbSubnetGroupName: "db-group-test-terraform",
            dbSubnetGroupUseNamePrefix: false,
            parameterGroupUseNamePrefix: false,
            optionGroupUseNamePrefix: false,
            skipFinalSnapshot: true,
            skipFinalBackup: true,
            vpcSecurityGroupIds: [rdsSg.thisSecurityGroupIdOutput]
        };

        return new Rds(this, 'rds', rdsOptions);
    }
}

export { RdsResource };
