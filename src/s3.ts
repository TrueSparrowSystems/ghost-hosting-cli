import { Resource } from "cdktf";
import { Construct } from "constructs";
import { S3Bucket, S3BucketWebsiteConfiguration } from "../.gen/providers/aws/s3";
import { StringResource } from "../.gen/providers/random";

const s3Config = require("../config/s3.json");

/**
 * Class to create required s3 buckets.
 */
class S3Resource extends Resource {
    options: {};

    constructor(scope: Construct, name: string, options: any) {
        super(scope, name);

        this.options = options;
    }

    perform() {
        // const randomString = this._generateRandomSuffix();

        const randomString = Math.random().toString(36).substring(2, 10);
        const blogBucket = this._createBlogAssetBucket(randomString);

        const staticBucket = this._createStaticAssetBucket(randomString);

        const configsBucket = this._createConfigsBucket(randomString);

        return { blogBucket, staticBucket, configsBucket };
    }

    _generateRandomSuffix() {
        const random = new StringResource(this, "random-string-suffix", {
            length: 8,
            special: false,
            numeric: false,
            upper: false
        });

        return random.toString();
    }

    _createBlogAssetBucket(randomSuffix: string) {
        const blogContentS3BucketName =  s3Config.blogContentS3BucketName.concat("-", randomSuffix);

        return new S3Bucket(this, "plg-gh-blog-assets", {
            bucket: blogContentS3BucketName
        });
    }

    _createStaticAssetBucket(randomSuffix: string) {
        const blogStaticS3BucketName = s3Config.blogStaticS3BucketName.concat("-", randomSuffix);

        const staticBucket = new S3Bucket(this, "plg-gh-static-assets", {
            bucket: blogStaticS3BucketName,
            acl: "public-read"
        });

        new S3BucketWebsiteConfiguration(this, "plg-gh-website-configuration", {
            bucket: staticBucket.bucket,
            indexDocument: {
                suffix: "index.html"
            },
            errorDocument: {
                key: "blog/404/index.html"
            }
        });

        return staticBucket;
    }

    _createConfigsBucket(randomSuffix: string) {
        const configsBucket = s3Config.configsS3BucketName.concat("-", randomSuffix);

        return new S3Bucket(this, "plg-gh-configs", {
            bucket: configsBucket
        });
    }
}

export { S3Resource };
