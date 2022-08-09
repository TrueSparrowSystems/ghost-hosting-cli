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

        const { vpc, vpcSg } = this._createVpc();

        const { rds, rdsSg } = this._createRdsInstance(vpc);

        const { alb, targetGroup } = this._createAlb(vpc);

        const albSecurityGroupId = alb.securityGroups[0];

        this._createEcs(
            vpc.vpcIdOutput,
            vpc.privateSubnetsOutput,
            vpcSg.id,
            rds.dbInstanceAddressOutput,
            albSecurityGroupId,
            targetGroup.arn,
            alb.dnsName,
            rdsSg.id
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
     * @param vpc
     * @private
     */
    _createRdsInstance(vpc: Vpc) {
        return new RdsResource(this, "plg-gh-rds", {
            vpcId: vpc.vpcIdOutput,
            privateSubnets: Fn.tolist(vpc.privateSubnetsOutput),
            publicSubnets: Fn.tolist(vpc.publicSubnetsOutput)
        }).perform();
    }

    /**
     * Create application load balancer
     *
     * @param vpc
     * @private
     */
    _createAlb(vpc: Vpc) {
        return new AlbResource(this, "plg-gh-alb", {
            vpcId: vpc.vpcIdOutput,
            publicSubnets: Fn.tolist(vpc.publicSubnetsOutput),
            isExistingAlb: false,
            listenerArn: "",
            isConfiguredDomain: ""
        }).perform();
    }

    /**
     * Create ECS container, cluster, task-definition, service and task in EC2-ECS optimised instance
     *
     * @param vpcId
     * @param subnets
     * @param securityGroupId
     * @param dbInstanceAddress
     * @param albSecurityGroupId
     * @param targetGroupArn
     * @param albDnsName
     * @param rdsSecurityGroupId
     * @private
     */
    _createEcs(
        vpcId: string,
        subnets: string,
        securityGroupId: string,
        dbInstanceAddress: string,
        albSecurityGroupId: string,
        targetGroupArn: string,
        albDnsName: string,
        rdsSecurityGroupId: string
    ) {
        return new EcsResource(this, "plg-gh-ecs", {
            vpcId,
            subnets: Fn.tolist(subnets),
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
