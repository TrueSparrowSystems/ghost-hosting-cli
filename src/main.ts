import { Construct } from "constructs";
import { App, TerraformStack, Fn } from "cdktf";
import { AwsProvider } from "@cdktf/provider-aws";
import { Vpc } from "../.gen/modules/vpc";

import { VpcResource } from "./vpc";
import { RdsResource } from "./rds";
import { EcsResource} from "./ecs";
import { AlbResource } from "./alb";

import { readInput } from "../lib/readInput";

/**
 * Terraform stack
 */
class MyStack extends TerraformStack {
    userInput: any;

    /**
     * Constructor for the terraform stack
     *
     * @param {Construct} scope
     * @param {string} name
     */
    constructor(scope: Construct, name: string) {
        super(scope, name);

        this.userInput = {};
    }

    /**
     * Main performer of the class.
     */
    async perform() {
        this.userInput = readInput();

        this._setAwsProvider();

        const { vpcOutput, vpcSg } = this._createVpc();

        const {rdsOutput, rdsSgOutput} = this._createRdsInstance(vpcOutput);

        const { alb, targetGroup } = this._createAlb(vpcOutput);

        const securityGroupId = alb.securityGroups[0];

        this._createEcs(
            vpcOutput.vpcIdOutput,
            vpcOutput.publicSubnetsOutput,
            vpcOutput.privateSubnetsOutput,
            vpcSg.thisSecurityGroupIdOutput,
            rdsOutput.dbInstanceAddressOutput,
            securityGroupId,
            targetGroup.arn,
            alb.dnsName,
            rdsSgOutput.id
        );
    }

    /**
     * Set aws provider for provided access key and secret key.
     *
     * @private
     */
    _setAwsProvider() {
        new AwsProvider(this, "AWS", {
            region: this.userInput.aws.awsDefaultRegion,
            accessKey: this.userInput.aws.awsAccessKeyId,
            secretKey: this.userInput.aws.awsSecretAccessKey
        });
    }

    /**
     * Create aws vpc
     *
     * @private
     */
    _createVpc() {
        return new VpcResource(this, "plg-gh-vpc", {}).perform();
    }

    /**
     * Create aws rds instance in private subnet.
     *
     * @param vpcOutput
     * @private
     */
    _createRdsInstance(vpcOutput: Vpc) {
        return new RdsResource(this, "plg-gh-rds", {
            vpcId: vpcOutput.vpcIdOutput,
            privateSubnets: Fn.tolist(vpcOutput.privateSubnetsOutput)
        }).perform();
    }

    /**
     * Create application load balancer
     *
     * @param vpcOutput
     * @private
     */
    _createAlb(vpcOutput: Vpc) {
         // TODO: change arguments - read from config.json
        return new AlbResource(this, "plg-gh-alb", {
            vpcId: vpcOutput.vpcIdOutput,
            publicSubnets: Fn.tolist(vpcOutput.publicSubnetsOutput),
            isExistingAlb: false,
            listenerArn: "",
            isConfiguredDomain: ""
        }).perform();
    }

    /**
     * Create ECS container, cluster, task-definition, service and task in EC2-ECS optimised instance
     *
     * @param vpcId
     * @param publicSubnets
     * @param securityGroupId
     * @param dbInstanceAddress
     * @param albSecurityGroupId
     * @param targetGroupArn
     * @param albDnsName
     * @private
     */
    _createEcs(
        vpcId: string,
        publicSubnets: string,
        privateSubnets: string,
        securityGroupId: string,
        dbInstanceAddress: string,
        albSecurityGroupId: string,
        targetGroupArn: string,
        albDnsName: string,
        rdsSecurityGroupId: string
    ) {
        return new EcsResource(this, "plg-gh-ecs", {
            vpcId,
            publicSubnets: Fn.tolist(publicSubnets),
            privateSubnets: Fn.tolist(privateSubnets),
            vpcSecurityGroupId: securityGroupId,
            dbInstanceEndpoint: dbInstanceAddress,
            albSecurityGroupId,
            targetGroupArn,
            albDnsName,
            rdsSecurityGroupId
        }).perform();
    }
}

const app = new App();
new MyStack(app, "plg-gh")
    .perform()
    .then()
    .catch();

app.synth();
