export interface S3Connection {
  id: string
  name: string
  region: string
  accessKeyId: string
  secretAccessKey: string
  sessionToken?: string
}

export type NewS3Connection = Omit<S3Connection, 'id'>
