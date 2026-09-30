export interface LlmConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  isMock: boolean;
}

export function getLlmConfig(): LlmConfig {
  const apiKey = process.env.LLM_API_KEY?.trim() ?? "";
  return {
    baseUrl: (process.env.LLM_BASE_URL?.trim() || "http://43.173.13.193:20128/v1").replace(
      /\/$/,
      "",
    ),
    apiKey,
    model: process.env.LLM_MODEL?.trim() || "webrent/glm-5.3-flash",
    isMock: apiKey.length === 0,
  };
}

export interface LlmMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/**
 * Mock stream: mengembalikan potongan kata dengan jeda acak,
 * supaya UI streaming bisa diuji tanpa API key.
 */
export function mockStream(reply: string): ReadableStream<string> {
  const tokens = reply.split(/(\s+)/);
  let i = 0;
  return new ReadableStream<string>({
    async pull(controller) {
      if (i >= tokens.length) {
        controller.close();
        return;
      }
      const token = tokens[i++];
      await new Promise((r) => setTimeout(r, 24 + Math.random() * 46));
      controller.enqueue(token);
    },
  });
}

/**
 * Streaming dari endpoint OpenAI-compatible /chat/completions.
 * Mengembalikan stream potongan teks delta.
 */
export function openAiCompatibleStream(
  messages: LlmMessage[],
  config: LlmConfig,
  signal?: AbortSignal,
): ReadableStream<string> {
  const decoder = new TextDecoder();

  return new ReadableStream<string>({
    async start(controller) {
      let res: Response;
      try {
        res = await fetch(`${config.baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${config.apiKey}`,
          },
          body: JSON.stringify({
            model: config.model,
            stream: true,
            temperature: 0.8,
            messages,
          }),
          signal,
        });
      } catch (err) {
        controller.error(err);
        return;
      }

      if (!res.ok || !res.body) {
        const detail = await res.text().catch(() => "");
        controller.error(
          new Error(`LLM request gagal (${res.status}): ${detail.slice(0, 400)}`),
        );
        return;
      }

      const reader = res.body.getReader();
      let buffer = "";

      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const rawLine of lines) {
            const line = rawLine.trim();
            if (!line.startsWith("data:")) continue;
            const data = line.slice(5).trim();
            if (data === "[DONE]") {
              controller.close();
              return;
            }
            try {
              const parsed = JSON.parse(data) as {
                choices?: Array<{ delta?: { content?: string } }>;
              };
              const delta = parsed.choices?.[0]?.delta?.content;
              if (delta) controller.enqueue(delta);
            } catch {
              // lewati baris SSE yang tidak lengkap
            }
          }
        }
        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
  });
}
