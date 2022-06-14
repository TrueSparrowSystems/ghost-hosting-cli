import * as fs from 'fs';

let configJson = {};
function readInput() {
    _readFromFile();

    return _formatInput();
}

function _readFromFile() {
    const configFileName = 'config.json';
    const data = fs.readFileSync(configFileName, 'utf-8');

    configJson = JSON.parse(data);
}

function _formatInput() {
    return configJson;
}

export { readInput };
