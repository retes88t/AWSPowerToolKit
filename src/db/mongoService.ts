import type { MongoConnection } from '../types/mongoConnection'
import {
  verifyConnection,
  fetchDatabases,
  fetchCollections,
  fetchQuery,
  type MongoProxyConnectionInput,
  type MongoProxyQueryOptions,
} from './mongoClient'

/** Drops UI-only fields (e.g. `name`) before handing the connection to the dev proxy. */
function toProxyConnection(connection: MongoConnection): MongoProxyConnectionInput {
  return {
    id: connection.id,
    connectionString: connection.connectionString,
    host: connection.host,
    port: connection.port,
    username: connection.username,
    password: connection.password,
    database: connection.database,
  }
}

export async function verify(connection: MongoConnection): Promise<boolean> {
  const res = await verifyConnection(toProxyConnection(connection))
  return res.ok
}

export async function listDatabases(connection: MongoConnection): Promise<string[]> {
  const res = await fetchDatabases(toProxyConnection(connection))
  return res.databases
}

export async function listCollections(connection: MongoConnection, database: string): Promise<string[]> {
  const res = await fetchCollections(toProxyConnection(connection), database)
  return res.collections
}

export type QueryOptions = MongoProxyQueryOptions

export async function runQuery(
  connection: MongoConnection,
  database: string,
  collection: string,
  filter?: Record<string, unknown>,
  options?: QueryOptions,
): Promise<unknown[]> {
  const res = await fetchQuery(toProxyConnection(connection), database, collection, filter, options)
  return res.documents
}
