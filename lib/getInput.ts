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
    isExistingRds: string,
    ghostHostingUrl: string,
    hostStaticPages: string,
    listenerArn: string,
    isExistingAlb: string,
    isConfiguredDomain: string,
    staticWebsiteUrl: string,
    staticPageSiteRootPath: string,
    rdsDbName: string,
    rdsHost: string,
    rdsDbUserName: string,
    rdsDbPassword: string
}

const options: Options = {
    awsAccessKeyId: '',
    awsSecretAccessKey: '',
    awsDefaultRegion: '',
    isExistingRds: '',
    ghostHostingUrl: '',
    hostStaticPages: '',
    listenerArn: '',
    isExistingAlb: '',
    isConfiguredDomain: '',
    staticWebsiteUrl: '',
    staticPageSiteRootPath: '',
    rdsDbName: '',
    rdsHost: '',
    rdsDbUserName: '',
    rdsDbPassword: ''
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

        this._getBlogManagementRequirements();

        this._getRdsRequirements();

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

    _getBlogManagementRequirements() {
        options.ghostHostingUrl = readlineSyc.question("Ghost hosting url : ");
        // TODO: Validation for HTTPS only

        options.hostStaticPages = readlineSyc.question("Do you want to host static pages site? (y/n) : ");
        if (options.hostStaticPages === yes) {
            // TODO: create static bucket
            options.staticWebsiteUrl = readlineSyc.question("Static website url : ");
            // TODO: validate website url/ extract path suffix
        } else if (options.hostStaticPages === no) {
            // Do nothing
        } else {
            throw new Error('Invalid choice.');
        }
    }

    _getRdsRequirements() {
        options.isExistingRds = readlineSyc.question("Do you want to use existing RDS instance? (y/n) : ");

        if (options.isExistingRds === yes) {
            options.rdsHost = readlineSyc.question("RDS database host : ");
            options.rdsDbUserName = readlineSyc.question("RDS database user name : ");
            options.rdsDbName = readlineSyc.question("RDS database name : ");
            options.rdsDbPassword = readlineSyc.question("RDS database password : ");
        }
    }

    _getAlbRequirements() {
        options.isExistingAlb = readlineSyc.question("Do you have existing ALB? (y/n) : ");

        if (options.isExistingAlb === yes) {
            options.listenerArn = readlineSyc.question("Please provide listener ARN : ");
        } else {
            options.isConfiguredDomain = readlineSyc.question("Do you have Route53 configured for domain? (Else the SSL certification verification will fail) (y/n) : ");

            // TODO: if options.isConfiguredDomain is NO then stop processing
            if (options.isConfiguredDomain === no) {
                console.log('Cannot proceed further!');
                process.exit(0);
            }
        }
    }

    _validateInput() {
        // Validate input here
    }

    _createConfig() {
        const userConfig = {
            aws: {},
            staticPageSite: {},
            alb: {},
            rds: {}
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
                staticWebsiteUrl: options.staticWebsiteUrl,
                staticPageSiteRootPath: options.staticPageSiteRootPath
            };
        }

        // Add alb inputs
        userConfig[`alb`] = {
            isExistingAlb: options.isExistingAlb === yes,
            listenerArn: options.listenerArn,
            isConfiguredDomain: options.isConfiguredDomain === yes
        };

        // Add rds inputs
        userConfig[`rds`] = {
            isExistingRds: options.isExistingRds === yes,
            rdsHost: options.rdsHost,
            rdsDbUserName: options.rdsDbUserName,
            rdsDbName: options.rdsDbName,
            rdsDbPassword: options.rdsDbPassword
        };

        fs.writeFileSync('config.json', JSON.stringify(userConfig, null, 4));
    }

}

module.exports = GetInput;
