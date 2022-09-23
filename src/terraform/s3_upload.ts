import { Resource } from 'cdktf';
import { Construct } from 'constructs';
import { S3Bucket, S3Object, S3BucketWebsiteConfiguration } from '../gen/providers/aws/s3';
import { getDomainFromUrl } from '../lib/util';

import ecsConfig from '../config/ecs.json';

interface Options {
  region: string;
  blogBucket: S3Bucket;
  configsBucket: S3Bucket;
  staticBucket: S3Bucket;
  s3BucketWebsiteConfiguration: S3BucketWebsiteConfiguration;
  rdsDbHost: string;
  rdsDbUserName: string;
  rdsDbPassword: string;
  rdsDbName: string;
  rdsSecurityGroupId: string;
  ghostHostingUrl: string;
  hostStaticWebsite: boolean;
  staticWebsiteUrl: string | undefined;
  cloudfrontDomainName: string;
}

interface Response {
  ghostEnvUpload: S3Object;
  nginxEnvUpload: S3Object;
}

const GHOST_ENV_FILE_NAME = ecsConfig.ghostContainerName + '.env';
const NGINX_ENV_FILE_NAME = ecsConfig.nginxContainerName + '.env';

/**
 * @dev Class to upload config files to S3 buckets
 * - This will create two env variables files and upload it to configs s3 bucket
 *    1. ghost env - to store ghost environment variables
 *    2. nginx env - to store nginx environment variables
 */
class S3Upload extends Resource {
  options: Options;

  /**
   * @dev Constructor for the S3 upload resource class
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
    const ghostEnvFileContent = this._getGhostEnvFileContent();

    const ghostEnvUpload = this._uploadFileToBucket(ghostEnvFileContent, GHOST_ENV_FILE_NAME);

    const nginxEnvFileContent = this._getNginxEnvFileContent();

    const nginxEnvUpload = this._uploadFileToBucket(nginxEnvFileContent, NGINX_ENV_FILE_NAME);

    return { ghostEnvUpload, nginxEnvUpload };
  }

  /**
   * @dev Ghost environment variables
   *
   * @returns { string } - ghost env variables as a concatenated string
   */
  _getGhostEnvFileContent(): string {
    const cloudfrontUrl = `https://${this.options.cloudfrontDomainName}`;

    return (
      `database__client=mysql\n` +
      `database__connection__host=${this.options.rdsDbHost}\n` +
      `database__connection__user=${this.options.rdsDbUserName}\n` +
      `database__connection__password=${this.options.rdsDbPassword}\n` +
      `database__connection__database=${this.options.rdsDbName}\n` +
      `storage__s3__bucket=${this.options.blogBucket.bucket}\n` +
      `storage__s3__region=${this.options.region}\n` +
      `storage__s3__pathPrefix=blog/images\n` +
      `storage__s3__acl=private\n` +
      `storage__s3__forcePathStyle=true\n` +
      `storage__active=s3\n` +
      `storage__s3__assetHost=${cloudfrontUrl}\n` +
      `url=${this.options.ghostHostingUrl}`
    );
  }

  /**
   * @dev Nginx environment variables
   *
   * @returns { string } - nginx env variables as a concatenated string
   */
  _getNginxEnvFileContent(): string {
    const hostingDomain = getDomainFromUrl(this.options.ghostHostingUrl);
    const staticWebsiteDomain = this.options.staticWebsiteUrl
      ? getDomainFromUrl(this.options.staticWebsiteUrl)
      : '127.0.0.1';
    const fileContent =
      `GHOST_SERVER_NAME=${hostingDomain}\n` +
      `GHOST_STATIC_SERVER_NAME=${staticWebsiteDomain}\n` +
      `PROXY_PASS_HOST=127.0.0.1\n` +
      `PROXY_PASS_PORT=${ecsConfig.ghostContainerPort}\n` +
      `S3_STATIC_BUCKET_HOST=${
        this.options.hostStaticWebsite ? this.options.s3BucketWebsiteConfiguration.websiteEndpoint : '127.0.0.1'
      }`;

    return fileContent;
  }

  /**
   * @dev Upload file to s3 bucket
   *
   * @param fileContent - contents of the file as a string
   * @param filename - name of the file to upload
   * @returns { S3Object }
   */
  _uploadFileToBucket(fileContent: string, filename: string): S3Object {
    const identifier = 'upload_configs_' + filename;

    return new S3Object(this, identifier, {
      key: filename,
      bucket: this.options.configsBucket.bucket,
      acl: 'private',
      content: fileContent,
      dependsOn: [this.options.configsBucket, this.options.staticBucket, this.options.s3BucketWebsiteConfiguration],
    });
  }
}

export { S3Upload };
