import * as shell from 'shelljs';
import * as readlineSync from 'readline-sync';
// const cdktfExec = './node_modules/.bin/cdktf';
import { GetInput, ActionType } from '../lib/getInput';

function run(): void {
  const response = new GetInput().perform();

  if (response.action === ActionType.DEPLOY) {
    _deployStack();
  } else if (response.action === ActionType.DESTROY) {
    _destroyStack();
  }
}

function _deployStack(): void {
  if (shell.exec('npm run diff').code !== 0) {
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
  } else if (approve === 'n') {
    console.log('Declined!');
  } else {
    console.log(`Invalid input! Please choose 'y' or 'n'`);
  }
}

function _destroyStack(): void {
  if (shell.exec('npm run diff').code !== 0) {
    shell.echo('Error: cdktf exec failed');
    shell.exit(1);
  }

  console.log('\nPlease review the above output for DESTROY action.');
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
