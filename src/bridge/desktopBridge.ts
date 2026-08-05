// Infra for the WebView2 message bridge used when AWSPowerToolKit runs embedded
// inside the .NET 9 WinForms desktop app (see .features/Embedded_NET/context.md).
//
// In that host, `window.chrome.webview` is injected by WebView2 and lets the SPA
// exchange JSON messages with the .NET side (`BridgeRouter` in
// desktop/AWSPowerToolKit.Desktop/BridgeRouter.cs). Outside that host — the
// published site or `npm run dev` — `window.chrome?.webview` is undefined, so
// `isDesktopBridgeAvailable()` returns false and callers are expected to fall
// back to their current behavior (direct AWS SDK calls / dev proxies).
//
// Nothing consumes this module yet; module-specific wrappers (sqsBridge.ts,
// s3Bridge.ts, mongoBridge.ts) and the eventual store/service integrations are
// separate tasks.

const CALL_TIMEOUT_MS = 30_000

export interface BridgeRequestEnvelope<TPayload = unknown> {
  correlationId: string
  action: string
  payload: TPayload
}

export interface BridgeResponseEnvelope<TResult = unknown> {
  correlationId: string
  payload?: TResult
  error?: string
}

interface WebViewMessageEvent {
  data: unknown
}

interface WebView2Bridge {
  postMessage(message: unknown): void
  addEventListener(type: 'message', listener: (event: WebViewMessageEvent) => void): void
  removeEventListener(type: 'message', listener: (event: WebViewMessageEvent) => void): void
}

declare global {
  interface Window {
    chrome?: {
      webview?: WebView2Bridge
    }
  }
}

function isBridgeResponseEnvelope(value: unknown): value is BridgeResponseEnvelope {
  return typeof value === 'object' && value !== null && 'correlationId' in value
}

/** True when running embedded in the .NET WebView2 host and the message bridge is available. */
export function isDesktopBridgeAvailable(): boolean {
  return typeof window !== 'undefined' && window.chrome?.webview !== undefined
}

/**
 * Sends `{ action, payload }` to the .NET host via the WebView2 message bridge
 * and resolves with the `payload` of the matching response (matched by
 * `correlationId`), or rejects with the response's `error`, or rejects on
 * timeout if the .NET side never responds.
 */
export function callBridge<TPayload, TResult>(action: string, payload: TPayload): Promise<TResult> {
  const webview = window.chrome?.webview
  if (!webview) {
    return Promise.reject(new Error('Desktop bridge is not available in this environment.'))
  }

  const correlationId = crypto.randomUUID()

  return new Promise<TResult>((resolve, reject) => {
    let timeoutId: ReturnType<typeof setTimeout>

    const cleanup = () => {
      clearTimeout(timeoutId)
      webview.removeEventListener('message', onMessage)
    }

    const onMessage = (event: WebViewMessageEvent) => {
      const response = event.data
      if (!isBridgeResponseEnvelope(response) || response.correlationId !== correlationId) {
        return
      }
      cleanup()
      if (response.error) {
        reject(new Error(response.error))
      } else {
        resolve(response.payload as TResult)
      }
    }

    webview.addEventListener('message', onMessage)

    timeoutId = setTimeout(() => {
      cleanup()
      reject(new Error(`Desktop bridge timed out waiting for a response to "${action}".`))
    }, CALL_TIMEOUT_MS)

    const envelope: BridgeRequestEnvelope<TPayload> = { correlationId, action, payload }
    webview.postMessage(envelope)
  })
}
