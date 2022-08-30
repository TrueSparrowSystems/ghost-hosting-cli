import * as fs from 'fs';

let configJson = {};
function readInput(): any {
    _readFromFile();

    return _formatInput();
}

function _readFromFile(): any {
    const configFileName = 'config.json';
    const data = fs.readFileSync(configFileName, 'utf-8');

    configJson = JSON.parse(data);
}

function _formatInput(): any {
    return configJson;
}

export { readInput };
