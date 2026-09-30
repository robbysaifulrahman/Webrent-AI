import { jsonError, jsonOk } from "@/lib/apiResponse";
import {
  getTelegramConfig,
  handleTelegramUpdate,
  sendTelegramMessage,
  verifyTelegramWebhook,
} from "@/lib/telegram";
import { setIntegrationStatus } from "@/lib/integrations";
import type { TelegramUpdate } from "@/lib/telegram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/v1/integrations/telegram/webhook — Phase G (Section 18-20).
 * - Verifikasi secret header (timing-safe).
 * - Command engine: baca = chat terdaftar, mutasi = admin saja.
 * - Balasan dikirim via Bot API; kegagalan send tidak menggagalkan webhook.
 */
export async function POST(req: Request) {
  const config = getTelegramConfig();
  if (!config) {
    return jsonError(
      "TELEGRAM_DISABLED",
      "Webhook Telegram nonaktif: TELEGRAM_BOT_TOKEN/TELEGRAM_WEBHOOK_SECRET belum diisi.",
      503,
      { req },
    );
  }

  if (!verifyTelegramWebhook(req.headers, config)) {
    return jsonError("FORBIDDEN", "Secret webhook tidak valid.", 403, { req });
  }

  // Webhook valid diterima → integrasi hidup (Section 24).
  setIntegrationStatus("telegram", "CONNECTED");

  let update: TelegramUpdate;
  try {
    update = (await req.json()) as TelegramUpdate;
  } catch {
    return jsonError("INVALID_JSON", "Body bukan JSON valid.", 400, { req });
  }

  const result = await handleTelegramUpdate(update);

  if (result.handled && result.reply && result.chatId !== null) {
    const sent = await sendTelegramMessage(result.chatId, result.reply);
    return jsonOk(
      { received: true, processed: true, reply_sent: sent.ok },
      { req },
    );
  }

  return jsonOk(
    { received: true, processed: result.handled, reply_sent: false },
    { req },
  );
}
