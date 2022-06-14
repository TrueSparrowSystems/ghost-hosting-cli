import * as fs from 'fs';
import { Command } from 'commander';
const command = new Command();

class GetInput {
    prompt: (arg0: string) => any;
    awsAccessKeyId: string | null;
    awsSecretAccessKey: string | null;
    awsDefaultRegion: string | null;

    constructor(params: { prompt: () => any; }) {
        this.awsAccessKeyId = null;
        this.awsSecretAccessKey = null;
        this.awsDefaultRegion = null;
        this.prompt = params.prompt;
    }

    perform() {
        this._parseArguments();

        this._getUserInputs();

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

    _getUserInputs() {
        if (!this.awsAccessKeyId) {
            this.awsAccessKeyId = this.prompt("What is the aws access key id? ");
        }

        if (!this.awsSecretAccessKey) {
            this.awsSecretAccessKey = this.prompt("What is the aws secret access key? ");
        }

        if (!this.awsDefaultRegion) {
            this.awsDefaultRegion = this.prompt("What is the default aws region? ");
        }
    }

    _validateInput() {
        // Validate input here
    }

    _createConfig() {
        const userConfig = {
            awsAccessKeyId: this.awsAccessKeyId,
            awsSecretAccessKey: this.awsSecretAccessKey,
            awsDefaultRegion: this.awsDefaultRegion
        };

        fs.writeFileSync('config.json', JSON.stringify(userConfig, null, 4));
    }
}

module.exports = GetInput;
