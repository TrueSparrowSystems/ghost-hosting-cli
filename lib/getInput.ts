import * as fs from 'fs';
import * as readlineSyc from "readline-sync";
import { Command } from 'commander';
const command = new Command();

const yes = 'y';
const no = 'n';
const ALLOW_ALB_CUSTOM_CONFIGURATION = false;
const USER_CONFIGS = {
    aws: {},
    ghostHostingUrl: '',
    hostStaticWebsite: false,
    staticWebsiteUrl: '',
    vpc: {},
    alb: {},
    rds: {}
};

interface Options {
    awsAccessKeyId: string,
    awsSecretAccessKey: string,
    awsDefaultRegion: string,
    ghostHostingUrl: string,
    hostStaticWebsite: string,
    staticWebsiteUrl: string,
    useExistingVpc: string,
    privateSubnets: string,
    useExistingAlb: string,
    isConfiguredDomain: string,
    listenerArn: string,
    useExistingRds: string,
    rdsDbName: string,
    rdsHost: string,
    rdsDbUserName: string,
    rdsDbPassword: string
}

const options: Options = {
    awsAccessKeyId: '',
    awsSecretAccessKey: '',
    awsDefaultRegion: '',
    useExistingVpc: '',
    privateSubnets: '',
    useExistingRds: '',
    ghostHostingUrl: '',
    hostStaticWebsite: '',
    listenerArn: '',
    useExistingAlb: '',
    isConfiguredDomain: '',
    staticWebsiteUrl: '',
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
        if(this._hasPreviousConfigInFile()){
            if(this._usePreviousConfigData()){
                return;
            }
        }

        this._parseArguments();

        this._getAwsCredentials();

        this._getBlogManagementRequirements();

        this._getRdsRequirements();

        this._getAlbRequirements();

        this._validateInput();

        this._createConfig();
    }

    _hasPreviousConfigInFile(): boolean {
        let configData: any;
        try {
            configData = require('../config.json');
        } catch(err) {
            console.log('Error: ', err);
        } finally {
            configData = configData || {};
        }

        let pass = true;
        for (const key in configData) {
            if(!['hostStaticWebsite', 'staticWebsiteUrl'].includes(key)){
                if(!configData.hasOwnProperty(key)){
                    pass = false;
                    break;
                }
            }
        }

        return Object.keys(configData).length > 0 && pass;
    }

    _usePreviousConfigData(): boolean {
        const useExistingConfig = readlineSyc.question("Previous installation \"config.json\" file found, Would you like to use the existing configuration options? [Else it will start from the scratch] (Y/n) : ", {defaultInput: yes});
        this._validateInputBooleanOption(useExistingConfig);

        return useExistingConfig === yes;
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
            this._validateInputStringOption(options.awsAccessKeyId);
        }

        if (!options.awsSecretAccessKey) {
            options.awsSecretAccessKey = readlineSyc.question("AWS secret access key? ");
            this._validateInputStringOption(options.awsSecretAccessKey);
        }

        if (!options.awsDefaultRegion) {
            options.awsDefaultRegion = readlineSyc.question("Default AWS region? ");
            this._validateInputStringOption(options.awsDefaultRegion);
        }
    }

    _getBlogManagementRequirements() {
        options.ghostHostingUrl = readlineSyc.question("Ghost hosting url : ");
        this._validateInputStringOption(options.ghostHostingUrl);
        // TODO: Validation for HTTPS only

        options.hostStaticWebsite = readlineSyc.question("Do you want to host static website? (Y/n) : ", {defaultInput: yes});
        this._validateInputBooleanOption(options.hostStaticWebsite);

        if (options.hostStaticWebsite === yes) {
            // TODO: create static bucket
            options.staticWebsiteUrl = readlineSyc.question("Static website url : ");
            this._validateInputStringOption(options.staticWebsiteUrl);
            // TODO: validate website url/ extract path suffix
        }
    }

    _getRdsRequirements() {
        options.useExistingRds = readlineSyc.question("Do you want to use existing RDS instance? (y/N) : ", {defaultInput: no});
        this._validateInputBooleanOption(options.useExistingRds);

        if (options.useExistingRds === yes) {
            options.rdsHost = readlineSyc.question("RDS database host : ");
            options.rdsDbUserName = readlineSyc.question("RDS database user name : ");
            options.rdsDbName = readlineSyc.question("RDS database name : ");
            options.rdsDbPassword = readlineSyc.question("RDS database password : ");
        }
    }

    _getAlbRequirements() {
        if(ALLOW_ALB_CUSTOM_CONFIGURATION){
            options.useExistingAlb = readlineSyc.question("Do you have existing ALB? (y/N) : ", {defaultInput: no});
            this._validateInputBooleanOption(options.useExistingAlb);
        }

        if (options.useExistingAlb === yes) {
            options.listenerArn = readlineSyc.question("Please provide listener ARN : ");
        } else {
            options.isConfiguredDomain = readlineSyc.question("Do you have Route53 configured for the domain in the same AWS account? [Else the SSL certification verification will fail] (Y/n) : ", {defaultInput: yes});
            this._validateInputBooleanOption(options.isConfiguredDomain);

            if (options.isConfiguredDomain === no) {
                console.log('Cannot proceed further!');
                process.exit(0);
            }
        }
    }

    _validateInput() {
        // Validate URLs and domains
        const hostingUrlParts = options.ghostHostingUrl.replace(/\/+$/, '').split('://');
        const staticUrlParts = options.staticWebsiteUrl.replace(/\/+$/, '').split('://');
        const hostStaticWebsite = options.hostStaticWebsite === yes;

        if(hostingUrlParts[0] !== 'https' || (hostStaticWebsite && staticUrlParts[0] !== 'https')){
            this._validateInputStringOption('', 'Invalid url scheme! It has to be "https"');
        }

        const hostingDomainParts = (hostingUrlParts[1] || '').split('/');
        const staticDomainParts = (staticUrlParts[1] || '').split('/');

        if(hostStaticWebsite && hostingDomainParts.slice(1).join('/') !== staticDomainParts.slice(1).join('/')){
            this._validateInputStringOption('', 'URL path should be same for Ghost hosting url and Static website url.');
        }

        const ghostHostingDomain = hostingDomainParts[0];
        const staticHostingDomain = staticDomainParts[0];

        if(ghostHostingDomain === '' || (hostStaticWebsite && staticHostingDomain === '')) {
            this._validateInputStringOption('', 'Domain name should be valid for Ghost hosting url and Static website url.');
        }

        if (
            hostStaticWebsite &&
            !(ghostHostingDomain.split(staticHostingDomain)[1] === '' ||
            staticHostingDomain.split(ghostHostingDomain)[1] === '')
        ) {
            this._validateInputStringOption('', 'Different domain names for Ghost hosting url and Static website url are not allowed.');
        }
    }

    _validateInputBooleanOption(bool: string) {
        if(![yes, no].includes(bool.toLowerCase())){
            console.error(new Error('Invalid option!'));
            process.exit(1);
        }
    }

    _validateInputStringOption(str: string, msg = '') {
        if(str === undefined || str === ''){
            console.error(new Error(msg || 'Invalid option!'));
            process.exit(1);
        }
    }

    _createConfig() {

        // Add AWS credentials
        USER_CONFIGS[`aws`] = {
            awsAccessKeyId: options.awsAccessKeyId,
            awsSecretAccessKey: options.awsSecretAccessKey,
            awsDefaultRegion: options.awsDefaultRegion
        };

        // Add VPC configurations
        USER_CONFIGS[`vpc`] = {
            useExistingVpc: options.useExistingVpc === yes
        };
        if(options.useExistingVpc === yes){
            Object.assign(USER_CONFIGS[`vpc`], {
                privateSubnets: options.privateSubnets
            });
        }

        USER_CONFIGS.ghostHostingUrl = options.ghostHostingUrl;
        USER_CONFIGS.hostStaticWebsite = options.hostStaticWebsite === yes;
        // Add static page site data
        if (options.hostStaticWebsite === yes) {
            USER_CONFIGS.staticWebsiteUrl = options.staticWebsiteUrl;
        }

        // Add alb inputs
        USER_CONFIGS[`alb`] = {
            useExistingAlb: options.useExistingAlb === yes,
            isConfiguredDomain: options.isConfiguredDomain === yes
        };

        if(options.useExistingAlb === yes){
            Object.assign(USER_CONFIGS[`alb`], {
                listenerArn: options.listenerArn
            });
        }

        // Add rds inputs
        USER_CONFIGS[`rds`] = {
            useExistingRds: options.useExistingRds === yes
        }

        if(options.useExistingRds === yes){
            Object.assign(USER_CONFIGS[`rds`], {
                rdsHost: options.rdsHost,
                rdsDbUserName: options.rdsDbUserName,
                rdsDbName: options.rdsDbName,
                rdsDbPassword: options.rdsDbPassword
            });
        }

        fs.writeFileSync('config.json', JSON.stringify(USER_CONFIGS, null, 4));
    }
}

module.exports = GetInput;
