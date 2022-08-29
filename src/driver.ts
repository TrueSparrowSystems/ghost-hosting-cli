import * as shell from 'shelljs';
import * as readlineSync from 'readline-sync';
// const cdktfExec = './node_modules/.bin/cdktf';
import { GetInput } from '../lib/getInput';

function run(): void {
  _getUserInput();

  // _installProvidersAndModules();

  _applyPlanChanges();
}

function _getUserInput(): void {
  new GetInput().perform();
}

function _installProvidersAndModules(): void {
  if (shell.exec('npm run get').code !== 0) {
    shell.echo('Error: Download failed for providers and modules.');
    process.exit(1);
  }
}

function _applyPlanChanges(): void {
  if (shell.exec('npm run diff').code !== 0) {
    shell.echo('Error: cdktf exec failed');
    shell.exit(1);
  }

  console.log('Please review the output above for the ghost hosting.');
  const approve = readlineSync.question('Do you want to approve?(y/n) (Applies the changes outlined in the plan): ');

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

export { run };
