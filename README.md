# AWSPowerToolKit

Suite de herramientas para explorar recursos de AWS y bases de datos. Tiene un shell con menú lateral de navegación y tres módulos independientes, cada uno con sus propias conexiones/credenciales (no se comparte estado entre módulos):

- **SQS Explorer** — listar colas, recibir/filtrar/eliminar mensajes, enviar mensajes nuevos y purgar colas (`@aws-sdk/client-sqs`).
- **S3 Explorer** — listar buckets, navegar objetos por prefijo, ver metadata/contenido, y eliminar/renombrar/cambiar storage class/restaurar objetos (`@aws-sdk/client-s3`).
- **Database** — conectar a una instancia Mongo/DocumentDB (por connection string o host/usuario/password), navegar bases/colecciones y correr queries `find`.

Se puede correr de dos formas: como **app 100% navegador** (sin backend propio, ver más abajo sus limitaciones) o como **ejecutable de escritorio Windows** (`.exe`) con un backend .NET real, sin depender de ningún proxy.

> ⚠️ Las credenciales cargadas en la UI no deben considerarse guardadas de forma segura por defecto: en modo navegador se persisten en `localStorage` (una clave distinta por módulo), y en modo escritorio en un archivo `access.json` en disco.

## Modo navegador

```bash
npm install
npm run dev
```

Abrí la URL que muestra Vite, elegí un módulo en el menú lateral y conectá la cuenta/base correspondiente desde la UI.

> Las llamadas reales a AWS (SQS y S3) y a Mongo solo funcionan corriendo `npm run dev` en local:
> - SQS no devuelve headers CORS, así que el dev server incluye un proxy que firma las requests con el SDK y las reenvía same-origin.
> - S3 soporta CORS de forma nativa por bucket, pero solo si el bucket lo tiene configurado; no hay proxy propio para este módulo.
> - Mongo/DocumentDB usa un driver de Node que no puede correr en el browser, así que el dev server expone un proxy propio (`/mongo-proxy/...`) que mantiene la conexión real y ejecuta las queries.
>
> El sitio publicado en GitHub Pages es solo una demo de la interfaz: no hay backend, y el módulo Database en particular no puede funcionar ahí porque depende enteramente del proxy de desarrollo.

### Requisitos (modo navegador)

- Node.js
- Para SQS Explorer: credenciales de AWS con permisos sobre SQS (`ListQueues`, `ReceiveMessage`, `SendMessage`, `DeleteMessage`, `PurgeQueue`, etc.)
- Para S3 Explorer: credenciales de AWS con permisos sobre S3 (`ListBuckets`, `ListObjectsV2`, `GetObject`, `DeleteObject`, `CopyObject`, `RestoreObject`, etc.)
- Para Database: acceso de red a una instancia Mongo/DocumentDB

## Modo escritorio (Windows, ejecutable .NET)

Un proyecto .NET 9 WinForms (`desktop/AWSPowerToolKit.Desktop/`) embebe la SPA en un control WebView2 y ejecuta él mismo las llamadas a AWS/Mongo (sin CORS ni proxy de Vite), comunicándose con la SPA por el puente de mensajes de WebView2. Las conexiones se guardan en `%LOCALAPPDATA%\AWSPowerToolKit\access.json` en vez de `localStorage`. Los tres módulos funcionan igual que en el navegador — incluido Database, que en este modo sí funciona fuera de `npm run dev`.

```bash
npm run package:desktop
```

Esto compila la SPA con rutas relativas y publica un único ejecutable self-contained (`AWSPowerToolKit.Desktop.exe`) en:

```
desktop/AWSPowerToolKit.Desktop/bin/Release/net9.0-windows/win-x64/publish/
```

Corré ese `.exe` directamente — no necesita `npm run dev` corriendo ni ningún otro proceso.

Para desarrollar sobre el proyecto .NET sin publicar cada vez: `dotnet run --project desktop/AWSPowerToolKit.Desktop` (usa `npm run build:desktop` primero para generar `dist-desktop/`, o muestra un placeholder si esa carpeta no existe todavía).

### Requisitos (modo escritorio)

- Windows
- [.NET 9 SDK](https://dotnet.microsoft.com/download/dotnet/9.0)
- [WebView2 Runtime](https://developer.microsoft.com/microsoft-edge/webview2/) (viene preinstalado en Windows 11; en Windows 10 puede requerir instalarlo aparte)
- Node.js (solo para generar `dist-desktop/` durante el build/publish)

## Scripts

- `npm run dev` — servidor de desarrollo (con los proxies de CORS/Mongo)
- `npm run build` — chequeo de tipos + build de producción (GitHub Pages)
- `npm run build:desktop` — build de producción con rutas relativas, en `dist-desktop/` (insumo del modo escritorio)
- `npm run package:desktop` — genera `dist-desktop/` y publica el ejecutable `.exe` single-file del modo escritorio
- `npm run lint` — lint con oxlint
- `npm run preview` — preview del build de producción

## Stack

React + Vite + TypeScript, Tailwind CSS v4, Zustand, TanStack Query, `@aws-sdk/client-sqs`, `@aws-sdk/client-s3` y `mongodb` (driver, usado solo por el proxy de desarrollo). Modo escritorio: .NET 9, WinForms, WebView2, `AWSSDK.SQS`, `AWSSDK.S3`, `MongoDB.Driver`.
