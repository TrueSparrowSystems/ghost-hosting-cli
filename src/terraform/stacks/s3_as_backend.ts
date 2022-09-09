import { Construct } from 'constructs';
import { TerraformStack } from 'cdktf';

import { S3AsBackendResource } from '../s3_as_backend';
import { AwsProvider } from '@cdktf/provider-aws';

interface Options {
  accessKey: string;
  secretKey: string;
}

interface Response {
  bucketName: string;
  dynamoTableName: string;
}

/**
 * @dev Class to create required resources by s3 backend
 */
class S3AsBackendStack extends TerraformStack {
  options: Options;

  /**
   * @dev Constructor to create required resources by s3 backend
   *
   * @param scope - scope in which to define this construct
   * @param name - name of the resource
   * @param options - options required by the resource
   */
  constructor(scope: Construct, name: string, options: Options) {
    super(scope, name);

    this.options = options;
  }

  /**
   * @dev Main performer of the class
   *
   * @returns {Response}
   */
  perform(): Response {
    new AwsProvider(this, 'aws_provider', {
      region: 'us-east-1',
      accessKey: this.options.accessKey,
      secretKey: this.options.secretKey,
    });

    const { bucketName, dynamoTableName } = this._s3AsBackend();

    return {
      bucketName,
      dynamoTableName,
    };
  }

  /**
   * @dev Create s3 backend resources
   *
   * @returns {object}
   */
  _s3AsBackend() {
    const { dynamoDbTable, tfStateBucket } = new S3AsBackendResource(this, 's3_as_backend', {}).perform();

    return { bucketName: tfStateBucket.bucket, dynamoTableName: dynamoDbTable.name };
  }
}

export { S3AsBackendStack };
