import { App } from 'cdktf';
import { S3AsBackendStack } from './stacks/s3_as_backend';
import { GhostStack } from './stacks/ghost';
import { readInput } from '../lib/readInput';

const app = new App();

const userInput = readInput();

const s3BackendResponse = new S3AsBackendStack(app, 's3-stack', {
  accessKey: userInput.aws.accessKeyId,
  secretKey: userInput.aws.secretAccessKey,
}).perform();

new GhostStack(app, 'ghost', {
  bucketName: s3BackendResponse.bucketName,
  dynamoTableName: s3BackendResponse.dynamoTableName,
  userInput
}).perform();

app.synth();
