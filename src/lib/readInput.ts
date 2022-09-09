import * as fs from 'fs';

let configJson = {

};

/**
 * @dev Read and format inputs from the file
 *
 * @returns {{}}
 */
function readInput(): {} {
  const configFileName = 'config.json';
  const data = fs.readFileSync(configFileName, 'utf-8');

  return JSON.parse(data);
}

export { readInput };
