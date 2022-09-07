import * as shell from 'shelljs';
import * as readlineSync from 'readline-sync';
import * as fs from 'fs';
import chalk from 'chalk';

import { GetInput, ActionType } from './lib/getInput';
import commonConfig from './config/common.json';

const INPUT_FILE_NAME = 'config.json';
const OUTPUT_FILE_NAME = 'output.json';

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
 * @dev Driver function to deploy the terraform stacks
 *
 * @returns {void}
 */
function _deployStack(): void {
  const resp = shell.exec('npm run diff');
  if (resp.code !== 0) {
    shell.echo('Error: cdktf exec failed');
    shell.exit(1);
  }

  console.log(chalk.blue.bold('Please review the above output for DEPLOY action.'));
  const approve = readlineSync.question(chalk.blue.bold('Do you want to approve?(Y/n): '), { defaultInput: 'y' });

  if (approve === 'y') {
    if (shell.exec('npm run auto-deploy').code !== 0) {
      shell.echo('Error: cdktf deploy failed');
      shell.exit(1);
    }

    // Success
    if (shell.exec('npm run output', { silent: true }).code !== 0) {
      shell.echo('Error: cdktf output failed');
      shell.exit(1);
    } else {
      const input = _readAndShowOutput();
      _nextActionMessage(input);
    }
  } else if (approve === 'n') {
    console.log('Declined!');
  } else {
    console.log(`Invalid input! Please choose 'y' or 'n'`);
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

  const plgGhostOutputHash = output[commonConfig.stackName];
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
 * @returns {void}
 */
function _destroyStack(): void {
  console.log('\nThis action will destroy the stack.');
  const approve = readlineSync.question('Do you want to approve?(y/n): ');

  if (approve === 'y') {
    if (shell.exec('npm run auto-destroy').code !== 0) {
      shell.echo('Error: cdktf destroy failed');
      shell.exit(1);
    }
  } else if (approve === 'n') {
    console.log('Declined!');
  } else {
    console.log(`Invalid input! Please choose 'y' or 'n'`);
  }
}

export { run };
