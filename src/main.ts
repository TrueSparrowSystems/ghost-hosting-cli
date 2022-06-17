import { Construct } from "constructs";
import { App, TerraformStack, TerraformOutput, Fn } from "cdktf";
import { AwsProvider } from "@cdktf/provider-aws";
import { Vpc } from '../.gen/modules/vpc';
import { Rds } from '../.gen/modules/rds';
import { SecurityGroup } from '../.gen/modules/security-group';

import { readInput } from "../lib/readInput";
import {
    getPublicSubnetCidrBlocks,
    getPrivateSubnetCidrBlocks, getDefaultCidrBlock
} from '../lib/util';

const cidrPrefix = "10.0.0.0/16";
const vpcName = "PLG Ghost VPC";
const rdsName = "plg-ghost-rds";

class MyStack extends TerraformStack {
    userInput: any;
    constructor(scope: Construct, name: string) {
        super(scope, name);

        this.userInput = {};
    }

    async perform() {
        this.userInput = readInput();

        new AwsProvider(this, "AWS", {
            region: this.userInput.aws.awsDefaultRegion,
            accessKey: this.userInput.aws.awsAccessKeyId,
            secretKey: this.userInput.aws.awsSecretAccessKey
        });


        // VPC
        const vpcOptions = this._getVpcOptions();
        const vpc = new Vpc(this, vpcName, vpcOptions);

        // RDS
        new Rds(this, rdsName, {
            identifier: rdsName,
            engine: "mysql",
            engineVersion: "5.7",
            allocatedStorage: "10",
            name: "testdb",
            username: "username",
            password: "password",
            availabilityZone: "us-east-1a",
            instanceClass: "db.t3.micro",
            subnetIds: Fn.tolist(vpc.privateSubnetsOutput),
            createDbSubnetGroup: true,
            majorEngineVersion: "5.7",
            parameterGroupName: "parameter-group-test-terraform",
            parameterGroupDescription: "Parameter group for plg cdk",
            family: "mysql5.7",
            optionGroupName: "option-group-test-terraform",
            dbSubnetGroupName: "db-group-test-terraform",
            dbSubnetGroupUseNamePrefix: false,
            parameterGroupUseNamePrefix: false,
            optionGroupUseNamePrefix: false
        });
    }

    _getVpcOptions() {
        const privateSubnetCidrBlocks = getPrivateSubnetCidrBlocks(cidrPrefix, 2, 2);

        return {
            name: vpcName,
            azs: ["us-east-1a", "us-east-1b"],
            cidr: cidrPrefix,
            publicSubnets: getPublicSubnetCidrBlocks(cidrPrefix),
            publicSubnetTags: {
                "Name": vpcName + " public"
            },
            privateSubnets: privateSubnetCidrBlocks,
            privateSubnetTags: {
                "Name": vpcName + " private"
            },
            enableNatGateway: true,
            singleNatGateway: true,
            enableDnsHostnames: true
        }
    }
}

const app = new App();
new MyStack(app, "plg-gh")
    .perform()
    .then()
    .catch();

app.synth();
