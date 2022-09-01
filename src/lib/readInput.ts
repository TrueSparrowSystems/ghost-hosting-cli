import * as fs from 'fs';

let configJson = {};
function readInput(): object {
    _readFromFile();

    return _formatInput();
}

function _readFromFile(): void {
    const configFileName = 'config.json';
    const data = fs.readFileSync(configFileName, 'utf-8');

    configJson = JSON.parse(data);
}

function _formatInput(): object {
    return configJson;
}

export { readInput };
