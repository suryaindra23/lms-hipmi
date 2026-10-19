import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CreateBucketCommand,
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';

export type StorageArea =
  | 'public-media'
  | 'learning-private'
  | 'submissions'
  | 'identity-private'
  | 'exports'
  | 'quarantine';

@Injectable()
export class ObjectStorageService implements OnModuleInit {
  private readonly client: S3Client;
  private readonly signingClient: S3Client;
  private readonly prefix: string;
  private readonly autoCreate: boolean;
  private readonly buckets: Record<StorageArea, string>;

  constructor(config: ConfigService) {
    this.prefix = config.get<string>('OBJECT_STORAGE_PREFIX') || 'sunrise';
    this.autoCreate = config.get<string>('OBJECT_STORAGE_AUTO_CREATE') !== 'false';
    const clientOptions = {
      region: config.get<string>('OBJECT_STORAGE_REGION') || 'us-east-1',
      forcePathStyle: true,
      credentials: {
        accessKeyId: config.get<string>('OBJECT_STORAGE_ACCESS_KEY') || 'sunrise-local',
        secretAccessKey: config.get<string>('OBJECT_STORAGE_SECRET_KEY') || 'sunrise-local-secret',
      },
    };
    const internalEndpoint = config.get<string>('OBJECT_STORAGE_ENDPOINT') || 'http://localhost:9000';
    this.client = new S3Client({ ...clientOptions, endpoint: internalEndpoint });
    this.signingClient = new S3Client({
      ...clientOptions,
      endpoint: config.get<string>('OBJECT_STORAGE_PUBLIC_ENDPOINT') || internalEndpoint,
    });
    this.buckets = {
      'public-media': `${this.prefix}-public-media`,
      'learning-private': `${this.prefix}-learning-private`,
      submissions: `${this.prefix}-submissions`,
      'identity-private': `${this.prefix}-identity-private`,
      exports: `${this.prefix}-exports`,
      quarantine: `${this.prefix}-quarantine`,
    };
  }

  async onModuleInit() {
    if (!this.autoCreate) return;
    await Promise.all(Object.values(this.buckets).map((bucket) => this.ensureBucket(bucket)));
  }

  createStorageKey(tenantId: string, filenameExtension = '') {
    const safeExtension = filenameExtension.replace(/[^a-zA-Z0-9.]/g, '').slice(0, 12);
    return `${tenantId}/${new Date().toISOString().slice(0, 10)}/${randomUUID()}${safeExtension}`;
  }

  async createUploadUrl(area: StorageArea, key: string, contentType: string, expiresIn = 300) {
    return getSignedUrl(
      this.signingClient,
      new PutObjectCommand({ Bucket: this.buckets[area], Key: key, ContentType: contentType }),
      { expiresIn: Math.min(expiresIn, 600) },
    );
  }

  async createDownloadUrl(area: StorageArea, key: string, expiresIn = 120) {
    return getSignedUrl(
      this.signingClient,
      new GetObjectCommand({
        Bucket: this.buckets[area],
        Key: key,
        ResponseContentDisposition: 'attachment',
      }),
      { expiresIn: Math.min(expiresIn, 300) },
    );
  }

  async assertObjectExists(area: StorageArea, key: string) {
    const object = await this.client.send(new HeadObjectCommand({ Bucket: this.buckets[area], Key: key }));
    return { sizeBytes: object.ContentLength, contentType: object.ContentType };
  }

  async readObject(area: StorageArea, key: string, maxBytes = 10 * 1024 * 1024) {
    const response = await this.client.send(new GetObjectCommand({ Bucket: this.buckets[area], Key: key }));
    if (!response.Body) throw new Error('Stored object has no body');
    const bytes = Buffer.from(await response.Body.transformToByteArray());
    if (bytes.length > maxBytes) throw new Error('Stored object exceeds the permitted size');
    return bytes;
  }

  async writeObject(area: StorageArea, key: string, body: Buffer | string, contentType: string) {
    await this.client.send(new PutObjectCommand({
      Bucket: this.buckets[area],
      Key: key,
      Body: body,
      ContentType: contentType,
    }));
  }

  async moveObject(from: StorageArea, to: StorageArea, sourceKey: string, destinationKey: string) {
    await this.client.send(new CopyObjectCommand({
      Bucket: this.buckets[to],
      Key: destinationKey,
      CopySource: `${encodeURIComponent(this.buckets[from])}/${sourceKey.split('/').map(encodeURIComponent).join('/')}`,
    }));
    await this.client.send(new DeleteObjectCommand({ Bucket: this.buckets[from], Key: sourceKey }));
  }

  async deleteObject(area: StorageArea, key: string) {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.buckets[area], Key: key }));
  }

  async getHealth() {
    await this.client.send(new HeadBucketCommand({ Bucket: this.buckets.quarantine }));
    return 'reachable';
  }

  private async ensureBucket(bucket: string) {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: bucket }));
    } catch {
      await this.client.send(new CreateBucketCommand({ Bucket: bucket }));
    }
  }
}
