import { getNpc } from "@/data/npcs";
import { buildNpcSystemPrompt } from "@/data/orchestrator";
import {
  getLlmConfig,
  openAiCompatibleStream,
  mockStream,
  type LlmMessage,
} from "@/lib/llm";
import type { ChatRequestBody } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_MESSAGES = 24;
const MAX_CHARS = 2000;

function buildMockReply(
  npcName: string,
  role: string,
  userText: string,
): string {
  return (
    `## WebRent Office\n\n` +
    `Saya ${npcName} (${role}). Permintaan "${userText.slice(0, 60)}" saya terima ` +
    `dan klasifikasikan sebagai LOW RISK.\n\n` +
    `### Next Action\n` +
    `Delegasi ke departemen terkait & susun draf. Status: PLANNING.\n\n` +
    `_Catatan: mode mock — isi LLM_API_KEY di .env.local untuk orkestrasi AI sungguhan._`
  );
}

export async function POST(req: Request) {
  let body: ChatRequestBody;
  try {
    body = (await req.json()) as ChatRequestBody;
  } catch {
    return new Response("Body bukan JSON valid.", { status: 400 });
  }

  const npc = getNpc(body?.npcId);
  if (!npc) {
    return new Response("NPC tidak ditemukan.", { status: 404 });
  }

  const history = (Array.isArray(body.messages) ? body.messages : [])
    .filter((m) => m && (m.role === "user" || m.role === "assistant"))
    .slice(-MAX_MESSAGES)
    .map((m) => ({
      role: m.role,
      content: String(m.content ?? "").slice(0, MAX_CHARS),
    }));

  const lastUser =
    [...history].reverse().find((m) => m.role === "user")?.content ?? "";

  const messages: LlmMessage[] = [
    { role: "system", content: buildNpcSystemPrompt({ npc }) },
    ...history,
  ];

  const config = getLlmConfig();
  const source = config.isMock
    ? mockStream(buildMockReply(npc.name, npc.role, lastUser))
    : openAiCompatibleStream(messages, config, req.signal);

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = source.getReader();
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) controller.enqueue(encoder.encode(value));
        }
        controller.close();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Terjadi kesalahan pada LLM.";
        try {
          controller.enqueue(encoder.encode(`\n[ERROR] ${message}`));
        } catch {
          // stream mungkin sudah ditutup
        }
        controller.close();
      }
    },
    cancel() {
      void source.cancel().catch(() => undefined);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
