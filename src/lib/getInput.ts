import * as fs from 'fs';
import * as readlineSyc from 'readline-sync';
import chalk from 'chalk';
import { Command, Argument } from 'commander';
import { getRootDomainFromUrl, readJsonFileWithFileName, getCurrentTimestampInSeconds } from '../lib/util';

import commonConfig from '../config/common.json';

const command = new Command();

const USER_CONFIGS = {
  aws: {},
  ghostHostingUrl: '',
  hostStaticWebsite: false,
  staticWebsiteUrl: '',
  uniqueIdentifier: '',
  vpc: {},
  alb: {},
  rds: {},
};
enum ActionType {
  DEPLOY = 'deploy',
  DESTROY = 'destroy',
}
const ALLOWED_ACTIONS = [ActionType.DEPLOY, ActionType.DESTROY];

interface Options {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  ghostHostingUrl: string;
  hostStaticWebsite: boolean;
  staticWebsiteUrl: string;
  useExistingVpc: boolean;
  vpcSubnets: string;
  vpcPublicSubnets: string;
  useExistingAlb: boolean;
  listenerArn: string;
  useExistingRds: boolean;
  rdsDbName: string;
  rdsHost: string;
  rdsDbUserName: string;
  rdsDbPassword: string;
}

const options: Options = {
  accessKeyId: '',
  secretAccessKey: '',
  region: '',
  useExistingVpc: false,
  vpcSubnets: '',
  vpcPublicSubnets: '',
  useExistingRds: false,
  ghostHostingUrl: '',
  hostStaticWebsite: false,
  listenerArn: '',
  useExistingAlb: false,
  staticWebsiteUrl: '',
  rdsDbName: '',
  rdsHost: '',
  rdsDbUserName: '',
  rdsDbPassword: '',
};

interface GetInputResponse {
  action: string;
}

/**
 * @dev Class to get inputs from the user
 * - This will ask required questions to the user regarding the resource configuration
 */
class GetInput {
  /**
   * @dev Constructor to get inputs from the user
   */
  constructor() {
    // Do nothing
  }

  /**
   * @dev Main performer of the class
   *
   * @returns {GetInputResponse}
   */
  perform(): GetInputResponse {
    const response = this._parseArguments();

    if (response.action === ActionType.DESTROY) {
      return response;
    }

    // if file already exists, consider values from file otherwise ask for input
    if (this._hasPreviousConfigInFile()) {
      if (this._usePreviousConfigData()) {
        return response;
      }
    }

    this._getAwsCredentials();

    this._getVpcConfigurations();

    this._getAlbRequirements();

    this._getBlogManagementRequirements();

    this._getRdsRequirements();

    this._validateInput();

    this._createConfig();

    return response;
  }

  /**
   * @dev Check whether configuration file already exists or not
   *
   * @returns {boolean}
   */
  _hasPreviousConfigInFile(): boolean {
    const configData = readJsonFileWithFileName(commonConfig.configFile);

    let pass = true;
    for (const key in USER_CONFIGS) {
      if (!Object.prototype.hasOwnProperty.call(configData, key)) {
        pass = false;
        break;
      }
    }

    return Object.keys(configData).length > 0 && pass;
  }

  /**
   * @dev Ask user whether to use existing configurations or to create new
   *
   * @returns {boolean}
   */
  _usePreviousConfigData(): boolean {
    const useExistingConfig = readlineSyc.keyInYN(
      chalk.blue.bold(
        'Previous installation "config.json" file found, Would you like to use the existing configuration options? [Else it will start from the scratch]',
      ),
    );

    return useExistingConfig === true ? true : false;
  }

  /**
   * @dev Parse arguments provided with the `run` command
   *
   * @returns {GetInputResponse}
   */
  _parseArguments(): GetInputResponse {
    let mainAction = '';

    command.allowUnknownOption();
    command
      .addArgument(new Argument('<action>', 'Action arguments').choices(ALLOWED_ACTIONS))
      .option('--aws-access-key-id <awsAccessKeyId>', 'AWS Access Key Id')
      .option('--aws-secret-access-key <awsSecretAccessKey>', 'AWS Secret Access Key')
      .option('--aws-region <awsRegion>', 'AWS Default Region')
      .action(function (arg, opts) {
        if (!ALLOWED_ACTIONS.includes(arg)) {
          console.error('Invalid action argument : ', arg);
          process.exit(1);
        }
        mainAction = arg;
        // console.log('----------- help: ', command.helpInformation());
        options.accessKeyId = opts.awsAccessKeyId;
        options.secretAccessKey = opts.awsSecretAccessKey;
        options.region = opts.awsRegion;
      })
      .parse();

    // console.log('----------- options: ', options);

    return {
      action: mainAction,
    };
  }

