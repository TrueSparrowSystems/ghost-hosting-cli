import { Construct } from "constructs";
import { App, TerraformStack } from "cdktf";
import { AwsProvider } from "@cdktf/provider-aws";
import { Vpc } from '../.gen/modules/vpc';

import { readInput } from "../lib/readInput";
import {
    getPublicSubnetCidrBlocks,
    getPrivateSubnetCidrBlocks
} from '../lib/util';

const defaultCidr = "10.0.0.0/16";
const vpcName = "plg-gh-vpc";

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

        new Vpc(this, vpcName, {
            name: vpcName,
            azs: ["us-east-1a"],
            cidr: defaultCidr,
            publicSubnets: getPublicSubnetCidrBlocks(defaultCidr),
            publicSubnetTags: {
                "Name": vpcName + " public"
            },
            privateSubnets: getPrivateSubnetCidrBlocks(defaultCidr, 2),
            privateSubnetTags: {
                "Name": vpcName + " public"
            },
            enableNatGateway: true,
            singleNatGateway: true,
            enableDnsHostnames: true
        });

        // new Rds(this, "plg-gh-rds", {
        //     identifier: "plg-gh-rds",
        //     username: "username",
        //     password: "password",
        //     engine: "aurora-mysql",
        //     engineVersion: "5.7.mysql_aurora.2.03.2",
        //     availabilityZone: "us-east-1a"
        // });
    }
}

const app = new App();
new MyStack(app, "plg-gh")
    .perform()
    .then()
    .catch();

app.synth();
