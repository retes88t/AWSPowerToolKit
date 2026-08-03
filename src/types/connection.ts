export interface AwsConnection {
  id: string
  name: string
  region: string
  accessKeyId: string
  secretAccessKey: string
  sessionToken?: string
}

export type NewAwsConnection = Omit<AwsConnection, 'id'>
