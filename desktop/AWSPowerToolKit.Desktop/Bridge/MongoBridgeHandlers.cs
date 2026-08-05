using System.Text.Json;
using MongoDB.Bson;
using MongoDB.Driver;

namespace AWSPowerToolKit.Desktop.Bridge;

/// <summary>
/// Handlers .NET para el módulo Database (Mongo/DocumentDB), usando el driver oficial
/// <c>MongoDB.Driver</c> en vez de un fetch a un proxy HTTP. Replica las operaciones que hoy
/// expone <c>src/db/mongoService.ts</c> vía el proxy de dev <c>mongoDevProxy</c> en
/// <c>vite.config.ts</c>: <c>verify</c> (ping), <c>listDatabases</c>, <c>listCollections</c>,
/// <c>runQuery</c> (find con filter/limit/skip/sort, serializando <c>ObjectId</c>/<c>Date</c>
/// a JSON plano, igual espíritu que <c>toJsonSafe</c> del lado Node).
///
/// Cada método público tiene la firma <c>Task&lt;object&gt; Handle(JsonElement payload)</c>
/// exigida por <c>BridgeRouter.RegisterHandler</c> (ver T4), y corresponde a la acción
/// indicada en su doc-comment (<c>mongo.verify</c>, <c>mongo.listDatabases</c>,
/// <c>mongo.listCollections</c>, <c>mongo.runQuery</c>). Registrados en el router en T10.
///
/// La persistencia de la lista de conexiones Mongo en sí (leer/escribir
/// <c>AccessStore.MongoConnections</c> completo) vive aparte, en
/// <see cref="AccessBridgeHandlers.ListMongoConnections"/>/<see cref="AccessBridgeHandlers.SaveMongoConnections"/>
/// (acciones <c>access.listMongoConnections</c>/<c>access.saveMongoConnections</c>, T13),
/// mismo patrón que <c>access.listS3Connections</c>/<c>access.saveS3Connections</c> (T12) y
/// <c>access.listSqsConnections</c>/<c>access.saveSqsConnections</c> (T11) — no en esta clase,
/// para no acoplar el CRUD de conexiones con los handlers de operaciones de dominio.
///
/// Resuelve la conexión por <c>payload.connectionId</c> contra <see cref="AccessStoreService"/>
/// (T5), leyendo <c>AccessStore.MongoConnections</c>. Cachea el <see cref="MongoClient"/> por
/// conexión (mismo espíritu que <c>mongoClientCache</c> en <c>vite.config.ts</c> / <c>clientCache</c>
/// en <c>sqsService.ts</c>).
/// </summary>
public sealed class MongoBridgeHandlers
{
    private static readonly JsonSerializerOptions PayloadJsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
    };

    private readonly AccessStoreService _accessStoreService;
    private readonly Dictionary<string, MongoClient> _clientCache = new();

    public MongoBridgeHandlers(AccessStoreService accessStoreService)
    {
        _accessStoreService = accessStoreService;
    }

    // Payload shapes ----------------------------------------------------------------------

    private sealed class ConnectionOnlyPayload
    {
        public string ConnectionId { get; set; } = string.Empty;
    }

    private sealed class ListCollectionsPayload
    {
        public string ConnectionId { get; set; } = string.Empty;
        public string Database { get; set; } = string.Empty;
    }

    private sealed class RunQueryPayload
    {
        public string ConnectionId { get; set; } = string.Empty;
        public string Database { get; set; } = string.Empty;
        public string Collection { get; set; } = string.Empty;
        public JsonElement? Filter { get; set; }
        public RunQueryOptionsPayload? Options { get; set; }
    }

    private sealed class RunQueryOptionsPayload
    {
        public int? Limit { get; set; }
        public int? Skip { get; set; }
        public JsonElement? Sort { get; set; }
    }

    // Handlers ------------------------------------------------------------------------------

    /// <summary>Acción "mongo.verify" — hace ping a la conexión indicada por payload.connectionId.</summary>
    public async Task<object> Verify(JsonElement payload)
    {
        var request = Deserialize<ConnectionOnlyPayload>(payload);
        var client = GetClient(request.ConnectionId);
        await client.GetDatabase("admin").RunCommandAsync<BsonDocument>(new BsonDocument("ping", 1));
        return new { ok = true };
    }

    /// <summary>Acción "mongo.listDatabases".</summary>
    public async Task<object> ListDatabases(JsonElement payload)
    {
        var request = Deserialize<ConnectionOnlyPayload>(payload);
        var client = GetClient(request.ConnectionId);
        using var cursor = await client.ListDatabaseNamesAsync();
        var names = await cursor.ToListAsync();
        return new { databases = names };
    }

    /// <summary>Acción "mongo.listCollections" (requiere payload.database).</summary>
    public async Task<object> ListCollections(JsonElement payload)
    {
        var request = Deserialize<ListCollectionsPayload>(payload);
        if (string.IsNullOrEmpty(request.Database))
        {
            throw new InvalidOperationException("Falta 'database' en el payload de mongo.listCollections.");
        }

        var client = GetClient(request.ConnectionId);
        using var cursor = await client.GetDatabase(request.Database).ListCollectionNamesAsync();
        var names = await cursor.ToListAsync();
        return new { collections = names };
    }

    /// <summary>
    /// Acción "mongo.runQuery" (requiere payload.database y payload.collection) — corre un
    /// find con filter/limit/skip/sort y devuelve los documentos como JSON plano.
    /// </summary>
    public async Task<object> RunQuery(JsonElement payload)
    {
        var request = Deserialize<RunQueryPayload>(payload);
        if (string.IsNullOrEmpty(request.Database) || string.IsNullOrEmpty(request.Collection))
        {
            throw new InvalidOperationException("Faltan 'database' y/o 'collection' en el payload de mongo.runQuery.");
        }

        var client = GetClient(request.ConnectionId);
        var collection = client.GetDatabase(request.Database).GetCollection<BsonDocument>(request.Collection);

        var filter = ToBsonFilter(request.Filter);
        var findOptions = new FindOptions<BsonDocument>
        {
            Limit = request.Options?.Limit,
            Skip = request.Options?.Skip,
            Sort = ToBsonSort(request.Options?.Sort),
        };

        using var resultCursor = await collection.FindAsync(filter, findOptions);
        var documents = await resultCursor.ToListAsync();
        var jsonSafeDocuments = documents.Select(ToJsonSafe).ToList();
        return new { documents = jsonSafeDocuments };
    }

    // Helpers -------------------------------------------------------------------------------

    private MongoClient GetClient(string connectionId)
    {
        if (string.IsNullOrEmpty(connectionId))
        {
            throw new InvalidOperationException("Falta 'connectionId' en el payload.");
        }

        if (_clientCache.TryGetValue(connectionId, out var cachedClient))
        {
            return cachedClient;
        }

        var store = _accessStoreService.Load();
        var connection = store.MongoConnections.FirstOrDefault(c => c.Id == connectionId)
            ?? throw new InvalidOperationException($"No se encontró la conexión Mongo '{connectionId}' en access.json.");

        var client = new MongoClient(BuildMongoUri(connection));
        _clientCache[connectionId] = client;
        return client;
    }

    /// <summary>
    /// Construye el connection string igual que <c>buildMongoUri</c> en <c>vite.config.ts</c>:
    /// usa <c>connectionString</c> directo si está presente, si no arma
    /// <c>mongodb://user:pass@host:port/database</c> a partir de los campos individuales.
    /// </summary>
    private static string BuildMongoUri(MongoConnectionEntry connection)
    {
        if (!string.IsNullOrEmpty(connection.ConnectionString))
        {
            return connection.ConnectionString;
        }

        var auth = !string.IsNullOrEmpty(connection.Username) || !string.IsNullOrEmpty(connection.Password)
            ? $"{Uri.EscapeDataString(connection.Username ?? string.Empty)}:{Uri.EscapeDataString(connection.Password ?? string.Empty)}@"
            : string.Empty;
        var host = string.IsNullOrEmpty(connection.Host) ? "localhost" : connection.Host;
        var port = connection.Port is int p ? $":{p}" : string.Empty;
        var database = string.IsNullOrEmpty(connection.Database) ? string.Empty : $"/{connection.Database}";

        return $"mongodb://{auth}{host}{port}{database}";
    }

    private static FilterDefinition<BsonDocument> ToBsonFilter(JsonElement? filter)
    {
        if (filter is not { } value || value.ValueKind is JsonValueKind.Undefined or JsonValueKind.Null)
        {
            return FilterDefinition<BsonDocument>.Empty;
        }

        return BsonDocument.Parse(value.GetRawText());
    }

    private static SortDefinition<BsonDocument>? ToBsonSort(JsonElement? sort)
    {
        if (sort is not { } value || value.ValueKind is JsonValueKind.Undefined or JsonValueKind.Null)
        {
            return null;
        }

        return new BsonDocumentSortDefinition<BsonDocument>(BsonDocument.Parse(value.GetRawText()));
    }

    /// <summary>
    /// Convierte un <see cref="BsonDocument"/> a un objeto JSON-safe (<c>ObjectId</c> como
    /// string hex, <c>DateTime</c> como string ISO 8601), mismo resultado que <c>toJsonSafe</c>
    /// en <c>vite.config.ts</c> (ahí resuelto vía un round-trip de <c>JSON.stringify/parse</c>
    /// porque el driver de Node ya serializa ObjectId/Date "lindo" por default; acá se hace
    /// explícito documento por documento porque <c>System.Text.Json</c> no serializa BSON solo).
    /// </summary>
    private static Dictionary<string, object?> ToJsonSafe(BsonDocument document)
    {
        var result = new Dictionary<string, object?>();
        foreach (var element in document)
        {
            result[element.Name] = ToJsonSafeValue(element.Value);
        }

        return result;
    }

    private static object? ToJsonSafeValue(BsonValue value)
    {
        return value.BsonType switch
        {
            BsonType.ObjectId => value.AsObjectId.ToString(),
            BsonType.DateTime => value.ToUniversalTime().ToString("o"),
            BsonType.Document => ToJsonSafe(value.AsBsonDocument),
            BsonType.Array => value.AsBsonArray.Select(ToJsonSafeValue).ToList(),
            BsonType.Null => null,
            BsonType.Boolean => value.AsBoolean,
            BsonType.Int32 => value.AsInt32,
            BsonType.Int64 => value.AsInt64,
            BsonType.Double => value.AsDouble,
            BsonType.Decimal128 => value.AsDecimal,
            BsonType.String => value.AsString,
            _ => BsonTypeMapper.MapToDotNetValue(value),
        };
    }

    private static T Deserialize<T>(JsonElement payload) where T : new()
    {
        if (payload.ValueKind is JsonValueKind.Undefined or JsonValueKind.Null)
        {
            return new T();
        }

        return payload.Deserialize<T>(PayloadJsonOptions) ?? new T();
    }
}