  /**
   * @dev Get vpc configurations
   *
   * @returns {void}
   */
  _getVpcConfigurations(): void {
    const useExistingVpc = readlineSyc.keyInYN(chalk.blue.bold('Use existing VPC?'));
    options.useExistingVpc = useExistingVpc === true ? true : false;

    if (options.useExistingVpc) {
      options.vpcSubnets = readlineSyc.question(
        chalk.blue.bold(
          'Provide VPC Subnets to run ECS tasks [comma separated values, at least 2 subnets required] : ',
        ),
      );
      this._validateInputStringOption(options.vpcSubnets, 'Invalid VPC Subnets.');
    }
  }

  /**
   * @dev Get aws credentials
   *
   * @returns {void}
   */
  _getAwsCredentials(): void {
    if (!options.accessKeyId) {
      options.accessKeyId = readlineSyc.question(chalk.blue.bold('AWS access key id : '));
      this._validateInputStringOption(options.accessKeyId);
    }

    if (!options.secretAccessKey) {
      options.secretAccessKey = readlineSyc.question(chalk.blue.bold('AWS secret access key : '));
      this._validateInputStringOption(options.secretAccessKey);
    }

    if (!options.region) {
      options.region = readlineSyc.question(chalk.blue.bold('AWS region : '));
      this._validateInputStringOption(options.region);
    }
  }

  /**
   * @dev Get blog related requirements
   *
   * @returns {void}
   */
  _getBlogManagementRequirements(): void {
    options.ghostHostingUrl = readlineSyc.question(chalk.blue.bold('Ghost hosting url : '));
    this._validateInputStringOption(options.ghostHostingUrl);

    const hostStaticWebsite = readlineSyc.keyInYN(chalk.blue.bold('Do you want to host static website?'));
    options.hostStaticWebsite = hostStaticWebsite === true ? true : false;

    if (options.hostStaticWebsite) {
      options.staticWebsiteUrl = readlineSyc.question(chalk.blue.bold('Static website url : '));
      this._validateInputStringOption(options.staticWebsiteUrl);
    }

    let hasDomainConfiguredInRoute53 = readlineSyc.keyInYN(
      chalk.blue.bold(
        'Do you have Route53 configured for the domain in the same AWS account? [Else the SSL certification verification will fail]',
      ),
    );
    hasDomainConfiguredInRoute53 = hasDomainConfiguredInRoute53 === true ? true : false;

    if (!hasDomainConfiguredInRoute53) {
      console.log(chalk.yellow.bold('Cannot proceed further!'));
      process.exit(0);
    }
  }

  /**
   * @dev Get rds requirements
   *
   * @returns {void}
   */
  _getRdsRequirements(): void {
    const useExistingRds = readlineSyc.keyInYN(chalk.blue.bold('Do you want to use existing RDS MySQL instance?'));
    options.useExistingRds = useExistingRds === true ? true : false;

    if (options.useExistingRds) {
      options.rdsHost = readlineSyc.question(chalk.blue.bold('MySQL host : '));
      this._validateInputStringOption(options.rdsHost);
      options.rdsDbUserName = readlineSyc.question(chalk.blue.bold('MySQL user name : '));
      this._validateInputStringOption(options.rdsDbUserName);
      options.rdsDbPassword = readlineSyc.question(chalk.blue.bold('MySQL user password : '), {
        hideEchoBack: true,
      });
      this._validateInputStringOption(options.rdsDbPassword);
      options.rdsDbName = readlineSyc.question(chalk.blue.bold('MySQL database name : '));
      this._validateInputStringOption(options.rdsDbName);
    }
  }

  /**
   * @dev Get load balancer requirements
   *
   * @returns {void}
   */
  _getAlbRequirements(): void {
    if (options.useExistingVpc) {
      const useExistingAlb = readlineSyc.keyInYN(chalk.blue.bold('Do you have existing ALB?'));
      options.useExistingAlb = useExistingAlb === true ? true : false;
    }

    if (options.useExistingAlb) {
      options.listenerArn = readlineSyc.question(chalk.blue.bold('Please provide listener ARN : '));
    } else {
      if (options.useExistingVpc) {
        options.vpcPublicSubnets = readlineSyc.question(
          chalk.blue.bold(
            'Provide VPC Public Subnets to launch ALB [comma separated values, at least 2 subnets required] : ',
          ),
        );
        this._validateInputStringOption(options.vpcSubnets, 'Invalid VPC Public Subnets.');
      }
    }
  }

