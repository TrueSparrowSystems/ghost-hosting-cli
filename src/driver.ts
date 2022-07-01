import * as shell from 'shelljs';
import * as promptSync from 'prompt-sync';
const prompt = promptSync({ sigint: true });
const cdktfExec = './node_modules/.bin/cdktf';

function run(): void {
    _getUserInput();

    _applyPlanChanges();
}

function _getUserInput(): void {
    const getInput = require('../lib/getInput');
    new getInput({ prompt }).perform();
}

function _applyPlanChanges(): void {
    // shell.exec('cdktf diff');
    if(shell.exec(`${cdktfExec} diff`).code !== 0){
        shell.echo('Error: cdktf exec failed');
        process.exit(1)
    }

    console.log('Please review the diff output above for ghost-hosting-cli');
    const approve = prompt("Do you want to approve?(y/n) (Applies the changes outlined in the plan): ");

    if (approve === 'y') {
        if (shell.exec('cdktf deploy --auto-approve').code !== 0) {
            shell.echo('Error: cdktf deploy failed');
        }
    } else if (approve === 'n') {
        console.log('Declined!');
    } else {
        console.log(`Invalid input! Please choose 'y' or 'n'`);
    }

    // shell.exec('rm config.json');

    shell.exit(1);
}

export { run };
