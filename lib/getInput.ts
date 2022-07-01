import * as fs from 'fs';
import { Command } from 'commander';
const command = new Command();

const yes = 'yes';
const no = 'no';

class GetInput {
    prompt: (arg0: string) => any;
    awsAccessKeyId: string | null;
    awsSecretAccessKey: string | null;
    awsDefaultRegion: string | null;
    isRDSRequired: string | null;
    useExistingRDSInstance: string | null;
    RDSCredentials;
    blogManagementHostDomain: string | null;
    hostStaticPages: string | null;
    staticPageSiteData;

    constructor(params: { prompt: () => any; }) {
        this.awsAccessKeyId = null;
        this.awsSecretAccessKey = null;
        this.awsDefaultRegion = null;
        this.prompt = params.prompt;
        this.isRDSRequired = null;
        this.useExistingRDSInstance = null;
        this.blogManagementHostDomain = null;
        this.hostStaticPages = null;
        this.RDSCredentials = {
            hostName: null,
            userName: null,
            password: null,
            dbName: null
        };
        this.staticPageSiteData = {
            staticPageSiteDomain: null,
            staticPageSiteRootPath: null
        };
    }

    perform() {
        this._parseArguments();

        this._getAwsCredentials();

        this._validateAWSCredentials();

        this._getRDSRequirements();

        this._getBlogManagementRequirements();

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

    _getRDSRequirements() {
        this.isRDSRequired = this.prompt("RDS required? (yes/no) ");
        let hostName = null;
        let userName = null;
        let password = null;
        let dbName = null;

        if (this.isRDSRequired === 'yes') {
            this.useExistingRDSInstance = this.prompt("Do you want to use existing RDS instance? (yes/no) ");
            if (this.useExistingRDSInstance === 'yes') {
                hostName = this.prompt("RDS host name: ");
                userName = this.prompt("RDS user name: ");
                password = this.prompt("RDS password: ");
                dbName = this.prompt("RDS database name: ");
            } else if (this.useExistingRDSInstance === 'no') {
                console.log('Please provide RDS credentials to create new RDS instance.');
                userName = this.prompt("RDS user name: ");
                password = this.prompt("RDS password: ");
            } else {
                throw new Error('Invalid choice.');
            }

            this.RDSCredentials = {
                hostName,
                userName,
                password,
                dbName
            };
        } else if (this.isRDSRequired === 'no') {
            // Use SQLite
        } else {
            throw new Error('Invalid choice.');
        }
    }

    _getBlogManagementRequirements() {
        this.blogManagementHostDomain = this.prompt("Blog management host domain:");

        this.hostStaticPages = this.prompt("Do you want to host static pages site?");
        if (this.hostStaticPages === yes) {
            const staticPageSiteDomain = this.prompt("Static pages site domain: ");
            const staticPageSiteRootPath = this.prompt("Static pages site root path: ");

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

    _validateInput() {
        // Validate input here
    }

    _createConfig() {
        const userConfig = {
            aws: {},
            rds: {},
            staticPageSite: {}
        };

        // Add AWS credentials
        userConfig[`aws`] = {
            awsAccessKeyId: this.awsAccessKeyId,
            awsSecretAccessKey: this.awsSecretAccessKey,
            awsDefaultRegion: this.awsDefaultRegion
        };

        // Add RDS credentials
        if (this.isRDSRequired === yes) {
            userConfig[`rds`] = {
                useExistingRDSInstance: this.useExistingRDSInstance,
                hostName: this.RDSCredentials.hostName,
                userName: this.RDSCredentials.userName,
                password: this.RDSCredentials.password,
                dbName: this.RDSCredentials.dbName
            };
        }

        // Add static page site data
        if (this.hostStaticPages === yes) {
            userConfig[`staticPageSite`] = {
                staticPageSiteDomain: this.staticPageSiteData.staticPageSiteDomain,
                staticPageSiteRootPath: this.staticPageSiteData.staticPageSiteRootPath
            };
        }

        // fs.writeFileSync('config.json', JSON.stringify(userConfig, null, 4));
    }

}

module.exports = GetInput;
