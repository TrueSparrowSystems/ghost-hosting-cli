import * as readlineSync from 'readline-sync';
import * as fs from 'fs';
import chalk from 'chalk';
import * as shell from 'shelljs';

import { GetInput, ActionType } from './lib/getInput';
import commonConfig from './config/common.json';

import cdktfConfig from '../cdktf.json';

const INPUT_FILE_NAME = 'config.json';
const OUTPUT_FILE_NAME = 'output.json';

const YES = 'y';
const NO = 'n';
const INVALID_INPUT = `Invalid input! Please choose ${YES} or ${NO}`;

const ghostOutputDir = `${cdktfConfig.output}/stacks/${commonConfig.ghostStackName}`;

/**
 * @dev Entry point to deploy or destroy terraform stacks
 *
 * @returns {void}
 */
function run(): void {
  const response = new GetInput().perform();

  if (response.action === ActionType.DEPLOY) {
    _deployStack();
  } else if (response.action === ActionType.DESTROY) {
    _destroyStack();
  }
}

/**
 * @dev Type definition for the exec options
 */
type execOptions = {
  silent: boolean | undefined;
};

/**
 * @dev Execute command
 *
 * @param command - command to execute
 * @param options - options for the shell exec
 * @returns {Promise}
 */
async function exec(command: string, options: execOptions = { silent: false }) {
  return new Promise((resolve, reject) => {
    const handleSilently = options && options.silent ? true : false;
    shell.exec(command, { silent: handleSilently }, function (code: number, stdout: string, stderr: string) {
      if (code != 0) {
        reject({ code: code, stderr: stderr });
      }
      resolve({ code: code, stderr: stderr });
    });
  });
}

/**
 * @dev Driver function to deploy the terraform stacks
 *
 * @returns {Promise<void>}
 */
async function _deployStack(): Promise<void> {
  console.log('Deploy called ..');

  // Deploy s3 backend stack
  await exec(`npm run auto-deploy ${commonConfig.s3BackendStackName}`).catch((err) => {
    shell.echo('Error: cdktf s3 backend deploy failed');
    shell.exit(1);
  });

  // Diff for ghost stack
  await exec(`npm run diff ${commonConfig.ghostStackName}`).catch((err) => {
    shell.echo('Error: cdktf s3 backend deploy failed');
    shell.exit(1);
  });

  // Terraform plan
  await exec(`cd ${ghostOutputDir} && terraform plan`)
    .then()
    .catch((err) => {
      shell.echo('Error: cdktf exec failed');
      shell.exit(1);
    });

  console.log(chalk.blue.bold('Please review the above output for DEPLOY action.'));
  const approve = readlineSync.question(chalk.blue.bold('Do you want to approve?(Y/n): '), { defaultInput: YES });

  if (approve === YES) {
    // Deploy ghost stack
    await exec(`npm run auto-deploy ${commonConfig.ghostStackName}`).catch((err) => {
      shell.echo('Error: cdktf ghost deploy failed');
      shell.exit(1);
    });

    // Success
    await exec('npm run output', { silent: true }).catch((err) => {
      shell.echo('Error: cdktf output failed');
      shell.exit(1);
    });

    const input = _readAndShowOutput();
    _nextActionMessage(input);
  } else if (approve === NO) {
    console.log('Declined!');
  } else {
    console.log(INVALID_INPUT);
  }
}

/**
 * @dev Read terraform output and present it
 *
 * @returns {object}
 */
function _readAndShowOutput(): any {
  const inputData = fs.readFileSync(INPUT_FILE_NAME, 'utf-8');
  const outputData = fs.readFileSync(OUTPUT_FILE_NAME, 'utf-8');

  const input = JSON.parse(inputData);
  const output = JSON.parse(outputData);

  const formattedOutput = _formatOutput(output);

  console.log('\n');
  console.log(chalk.blue.bold('------------------------------------------------------------'));
  console.log(chalk.blue.bold('Ghost hosted URL: '), chalk.green.bold(input.ghostHostingUrl));
  if (input.hostStaticWebsite) {
    console.log(chalk.blue.bold('Static website URL: '), chalk.green.bold(input.staticWebsiteUrl));
    console.log(
      chalk.blue.bold('Static website S3 bucket ARN: '),
      chalk.green.bold(formattedOutput['s3_website_bucket_arn']),
    );
  }

  console.log(chalk.blue.bold('Ghost env file S3 ARN: '), chalk.green.bold(formattedOutput['ecs_ghost_env_file_arn']));
  console.log(chalk.blue.bold('Nginx env file S3 ARN: '), chalk.green.bold(formattedOutput['ecs_nginx_env_file_arn']));

  if (!input.rds.useExistingRds) {
    console.log(chalk.blue.bold('RDS host: '), chalk.green.bold(formattedOutput['rds_rds_host']));
    console.log(chalk.blue.bold('RDS user: '), chalk.green.bold(formattedOutput['rds_rds_user']));
    console.log(chalk.blue.bold('RDS password: '), chalk.green.bold(formattedOutput['rds_rds_password']));
    console.log(chalk.blue.bold('RDS database: '), chalk.green.bold(formattedOutput['rds_rds_database']));
  }

  if (!input.alb.useExistingAlb) {
    console.log(chalk.blue.bold('ALB DNS Name: '), chalk.green.bold(formattedOutput['alb_alb_dns_name']));
  }
  console.log(chalk.blue.bold('------------------------------------------------------------'));

  return input;
}

/**
 * @dev Format terraform output data
 *
 * @param output
 * @returns {object}
 */
function _formatOutput(output: any): any {
  const responseData = {};

  const plgGhostOutputHash = output[commonConfig.ghostStackName];
  Object.keys(plgGhostOutputHash).forEach(function (key) {
    const value = plgGhostOutputHash[key];

    const extractedKey = key.substring(0, key.length - 9); // 8 char random string with '_'

    Object.assign(responseData, { [extractedKey]: value });
  });

  return responseData;
}

/**
 * @dev Prints next set of action items for end user
 *
 * @param input
 */
function _nextActionMessage(input: any): void {
  console.log('');

  if (!input.alb.useExistingAlb) {
    console.log(chalk.cyan('Create a Route53 "A" record for'), chalk.cyan.bold('ALB DNS Name'));
  }

  if (input.hostStaticWebsite) {
    console.log(
      chalk.cyan(
        'To generate the static website, follow the instructions provided here: https://github.com/marketplace/actions/ghost-static-website-generator',
      ),
    );
  }

  console.log(
    chalk.cyan.bold(
      'Keep "terraform.plg-ghost.tfstate" and "config.json" files safe somewhere. It is required to make changes to the existing stack or to destroy it.',
    ),
  );

  console.log('');
}

/**
 * @dev Driver function to destroy already deployed terraform stacks
 *
 * @returns {Promise<void>}
 */
async function _destroyStack(): Promise<void> {
  console.log(chalk.blue.bold('\nThis action will destroy the stack.'));
  const approve = readlineSync.question(chalk.blue.bold('Do you want to approve?(Y/n): '), { defaultInput: YES });

  if (approve === YES) {
    await exec(`npm run auto-destroy ${commonConfig.ghostStackName}`).catch(() => {
      shell.echo('Error: cdktf destroy failed');
      shell.exit(1);
    });
  } else if (approve === NO) {
    console.log('Declined!');
  } else {
    console.log(INVALID_INPUT);
  }
}

export { run };
