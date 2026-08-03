import { SQSClient } from '@aws-sdk/client-sqs'
import { FetchHttpHandler } from '@smithy/fetch-http-handler'
import type { HttpRequest } from '@smithy/core/protocols'
import type { HttpHandlerOptions } from '@smithy/types'
import type { AwsConnection } from '../types/connection'

/**
 * SQS never sends CORS headers, so a direct browser call fails outright.
 * In dev, we let the AWS SDK sign the request as usual against the real
 * sqs.<region>.amazonaws.com host (so the Authorization header is valid),
 * then rewrite only the physical connection target to same-origin
 * /aws-proxy/<region>/... right before the fetch happens. Vite's dev
 * middleware (vite.config.ts) forwards the already-signed bytes to AWS
 * unchanged, so the signature still checks out on AWS's end.
 */
class DevProxyHttpHandler extends FetchHttpHandler {
  private region: string

  constructor(region: string) {
    super()
    this.region = region
  }

  handle(request: HttpRequest, options?: HttpHandlerOptions) {
    request.protocol = window.location.protocol
    request.hostname = window.location.hostname
    request.port = window.location.port ? Number(window.location.port) : undefined
    request.path = `/aws-proxy/${this.region}${request.path}`
    return super.handle(request, options)
  }
}

export function createSqsClient(connection: AwsConnection): SQSClient {
  return new SQSClient({
    region: connection.region,
    credentials: {
      accessKeyId: connection.accessKeyId,
      secretAccessKey: connection.secretAccessKey,
      sessionToken: connection.sessionToken || undefined,
    },
    ...(import.meta.env.DEV ? { requestHandler: new DevProxyHttpHandler(connection.region) } : {}),
  })
}
