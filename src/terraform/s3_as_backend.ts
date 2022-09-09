import { Resource, Fn } from 'cdktf';
import { Construct } from 'constructs';
import {
  S3Bucket,
  S3BucketVersioningA,
  S3BucketServerSideEncryptionConfigurationA,
  S3BucketPolicy,
} from '../gen/providers/aws/s3';
import { DynamodbTable } from '../gen/providers/aws/dynamodb';

import s3Config from '../config/s3.json';
import commonConfig from '../config/common.json';

import { DataAwsIamPolicyDocument, IamPolicy, IamRole, IamRolePolicyAttachment } from '../gen/providers/aws/iam';

interface Options {}

interface Response {
  dynamoDbTable: DynamodbTable;
  tfStateBucket: S3Bucket;
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
   * @returns { Response }
   */
  perform(): Response {
    const tfStateBucket = this._createBucket();

    // this._addBucketPolicy(tfStateBucket);

    this._bucketVersioning(tfStateBucket);

    this._bucketServerSideEncryption(tfStateBucket);

    const dynamoDbTable = this._createDynamoDbTable();

    return { dynamoDbTable, tfStateBucket };
  }

  _createBucket() {
    const tfStateBucket = new S3Bucket(this, 'tf_state', {
      bucket: s3Config.tfStateBucketName,
      lifecycle: {
        preventDestroy: false, // TODO: discuss?
      },
    });

    // const IamPolicyDocument = new DataAwsIamPolicyDocument(this, 'tf_state_policy_doc', {
    //   version: "2012-10-17",
    //   statement: [
    //     {
    //       effect: "Allow",
    //       actions: ["s3:ListBucket"],
    //       resources: [tfStateBucket.arn],
    //       principals: []
    //     },
    //     {
    //       effect: "Allow",
    //       actions: ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
    //       resources: [tfStateBucket.arn + '/*'],
    //       principals: []
    //     }
    //   ],
    // });

    // new S3BucketPolicy(this, 'tf_remote_state_policy', {
    //   bucket: tfStateBucket.bucket,
    //   policy: IamPolicyDocument.json
    // });

    return tfStateBucket;
  }

  _addBucketPolicy(tfStateBucket: S3Bucket) {
    const policy = new IamPolicy(this, 'tf_state_bucket_policy', {
      name: commonConfig.nameIdentifier + '-s3-as-backend-policy',
      path: '/',
      policy: Fn.jsonencode({
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Action: 's3:ListBucket',
            Resource: [tfStateBucket.arn],
          },
          {
            Effect: 'Allow',
            Action: ['s3:GetObject', 's3:PutObject', 's3:DeleteObject'],
            Resource: [tfStateBucket.arn + '/*'],
          },
        ],
      }),
    });

    // Create role
    const role = new IamRole(this, 'tf_state_bucket_role', {
      name: commonConfig.nameIdentifier + '-s3-as-backend-role',
      assumeRolePolicy: Fn.jsonencode({
        Version: '2012-10-17',
        Statement: [
          {
            Action: 'sts:AssumeRole',
            Effect: 'Allow',
            Sid: '',
            Principal: {
              Service: '*',
            },
          },
        ],
      }),
    });

    // Role-policy attachment
    new IamRolePolicyAttachment(this, 'tf_state_bucket_role_attachment', {
      role: role.name,
      policyArn: policy.arn,
    });
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
      name: s3Config.dynamoDbTableName,
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
