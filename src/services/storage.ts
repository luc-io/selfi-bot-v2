import AWS from 'aws-sdk';
import { randomBytes } from 'crypto';
import { logger } from '../lib/logger.js';

if (!process.env.SPACES_KEY || !process.env.SPACES_SECRET || !process.env.SPACES_BUCKET || !process.env.SPACES_ENDPOINT) {
  throw new Error('Digital Ocean Spaces credentials not configured');
}

export interface UploadOptions {
  key?: string;
  contentType?: string;
  expiresIn?: number; // In seconds
  public?: boolean;
}

export class StorageService {
  private s3: AWS.S3;
  private bucket: string;

  constructor() {
    this.bucket = process.env.SPACES_BUCKET as string;
    const endpoint = process.env.SPACES_ENDPOINT;

    if (!endpoint) {
      throw new Error('SPACES_ENDPOINT environment variable is not set');
    }

    this.s3 = new AWS.S3({
      endpoint: new URL(endpoint).hostname,
      accessKeyId: process.env.SPACES_KEY,
      secretAccessKey: process.env.SPACES_SECRET,
      signatureVersion: 'v4'
    });
  }

  /**
   * Generate a unique key for storage
   */
  private generateKey(prefix: string = ''): string {
    const uniqueId = randomBytes(16).toString('hex');
    return prefix ? `${prefix}/${uniqueId}` : uniqueId;
  }

  /**
   * Upload a file to DO Spaces
   */
  public async uploadFile(
    file: Buffer,
    options: UploadOptions = {}
  ): Promise<string> {
    try {
      const key = options.key || this.generateKey('training');

      const params: AWS.S3.PutObjectRequest = {
        Bucket: this.bucket,
        Key: key,
        Body: file,
        ContentType: options.contentType,
        ACL: options.public ? 'public-read' : 'private'
      };

      await this.s3.putObject(params).promise();

      // Get URL
      const endpoint = process.env.SPACES_ENDPOINT;
      if (!endpoint) {
        throw new Error('SPACES_ENDPOINT environment variable is not set');
      }

      if (options.public) {
        // Return public URL if ACL is public-read
        return `${endpoint}/${key}`;
      } else {
        // Generate signed URL
        return this.getSignedUrl(key, options.expiresIn);
      }
    } catch (error) {
      logger.error({ error }, 'Failed to upload file to storage');
      throw error;
    }
  }

  /**
   * Delete a file from storage
   */
  public async deleteFile(key: string): Promise<void> {
    try {
      await this.s3.deleteObject({
        Bucket: this.bucket,
        Key: key
      }).promise();

      logger.info({ key }, 'Deleted file from storage');
    } catch (error) {
      logger.error({ error, key }, 'Failed to delete file from storage');
      throw error;
    }
  }

  /**
   * Generate a signed URL for temporary access
   */
  public async getSignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    try {
      const url = await this.s3.getSignedUrlPromise('getObject', {
        Bucket: this.bucket,
        Key: key,
        Expires: expiresIn
      });

      return url;
    } catch (error) {
      logger.error({ error, key }, 'Failed to generate signed URL');
      throw error;
    }
  }
}