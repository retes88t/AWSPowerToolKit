import { S3Client } from '@aws-sdk/client-s3'
import type { S3Connection } from '../types/s3Connection'

/**
 * Unlike SQS, S3 supports CORS natively (configured per-bucket via a bucket
 * policy / CORS configuration on AWS's side), so there is no need for a
 * same-origin dev proxy here like `sqsClient.ts`'s `DevProxyHttpHandler`.
 * Calls from this client can still fail with a CORS error in the browser if
 * the target bucket doesn't have a CORS configuration allowing this origin —
 * that's an AWS-side configuration issue on the bucket, not a bug in this app.
 */
export function createS3Client(connection: S3Connection): S3Client {
  return new S3Client({
    region: connection.region,
    credentials: {
      accessKeyId: connection.accessKeyId,
      secretAccessKey: connection.secretAccessKey,
      sessionToken: connection.sessionToken || undefined,
    },
  })
}

const clientCache = new Map<string, S3Client>()

function clientCacheKey(connection: S3Connection): string {
  return `${connection.id}:${connection.region}:${connection.accessKeyId}:${connection.sessionToken ?? ''}`
}

export function getClient(connection: S3Connection): S3Client {
  const cacheKey = clientCacheKey(connection)
  let client = clientCache.get(cacheKey)
  if (!client) {
    client = createS3Client(connection)
    clientCache.set(cacheKey, client)
  }
  return client
}
