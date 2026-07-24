import { S3Client, PutObjectCommand, DeleteObjectCommand, HeadBucketCommand } from '@aws-sdk/client-s3';
import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger';
import settingsService from '../modules/settings/services/settings.service';

export async function getS3Config() {
  const accessKeyId = (await settingsService.getIntegrationKey('aws', 'access_key_id')) || process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = (await settingsService.getIntegrationKey('aws', 'secret_access_key')) || process.env.AWS_SECRET_ACCESS_KEY;
  const region = (await settingsService.getIntegrationKey('aws', 'region')) || process.env.AWS_REGION || 'ap-south-1';
  const bucketName = (await settingsService.getIntegrationKey('aws', 'bucket_name')) || process.env.AWS_S3_BUCKET_NAME;

  return { accessKeyId, secretAccessKey, region, bucketName };
}

export const isS3Configured = async (): Promise<boolean> => {
  const config = await getS3Config();
  return Boolean(
    config.accessKeyId &&
    config.accessKeyId !== 'your_access_key' &&
    config.secretAccessKey &&
    config.secretAccessKey !== 'your_secret_key' &&
    config.bucketName &&
    config.bucketName !== 'your_s3_bucket_name'
  );
};

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

    if (
      !keyId ||
      !secretKey ||
      !bucket ||
      keyId === 'your_access_key' ||
      secretKey === 'your_secret_key' ||
      bucket === 'your_s3_bucket_name'
    ) {
      return false;
    }

    const client = new S3Client({
      region: reg,
      credentials: {
        accessKeyId: keyId,
        secretAccessKey: secretKey,
      },
    });

    await client.send(new HeadBucketCommand({ Bucket: bucket }));
    return true;
  } catch (error) {
    logger.error(`S3 Connection Test Failed: ${error}`);
    return false;
  }
}

/**
 * Uploads a file to AWS S3 bucket.
 * Accepts a Multer file object (disk or memory storage).
 */
export async function uploadToS3(
  file: { path?: string; buffer?: Buffer; originalname?: string; mimetype?: string },
  folder: string = 'uploads'
): Promise<string> {
  const config = await getS3Config();
  if (
    !config.accessKeyId ||
    !config.secretAccessKey ||
    !config.bucketName ||
    config.accessKeyId === 'your_access_key'
  ) {
    throw new Error('AWS S3 is not configured in environment variables or integration settings');
  }

  const client = new S3Client({
    region: config.region,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });

  const ext = file.originalname ? path.extname(file.originalname) : '.jpg';
  const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
  const key = `${folder}/${uniqueSuffix}${ext}`;

  let body: Buffer;
  if (file.buffer) {
    body = file.buffer;
  } else if (file.path && fs.existsSync(file.path)) {
    body = fs.readFileSync(file.path);
  } else {
    throw new Error('Invalid file object: no buffer or file path found');
  }

  const command = new PutObjectCommand({
    Bucket: config.bucketName,
    Key: key,
    Body: body,
    ContentType: file.mimetype || 'image/jpeg',
  });

  await client.send(command);

  // Return full public S3 URL
  const publicUrl = `https://${config.bucketName}.s3.${config.region}.amazonaws.com/${key}`;
  logger.info(`File uploaded successfully to AWS S3: ${publicUrl}`);
  return publicUrl;
}

/**
 * Deletes an object from AWS S3 bucket given its full URL or key.
 */
export async function deleteFromS3(fileUrlOrKey: string): Promise<void> {
  try {
    const config = await getS3Config();
    if (
      !config.accessKeyId ||
      !config.secretAccessKey ||
      !config.bucketName ||
      config.accessKeyId === 'your_access_key'
    ) {
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
    logger.info(`Deleted object from AWS S3: ${key}`);
  } catch (error) {
    logger.error(`Failed to delete object from S3: ${error}`);
  }
}
