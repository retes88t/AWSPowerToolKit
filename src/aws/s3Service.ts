import {
  ListBucketsCommand,
  ListObjectsV2Command,
  HeadObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  CopyObjectCommand,
  RestoreObjectCommand,
  type StorageClass,
} from '@aws-sdk/client-s3'
import { getClient } from './s3Client'
import type { S3Connection } from '../types/s3Connection'

export interface BucketSummary {
  name: string
  creationDate?: string
}

export interface S3ObjectSummary {
  key: string
  size: number
  lastModified?: string
  storageClass?: string
  eTag?: string
}

export interface ListObjectsResult {
  objects: S3ObjectSummary[]
  /** "Folder" prefixes when listing with a `/` delimiter. */
  commonPrefixes: string[]
  isTruncated: boolean
  nextContinuationToken?: string
}

export interface ObjectMetadata {
  key: string
  size: number
  contentType?: string
  lastModified?: string
  storageClass?: string
  eTag?: string
  metadata?: Record<string, string>
  restoreStatus?: string
}

export interface ObjectContentResult {
  content: string
  /** True when the object is bigger than `MAX_PREVIEW_BYTES` and was cut off. */
  truncated: boolean
  contentType?: string
}

/** Reasonable cap for client-side text previews; avoids pulling huge objects into memory. */
const MAX_PREVIEW_BYTES = 1_000_000

export async function listBuckets(connection: S3Connection): Promise<BucketSummary[]> {
  const client = getClient(connection)
  const res = await client.send(new ListBucketsCommand({}))
  return (res.Buckets ?? []).map((b) => ({
    name: b.Name ?? '',
    creationDate: b.CreationDate?.toISOString(),
  }))
}

export async function listObjects(
  connection: S3Connection,
  bucket: string,
  prefix?: string,
  continuationToken?: string,
): Promise<ListObjectsResult> {
  const client = getClient(connection)
  const res = await client.send(
    new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: prefix || undefined,
      Delimiter: '/',
      ContinuationToken: continuationToken,
    }),
  )

  return {
    objects: (res.Contents ?? [])
      .filter((o) => o.Key !== prefix)
      .map((o) => ({
        key: o.Key ?? '',
        size: o.Size ?? 0,
        lastModified: o.LastModified?.toISOString(),
        storageClass: o.StorageClass,
        eTag: o.ETag,
      })),
    commonPrefixes: (res.CommonPrefixes ?? []).map((p) => p.Prefix ?? '').filter(Boolean),
    isTruncated: res.IsTruncated ?? false,
    nextContinuationToken: res.NextContinuationToken,
  }
}

export async function getObjectMetadata(
  connection: S3Connection,
  bucket: string,
  key: string,
): Promise<ObjectMetadata> {
  const client = getClient(connection)
  const res = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }))

  return {
    key,
    size: res.ContentLength ?? 0,
    contentType: res.ContentType,
    lastModified: res.LastModified?.toISOString(),
    storageClass: res.StorageClass,
    eTag: res.ETag,
    metadata: res.Metadata,
    restoreStatus: res.Restore,
  }
}

export async function getObjectContent(
  connection: S3Connection,
  bucket: string,
  key: string,
): Promise<ObjectContentResult> {
  const client = getClient(connection)
  const res = await client.send(
    new GetObjectCommand({ Bucket: bucket, Key: key, Range: `bytes=0-${MAX_PREVIEW_BYTES - 1}` }),
  )

  const content = (await res.Body?.transformToString()) ?? ''
  const truncated = (res.ContentRange ? Number(res.ContentRange.split('/')[1]) : res.ContentLength ?? 0) > content.length

  return {
    content,
    truncated,
    contentType: res.ContentType,
  }
}

export async function deleteObject(connection: S3Connection, bucket: string, key: string): Promise<void> {
  const client = getClient(connection)
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
}

/** S3 has no native rename; implemented as copy to the new key followed by deleting the old one. */
export async function renameObject(
  connection: S3Connection,
  bucket: string,
  oldKey: string,
  newKey: string,
): Promise<void> {
  const client = getClient(connection)
  await client.send(
    new CopyObjectCommand({ Bucket: bucket, CopySource: `${bucket}/${encodeURIComponent(oldKey)}`, Key: newKey }),
  )
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: oldKey }))
}

/** Changes storage class via a copy-in-place (same bucket/key) with a new `StorageClass`. */
export async function setStorageClass(
  connection: S3Connection,
  bucket: string,
  key: string,
  storageClass: StorageClass,
): Promise<void> {
  const client = getClient(connection)
  await client.send(
    new CopyObjectCommand({
      Bucket: bucket,
      CopySource: `${bucket}/${encodeURIComponent(key)}`,
      Key: key,
      StorageClass: storageClass,
      MetadataDirective: 'COPY',
    }),
  )
}

/** Requests a temporary restore of an archived (Glacier/Deep Archive) object. */
export async function restoreObject(
  connection: S3Connection,
  bucket: string,
  key: string,
  days = 7,
): Promise<void> {
  const client = getClient(connection)
  await client.send(
    new RestoreObjectCommand({
      Bucket: bucket,
      Key: key,
      RestoreRequest: { Days: days },
    }),
  )
}
