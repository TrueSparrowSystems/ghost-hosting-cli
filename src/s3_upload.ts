import { Resource } from "cdktf";
import { Construct } from "constructs";
import { S3Bucket, S3BucketObject } from "../.gen/providers/aws/s3";
import { File } from "../.gen/providers/local";

const ecsConfig = require("../config/ecs.json");

interface Options {
    blogBucket: S3Bucket,
    configsBucket: S3Bucket,
    staticBucket: S3Bucket,
    rdsDbHost: string,
    rdsDbUserName: string,
    rdsDbPassword: string,
    rdsDbName: string,
    rdsSecurityGroupId: string,
    ghostHostingUrl: string,
    hostStaticWebsite: boolean
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
    perform() {
        const ghostEnvFileContent = this._getGhostEnvFileContent();

        const ghostEnvFile = this._createLocalFile(GHOST_ENV_FILE_NAME, ghostEnvFileContent);

        const ghostEnvUpload = this._uploadFileToBucket(ghostEnvFile, GHOST_ENV_FILE_NAME);

        const nginxEnvFileContent = this._getNginxEnvFileContent();

        const nginxEnvFile = this._createLocalFile(NGINX_ENV_FILE_NAME, nginxEnvFileContent);

        const nginxEnvUpload = this._uploadFileToBucket(nginxEnvFile, NGINX_ENV_FILE_NAME);

        return { ghostEnvUpload, nginxEnvUpload }
    }

    _getGhostEnvFileContent() {
        return `database__client=mysql\ndatabase__connection__host=${this.options.rdsDbHost}\ndatabase__connection__user=${this.options.rdsDbUserName}\ndatabase__connection__password=${this.options.rdsDbPassword}\ndatabase__connection__database=${this.options.rdsDbName}\nstorage__s3__bucket=${this.options.blogBucket.bucket}\nstorage__s3__pathPrefix=blog/images\nstorage__s3__acl=public-read\nstorage__s3__forcePathStyle=true\nstorage__active=s3\nurl=${this.options.ghostHostingUrl}`;
    }

    _getNginxEnvFileContent() {
        const fileContent = `GHOST_SERVER_NAME=ghost\nGHOST_STATIC_SERVER_NAME=ghost-static\nPROXY_PASS_HOST=127.0.0.1\nPROXY_PASS_PORT=${ecsConfig.ghostContainerPort}`;

        if (this.options.hostStaticWebsite) {
            const s3EnvVars = `\nS3_STATIC_BUCKET_HOST=${this.options.staticBucket.bucketDomainName}\nS3_STATIC_BUCKET=${this.options.staticBucket.bucket}`;

            fileContent.concat(s3EnvVars);
        }

        return fileContent;
    }

    _createLocalFile(filename: string, fileContent: string) {
        const identifier = "plg-gh-" + filename + "-file";

        return new File(this, identifier, {
            filename: filename + ".env",
            content: fileContent,
            dependsOn: [this.options.configsBucket]
        });
    }

    _uploadFileToBucket(ghostEnvFile: File, filename: string) {
        const identifier = "plg-gh-" + filename + "-configs";

        return new S3BucketObject(this, identifier, {
            key: filename + ".env",
            bucket: this.options.configsBucket.bucket,
            acl: "private",
            source: filename + ".env",
            dependsOn: [ghostEnvFile]
        });
    }
}

export { S3Upload };
