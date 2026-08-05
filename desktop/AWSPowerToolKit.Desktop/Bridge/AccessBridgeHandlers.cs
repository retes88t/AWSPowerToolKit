using System.Text.Json;

namespace AWSPowerToolKit.Desktop.Bridge;

/// <summary>
/// Handlers .NET para leer/escribir en <c>access.json</c> las conexiones que el frontend
/// hoy persiste en <c>localStorage</c> (ver T11, <c>src/store/connectionsStore.ts</c>, y
/// T12, <c>src/store/s3ConnectionsStore.ts</c>). Cuando la app corre embebida vía el bridge
/// de WebView2, el store de Zustand usa estas acciones como backend de su middleware
/// <c>persist</c> en vez de <c>localStorage</c>.
///
/// Expone las acciones de los módulos SQS (<c>access.listSqsConnections</c>,
/// <c>access.saveSqsConnections</c>), S3 (<c>access.listS3Connections</c>,
/// <c>access.saveS3Connections</c>) y Database/Mongo (<c>access.listMongoConnections</c>,
/// <c>access.saveMongoConnections</c>, T13, consumidas por
/// <c>src/store/mongoConnectionsStore.ts</c>).
/// </summary>
public sealed class AccessBridgeHandlers
{
    private static readonly JsonSerializerOptions RequestJsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
    };

    private readonly AccessStoreService _accessStoreService;

    public AccessBridgeHandlers(AccessStoreService accessStoreService)
    {
        _accessStoreService = accessStoreService;
    }

    private sealed class SaveSqsConnectionsRequestDto
    {
        public List<AwsCredentialEntry> Connections { get; set; } = [];
    }

    private sealed class SaveS3ConnectionsRequestDto
    {
        public List<AwsCredentialEntry> Connections { get; set; } = [];
    }

    private sealed class SaveMongoConnectionsRequestDto
    {
        public List<MongoConnectionEntry> Connections { get; set; } = [];
    }

    public Task<object> ListSqsConnections(JsonElement payload)
    {
        var store = _accessStoreService.Load();
        return Task.FromResult<object>(store.SqsConnections);
    }

    public Task<object> SaveSqsConnections(JsonElement payload)
    {
        var request = Deserialize<SaveSqsConnectionsRequestDto>(payload);
        var store = _accessStoreService.Load();
        store.SqsConnections = request.Connections;
        _accessStoreService.Save(store);
        return Task.FromResult<object>(new { ok = true });
    }

    public Task<object> ListS3Connections(JsonElement payload)
    {
        var store = _accessStoreService.Load();
        return Task.FromResult<object>(store.S3Connections);
    }

    public Task<object> SaveS3Connections(JsonElement payload)
    {
        var request = Deserialize<SaveS3ConnectionsRequestDto>(payload);
        var store = _accessStoreService.Load();
        store.S3Connections = request.Connections;
        _accessStoreService.Save(store);
        return Task.FromResult<object>(new { ok = true });
    }

    public Task<object> ListMongoConnections(JsonElement payload)
    {
        var store = _accessStoreService.Load();
        return Task.FromResult<object>(store.MongoConnections);
    }

    public Task<object> SaveMongoConnections(JsonElement payload)
    {
        var request = Deserialize<SaveMongoConnectionsRequestDto>(payload);
        var store = _accessStoreService.Load();
        store.MongoConnections = request.Connections;
        _accessStoreService.Save(store);
        return Task.FromResult<object>(new { ok = true });
    }

    private static T Deserialize<T>(JsonElement payload)
    {
        return JsonSerializer.Deserialize<T>(payload, RequestJsonOptions)
            ?? throw new InvalidOperationException($"No se pudo deserializar el payload como {typeof(T).Name}.");
    }
}
