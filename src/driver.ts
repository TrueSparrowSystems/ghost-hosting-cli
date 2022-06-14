const shell = require('shelljs');
const promptSync = require("prompt-sync")({ sigint: true });

function run(): void {
    _getUserInput();

    _applyPlanChanges();
}

function _getUserInput(): void {
    const GetInput = require('../lib/GetInput');
    new GetInput({ promptSync: promptSync }).perform();
}

function _applyPlanChanges(): void {
    shell.exec('cdktf diff');

    console.log('Please review the diff output above for ghost-hosting-cli');
    const approve = promptSync("Do you want to approve?(y/n) (Applies the changes outlined in the plan): ");

    if (approve === 'y') {
        if (shell.exec('cdktf deploy --auto-approve').code !== 0) {
            shell.echo('Error: cdktf deploy failed');
        }
    } else if (approve === 'n') {
        console.log('Declined!');
    } else {
        console.log(`Invalid input! Please choose 'y' or 'n'`);
    }

    shell.exit(1);
}

run();
