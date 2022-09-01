import { Resource } from 'cdktf';
import { Construct } from 'constructs';
import { S3Bucket, S3BucketAcl, S3BucketWebsiteConfiguration } from '../gen/providers/aws/s3';

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

    return new S3Bucket(this, 'plg-gh-blog-assets', {
      bucket: blogContentS3BucketName,
    });
  }

  /**
   * @dev Create bucket to store static assets
   *
   * @returns { S3Bucket }
   */
  _createStaticAssetBucket(): S3Bucket {
    const blogStaticS3BucketName = s3Config.blogStaticS3BucketName.concat('-', this.options.randomString);

    const staticBucket = new S3Bucket(this, 'plg-gh-static-assets', {
      bucket: blogStaticS3BucketName,
    });

    new S3BucketAcl(this, 'plg-gh-static-assets-acl', {
      acl: 'public-read',
      bucket: staticBucket.bucket,
    });

    new S3BucketWebsiteConfiguration(this, 'plg-gh-website-configuration', {
      bucket: staticBucket.bucket,
      indexDocument: {
        suffix: 'index.html',
      },
      errorDocument: {
        key: 'blog/404/index.html',
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

    return new S3Bucket(this, 'plg-gh-configs', {
      bucket: configsBucket,
    });
  }
}

export { S3Resource };
