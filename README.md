# AWSPowerToolKit

Suite 100% en el navegador de herramientas para explorar recursos de AWS y bases de datos, sin backend propio. Tiene un shell con menú lateral de navegación y tres módulos independientes, cada uno con sus propias conexiones/credenciales (no se comparte estado entre módulos):

- **SQS Explorer** — listar colas, recibir/filtrar/eliminar mensajes, enviar mensajes nuevos y purgar colas (`@aws-sdk/client-sqs`).
- **S3 Explorer** — listar buckets, navegar objetos por prefijo, ver metadata/contenido, y eliminar/renombrar/cambiar storage class/restaurar objetos (`@aws-sdk/client-s3`).
- **Database** — conectar a una instancia Mongo/DocumentDB (por connection string o host/usuario/password), navegar bases/colecciones y correr queries `find`. A diferencia de los otros dos módulos, este depende de un proxy que solo existe en modo desarrollo (ver más abajo).

Las credenciales de AWS y de Mongo que cargás en la UI se usan directamente desde el navegador (o, en el caso de Mongo, desde el proxy de desarrollo) y las conexiones se guardan en `localStorage`, en una clave distinta por módulo.

> ⚠️ Al ser una herramienta local para desarrollo, el almacenamiento de credenciales en `localStorage` no debe considerarse seguro por defecto.

## Requisitos

- Node.js
- Para SQS Explorer: credenciales de AWS con permisos sobre SQS (`ListQueues`, `ReceiveMessage`, `SendMessage`, `DeleteMessage`, `PurgeQueue`, etc.)
- Para S3 Explorer: credenciales de AWS con permisos sobre S3 (`ListBuckets`, `ListObjectsV2`, `GetObject`, `DeleteObject`, `CopyObject`, `RestoreObject`, etc.)
- Para Database: acceso de red a una instancia Mongo/DocumentDB

## Uso

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

## Scripts

- `npm run dev` — servidor de desarrollo (con los proxies de CORS/Mongo)
- `npm run build` — chequeo de tipos + build de producción
- `npm run lint` — lint con oxlint
- `npm run preview` — preview del build de producción

## Stack

React + Vite + TypeScript, Tailwind CSS v4, Zustand, TanStack Query, `@aws-sdk/client-sqs`, `@aws-sdk/client-s3` y `mongodb` (driver, usado solo por el proxy de desarrollo).
