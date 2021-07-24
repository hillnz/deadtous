'use strict';

import * as AWS from 'aws-sdk';

// const stage = process.env.stage || 'dev';
// const service = process.env.service || 'deadtous';

export class S3 {
    s3: AWS.S3;
    bucket: string;

    constructor(bucket) {
        this.s3 = new AWS.S3();
        this.bucket = bucket;
    }

    getObject(key) {
        return this.s3.getObject({
            Bucket: this.bucket,
            Key: key
        }).promise()
            .catch(err => {
                if (err.code === 'NoSuchKey') {
                    return false;
                } else {
                    throw err;
                }
            });
    }

    putObject(key, body) {
        return this.s3.putObject({
            Bucket: this.bucket,
            Key: key,
            Body: body                
        }).promise();
    }

    deleteObject(key) {
        return this.s3.deleteObject({
            Bucket: this.bucket,
            Key: key                
        }).promise();
    }

    listObjects(prefix, limit) {
        return this.s3.listObjectsV2({
            Bucket: this.bucket,
            MaxKeys: limit,
            Prefix: prefix
        }).promise();
    }
}

