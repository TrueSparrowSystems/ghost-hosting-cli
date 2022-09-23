import { Construct } from 'constructs';
import { TerraformStack } from 'cdktf';

import { S3AsBackendResource } from './backend/s3_as_backend';
import { AwsProvider } from '@cdktf/provider-aws';

interface Options {
  accessKey: string;
  secretKey: string;
  region: string;
  uniqueIdentifier: string;
}

/**
 * @dev Class to create required resources by s3 backend
 */
class BackendStack extends TerraformStack {
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
   * @returns {void}
   */
  perform(): void {
    new AwsProvider(this, 'aws_provider', {
      region: this.options.region,
      accessKey: this.options.accessKey,
      secretKey: this.options.secretKey,
    });

    this._s3AsBackend();
  }

  /**
   * @dev Create s3 backend resources
   *
   * @returns {void}
   */
  _s3AsBackend(): void {
    new S3AsBackendResource(this, 's3_as_backend', { uniqueIdentifier: this.options.uniqueIdentifier }).perform();
  }
}

export { BackendStack };
