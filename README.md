# SQSExplorer

Cliente 100% en el navegador para explorar colas de AWS SQS: listar colas, recibir/filtrar/eliminar mensajes, enviar mensajes nuevos y purgar colas. No hay backend — las credenciales de AWS que cargás en la UI se usan directamente desde el navegador (`@aws-sdk/client-sqs`) y las conexiones se guardan en `localStorage`.

> ⚠️ Al ser una herramienta local para desarrollo, el almacenamiento de credenciales en `localStorage` no debe considerarse seguro por defecto.

## Requisitos

- Node.js
- Credenciales de AWS con permisos sobre SQS (`ListQueues`, `ReceiveMessage`, `SendMessage`, `DeleteMessage`, `PurgeQueue`, etc.)

## Uso

```bash
npm install
npm run dev
```

Abrí la URL que muestra Vite y conectá tu cuenta de AWS desde la UI.

> Las llamadas reales a AWS solo funcionan corriendo `npm run dev` en local, ya que SQS no devuelve headers CORS. El dev server incluye un proxy que firma las requests con el SDK y las reenvía same-origin. El sitio publicado en GitHub Pages es solo una demo de la interfaz.

## Scripts

- `npm run dev` — servidor de desarrollo (con proxy CORS)
- `npm run build` — chequeo de tipos + build de producción
- `npm run lint` — lint con oxlint
- `npm run preview` — preview del build de producción

## Stack

React + Vite + TypeScript, Tailwind CSS v4, Zustand, TanStack Query y `@aws-sdk/client-sqs`.
