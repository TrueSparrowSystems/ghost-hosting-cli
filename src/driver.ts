import * as shell from 'shelljs';
import * as readlineSync from "readline-sync";
const cdktfExec = './node_modules/.bin/cdktf';

function run(): void {
    _getUserInput();

    _installProvidersAndModules();

    _applyPlanChanges();
}

function _getUserInput(): void {
    const getInput = require('../lib/getInput');
    new getInput().perform();
}

function _installProvidersAndModules(): void {
    if(shell.exec('npm run get').code !== 0){
        shell.echo('Error: Download failed for providers and modules.');
        process.exit(1)
    }
}

function _applyPlanChanges(): void {
    if(shell.exec(`${cdktfExec} diff`).code !== 0){
        shell.echo('Error: cdktf exec failed');
        shell.exit(1)
    }

    console.log('Please review the diff output above for the ghost hosting.');
    const approve = readlineSync.question("Do you want to approve?(y/n) (Applies the changes outlined in the plan): ");

    if (approve === 'y') {
        if (shell.exec(`${cdktfExec} deploy --auto-approve`).code !== 0) {
            shell.echo('Error: cdktf deploy failed');
            shell.exit(1);
        }
    } else if (approve === 'n') {
        console.log('Declined!');
    } else {
        console.log(`Invalid input! Please choose 'y' or 'n'`);
    }

    // shell.exec('rm config.json');
}

export { run };
