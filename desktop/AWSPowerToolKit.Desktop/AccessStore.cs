namespace AWSPowerToolKit.Desktop;

/// <summary>
/// Credential entry shared by SQS and S3 connections — both have the exact same shape
/// today (mirrors `AwsConnection` in src/types/connection.ts and `S3Connection` in
/// src/types/s3Connection.ts on the frontend).
/// </summary>
public class AwsCredentialEntry
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Region { get; set; } = string.Empty;
    public string AccessKeyId { get; set; } = string.Empty;
    public string SecretAccessKey { get; set; } = string.Empty;
    public string? SessionToken { get; set; }
}

/// <summary>
/// Mirrors `MongoConnection` in src/types/mongoConnection.ts: either a direct
/// connection string or the individual host/port/username/password/database fields.
/// </summary>
public class MongoConnectionEntry
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? ConnectionString { get; set; }
    public string? Host { get; set; }
    public int? Port { get; set; }
    public string? Username { get; set; }
    public string? Password { get; set; }
    public string? Database { get; set; }
}

/// <summary>
/// Root container persisted as `access.json` (see <see cref="AccessStoreService"/>).
/// Holds the three modules' connections independently, matching the frontend's
/// per-module connection stores (connectionsStore.ts, s3ConnectionsStore.ts,
/// mongoConnectionsStore.ts) which never share state with each other either.
/// </summary>
public class AccessStore
{
    public List<AwsCredentialEntry> SqsConnections { get; set; } = [];
    public List<AwsCredentialEntry> S3Connections { get; set; } = [];
    public List<MongoConnectionEntry> MongoConnections { get; set; } = [];
}
