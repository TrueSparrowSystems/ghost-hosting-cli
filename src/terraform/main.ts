import { App } from 'cdktf';
import { S3AsBackendStack } from './stacks/s3_as_backend';
import { GhostStack } from './stacks/ghost';
import { readInput } from '../lib/readInput';

import commonConfig from '../config/common.json';

const app = new App();

const userInput = readInput();

const s3BackendResponse = new S3AsBackendStack(app, 'xyz', {
  accessKey: userInput.aws.accessKeyId,
  secretKey: userInput.aws.secretAccessKey,
  region: userInput.aws.region,
}).perform();

new GhostStack(app, commonConfig.ghostStackName, {
  bucketName: s3BackendResponse.bucketName,
  dynamoTableName: s3BackendResponse.dynamoTableName,
  userInput,
}).perform();

app.synth();
