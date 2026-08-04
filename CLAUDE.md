# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

SQS Explorer — a browser-only client for exploring AWS SQS queues (list queues, receive/filter/delete/send messages, purge a queue). There is no backend server; AWS credentials entered in the UI are used directly from the browser via `@aws-sdk/client-sqs`, and connections (including secret keys) persist in `localStorage` via zustand's `persist` middleware (`src/store/connectionsStore.ts`). Keep that in mind when touching connection handling — nothing about credential storage should be assumed to be secure by default, since it's a local dev tool, not a hosted multi-user app.

## Commands

- `npm run dev` — start Vite dev server (includes the CORS proxy, see below; required for real AWS calls to work)
- `npm run build` — typecheck (`tsc -b`) then production build via Vite
- `npm run lint` — run oxlint (config: `.oxlintrc.json`)
- `npm run preview` — preview the production build

There is no test suite configured in this repo.

## Architecture

### The CORS proxy is load-bearing

Amazon SQS does not return CORS headers, so the browser cannot call `sqs.<region>.amazonaws.com` directly. This is solved by a dev-only pipeline that spans two files:

1. `src/aws/sqsClient.ts` — `createSqsClient` builds an `SQSClient` where, in dev (`import.meta.env.DEV`), the `requestHandler` is a `DevProxyHttpHandler` that lets the AWS SDK sign the request normally against the real `sqs.<region>.amazonaws.com` host, then rewrites only the *physical* connection target to same-origin `/aws-proxy/<region>/...` right before the fetch fires. The signed `Authorization` header stays valid because only the transport target changed, not the signed request.
2. `vite.config.ts` — a `sqsDevProxy()` Vite plugin middleware handles `/aws-proxy/<region>/...`, reconstructs the real AWS URL, forwards the already-signed request bytes verbatim, and streams the response back same-origin.

In production builds (GitHub Pages, see `.github/workflows/deploy.yml`), there is no proxy — `App.tsx` shows a banner warning that AWS calls will fail on the published site and that real usage requires cloning the repo and running `npm run dev`. Any change to request signing, headers, or the client construction must keep this dev-proxy path intact or real AWS calls break silently.

### State layout

Two independent zustand stores, not one:

- `connectionsStore` (`src/store/connectionsStore.ts`) — persisted (`localStorage`, key `sqs-explorer-connections`) list of `AwsConnection`s (name, region, credentials) plus which one is active. This is the only persisted state in the app.
- `explorerStore` (`src/store/explorerStore.ts`) — in-memory only. Holds open "queue tabs", each keyed by `tabKey(connectionId, queueUrl)` = `` `${connectionId}:${queueUrl}` ``. Each `QueueTab` carries its own messages, filters, loading state, and last error, so switching connections/queues doesn't clobber other tabs' state. Messages are deduped by `messageId` when appended (`appendMessages`).

AWS calls themselves go through `@tanstack/react-query` (see `QueueSidebar.tsx`'s `useQuery(['queues', connectionId], ...)`) only for read/list operations tied to a query key; message receive/send/delete/purge are imperative calls into `src/aws/sqsService.ts` invoked directly from component handlers, not react-query mutations — follow whichever pattern the surrounding code already uses for a given operation rather than mixing them.

### AWS access layer

All actual SQS API calls live in `src/aws/sqsService.ts` and go through a per-connection cached `SQSClient` (`clientCache`, keyed by connection id + region + access key + session token — see `clientCacheKey`). Do not construct `SQSClient` directly elsewhere; add new operations here and reuse `getClient`.

Notable behaviors to preserve when editing this file:
- `receiveMessages` paginates in batches of up to 10 (AWS's per-request max) up to `options.maxMessages`, dedupes by `MessageId` within the call, and stops early once AWS returns fewer messages than requested.
- `releaseAfterReceive` immediately sets `VisibilityTimeout: 0` after receiving each message (via `ChangeMessageVisibilityCommand`) so messages become instantly re-visible instead of being held for the full visibility timeout — this is what lets the UI "peek" at messages non-destructively.
- FIFO-only fields (`MessageGroupId`, `MessageDeduplicationId`, and `DelaySeconds` being disallowed) are gated on `queue.isFifo` (derived from the queue URL ending in `.fifo`, see `queueNameFromUrl`/`listQueues`).

### UI structure

- `App.tsx` is the shell: header, dev/prod CORS warning banner, `QueueSidebar` + `MessageExplorer` side by side, and the `ConnectionManager` modal (shown when there are no connections yet, or on demand).
- `QueueSidebar` — connection picker + queue list/search for the active connection (react-query backed).
- `MessageExplorer` → `TabsBar` (open queue tabs) + `QueueView` (the active tab's toolbar, filters, message table, detail drawer). Filtering logic (`src/utils/attributeFilter.ts`) supports filtering by body, messageId, or a named message attribute, with `contains`/`notContains`/`equals`/`notEquals` operators (`src/types/filter.ts`), applied client-side over already-received messages — it does not change what's fetched from AWS.
- User-facing copy is in Spanish (e.g. "Conectar a AWS", "Elegí una cola...") — match this when adding UI strings.

### Styling

Tailwind CSS v4 via `@tailwindcss/vite` (no separate `tailwind.config.js` — v4 is CSS-driven, see `src/index.css`). Components hand-roll `dark:` variants throughout rather than relying on a theme abstraction; keep light/dark pairs in sync when editing className strings.

### Build/deploy specifics

- `vite.config.ts` sets `base: '/SQSExplorer/'` for GitHub Pages hosting — don't remove this or asset paths break on the deployed site.
- Deploys happen automatically on push to `main` via `.github/workflows/deploy.yml` (builds and pushes `dist/` to the `gh-pages` branch). There's no staging step; merging to `main` is effectively shipping.
