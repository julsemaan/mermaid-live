import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { Logger } from "pino";
import { ManifestService } from "../../application/services/ManifestService.js";
import type { RealtimeEventBus } from "../../application/services/RealtimeEventBus.js";
import type { DiagramRealtimeEvent } from "../../domain/realtime.js";
import type { ApiErrorDto } from "./dtos.js";
import { toDiagramDetailDto, toDiagramSummaryDto } from "./dtos.js";

const DIAGRAM_ID_PATTERN = /^[a-f0-9]{40}$/;
const SSE_RETRY_MS = 1500;
const HEARTBEAT_INTERVAL_MS = 15_000;

interface ApiServerOptions {
  port: number;
  logger: Logger;
  manifestService: ManifestService;
  realtimeEventBus: RealtimeEventBus;
}

interface SseClient {
  response: ServerResponse;
  heartbeat: NodeJS.Timeout;
}

interface RequestContext {
  requestId: string;
  method: string;
  pathname: string;
}

const toEtag = (diagramId: string, version: string): string => `"${diagramId}:${version}"`;

const stripWeakPrefix = (value: string): string => {
  return value.startsWith("W/") ? value.slice(2) : value;
};

const etagMatches = (ifNoneMatchHeader: string, expectedEtag: string): boolean => {
  const expected = stripWeakPrefix(expectedEtag.trim());
  const tokens = ifNoneMatchHeader.split(",").map((token) => stripWeakPrefix(token.trim()));

  return tokens.includes("*") || tokens.includes(expected);
};

const writeJson = (
  response: ServerResponse,
  statusCode: number,
  payload: unknown,
  extraHeaders: Record<string, string> = {}
): void => {
  const body = `${JSON.stringify(payload)}\n`;
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body).toString(),
    ...extraHeaders
  });
  response.end(body);
};

const writeApiError = (
  response: ServerResponse,
  statusCode: number,
  code: string,
  message: string,
  requestId: string,
  details?: Record<string, string>
): void => {
  const payload: ApiErrorDto = {
    error: {
      code,
      message,
      requestId,
      details
    }
  };

  writeJson(response, statusCode, payload, withCorsHeaders({}));
};

const withCorsHeaders = (headers: Record<string, string>): Record<string, string> => {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,OPTIONS",
    "access-control-allow-headers": "if-none-match,content-type,x-request-id",
    ...headers
  };
};

const hashOfManifest = (values: string[]): string => {
  const hash = createHash("sha1");
  for (const value of values) {
    hash.update(value);
    hash.update("|");
  }
  return hash.digest("hex");
};

export class ApiServer {
  private readonly port: number;
  private readonly logger: Logger;
  private readonly manifestService: ManifestService;
  private readonly realtimeEventBus: RealtimeEventBus;
  private readonly sseClients = new Set<SseClient>();
  private readonly unsubscribeRealtime: () => void;
  private server: Server | null = null;

  public constructor(options: ApiServerOptions) {
    this.port = options.port;
    this.logger = options.logger;
    this.manifestService = options.manifestService;
    this.realtimeEventBus = options.realtimeEventBus;

    this.unsubscribeRealtime = this.realtimeEventBus.subscribe((event) => {
      this.broadcastSseEvent(event);
    });
  }

  public async start(): Promise<void> {
    if (this.server) {
      return;
    }

    this.server = createServer((request, response) => {
      void this.handleRequest(request, response);
    });

    await new Promise<void>((resolve, reject) => {
      this.server?.once("error", reject);
      this.server?.listen(this.port, () => {
        this.server?.off("error", reject);
        resolve();
      });
    });
  }

