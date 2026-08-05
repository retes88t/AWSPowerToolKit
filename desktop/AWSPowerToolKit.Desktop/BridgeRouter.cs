using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Web.WebView2.Core;

namespace AWSPowerToolKit.Desktop;

/// <summary>
/// Envelope enviado por la SPA vía <c>window.chrome.webview.postMessage</c>
/// (ver <c>src/bridge/desktopBridge.ts</c>, <c>BridgeRequestEnvelope</c>).
/// </summary>
public readonly struct BridgeRequestEnvelope
{
    public string? CorrelationId { get; init; }
    public string? Action { get; init; }
    public JsonElement Payload { get; init; }
}

/// <summary>
/// Envelope de respuesta que se postea de vuelta a la SPA (ver
/// <c>src/bridge/desktopBridge.ts</c>, <c>BridgeResponseEnvelope</c>). Debe llevar el
/// mismo <c>correlationId</c> que la request para que la promesa pendiente del lado
/// JS se resuelva/rechace correctamente.
/// </summary>
public sealed class BridgeResponseEnvelope
{
    public required string CorrelationId { get; init; }
    public object? Payload { get; init; }
    public string? Error { get; init; }
}

/// <summary>
/// Escucha <see cref="CoreWebView2.WebMessageReceived"/>, parsea el envelope JSON
/// enviado desde la SPA (<c>action</c>, <c>correlationId</c>, <c>payload</c>) y lo
/// despacha al handler registrado para esa <c>action</c>, devolviendo la respuesta
/// vía <see cref="CoreWebView2.PostWebMessageAsJson"/> con el mismo
/// <c>correlationId</c> (y <c>error</c> si el handler lanza una excepción o si no
/// hay ningún handler registrado para la acción pedida).
///
/// Los handlers se registran por nombre de acción (ej. <c>"sqs.listQueues"</c>) vía
/// <see cref="RegisterHandler"/>, para que otras clases (oleada 3:
/// <c>SqsBridgeHandlers</c>, <c>S3BridgeHandlers</c>, <c>MongoBridgeHandlers</c>)
/// puedan registrar sus propias acciones sin tener que editar esta clase ni
/// <c>Form1</c> en paralelo.
/// </summary>
public sealed class BridgeRouter
{
    private static readonly JsonSerializerOptions ResponseJsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    };

    private readonly Dictionary<string, Func<JsonElement, Task<object>>> _handlers = new();
    private readonly CoreWebView2 _coreWebView;

    public BridgeRouter(CoreWebView2 coreWebView)
    {
        _coreWebView = coreWebView;
        _coreWebView.WebMessageReceived += OnWebMessageReceived;

        // Acción de prueba para validar el circuito completo end-to-end (ver T4).
        RegisterHandler("ping", _ => Task.FromResult<object>(new { ok = true }));
    }

    /// <summary>
    /// Registra <paramref name="handler"/> para atender <paramref name="action"/>.
    /// Si ya había un handler registrado para esa acción, lo reemplaza.
    /// </summary>
    public void RegisterHandler(string action, Func<JsonElement, Task<object>> handler)
    {
        _handlers[action] = handler;
    }

    private async void OnWebMessageReceived(object? sender, CoreWebView2WebMessageReceivedEventArgs e)
    {
        string correlationId = string.Empty;

        try
        {
            using var document = JsonDocument.Parse(e.WebMessageAsJson);
            var root = document.RootElement;

            correlationId = root.TryGetProperty("correlationId", out var correlationIdElement)
                ? correlationIdElement.GetString() ?? string.Empty
                : string.Empty;
            var action = root.TryGetProperty("action", out var actionElement) ? actionElement.GetString() : null;
            var payload = root.TryGetProperty("payload", out var payloadElement) ? payloadElement : default;

            if (string.IsNullOrEmpty(correlationId) || string.IsNullOrEmpty(action))
            {
                PostResponse(new BridgeResponseEnvelope
                {
                    CorrelationId = correlationId,
                    Error = "El mensaje recibido no tiene 'correlationId' o 'action'.",
                });
                return;
            }

            if (!_handlers.TryGetValue(action, out var handler))
            {
                PostResponse(new BridgeResponseEnvelope
                {
                    CorrelationId = correlationId,
                    Error = $"No hay ningún handler registrado para la acción '{action}'.",
                });
                return;
            }

            try
            {
                var result = await handler(payload);
                PostResponse(new BridgeResponseEnvelope
                {
                    CorrelationId = correlationId,
                    Payload = result,
                });
            }
            catch (Exception ex)
            {
                PostResponse(new BridgeResponseEnvelope
                {
                    CorrelationId = correlationId,
                    Error = ex.Message,
                });
            }
        }
        catch (Exception ex)
        {
            PostResponse(new BridgeResponseEnvelope
            {
                CorrelationId = correlationId,
                Error = $"No se pudo procesar el mensaje del bridge: {ex.Message}",
            });
        }
    }

    private void PostResponse(BridgeResponseEnvelope response)
    {
        var json = JsonSerializer.Serialize(response, ResponseJsonOptions);
        _coreWebView.PostWebMessageAsJson(json);
    }
}
