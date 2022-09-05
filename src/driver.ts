import * as shell from 'shelljs';
import * as readlineSync from 'readline-sync';
import { GetInput, ActionType } from './lib/getInput';
import * as fs from 'fs';
import commonConfig from './config/common.json';

const OUTPUT_FILE_NAME = 'output.json';
let output = {};

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

  console.log('Please review the above output for DEPLOY action.');
  const approve = readlineSync.question('Do you want to approve?(y/n): ');

  if (approve === 'y') {
    if (shell.exec('npm run auto-deploy').code !== 0) {
      shell.echo('Error: cdktf deploy failed');
      shell.exit(1);
    }

    // Success
    if (shell.exec(`npm run output --output-file ${OUTPUT_FILE_NAME}`, { silent: true })) {
      shell.echo('Error: cdktf output failed');
      shell.exit(1);
    } else {
      _readAndShowOutput();
    }
  } else if (approve === 'n') {
    console.log('Declined!');
  } else {
    console.log(`Invalid input! Please choose 'y' or 'n'`);
  }
}

function _readAndShowOutput() {
  const data = fs.readFileSync(OUTPUT_FILE_NAME, 'utf-8');

  output = JSON.parse(data);
  console.log('output ==>', output);
  
  const formattedOutput = _formatOutput(output);
  
  console.log('formattedOutput ==>', formattedOutput);
  
  console.log('RDS host: ', formattedOutput.rds.host);
  console.log('RDS password: ', formattedOutput.rds.password);
  console.log('ALB DNS Name: ', formattedOutput.alb.dnsName);
  console.log('Ghost env file arn: ', formattedOutput.ecs.ghostFileArn);
  console.log('Nginx env file arn: ', formattedOutput.ecs.nginxFileArn);
}

function _formatOutput(output: any) {
  let formattedOutput = {
    rds: { host: '', password: '' },
    alb: { dnsName: '' },
    ecs: { nginxFileArn: '', ghostFileArn: '' }
  };

  const plgGhostOutputHash = output[commonConfig.stackName];
  Object.keys(plgGhostOutputHash).forEach(function (key) { 
    var value = plgGhostOutputHash[key];

    const extractedKey = key.substring(0, key.length - 9); // 8 char random string with '_'
    switch (extractedKey) {
      case 'ecs_nginx_env_file_arn': {
        formattedOutput.ecs = Object.assign(formattedOutput.ecs, {
          nginxFileArn: value
        });
      } 

      case 'ecs_ghost_env_file_arn': {
        formattedOutput.ecs = Object.assign(formattedOutput.ecs, {
          ghostFileArn: value
        });
      }

      case 'alb_alb_dns_name': {
        formattedOutput.alb = Object.assign(formattedOutput.alb, {
          dnsName: value
        });
      }

      case 'rds_rds_host': {
        formattedOutput.rds = Object.assign(formattedOutput.rds, {
          host: value
        });
      }

      case 'rds_rds_password': {
        formattedOutput.rds = Object.assign(formattedOutput.rds, {
          password: value
        });
      }
    }
  });

  return formattedOutput;
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
