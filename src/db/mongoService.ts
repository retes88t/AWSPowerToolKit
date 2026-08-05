import type { MongoConnection } from '../types/mongoConnection'
import {
  verifyConnection,
  fetchDatabases,
  fetchCollections,
  fetchQuery,
  type MongoProxyConnectionInput,
  type MongoProxyQueryOptions,
} from './mongoClient'
import { isDesktopBridgeAvailable } from '../bridge/desktopBridge'
import * as mongoBridge from '../bridge/mongoBridge'

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

// When running embedded in the .NET WebView2 host (`isDesktopBridgeAvailable()`, T2), every
// operation below delegates to `mongoBridge` (T9/T13) instead of `mongoClient`'s dev-only
// `/mongo-proxy/...` fetch wrapper — the real `MongoDB.Driver` runs on the .NET side there.
// Outside the bridge (published site, `npm run dev`), behavior is unchanged: this module
// still only works under `npm run dev` (no Mongo dev proxy on the published site).

export async function verify(connection: MongoConnection): Promise<boolean> {
  if (isDesktopBridgeAvailable()) {
    return mongoBridge.verify(connection)
  }
  const res = await verifyConnection(toProxyConnection(connection))
  return res.ok
}

export async function listDatabases(connection: MongoConnection): Promise<string[]> {
  if (isDesktopBridgeAvailable()) {
    return mongoBridge.listDatabases(connection)
  }
  const res = await fetchDatabases(toProxyConnection(connection))
  return res.databases
}

export async function listCollections(connection: MongoConnection, database: string): Promise<string[]> {
  if (isDesktopBridgeAvailable()) {
    return mongoBridge.listCollections(connection, database)
  }
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
  if (isDesktopBridgeAvailable()) {
    return mongoBridge.runQuery(connection, database, collection, filter, options)
  }
  const res = await fetchQuery(toProxyConnection(connection), database, collection, filter, options)
  return res.documents
}