  public async close(): Promise<void> {
    this.unsubscribeRealtime();
    for (const client of this.sseClients) {
      clearInterval(client.heartbeat);
      client.response.end();
    }
    this.sseClients.clear();

    if (!this.server) {
      return;
    }

    const current = this.server;
    this.server = null;

    await new Promise<void>((resolve, reject) => {
      current.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }

  private async handleRequest(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const method = request.method ?? "GET";
    const requestId = randomUUID();
    const url = new URL(request.url ?? "/", "http://localhost");
    const pathname = url.pathname;
    const startedAt = Date.now();

    response.setHeader("x-request-id", requestId);

    response.on("finish", () => {
      this.logger.info(
        {
          requestId,
          method,
          path: pathname,
          statusCode: response.statusCode,
          durationMs: Date.now() - startedAt
        },
        "HTTP request completed"
      );
    });

    if (method === "OPTIONS") {
      response.writeHead(204, withCorsHeaders({}));
      response.end();
      return;
    }

    const context: RequestContext = {
      requestId,
      method,
      pathname
    };

    try {
      await this.routeRequest(request, response, context);
    } catch (error) {
      this.logger.error(
        {
          requestId,
          method,
          path: pathname,
          error: error instanceof Error ? error.message : String(error)
        },
        "HTTP request failed"
      );
      writeApiError(response, 500, "internal_error", "Unexpected server error", requestId);
    }
  }

  private async routeRequest(
    request: IncomingMessage,
    response: ServerResponse,
    context: RequestContext
  ): Promise<void> {
    if (context.method !== "GET") {
      writeApiError(
        response,
        405,
        "method_not_allowed",
        "Only GET is supported",
        context.requestId
      );
      return;
    }

    if (context.pathname === "/api/diagrams") {
      this.handleListDiagrams(request, response);
      return;
    }

    if (context.pathname === "/api/events") {
      this.handleEventsStream(response);
      return;
    }

    const parts = context.pathname.split("/").filter(Boolean);
    if (parts.length < 3 || parts[0] !== "api" || parts[1] !== "diagrams") {
      writeApiError(response, 404, "not_found", "Route not found", context.requestId);
      return;
    }

    const diagramId = (() => {
      try {
        return decodeURIComponent(parts[2]);
      } catch {
        return "";
      }
    })();
    if (!DIAGRAM_ID_PATTERN.test(diagramId)) {
      writeApiError(
        response,
        400,
        "invalid_diagram_id",
        "diagram id must be a sha1 hex string",
        context.requestId
      );
      return;
    }

    if (parts.length === 3) {
      this.handleGetDiagram(request, response, context, diagramId);
      return;
    }

    if (parts.length === 4 && parts[3] === "svg") {
      await this.handleGetSvg(request, response, context, diagramId);
      return;
    }

    writeApiError(response, 404, "not_found", "Route not found", context.requestId);
  }

  private handleListDiagrams(request: IncomingMessage, response: ServerResponse): void {
    const entries = this.manifestService.listEntries();
    const values = entries.map(
      (entry) =>
        `${entry.id}:${entry.version}:${entry.status}:${entry.updatedAt}:${entry.lastError ?? ""}`
    );
    const etag = toEtag("collection", hashOfManifest(values));
    const ifNoneMatch = request.headers["if-none-match"];

    if (typeof ifNoneMatch === "string" && etagMatches(ifNoneMatch, etag)) {
      response.writeHead(304, withCorsHeaders({ etag }));
      response.end();
      return;
    }

    writeJson(
      response,
      200,
      {
        diagrams: entries.map(toDiagramSummaryDto)
      },
      withCorsHeaders({
        etag,
        "cache-control": "private, max-age=0, must-revalidate"
      })
    );
  }

  private handleGetDiagram(
    request: IncomingMessage,
    response: ServerResponse,
    context: RequestContext,
    diagramId: string
  ): void {
    const entry = this.manifestService.getEntry(diagramId);
    if (!entry) {
      writeApiError(response, 404, "diagram_not_found", "Diagram not found", context.requestId);
      return;
    }

    const etag = toEtag(entry.id, entry.version);
    const ifNoneMatch = request.headers["if-none-match"];
    if (typeof ifNoneMatch === "string" && etagMatches(ifNoneMatch, etag)) {
      response.writeHead(304, withCorsHeaders({ etag }));
      response.end();
      return;
    }

    writeJson(
      response,
      200,
      {
        diagram: toDiagramDetailDto(entry)
      },
      withCorsHeaders({
        etag,
        "cache-control": "private, max-age=0, must-revalidate"
      })
    );
  }

  private async handleGetSvg(
    request: IncomingMessage,
    response: ServerResponse,
    context: RequestContext,
    diagramId: string
  ): Promise<void> {
    const entry = this.manifestService.getEntry(diagramId);
    if (!entry) {
      writeApiError(response, 404, "diagram_not_found", "Diagram not found", context.requestId);
      return;
    }

    if (entry.status !== "ready") {
      writeApiError(
        response,
        409,
        "diagram_not_ready",
        "Diagram is not available as SVG",
        context.requestId,
        { status: entry.status }
      );
      return;
    }

    const etag = toEtag(entry.id, entry.version);
    const ifNoneMatch = request.headers["if-none-match"];
    if (typeof ifNoneMatch === "string" && etagMatches(ifNoneMatch, etag)) {
      response.writeHead(304, withCorsHeaders({ etag }));
      response.end();
      return;
    }

    const content = await readFile(entry.svgPath, "utf8").catch((error: unknown) => {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        writeApiError(
          response,
          404,
          "artifact_not_found",
          "SVG artifact is missing",
          context.requestId
        );
        return null;
      }
      throw error;
    });

    if (content === null) {
      return;
    }

    response.writeHead(
      200,
      withCorsHeaders({
        "content-type": "image/svg+xml; charset=utf-8",
        "content-length": Buffer.byteLength(content).toString(),
        etag,
        "cache-control": "private, max-age=0, must-revalidate"
      })
    );
    response.end(content);
  }

  private handleEventsStream(response: ServerResponse): void {
    response.writeHead(
      200,
      withCorsHeaders({
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-cache, no-transform",
        connection: "keep-alive",
        "x-accel-buffering": "no"
      })
    );

    response.write(`retry: ${SSE_RETRY_MS}\n\n`);

    const heartbeat = setInterval(() => {
      response.write(`: heartbeat ${new Date().toISOString()}\n\n`);
    }, HEARTBEAT_INTERVAL_MS);

    const client: SseClient = {
      response,
      heartbeat
    };
    this.sseClients.add(client);

    const cleanup = () => {
      clearInterval(heartbeat);
      this.sseClients.delete(client);
    };

    response.on("close", cleanup);
    response.on("error", cleanup);
  }

  private broadcastSseEvent(event: DiagramRealtimeEvent): void {
    const payload = JSON.stringify(event.payload);
    const eventBlock = `event: ${event.type}\ndata: ${payload}\n\n`;
    for (const client of this.sseClients) {
      client.response.write(eventBlock);
    }
  }
}
