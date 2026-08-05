export interface MongoConnection {
  id: string
  name: string
  connectionString?: string
  host?: string
  port?: number
  username?: string
  password?: string
  database?: string
}

export type NewMongoConnection = Omit<MongoConnection, 'id'>
