'use strict';

import * as AWS from 'aws-sdk';
import { Body } from 'aws-sdk/clients/s3'

export class S3 {
    s3: AWS.S3;
    bucket: string;

    constructor(bucket) {
        this.s3 = new AWS.S3();
        this.bucket = bucket;
    }

    async getObject(key): Promise<Body | undefined> {
        try {
            let result = await this.s3.getObject({
                Bucket: this.bucket,
                Key: key
            }).promise()
            return result.Body
        } catch (err) {
            if (err.code === 'NoSuchKey') {
                return;
            } else {
                throw err;
            }
        }
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

