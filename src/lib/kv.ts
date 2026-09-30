interface KvConfig {
  url: string;
  token: string;
}

/** Konfigurasi KV dari env (Vercel KV atau Upstash). Null bila tidak ada. */
export function getKvConfig(): KvConfig | null {
  const url =
    process.env.KV_REST_API_URL?.trim() ||
    process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token =
    process.env.KV_REST_API_TOKEN?.trim() ||
    process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (url && token) return { url: url.replace(/\/$/, ""), token };
  return null;
}

/** Menjalankan satu perintah Redis (REST) dan mengembalikan `result`. */
export async function kvCommand<T = unknown>(
  config: KvConfig,
  command: (string | number)[],
): Promise<T | null> {
  const res = await fetch(config.url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`KV error ${res.status}`);
  const data = (await res.json()) as { result?: T };
  return data.result ?? null;
}

export type { KvConfig };