  /**
   * @dev Validate the input fields provided
   *
   * @returns {void}
   */
  _validateInput(): void {
    // Validate VPC subnets
    if (options.vpcSubnets && options.vpcSubnets.split(',').length < 2) {
      this._validateInputStringOption('', 'At least 2 VPC Subnets required.');
    }

    if (options.vpcPublicSubnets && options.vpcPublicSubnets.split(',').length < 2) {
      this._validateInputStringOption('', 'At least 2 VPC Public Subnets required.');
    }

    // Validate URLs and domains
    options.ghostHostingUrl = options.ghostHostingUrl.replace(/\/+$/, '');
    options.staticWebsiteUrl = options.staticWebsiteUrl.replace(/\/+$/, '');
    const hostingUrlParts = options.ghostHostingUrl.split('://');
    const staticUrlParts = options.staticWebsiteUrl.split('://');
    const hostStaticWebsite = options.hostStaticWebsite;

    if (hostingUrlParts[0] !== 'https' || (hostStaticWebsite && staticUrlParts[0] !== 'https')) {
      this._validateInputStringOption('', 'Invalid url scheme! It has to be "https"');
    }

    const hostingDomainParts = (hostingUrlParts[1] || '').split('/');
    const staticDomainParts = (staticUrlParts[1] || '').split('/');

    if (hostStaticWebsite && hostingDomainParts.slice(1).join('/') !== staticDomainParts.slice(1).join('/')) {
      this._validateInputStringOption('', 'URL path should be same for Ghost hosting url and Static website url.');
    }

    const ghostHostingDomain = hostingDomainParts[0];
    const staticHostingDomain = staticDomainParts[0];

    if (ghostHostingDomain === '' || (hostStaticWebsite && staticHostingDomain === '')) {
      this._validateInputStringOption('', 'Domain name should be valid for Ghost hosting url and Static website url.');
    }

    if (
      hostStaticWebsite &&
      getRootDomainFromUrl(options.ghostHostingUrl) !== getRootDomainFromUrl(options.staticWebsiteUrl)
    ) {
      this._validateInputStringOption(
        '',
        'Different domain names for Ghost hosting url and Static website url are not allowed.',
      );
    }
  }

  /**
   * @dev Validate input string
   *
   * @param str - input string
   * @param msg
   * @returns {void}
   */
  _validateInputStringOption(str: string, msg = '') {
    if (str === undefined || str === '') {
      console.error(new Error(chalk.red.bold(msg || 'Invalid option!')));
      process.exit(1);
    }
  }

  /**
   * @dev Create configuration file from the inputs provided by the user
   *
   * @returns {void}
   */
  _createConfig(): void {
    USER_CONFIGS.uniqueIdentifier = getCurrentTimestampInSeconds().toString();

    // Add AWS credentials
    USER_CONFIGS[`aws`] = {
      accessKeyId: options.accessKeyId,
      secretAccessKey: options.secretAccessKey,
      region: options.region,
    };

    // Add VPC configurations
    USER_CONFIGS[`vpc`] = {
      useExistingVpc: options.useExistingVpc,
    };

    if (options.useExistingVpc) {
      Object.assign(USER_CONFIGS[`vpc`], {
        vpcSubnets: options.vpcSubnets.split(','),
      });

      if (!options.useExistingAlb) {
        Object.assign(USER_CONFIGS[`vpc`], {
          vpcPublicSubnets: options.vpcPublicSubnets.split(','),
        });
      }
    }

    USER_CONFIGS.ghostHostingUrl = options.ghostHostingUrl;
    USER_CONFIGS.hostStaticWebsite = options.hostStaticWebsite;
    // Add static page site data
    if (options.hostStaticWebsite) {
      USER_CONFIGS.staticWebsiteUrl = options.staticWebsiteUrl;
    }

    // Add alb inputs
    USER_CONFIGS[`alb`] = {
      useExistingAlb: options.useExistingAlb,
    };

    if (options.useExistingAlb) {
      Object.assign(USER_CONFIGS[`alb`], {
        listenerArn: options.listenerArn,
      });
    }

    // Add rds inputs
    USER_CONFIGS[`rds`] = {
      useExistingRds: options.useExistingRds,
    };

    if (options.useExistingRds) {
      Object.assign(USER_CONFIGS[`rds`], {
        rdsHost: options.rdsHost,
        rdsDbUserName: options.rdsDbUserName,
        rdsDbName: options.rdsDbName,
        rdsDbPassword: options.rdsDbPassword,
      });
    }

    fs.writeFileSync(commonConfig.configFile, JSON.stringify(USER_CONFIGS, null, 4));
  }
}

export { GetInput, GetInputResponse, ActionType };
