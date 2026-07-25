import { S3Client, PutObjectCommand, DeleteObjectCommand, HeadBucketCommand } from '@aws-sdk/client-s3';
import path from 'path';
import dotenv from 'dotenv';
import { logger } from '../utils/logger';
import settingsService from '../modules/settings/services/settings.service';

dotenv.config();

/**
 * Gets S3 Configuration reading from environment variables
 * (AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, S3_BUCKET_NAME / AWS_S3_BUCKET_NAME)
 * with integration settings fallback.
 */
export async function getS3Config() {
  const envAccessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const envSecretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  const envRegion = process.env.AWS_REGION;
  const envBucketName = process.env.S3_BUCKET_NAME || process.env.AWS_S3_BUCKET_NAME;

  const dbAccessKey = await settingsService.getIntegrationKey('aws', 'access_key_id');
  const dbSecretKey = await settingsService.getIntegrationKey('aws', 'secret_access_key');
  const dbRegion = await settingsService.getIntegrationKey('aws', 'region');
  const dbBucket = await settingsService.getIntegrationKey('aws', 'bucket_name');

  const accessKeyId = (envAccessKeyId && envAccessKeyId !== 'your_access_key') ? envAccessKeyId : (dbAccessKey || envAccessKeyId);
  const secretAccessKey = (envSecretAccessKey && envSecretAccessKey !== 'your_secret_key') ? envSecretAccessKey : (dbSecretKey || envSecretAccessKey);
  const region = envRegion || dbRegion || 'ap-south-1';
  const bucketName = (envBucketName && envBucketName !== 'your_s3_bucket_name') ? envBucketName : (dbBucket || envBucketName || 'hopscotch-bt');

  return { accessKeyId, secretAccessKey, region, bucketName };
}

/**
 * Tests S3 bucket connection.
 */
export async function testS3Connection(
  accessKeyId?: string,
  secretAccessKey?: string,
  region?: string,
  bucketName?: string
): Promise<boolean> {
  try {
    const config = await getS3Config();
    const keyId = accessKeyId || config.accessKeyId;
    const secretKey = secretAccessKey || config.secretAccessKey;
    const reg = region || config.region || 'ap-south-1';
    const bucket = bucketName || config.bucketName;

    if (!keyId || !secretKey || !bucket) return false;

    const client = new S3Client({
      region: reg,
      credentials: { accessKeyId: keyId, secretAccessKey: secretKey },
    });

    await client.send(new HeadBucketCommand({ Bucket: bucket }));
    return true;
  } catch (error) {
    logger.error(`S3 Connection Test Failed: ${error}`);
    return false;
  }
}

/**
 * Checks if AWS S3 environment credentials are properly configured.
 */
export const isS3Configured = async (): Promise<boolean> => {
  const config = await getS3Config();
  return Boolean(
    config.accessKeyId &&
      config.accessKeyId !== 'your_access_key' &&
      config.secretAccessKey &&
      config.secretAccessKey !== 'your_secret_key' &&
      config.bucketName
  );
};

/**
 * Validates file type and size.
 */
export function validateFile(mimetype: string, size: number, maxSizeMB: number = 50) {
  const allowedMimeTypes = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/svg+xml',
    'video/mp4',
    'video/webm',
    'application/pdf',
  ];

  if (mimetype && !allowedMimeTypes.includes(mimetype.toLowerCase())) {
    throw new Error(`File type ${mimetype} is not allowed.`);
  }

  const maxBytes = maxSizeMB * 1024 * 1024;
  if (size > maxBytes) {
    throw new Error(`File size exceeds maximum allowed limit of ${maxSizeMB}MB.`);
  }
}

/**
 * Uploads a file buffer or Multer file object directly to AWS S3 bucket.
 * Does NOT set ACL: 'public-read' on PutObject call (preferring AWS recommended Bucket Policy).
 */
export async function uploadToS3(
  fileInput: {
    buffer?: Buffer;
    path?: string;
    originalname?: string;
    mimetype?: string;
    size?: number;
  },
  folder: string = 'uploads'
): Promise<string> {
  const config = await getS3Config();

  if (!config.accessKeyId || !config.secretAccessKey || !config.bucketName) {
    throw new Error('AWS S3 is missing credentials in environment (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, S3_BUCKET_NAME)');
  }

  // Validate mimetype & size if present
  if (fileInput.mimetype && fileInput.size) {
    validateFile(fileInput.mimetype, fileInput.size);
  }

  const client = new S3Client({
    region: config.region,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });

  const originalName = fileInput.originalname || 'file.jpg';
  const ext = path.extname(originalName) || '.jpg';
  const sanitizedBase = path
    .basename(originalName, ext)
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .substring(0, 30);

  const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
  const key = `${folder}/${uniqueSuffix}-${sanitizedBase}${ext}`;

  let bodyBuffer: Buffer;
  if (fileInput.buffer) {
    bodyBuffer = fileInput.buffer;
  } else if (fileInput.path) {
    const fs = require('fs');
    if (fs.existsSync(fileInput.path)) {
      bodyBuffer = fs.readFileSync(fileInput.path);
    } else {
      throw new Error(`File path not found: ${fileInput.path}`);
    }
  } else {
    throw new Error('No file buffer or path provided for S3 upload');
  }

  const command = new PutObjectCommand({
    Bucket: config.bucketName,
    Key: key,
    Body: bodyBuffer,
    ContentType: fileInput.mimetype || 'image/jpeg',
  });

  await client.send(command);

  // Return proxied public uploads URL accessible to client apps and browsers
  const publicUrl = `/api/uploads/${key}`;
  logger.info(`Successfully uploaded to S3: key=${key}, publicUrl=${publicUrl}`);
  return publicUrl;
}

/**
 * Fetches an object directly from AWS S3 bucket by Key.
 */
export async function getObjectFromS3(key: string) {
  const config = await getS3Config();
  if (!config.accessKeyId || !config.secretAccessKey || !config.bucketName) {
    throw new Error('AWS S3 credentials missing');
  }
  const client = new S3Client({
    region: config.region,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
  const { GetObjectCommand } = require('@aws-sdk/client-s3');
  return await client.send(new GetObjectCommand({
    Bucket: config.bucketName,
    Key: key,
  }));
}

/**
 * Deletes an object from AWS S3 bucket by full URL or Key.
 */
export async function deleteFromS3(fileUrlOrKey: string): Promise<void> {
  try {
    const config = await getS3Config();
    if (!config.accessKeyId || !config.secretAccessKey || !config.bucketName) {
      return;
    }

    const client = new S3Client({
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });

    let key = fileUrlOrKey;
    if (fileUrlOrKey.startsWith('http://') || fileUrlOrKey.startsWith('https://')) {
      const url = new URL(fileUrlOrKey);
      key = url.pathname.startsWith('/') ? url.pathname.slice(1) : url.pathname;
    }

    const command = new DeleteObjectCommand({
      Bucket: config.bucketName,
      Key: key,
    });

    await client.send(command);
    logger.info(`Successfully deleted S3 object: ${key}`);
  } catch (error) {
    logger.error(`Failed to delete object from S3: ${error}`);
  }
}
