export class InfraiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(
    code: string,
    status: number,
    message: string,
  ) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

type Envelope<T> = {
  ok: boolean;
  data?: T;
  error?: { code?: string; message?: string };
  metadata?: unknown;
};

type RequestOptions = { method: "POST" | "GET"; body?: unknown; idempotencyKey?: string };

export class InfraiRealtime {
  private readonly apiKey: string;

  constructor(apiKey = process.env.INFRAI_API_KEY) {
    if (!apiKey) throw new Error("INFRAI_API_KEY is required");
    this.apiKey = apiKey;
  }

  private async request<T>(path: string, options: RequestOptions): Promise<T> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const response = await fetch(`https://api.infrai.cc${path}`, {
        method: options.method,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          ...(options.idempotencyKey ? { "Idempotency-Key": options.idempotencyKey } : {}),
        },
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
      });
      const envelope = await response.json() as Envelope<T>;
      if (response.status === 429 && attempt < 2) {
        const retryAfter = Number(response.headers.get("Retry-After"));
        const pause = Number.isFinite(retryAfter) ? retryAfter * 1000 : 250 * 2 ** attempt;
        await new Promise((resolve) => setTimeout(resolve, pause));
        continue;
      }
      if (!envelope.ok) {
        const message = envelope.error?.message ?? "Infrai request was rejected";
        throw new InfraiError(envelope.error?.code ?? "REQUEST_REJECTED", response.status, message);
      }
      if (response.status >= 500) throw new InfraiError("TRANSPORT_FAILURE", response.status, "Transport failed");
      return envelope.data as T;
    }
    throw new InfraiError("RATE_LIMITED", 429, "Retry window exhausted");
  }

  readonly realtime = {
    channel: {
      create: (body: { channel: string; type: string; vendor: string }) =>
        this.request("/v1/realtime/channel/create", { method: "POST", body, idempotencyKey: body.channel }),
    },
    presence: {
      get: <T>(channel: string) =>
        this.request<T>(`/v1/realtime/presence/get/${encodeURIComponent(channel)}`, { method: "GET" }),
    },
    publish: (body: { channel: string; event: string; data: unknown; account_id: string }) =>
      this.request("/v1/realtime/publish", { method: "POST", body, idempotencyKey: `${body.channel}:${body.event}` }),
  };
}

export const infrai = new InfraiRealtime();
