import * as fs from 'fs';

let configJson = {};

/**
 * @dev Read and format inputs from the file
 *
 * @returns {object}
 */
function readInput(): object {
  _readFromFile();

  return _formatInput();
}

/**
 * @dev Read file and parse JSON data
 *
 * @returns {void}
 */
function _readFromFile(): void {
  const configFileName = 'config.json';
  const data = fs.readFileSync(configFileName, 'utf-8');

  configJson = JSON.parse(data);
}

/**
 * @dev Format input from the file
 *
 * @returns {object}
 */
function _formatInput(): object {
  return configJson;
}

export { readInput };
