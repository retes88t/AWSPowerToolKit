// Typed wrappers around the desktop message bridge (see desktopBridge.ts) for
// the Database (Mongo) domain. Each export mirrors the signature of its
// counterpart in `src/db/mongoService.ts` so that consuming it from the
// store/service layer (a later task) is a drop-in swap once
// `isDesktopBridgeAvailable()` is true.
//
// The .NET side (`MongoBridgeHandlers`, desktop/AWSPowerToolKit.Desktop/Bridge/MongoBridgeHandlers.cs)
// resolves the connection (connection string, or host/port/user/password/database)
// by `connectionId` against `AccessStoreService` (access.json) instead of
// receiving it on every call, so payloads carry `connectionId` rather than the
// full `MongoConnection`.
//
// Actions exposed by the .NET router (see workplan T8):
//   mongo.verify, mongo.listDatabases, mongo.listCollections, mongo.runQuery
//
// Also wraps `access.listMongoConnections`/`access.saveMongoConnections` (T13,
// `AccessBridgeHandlers` in desktop/AWSPowerToolKit.Desktop/Bridge/AccessBridgeHandlers.cs),
// which read/write the whole Mongo connection list in `access.json` — same pattern as
// `access.listS3Connections`/`access.saveS3Connections` in s3Bridge.ts (T12). Consumed by
// `src/store/mongoConnectionsStore.ts` as the `persist` middleware's storage backend when
// `isDesktopBridgeAvailable()`.

import { callBridge } from './desktopBridge'
import type { MongoConnection } from '../types/mongoConnection'
import type { QueryOptions } from '../db/mongoService'

export async function listConnections(): Promise<MongoConnection[]> {
  return callBridge('access.listMongoConnections', {})
}

export async function saveConnections(connections: MongoConnection[]): Promise<void> {
  await callBridge('access.saveMongoConnections', { connections })
}

export async function verify(connection: MongoConnection): Promise<boolean> {
  const res = await callBridge<{ connectionId: string }, { ok: boolean }>('mongo.verify', {
    connectionId: connection.id,
  })
  return res.ok
}

export async function listDatabases(connection: MongoConnection): Promise<string[]> {
  return callBridge('mongo.listDatabases', { connectionId: connection.id })
}

export async function listCollections(connection: MongoConnection, database: string): Promise<string[]> {
  return callBridge('mongo.listCollections', { connectionId: connection.id, database })
}

export async function runQuery(
  connection: MongoConnection,
  database: string,
  collection: string,
  filter?: Record<string, unknown>,
  options?: QueryOptions,
): Promise<unknown[]> {
  return callBridge('mongo.runQuery', { connectionId: connection.id, database, collection, filter, options })
}
