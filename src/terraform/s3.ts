import { Resource, TerraformOutput } from 'cdktf';
import { Construct } from 'constructs';
import { S3Bucket, S3BucketAcl, S3BucketWebsiteConfiguration } from '../gen/providers/aws/s3';
import { getPathSuffixFromUrl } from '../lib/util';

import s3Config from '../config/s3.json';

interface Options {
  randomString: string;
  vpcId: string;
  ghostHostingUrl: string;
  region: string;
}

interface Response {
  blogBucket: S3Bucket;
  staticBucket: S3Bucket;
  configsBucket: S3Bucket;
}

/**
 * @dev Class to create required s3 buckets
 * - This will create three s3 buckets
 *    1. blog asset bucket - to store static content/images
 *    2. static asset bucket - to store static pages
 *    3. configs bucket - to store env/config files
 */
class S3Resource extends Resource {
  options: Options;

  /**
   * @dev Constructor for the S3 resource class
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
    const blogBucket = this._createBlogAssetBucket();

    const staticBucket = this._createStaticAssetBucket();

    const configsBucket = this._createConfigsBucket();

    return { blogBucket, staticBucket, configsBucket };
  }

  /**
   * @dev Create bucket to store blog assets
   *
   * @returns { S3Bucket }
   */
  _createBlogAssetBucket(): S3Bucket {
    const blogContentS3BucketName = s3Config.blogContentS3BucketName.concat('-', this.options.randomString);

    return new S3Bucket(this, 'blog_assets', {
      bucket: blogContentS3BucketName,
      forceDestroy: true,
    });
  }

  /**
   * @dev Create bucket to store static assets
   *
   * @returns { S3Bucket }
   */
  _createStaticAssetBucket(): S3Bucket {
    const blogStaticS3BucketName = s3Config.blogStaticS3BucketName.concat('-', this.options.randomString);

    const staticBucket = new S3Bucket(this, 'static_assets', {
      bucket: blogStaticS3BucketName,
      forceDestroy: true,
    });

    new TerraformOutput(this, 'website_bucket_arn', {
      value: staticBucket.arn,
    });

    new S3BucketAcl(this, 'static_assets_acl', {
      acl: 'public-read',
      bucket: staticBucket.bucket,
    });

    const urlPath = getPathSuffixFromUrl(this.options.ghostHostingUrl);

    let errorDoc = '404/index.html';
    if(urlPath){
      errorDoc = `${urlPath}/${errorDoc}`
    }
    new S3BucketWebsiteConfiguration(this, 'website_configuration', {
      bucket: staticBucket.bucket,
      indexDocument: {
        suffix: 'index.html',
      },
      errorDocument: {
        key: errorDoc,
      },
    });

    return staticBucket;
  }

  /**
   * @dev Create bucket to store configuration files
   *
   * @returns { S3Bucket }
   */
  _createConfigsBucket(): S3Bucket {
    const configsBucket = s3Config.configsS3BucketName.concat('-', this.options.randomString);

    return new S3Bucket(this, 'configs', {
      bucket: configsBucket,
      forceDestroy: true,
    });
  }
}

export { S3Resource };
