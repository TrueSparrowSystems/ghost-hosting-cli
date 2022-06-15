import { Construct } from "constructs";
import { App, TerraformStack } from "cdktf";
import { AwsProvider } from "@cdktf/provider-aws";
import { Vpc } from '../.gen/modules/vpc';
import { Rds } from '../.gen/modules/rds';

import { readInput } from "../lib/readInput";

class MyStack extends TerraformStack {
    userInput: any;
    constructor(scope: Construct, name: string) {
        super(scope, name);

        this.userInput = {};
    }

    async perform() {
        this.userInput = readInput();
        console.log('Default Region: ', this.userInput.aws.awsDefaultRegion);

        new AwsProvider(this, "AWS", {
            region: this.userInput.aws.awsDefaultRegion,
            accessKey: this.userInput.aws.awsAccessKeyId,
            secretKey: this.userInput.aws.awsSecretAccessKey
        });

        new Vpc(this, "plg-gh-vpc", {
            name: "plg-gh-vpc",
            cidr: "10.0.0.0/24",
        });

        new Rds(this, "plg-gh-rds", {
            identifier: "plg-gh-rds",
            username: "username",
            password: "password",
            engine: "aurora-mysql",
            engineVersion: "5.7.mysql_aurora.2.03.2",
            availabilityZone: "us-east-1a"
        });
    }
}

const app = new App();
new MyStack(app, "plg-gh")
    .perform()
    .then(() => {
        // add logic here
    });
app.synth();
