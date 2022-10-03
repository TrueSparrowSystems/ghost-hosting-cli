import { App } from 'cdktf';
import { BackendStack } from './backend';
import { GhostStack } from './ghost';
import { readJsonFile } from '../lib/util';

import commonConfig from '../config/common.json';

const app = new App();

const filePath = `${__dirname}/${commonConfig.configFile}`;
const userInput = readJsonFile(filePath);

new BackendStack(app, commonConfig.backendStackName, {
  accessKey: userInput.aws.accessKeyId,
  secretKey: userInput.aws.secretAccessKey,
  region: userInput.aws.region,
  uniqueIdentifier: userInput.uniqueIdentifier,
}).perform();

new GhostStack(app, commonConfig.ghostStackName, {
  userInput,
}).perform();

app.synth();
