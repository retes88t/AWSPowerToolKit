using System.Text.Json;

namespace AWSPowerToolKit.Desktop;

/// <summary>
/// Reads/writes `access.json`, the on-disk store of AWS/Mongo connections used by the
/// desktop bridge handlers (SqsBridgeHandlers, S3BridgeHandlers, MongoBridgeHandlers —
/// oleada 3) in place of the browser's `localStorage` that the web build uses (see
/// connectionsStore.ts / s3ConnectionsStore.ts / mongoConnectionsStore.ts). Not wired
/// into the router or the UI yet — that happens in later tasks.
/// </summary>
public class AccessStoreService
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        WriteIndented = true,
    };

    private readonly string _filePath;

    /// <summary>Uses the default location: %LOCALAPPDATA%/AWSPowerToolKit/access.json.</summary>
    public AccessStoreService()
        : this(Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "AWSPowerToolKit",
            "access.json"))
    {
    }

    /// <summary>Overload mainly for tests, to point at an arbitrary file path.</summary>
    public AccessStoreService(string filePath)
    {
        _filePath = filePath;
    }

    /// <summary>
    /// Loads the store from disk. If the file doesn't exist yet, creates it (and its
    /// parent folder) with an empty default structure and returns that.
    /// </summary>
    public AccessStore Load()
    {
        if (!File.Exists(_filePath))
        {
            var empty = new AccessStore();
            Save(empty);
            return empty;
        }

        var json = File.ReadAllText(_filePath);
        if (string.IsNullOrWhiteSpace(json))
        {
            return new AccessStore();
        }

        return JsonSerializer.Deserialize<AccessStore>(json, JsonOptions) ?? new AccessStore();
    }

    /// <summary>Serializes and writes the store to disk, creating the parent folder if needed.</summary>
    public void Save(AccessStore store)
    {
        var directory = Path.GetDirectoryName(_filePath);
        if (!string.IsNullOrEmpty(directory))
        {
            Directory.CreateDirectory(directory);
        }

        var json = JsonSerializer.Serialize(store, JsonOptions);
        File.WriteAllText(_filePath, json);
    }
}
