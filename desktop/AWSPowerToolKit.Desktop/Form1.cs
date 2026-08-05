using System.Diagnostics;
using AWSPowerToolKit.Desktop.Bridge;
using Microsoft.Web.WebView2.Core;

namespace AWSPowerToolKit.Desktop;

public partial class Form1 : Form
{
    // Host name virtual usado para mapear la carpeta local `dist-desktop` (ver T3) como si
    // fuera un origen https, evitando problemas de rutas relativas/CORS al cargar la SPA.
    private const string VirtualHostName = "app.awspowertoolkit.local";

    // Ruteador de mensajes del bridge WebView2 (ver BridgeRouter.cs, T4). Se crea una vez
    // que `CoreWebView2` está inicializado, y otras clases (oleada 3) registran sus propios
    // handlers sobre esta misma instancia (ver T10) sin tener que reeditar este archivo.
    private BridgeRouter? _bridgeRouter;

    // Persistencia compartida de `access.json` (ver AccessStoreService.cs, T5), inyectada
    // a cada grupo de handlers para resolver credenciales por `connectionId`.
    private readonly AccessStoreService _accessStoreService = new();

    public Form1()
    {
        InitializeComponent();
        Load += Form1_Load;
    }

    private async void Form1_Load(object? sender, EventArgs e)
    {
        await InitializeWebViewAsync();
    }

