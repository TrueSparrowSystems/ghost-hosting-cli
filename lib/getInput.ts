import * as fs from 'fs';
import { Command } from 'commander';
import * as promptSync from "prompt-sync";
const command = new Command();

const yes = 'y';
const no = 'n';

class GetInput {
    prompt: promptSync;
    awsAccessKeyId: string | null;
    awsSecretAccessKey: string | null;
    awsDefaultRegion: string | null;
    useExistingRDSInstance: string | null;
    blogManagementHostDomain: string | null;
    hostStaticPages: string | null;
    staticPageSiteData;
    listenerArn: string;
    isExistingAlb: string;
    isConfiguredDomain: string;

    constructor(params: { prompt: promptSync }) {
        this.awsAccessKeyId = null;
        this.awsSecretAccessKey = null;
        this.awsDefaultRegion = null;
        this.prompt = params.prompt;
        this.useExistingRDSInstance = null;
        this.blogManagementHostDomain = null;
        this.hostStaticPages = null;
        this.staticPageSiteData = {
            staticPageSiteDomain: null,
            staticPageSiteRootPath: null
        };
        this.listenerArn = '';
        this.isExistingAlb = '';
        this.isConfiguredDomain = '';
    }

    perform() {
        this._parseArguments();

        this._getAwsCredentials();

        this._validateAWSCredentials();

        this._getBlogManagementRequirements();

        this._getAlbRequirements();

        this._validateInput();

        this._createConfig();
    }

    _parseArguments() {
        command.allowUnknownOption();

        command.option(
            '--aws-access-key-id <awsAccessKeyId>',
            'AWS Access Key Id'
        ).parse(process.argv);

        command.option(
            '--aws-secret-access-key <awsSecretAccessKey>',
            'AWS Secret Access Key'
        ).parse(process.argv);

        command.option(
            '--aws-default-region <awsDefaultRegion>',
            'AWS Default Region'
        ).parse(process.argv);

        this.awsAccessKeyId = command.opts().awsAccessKeyId;
        this.awsSecretAccessKey = command.opts().awsSecretAccessKey;
        this.awsDefaultRegion = command.opts().awsDefaultRegion;
    }

    _getAwsCredentials() {
        if (!this.awsAccessKeyId) {
            this.awsAccessKeyId = this.prompt("AWS access key id? ");
        }

        if (!this.awsSecretAccessKey) {
            this.awsSecretAccessKey = this.prompt("AWS secret access key? ");
        }

        if (!this.awsDefaultRegion) {
            this.awsDefaultRegion = this.prompt("Default AWS region? ");
        }
    }

    _validateAWSCredentials() {
        // Validate aws creds
    }

    _getBlogManagementRequirements() {
        this.blogManagementHostDomain = this.prompt("Blog management host domain : ");

        this.hostStaticPages = this.prompt("Do you want to host static pages site? (y/n) : ");
        if (this.hostStaticPages === yes) {
            const staticPageSiteDomain = this.prompt("Static pages site domain : ");
            const staticPageSiteRootPath = this.prompt("Static pages site root path : ");

            this.staticPageSiteData = {
                staticPageSiteDomain,
                staticPageSiteRootPath
            }
        } else if (this.hostStaticPages === no) {
            // Do nothing
        } else {
            throw new Error('Invalid choice.');
        }
    }

    _getAlbRequirements() {
        this.isExistingAlb = this.prompt("Do you have existing ALB? (y/n) : ");

        if (this.isExistingAlb === yes) {
            this.listenerArn = this.prompt("Please provide listener ARN : ");
        } else {
            this.isConfiguredDomain = this.prompt("Do you have Route53 configured for domain? (Else the SSL certification verification will fail) (y/n) : ");
        }
    }

    _validateInput() {
        // Validate input here
    }

    _createConfig() {
        const userConfig = {
            aws: {},
            staticPageSite: {},
            alb: {}
        };

        // Add AWS credentials
        userConfig[`aws`] = {
            awsAccessKeyId: this.awsAccessKeyId,
            awsSecretAccessKey: this.awsSecretAccessKey,
            awsDefaultRegion: this.awsDefaultRegion
        };

        // Add static page site data
        if (this.hostStaticPages === yes) {
            userConfig[`staticPageSite`] = {
                staticPageSiteDomain: this.staticPageSiteData.staticPageSiteDomain,
                staticPageSiteRootPath: this.staticPageSiteData.staticPageSiteRootPath
            };
        }

        // Add alb inputs
        userConfig[`alb`] = {
            isExistingAlb: this.isExistingAlb,
            listenerArn: this.listenerArn,
            isConfiguredDomain: this.isConfiguredDomain
        };

        fs.writeFileSync('config.json', JSON.stringify(userConfig, null, 4));
    }

}

module.exports = GetInput;
