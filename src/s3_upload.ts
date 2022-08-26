import { Resource } from "cdktf";
import { Construct } from "constructs";
import { S3Bucket, S3Object } from "../.gen/providers/aws/s3";
import { getDomainFromUrl } from "../lib/util";

import ecsConfig from "../config/ecs.json";

interface Options {
    region: string;
    blogBucket: S3Bucket;
    configsBucket: S3Bucket;
    staticBucket: S3Bucket;
    rdsDbHost: string;
    rdsDbUserName: string;
    rdsDbPassword: string;
    rdsDbName: string;
    rdsSecurityGroupId: string;
    ghostHostingUrl: string;
    hostStaticWebsite: boolean;
    staticWebsiteUrl: string | undefined;
}

interface Response {
    ghostEnvUpload: S3Object;
    nginxEnvUpload: S3Object;
}

const GHOST_ENV_FILE_NAME = "ghost";
const NGINX_ENV_FILE_NAME = "nginx";

/**
 * Class to create required s3 buckets.
 */
class S3Upload extends Resource {
    options: Options;

    constructor(scope: Construct, name: string, options: Options) {
        super(scope, name);

        this.options = options;
    }

    /**
     * Main performer of the class.
     */
    perform(): Response {
        const ghostEnvFileContent = this._getGhostEnvFileContent();

        const ghostEnvUpload = this._uploadFileToBucket(ghostEnvFileContent, GHOST_ENV_FILE_NAME);

        const nginxEnvFileContent = this._getNginxEnvFileContent();

        const nginxEnvUpload = this._uploadFileToBucket(nginxEnvFileContent, NGINX_ENV_FILE_NAME);

        return { ghostEnvUpload, nginxEnvUpload }
    }

    _getGhostEnvFileContent(): string {
        return `database__client=mysql\n` +
        `database__connection__host=${this.options.rdsDbHost}\n` +
        `database__connection__user=${this.options.rdsDbUserName}\n` +
        `database__connection__password=${this.options.rdsDbPassword}\n` +
        `database__connection__database=${this.options.rdsDbName}\n` +
        `storage__s3__bucket=${this.options.blogBucket.bucket}\n` +
        `storage__s3__region=${this.options.region}\n` +
        `storage__s3__pathPrefix=blog/images\n` +
        `storage__s3__acl=public-read\n` +
        `storage__s3__forcePathStyle=true\n` +
        `storage__active=s3\n` +
        `url=${this.options.ghostHostingUrl}`;
    }

    _getNginxEnvFileContent(): string {
        const hostingDomain = getDomainFromUrl(this.options.ghostHostingUrl);
        const staticWebsiteDomain = this.options.staticWebsiteUrl
            ? getDomainFromUrl(this.options.staticWebsiteUrl)
            : '127.0.0.1';
        let fileContent = `GHOST_SERVER_NAME=${hostingDomain}\n` +
        `GHOST_STATIC_SERVER_NAME=${staticWebsiteDomain}\n` +
        `PROXY_PASS_HOST=127.0.0.1\n` +
        `PROXY_PASS_PORT=${ecsConfig.ghostContainerPort}`;

        if (this.options.hostStaticWebsite) {
            const s3EnvVars = `\nS3_STATIC_BUCKET_HOST=${this.options.staticBucket.bucketDomainName}`;
            fileContent = fileContent.concat(s3EnvVars);
        }

        return fileContent;
    }

    _uploadFileToBucket(fileContent: string, filename: string): S3Object {
        const identifier = "plg-gh-" + filename + "-configs";

        return new S3Object(this, identifier, {
            key: filename + ".env",
            bucket: this.options.configsBucket.bucket,
            acl: "private",
            content: fileContent
        });
    }
}

export { S3Upload };
