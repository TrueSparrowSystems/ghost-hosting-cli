import * as fs from 'fs';
import * as readlineSyc from "readline-sync";
import { Command } from 'commander';
const command = new Command();

const yes = 'y';
const no = 'n';

interface Options {
    awsAccessKeyId: string,
    awsSecretAccessKey: string,
    awsDefaultRegion: string,
    useExistingRDSInstance: boolean,
    blogManagementHostDomain: string,
    hostStaticPages: string,
    listenerArn: string,
    isExistingAlb: string,
    isConfiguredDomain: string,
    staticPageSiteDomain: string,
    staticPageSiteRootPath: string
}

const options: Options = {
    awsAccessKeyId: '',
    awsSecretAccessKey: '',
    awsDefaultRegion: '',
    useExistingRDSInstance: false,
    blogManagementHostDomain: '',
    hostStaticPages: '',
    listenerArn: '',
    isExistingAlb: '',
    isConfiguredDomain: '',
    staticPageSiteDomain: '',
    staticPageSiteRootPath: ''
};

console.log(process.argv);

export class GetInput {
    constructor() {
        // Do nothing
    }

    perform() {
        // TODO: if file already exists, consider values from file otherwise ask for input

        this._parseArguments();

        this._getAwsCredentials();

        this._validateAWSCredentials();

        // this._getBlogManagementRequirements();

        // this._getAlbRequirements();

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

        options.awsAccessKeyId = command.opts().awsAccessKeyId;
        options.awsSecretAccessKey = command.opts().awsSecretAccessKey;
        options.awsDefaultRegion = command.opts().awsDefaultRegion;
    }

    _getAwsCredentials() {
        if (!options.awsAccessKeyId) {
            options.awsAccessKeyId = readlineSyc.question("AWS access key id? ");
        }

        if (!options.awsSecretAccessKey) {
            options.awsSecretAccessKey = readlineSyc.question("AWS secret access key? ");
        }

        if (!options.awsDefaultRegion) {
            options.awsDefaultRegion = readlineSyc.question("Default AWS region? ");
        }
    }

    _validateAWSCredentials() {
        // Validate aws creds
    }

    _getBlogManagementRequirements() {
        options.blogManagementHostDomain = readlineSyc.question("Blog management host url : ");
        // TODO: Validation for HTTPS only

        options.hostStaticPages = readlineSyc.question("Do you want to host static pages site? (y/n) : ");
        if (options.hostStaticPages === yes) {
            // TODO: create static bucket
            options.staticPageSiteDomain = readlineSyc.question("Static pages site url : ");
            options.staticPageSiteRootPath = readlineSyc.question("Static pages site root path : ");
        } else if (options.hostStaticPages === no) {
            // Do nothing
        } else {
            throw new Error('Invalid choice.');
        }
    }

    _getAlbRequirements() {
        options.isExistingAlb = readlineSyc.question("Do you have existing ALB? (y/n) : ");

        if (options.isExistingAlb === yes) {
            options.listenerArn = readlineSyc.question("Please provide listener ARN : ");
        } else {
            options.isConfiguredDomain = readlineSyc.question("Do you have Route53 configured for domain? (Else the SSL certification verification will fail) (y/n) : ");
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
            awsAccessKeyId: options.awsAccessKeyId,
            awsSecretAccessKey: options.awsSecretAccessKey,
            awsDefaultRegion: options.awsDefaultRegion
        };

        // Add static page site data
        if (options.hostStaticPages === yes) {
            userConfig[`staticPageSite`] = {
                staticPageSiteDomain: options.staticPageSiteDomain,
                staticPageSiteRootPath: options.staticPageSiteRootPath
            };
        }

        // Add alb inputs
        userConfig[`alb`] = {
            isExistingAlb: options.isExistingAlb,
            listenerArn: options.listenerArn,
            isConfiguredDomain: options.isConfiguredDomain
        };

        fs.writeFileSync('config.json', JSON.stringify(userConfig, null, 4));
    }

}

module.exports = GetInput;
