const fs = require('fs');
const program = require('commander');

class GetInput {
    promptSync: Function;
    awsAccessKeyId: string | null;
    awsSecretAccessKey: string | null;
    awsDefaultRegion: string | null;

    constructor(params: { promptSync: Function; }) {
        this.awsAccessKeyId = null;
        this.awsSecretAccessKey = null;
        this.awsDefaultRegion = null;
        this.promptSync = params.promptSync;
    }

    perform() {
        this._parseArguments();

        this._getUserInputs();

        this._createConfig();
    }

    _parseArguments() {
        program.allowUnknownOption();
        program.option('--aws-access-key-id <awsAccessKeyId>', 'AWS Access Key Id').parse(process.argv);
        program.option('--aws-secret-access-key <awsSecretAccessKey>', 'AWS Secret Access Key').parse(process.argv);
        program.option('--aws-default-region <awsDefaultRegion>', 'AWS Default Region').parse(process.argv);

        this.awsAccessKeyId = program.opts().awsAccessKeyId;
        this.awsSecretAccessKey = program.opts().awsSecretAccessKey;
        this.awsDefaultRegion = program.opts().awsDefaultRegion;
    }

    _getUserInputs() {
        if (!this.awsAccessKeyId) {
            this.awsAccessKeyId = this.promptSync("What is the aws access key id? ");
        }

        if (!this.awsSecretAccessKey) {
            this.awsSecretAccessKey = this.promptSync("What is the aws secret access key? ");
        }

        if (!this.awsDefaultRegion) {
            this.awsDefaultRegion = this.promptSync("What is the default aws region? ");
        }
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
