import { Resource } from 'cdktf';
import { Construct } from 'constructs';
import { S3Bucket, S3BucketVersioningA, S3BucketServerSideEncryptionConfigurationA } from '../../gen/providers/aws/s3';
import { DynamodbTable } from '../../gen/providers/aws/dynamodb';

import commonConfig from '../../config/common.json';

interface Options {
  uniqueIdentifier: string;
}

/**
 * @dev Class to create s3 backend
 */
class S3AsBackendResource extends Resource {
  options: Options;

  /**
   * @dev to create s3 backend
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
   * @returns { void }
   */
  perform(): void {
    const tfStateBucket = this._createBucket();

    this._bucketVersioning(tfStateBucket);

    this._bucketServerSideEncryption(tfStateBucket);

    this._createDynamoDbTable();
  }

  _createBucket() {
    const tfStateBucketName = `${commonConfig.tfStateBucketName}-${this.options.uniqueIdentifier}`;

    const tfStateBucket = new S3Bucket(this, 'tf_state', {
      bucket: tfStateBucketName,
      lifecycle: {
        preventDestroy: false,
      },
      forceDestroy: true,
    });

    return tfStateBucket;
  }

  _bucketVersioning(tfStateBucket: S3Bucket) {
    new S3BucketVersioningA(this, 'tf_remote_state_versioning', {
      bucket: tfStateBucket.bucket,
      versioningConfiguration: {
        status: 'Enabled',
      },
    });
  }

  _bucketServerSideEncryption(tfStateBucket: S3Bucket) {
    new S3BucketServerSideEncryptionConfigurationA(this, 'tf_remote_state_sse', {
      bucket: tfStateBucket.bucket,
      rule: [
        {
          applyServerSideEncryptionByDefault: {
            sseAlgorithm: 'AES256',
          },
        },
      ],
    });
  }

  _createDynamoDbTable() {
    return new DynamodbTable(this, 'tf_remote_state_locking', {
      hashKey: 'LockID',
      name: commonConfig.tfStateBucketLockDdbTableName,
      attribute: [
        {
          name: 'LockID',
          type: 'S',
        },
      ],
      billingMode: 'PAY_PER_REQUEST',
    });
  }
}

export { S3AsBackendResource };
