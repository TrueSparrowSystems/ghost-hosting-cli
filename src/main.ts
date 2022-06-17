import { Construct } from "constructs";
import { App, TerraformStack, TerraformOutput, Fn } from "cdktf";
import { AwsProvider } from "@cdktf/provider-aws";
import { Vpc } from '../.gen/modules/vpc';

import { readInput } from "../lib/readInput";
import {
    getPublicSubnetCidrBlocks,
    getPrivateSubnetCidrBlocks, getDefaultCidrBlock
} from '../lib/util';

const cidrPrefix = "10.0.0.0/16";
const vpcName = "plg-gh-vpc";
const rdsName = "plg-gh-rds";

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

        const privateSubnetCidrBlocks = getPrivateSubnetCidrBlocks(cidrPrefix, 2, 2);

        const vpc = new Vpc(this, vpcName, {
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
        });
    }
}

const app = new App();
new MyStack(app, "plg-gh")
    .perform()
    .then()
    .catch();

app.synth();
