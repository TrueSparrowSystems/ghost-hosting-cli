import { Resource } from 'cdktf';
import { Construct } from 'constructs';
import {
  DataAwsCloudfrontCachePolicy,
  DataAwsCloudfrontResponseHeadersPolicy,
} from '../../gen/providers/aws/cloudfront';
import {
  CloudfrontDistribution,
  CloudfrontOriginAccessIdentity,
  DataAwsCloudfrontOriginRequestPolicy,
} from '@cdktf/provider-aws/lib/cloudfront';
import { S3Bucket, S3BucketPolicy } from '../../gen/providers/aws/s3';
import { DataAwsIamPolicyDocument } from '../../gen/providers/aws/iam';

import commonConfig from '../../config/common.json';

interface Options {
  blogBucket: S3Bucket;
}

interface Response {
  cloudfrontDomainName: string;
}

/**
 * @dev Class create cloudfront distribution for the S3 bucket
 */
class CloudfrontResource extends Resource {
  options: Options;

  /**
   * @dev Constructor cloudfront distribution for the S3 bucket
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
    const cachePolicy = this._getCachePolicy();

    const responseHeaderPolicy = this._getResponseHeaderPolicy();

    const originRequestPolicy = this._getOriginRequestPolicy();

    const originAccessIdentity = this._createOriginAccessIdentity();

    const cloudfrontDomainName = this._createDistribution(
      cachePolicy,
      responseHeaderPolicy,
      originRequestPolicy,
      originAccessIdentity,
    );

    this._attachBucketPolicy(originAccessIdentity);

    return { cloudfrontDomainName: cloudfrontDomainName };
  }

  /**
   * @dev Cache policy
   *
   * @returns {DataAwsCloudfrontCachePolicy}
   */
  _getCachePolicy(): DataAwsCloudfrontCachePolicy {
    return new DataAwsCloudfrontCachePolicy(this, 'cache_policy', {
      name: 'Managed-CachingOptimizedForUncompressedObjects',
    });
  }

  /**
   * @dev Response header policy
   *
   * @returns {DataAwsCloudfrontResponseHeadersPolicy}
   */
  _getResponseHeaderPolicy(): DataAwsCloudfrontResponseHeadersPolicy {
    return new DataAwsCloudfrontResponseHeadersPolicy(this, 'response_header_policy', {
      name: 'Managed-SimpleCORS',
    });
  }

  /**
   * @dev Origin request policy
   *
   * @returns {DataAwsCloudfrontOriginRequestPolicy}
   */
  _getOriginRequestPolicy(): DataAwsCloudfrontOriginRequestPolicy {
    return new DataAwsCloudfrontOriginRequestPolicy(this, 'origin_request_policy', {
      name: 'Managed-CORS-S3Origin',
    });
  }

  /**
   * @dev Origin access identity
   *
   * @returns {CloudfrontOriginAccessIdentity}
   */
  _createOriginAccessIdentity() {
    return new CloudfrontOriginAccessIdentity(this, 'origin_access_identity', {
      comment: 'PLG Ghost blog',
    });
  }

  /**
   * @dev Create cloudfront distribution
   *
   * @param cachePolicy
   * @param responseHeaderPolicy
   * @param originRequestPolicy
   * @param originAccessIdentity
   * @returns
   */
  _createDistribution(
    cachePolicy: DataAwsCloudfrontCachePolicy,
    responseHeaderPolicy: DataAwsCloudfrontResponseHeadersPolicy,
    originRequestPolicy: DataAwsCloudfrontOriginRequestPolicy,
    originAccessIdentity: CloudfrontOriginAccessIdentity,
  ): string {
    const originId = `S3-${this.options.blogBucket.bucket}`;

    const cloudfrontDistribution = new CloudfrontDistribution(this, 'distribution', {
      origin: [
        {
          domainName: this.options.blogBucket.bucketRegionalDomainName,
          originId: originId,
          s3OriginConfig: {
            originAccessIdentity: originAccessIdentity.cloudfrontAccessIdentityPath,
          },
        },
      ],
      enabled: true,
      isIpv6Enabled: true,
      comment: 'PLG Ghost blog',
      defaultCacheBehavior: {
        allowedMethods: ['GET', 'HEAD', 'OPTIONS'],
        cachedMethods: ['GET', 'HEAD'],
        targetOriginId: originId,
        viewerProtocolPolicy: 'redirect-to-https',
        cachePolicyId: cachePolicy.id,
        originRequestPolicyId: originRequestPolicy.id,
        responseHeadersPolicyId: responseHeaderPolicy.id,
      },
      priceClass: 'PriceClass_All',
      restrictions: {
        geoRestriction: {
          restrictionType: 'none',
        },
      },
      viewerCertificate: {
        cloudfrontDefaultCertificate: true,
      },
      tags: commonConfig.tags,
    });

    return cloudfrontDistribution.domainName;
  }

  /**
   * @dev Give access to bucket
   *
   * @param originAccessIdentity
   */
  _attachBucketPolicy(originAccessIdentity: CloudfrontOriginAccessIdentity): void {
    const policy = new DataAwsIamPolicyDocument(this, 'iam_policy_document', {
      statement: [
        {
          actions: ['s3:GetObject'],
          resources: [`${this.options.blogBucket.arn}/*`],
          principals: [
            {
              type: 'AWS',
              identifiers: [originAccessIdentity.iamArn],
            },
          ],
        },
      ],
    });

    new S3BucketPolicy(this, 'bucket_policy', {
      bucket: this.options.blogBucket.id,
      policy: policy.json,
    });
  }
}

export { CloudfrontResource };
