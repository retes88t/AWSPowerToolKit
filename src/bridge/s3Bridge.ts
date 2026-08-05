// Typed wrappers around the desktop message bridge (see desktopBridge.ts) for
// the S3 domain. Each export mirrors the signature of its counterpart in
// `src/aws/s3Service.ts` so that consuming it from the store/service layer
// (a later task) is a drop-in swap once `isDesktopBridgeAvailable()` is true.
//
// The .NET side (`S3BridgeHandlers`, desktop/AWSPowerToolKit.Desktop/Bridge/S3BridgeHandlers.cs)
// resolves AWS credentials by `connectionId` against `AccessStoreService`
// (access.json) instead of receiving them on every call, so payloads carry
// `connectionId` rather than the full `S3Connection`.
//
// Actions exposed by the .NET router (see workplan T7):
//   s3.listBuckets, s3.listObjects, s3.getObjectMetadata, s3.getObjectContent,
//   s3.deleteObject, s3.renameObject, s3.setStorageClass, s3.restoreObject

import { callBridge } from './desktopBridge'
import type { S3Connection } from '../types/s3Connection'
import type {
  BucketSummary,
  ListObjectsResult,
  ObjectMetadata,
  ObjectContentResult,
} from '../aws/s3Service'
import type { StorageClass } from '@aws-sdk/client-s3'

export async function listBuckets(connection: S3Connection): Promise<BucketSummary[]> {
  return callBridge('s3.listBuckets', { connectionId: connection.id })
}

export async function listObjects(
  connection: S3Connection,
  bucket: string,
  prefix?: string,
  continuationToken?: string,
): Promise<ListObjectsResult> {
  return callBridge('s3.listObjects', { connectionId: connection.id, bucket, prefix, continuationToken })
}

export async function getObjectMetadata(
  connection: S3Connection,
  bucket: string,
  key: string,
): Promise<ObjectMetadata> {
  return callBridge('s3.getObjectMetadata', { connectionId: connection.id, bucket, key })
}

export async function getObjectContent(
  connection: S3Connection,
  bucket: string,
  key: string,
): Promise<ObjectContentResult> {
  return callBridge('s3.getObjectContent', { connectionId: connection.id, bucket, key })
}

export async function deleteObject(connection: S3Connection, bucket: string, key: string): Promise<void> {
  await callBridge('s3.deleteObject', { connectionId: connection.id, bucket, key })
}

export async function renameObject(
  connection: S3Connection,
  bucket: string,
  oldKey: string,
  newKey: string,
): Promise<void> {
  await callBridge('s3.renameObject', { connectionId: connection.id, bucket, oldKey, newKey })
}

export async function setStorageClass(
  connection: S3Connection,
  bucket: string,
  key: string,
  storageClass: StorageClass,
): Promise<void> {
  await callBridge('s3.setStorageClass', { connectionId: connection.id, bucket, key, storageClass })
}

export async function restoreObject(
  connection: S3Connection,
  bucket: string,
  key: string,
  days = 7,
): Promise<void> {
  await callBridge('s3.restoreObject', { connectionId: connection.id, bucket, key, days })
}