    private async Task InitializeWebViewAsync()
    {
        try
        {
            var userDataFolder = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "AWSPowerToolKit",
                "WebView2");

            var environment = await CoreWebView2Environment.CreateAsync(userDataFolder: userDataFolder);
            await webView.EnsureCoreWebView2Async(environment);

            _bridgeRouter = new BridgeRouter(webView.CoreWebView2);
            RegisterBridgeHandlers(_bridgeRouter);

            var distDesktopPath = Path.Combine(AppContext.BaseDirectory, "dist-desktop");

            if (Directory.Exists(distDesktopPath) && File.Exists(Path.Combine(distDesktopPath, "index.html")))
            {
                webView.CoreWebView2.SetVirtualHostNameToFolderMapping(
                    VirtualHostName,
                    distDesktopPath,
                    CoreWebView2HostResourceAccessKind.Allow);

                webView.CoreWebView2.Navigate($"https://{VirtualHostName}/index.html");
            }
            else
            {
                // `dist-desktop` todavía no existe (se genera con `npm run build:desktop`, ver T3).
                // Se muestra un placeholder embebido para poder validar que WebView2 arranca.
                webView.CoreWebView2.NavigateToString(PlaceholderHtml);
            }
        }
        catch (WebView2RuntimeNotFoundException)
        {
            ShowWebView2RuntimeMissingMessage();
        }
    }

    /// <summary>
    /// Registra en <paramref name="router"/> las acciones expuestas por
    /// <see cref="SqsBridgeHandlers"/> (T6), <see cref="S3BridgeHandlers"/> (T7) y
    /// <see cref="MongoBridgeHandlers"/> (T8), inyectando a cada uno el mismo
    /// <see cref="AccessStoreService"/> (T5) para resolver credenciales/conexiones por
    /// <c>connectionId</c> contra <c>access.json</c>.
    /// </summary>
    private void RegisterBridgeHandlers(BridgeRouter router)
    {
        var sqsHandlers = new SqsBridgeHandlers(_accessStoreService);
        router.RegisterHandler("sqs.listQueues", sqsHandlers.ListQueues);
        router.RegisterHandler("sqs.getQueueSummary", sqsHandlers.GetQueueSummary);
        router.RegisterHandler("sqs.receiveMessages", sqsHandlers.ReceiveMessages);
        router.RegisterHandler("sqs.deleteMessage", sqsHandlers.DeleteMessage);
        router.RegisterHandler("sqs.releaseMessage", sqsHandlers.ReleaseMessage);
        router.RegisterHandler("sqs.purgeQueue", sqsHandlers.PurgeQueue);
        router.RegisterHandler("sqs.sendMessage", sqsHandlers.SendMessage);

        // Backend de `persist` para connectionsStore.ts (T11), s3ConnectionsStore.ts (T12) y
        // mongoConnectionsStore.ts (T13) cuando corren embebidos: leen/escriben las conexiones
        // SQS/S3/Mongo guardadas en `access.json` en vez de `localStorage`.
        var accessHandlers = new AccessBridgeHandlers(_accessStoreService);
        router.RegisterHandler("access.listSqsConnections", accessHandlers.ListSqsConnections);
        router.RegisterHandler("access.saveSqsConnections", accessHandlers.SaveSqsConnections);
        router.RegisterHandler("access.listS3Connections", accessHandlers.ListS3Connections);
        router.RegisterHandler("access.saveS3Connections", accessHandlers.SaveS3Connections);
        router.RegisterHandler("access.listMongoConnections", accessHandlers.ListMongoConnections);
        router.RegisterHandler("access.saveMongoConnections", accessHandlers.SaveMongoConnections);

        var s3Handlers = new S3BridgeHandlers(_accessStoreService);
        router.RegisterHandler("s3.listBuckets", s3Handlers.ListBuckets);
        router.RegisterHandler("s3.listObjects", s3Handlers.ListObjects);
        router.RegisterHandler("s3.getObjectMetadata", s3Handlers.GetObjectMetadata);
        router.RegisterHandler("s3.getObjectContent", s3Handlers.GetObjectContent);
        router.RegisterHandler("s3.deleteObject", s3Handlers.DeleteObject);
        router.RegisterHandler("s3.renameObject", s3Handlers.RenameObject);
        router.RegisterHandler("s3.setStorageClass", s3Handlers.SetStorageClass);
        router.RegisterHandler("s3.restoreObject", s3Handlers.RestoreObject);

        var mongoHandlers = new MongoBridgeHandlers(_accessStoreService);
        router.RegisterHandler("mongo.verify", mongoHandlers.Verify);
        router.RegisterHandler("mongo.listDatabases", mongoHandlers.ListDatabases);
        router.RegisterHandler("mongo.listCollections", mongoHandlers.ListCollections);
        router.RegisterHandler("mongo.runQuery", mongoHandlers.RunQuery);
    }

    private void ShowWebView2RuntimeMissingMessage()
    {
        var result = MessageBox.Show(
            this,
            "AWSPowerToolKit necesita el WebView2 Runtime de Microsoft (Evergreen), que no está instalado en este equipo."
                + Environment.NewLine + Environment.NewLine
                + "¿Querés abrir la página de descarga ahora?",
            "WebView2 Runtime no encontrado",
            MessageBoxButtons.YesNo,
            MessageBoxIcon.Warning);

        if (result == DialogResult.Yes)
        {
            Process.Start(new ProcessStartInfo
            {
                FileName = "https://developer.microsoft.com/en-us/microsoft-edge/webview2/",
                UseShellExecute = true,
            });
        }

        Close();
    }

    private const string PlaceholderHtml = """
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="utf-8" />
            <title>AWSPowerToolKit</title>
            <style>
                body {
                    font-family: -apple-system, "Segoe UI", sans-serif;
                    background: #111827;
                    color: #f9fafb;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    height: 100vh;
                    margin: 0;
                }
                .card {
                    text-align: center;
                    max-width: 480px;
                    padding: 0 1.5rem;
                }
                h1 {
                    font-size: 1.5rem;
                    margin-bottom: 0.5rem;
                }
                p {
                    color: #9ca3af;
                }
                code {
                    background: #1f2937;
                    padding: 0.1rem 0.35rem;
                    border-radius: 4px;
                }
            </style>
        </head>
        <body>
            <div class="card">
                <h1>AWSPowerToolKit</h1>
                <p>WebView2 arrancó correctamente, pero todavía no se encontró la SPA empaquetada (<code>dist-desktop</code>).</p>
                <p>Corré <code>npm run build:desktop</code> en la raíz del repo y volvé a abrir la app.</p>
            </div>
        </body>
        </html>
        """;
}
