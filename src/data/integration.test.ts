import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import {
  INTEGRATION_PROMPT_VERSION,
  WEBRENT_INTEGRATION_MASTER_PROMPT,
} from "./integration";
import { buildNpcSystemPrompt } from "./orchestrator";
import { NPCS } from "./npcs";

describe("integration master prompt (Phase A, Section #34)", () => {
  it("versi semantik", () => {
    expect(INTEGRATION_PROMPT_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("verbatim 100% identik dengan docs/integration-master-prompt.md", () => {
    const doc = readFileSync(
      path.resolve(process.cwd(), "docs/integration-master-prompt.md"),
      "utf8",
    );
    expect(WEBRENT_INTEGRATION_MASTER_PROMPT).toBe(doc);
  });

  it("memuat 67 section (header 1..67) + pembuka & penutup", () => {
    const p = WEBRENT_INTEGRATION_MASTER_PROMPT;
    expect(p).toContain("INTEGRATION API MASTER PROMPT");
    expect(p).toContain("END OF WEBRENT AI OFFICE");
    for (let i = 1; i <= 67; i++) {
      const header = new RegExp(`^${i}\\. [A-Z]`, "m");
      expect(p).toMatch(header);
    }
  });

  it("Section #34 ter-load di NPC sample (prompt system per-agent)", () => {
    const npc = NPCS[0];
    expect(npc).toBeDefined();

    const prompt = buildNpcSystemPrompt({ npc });
    expect(prompt).toContain("# 34. INTEGRATION API MASTER PROMPT (GLOBAL)");
    expect(prompt).toContain(`v${INTEGRATION_PROMPT_VERSION}`);
    // Isi master prompt benar-benar tersisip di system prompt agent:
    expect(prompt).toMatch(/^2\. CORE PRINCIPLE$/m);
    expect(prompt).toContain("The server is the SOURCE OF TRUTH");
    expect(prompt).toContain("THE 3D OFFICE MUST NOT BE A MOCKUP");
    // Persona agent tetap ada:
    expect(prompt).toContain(npc.name);
    expect(prompt).toContain(npc.systemPrompt);
  });
});
