import * as fs from 'fs';
import * as readlineSyc from "readline-sync";
import { Command, Argument } from 'commander';
const command = new Command();

const yes = 'y';
const no = 'n';
const USER_CONFIGS = {
    aws: {},
    ghostHostingUrl: '',
    hostStaticWebsite: false,
    staticWebsiteUrl: '',
    vpc: {},
    alb: {},
    rds: {}
};
const CONFIG_FILE = 'config.json';

interface Options {
    accessKeyId: string,
    secretAccessKey: string,
    region: string,
    ghostHostingUrl: string,
    hostStaticWebsite: string,
    staticWebsiteUrl: string,
    useExistingVpc: string,
    vpcSubnets: string,
    vpcPublicSubnets: string,
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
    accessKeyId: '',
    secretAccessKey: '',
    region: '',
    useExistingVpc: '',
    vpcSubnets: '',
    vpcPublicSubnets: '',
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

class GetInput {
    constructor() {
        // Do nothing
    }

    perform() {
        // if file already exists, consider values from file otherwise ask for input
        if(this._hasPreviousConfigInFile()){
            if(this._usePreviousConfigData()){
                return;
            }
        }

        this._parseArguments();

        this._getAwsCredentials();

        this._getVpcConfigurations();

        this._getAlbRequirements();

        this._getBlogManagementRequirements();

        this._getRdsRequirements();

        this._validateInput();

        this._createConfig();
    }

    _hasPreviousConfigInFile(): boolean {
        let configData: any;
        try {
            configData = require(`../${CONFIG_FILE}`);
        } catch(err) {
            // console.log('Error: ', err);
        } finally {
            configData = configData || {};
        }

        let pass = true;
        for (const key in configData) {
            if(!['staticWebsiteUrl'].includes(key)){
                if(!Object.prototype.hasOwnProperty.call(configData, key)){
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

        command
        .addArgument(new Argument('<name>', 'Action arguements').choices(['setup', 'deploy', 'destroy']))
        .option(
            '--aws-access-key-id <awsAccessKeyId>',
            'AWS Access Key Id'
        )
        .option(
            '--aws-secret-access-key <awsSecretAccessKey>',
            'AWS Secret Access Key'
        )
        .option(
            '--aws-region <awsRegion>',
            'AWS Default Region'
        )
        .action(function(arg, opts){
            console.log('----------- arg: ', arg);
            console.log('----------- opts: ', opts);
            console.log('----------- help: ', command.helpInformation());
            options.accessKeyId = opts.awsAccessKeyId;
            options.secretAccessKey = opts.awsSecretAccessKey;
            options.region = opts.awsRegion;
        })
        .parse();

        console.log('----------- options: ', options);
    }

    _getVpcConfigurations(): void {
        options.useExistingVpc = readlineSyc.question("Use existing VPC? (y/N) : ", {defaultInput: no});
        this._validateInputBooleanOption(options.useExistingVpc);

        if (options.useExistingVpc === yes) {
            options.vpcSubnets = readlineSyc.question("Provide VPC Subnets to run ECS tasks [comma separated values, atleast 2 subnets required] : ");
            this._validateInputStringOption(options.vpcSubnets, 'Invalid VPC Subnets.');
        }
    }

    _getAwsCredentials() {
        if (!options.accessKeyId) {
            options.accessKeyId = readlineSyc.question("AWS access key id : ");
            this._validateInputStringOption(options.accessKeyId);
        }

        if (!options.secretAccessKey) {
            options.secretAccessKey = readlineSyc.question("AWS secret access key : ");
            this._validateInputStringOption(options.secretAccessKey);
        }

        if (!options.region) {
            options.region = readlineSyc.question("AWS region : ");
            this._validateInputStringOption(options.region);
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
        options.useExistingRds = readlineSyc.question("Do you want to use existing RDS MySQL instance? (y/N) : ", {defaultInput: no});
        this._validateInputBooleanOption(options.useExistingRds);

        if (options.useExistingRds === yes) {
            options.rdsHost = readlineSyc.question("MySQL host : ");
            this._validateInputStringOption(options.rdsHost);
            options.rdsDbUserName = readlineSyc.question("MySQL user name : ");
            this._validateInputStringOption(options.rdsDbUserName);
            options.rdsDbPassword = readlineSyc.question("MySQL user password : ", {
                hideEchoBack: true
            });
            this._validateInputStringOption(options.rdsDbPassword);
            options.rdsDbName = readlineSyc.question("MySQL database name : ");
            this._validateInputStringOption(options.rdsDbName);
        }
    }

    _getAlbRequirements() {
        if(options.useExistingVpc === yes){
            options.useExistingAlb = readlineSyc.question("Do you have existing ALB? (y/N) : ", {defaultInput: no});
            this._validateInputBooleanOption(options.useExistingAlb);
        }

        if (options.useExistingAlb === yes) {
            options.listenerArn = readlineSyc.question("Please provide listener ARN : ");
        } else {
            if(options.useExistingVpc === yes) {
                options.vpcPublicSubnets = readlineSyc.question("Provide VPC Public Subnets to launch ALB [comma separated values, atleast 2 subnets required] : ");
                this._validateInputStringOption(options.vpcSubnets, 'Invalid VPC Public Subnets.');
            }
            options.isConfiguredDomain = readlineSyc.question("Do you have Route53 configured for the domain in the same AWS account? [Else the SSL certification verification will fail] (Y/n) : ", {defaultInput: yes});
            this._validateInputBooleanOption(options.isConfiguredDomain);

            if (options.isConfiguredDomain === no) {
                console.log('Cannot proceed further!');
                process.exit(0);
            }
        }
    }

    _validateInput() {
        // Validate VPC subnets
        if(options.vpcSubnets && options.vpcSubnets.split(',').length < 2){
            this._validateInputStringOption('', 'Atleast 2 VPC Subnets required.');
        }

        if(options.vpcPublicSubnets && options.vpcPublicSubnets.split(',').length < 2){
            this._validateInputStringOption('', 'Atleast 2 VPC Public Subnets required.');
        }

        // Validate URLs and domains
        options.ghostHostingUrl = options.ghostHostingUrl.replace(/\/+$/, '');
        options.staticWebsiteUrl = options.staticWebsiteUrl.replace(/\/+$/, '');
        const hostingUrlParts = options.ghostHostingUrl.split('://');
        const staticUrlParts = options.staticWebsiteUrl.split('://');
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
            accessKeyId: options.accessKeyId,
            secretAccessKey: options.secretAccessKey,
            region: options.region
        };

        // Add VPC configurations
        USER_CONFIGS[`vpc`] = {
            useExistingVpc: options.useExistingVpc === yes
        };

        if(options.useExistingVpc === yes){
            Object.assign(USER_CONFIGS[`vpc`], {
                vpcSubnets: options.vpcSubnets.split(',')
            });

            if(options.useExistingAlb === no){
                Object.assign(USER_CONFIGS[`vpc`], {
                    vpcPublicSubnets: options.vpcPublicSubnets.split(',')
                });
            }
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

        fs.writeFileSync(CONFIG_FILE, JSON.stringify(USER_CONFIGS, null, 4));
    }
}

export { GetInput };
