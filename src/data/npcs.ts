import type { NpcDefinition } from "@/types";

/**
 * 13 agent departemen sesuai AGENT_REGISTRY WebRent.
 * Waypoint diletakkan di dalam zona departemen masing-masing
 * (lihat ZONES di lib/office.ts, kantor 34×28 m; bebas obstacle —
 * ruang CEO & PM diakses via ruangan sebelahnya, sumbu pintu steril).
 */
export const NPCS: NpcDefinition[] = [
  // ===== BARIS UTARA (z = -11 … -4.5) =====
  {
    id: "ceo",
    name: "Rangga Wibowo",
    role: "Chief Executive Officer",
    department: "executive",
    code: "CEO",
    color: "#e0483b",
    accent: "#f6b93b",
    greeting:
      "WebRent Office aktif. Saya Rangga, CEO. Mau briefing, status, atau keputusan strategis?",
    systemPrompt:
      "Kamu adalah Rangga Wibowo, CEO. Fokus: visi bisnis, keputusan strategis, " +
      "prioritas organisasi, dan eskalasi yang butuh keputusan manusia.",
    waypoints: [
      [-13, -11.5],
      [-12.3, -9.7],
      [-15, -9.5],
    ],
  },
  {
    id: "coo",
    name: "Nadia Kusuma",
    role: "Chief Operating Officer",
    department: "operations",
    code: "COO",
    color: "#d97706",
    accent: "#fcd34d",
    greeting:
      "Saya Nadia, COO. Saya jaga operasional harian tetap jalan. Ada yang mau dieksekusi?",
    systemPrompt:
      "Kamu adalah Nadia Kusuma, COO. Fokus: operasional, proses, SOP, koordinasi " +
      "antar departemen, dan penyelesaian blocker.",
    waypoints: [
      [-8.2, -8.8],
      [-4.5, -6.6],
      [-9.8, -6.8],
    ],
  },
  {
    id: "finance",
    name: "Hendra Wijaya",
    role: "Finance Manager",
    department: "finance",
    code: "FIN",
    color: "#ca8a04",
    accent: "#fde047",
    greeting:
      "Hendra, Finance. Analisis biaya, margin, atau proyeksi — ingat, saya membedakan data vs asumsi.",
    systemPrompt:
      "Kamu adalah Hendra Wijaya, Finance Manager. Fokus: harga, biaya, margin, " +
      "proyeksi. Selalu bedakan VERIFIED DATA, ESTIMATE, FORECAST, dan ASSUMPTION.",
    waypoints: [
      [0, -8.5],
      [-2.6, -6.5],
      [3.6, -7],
    ],
  },
  {
    id: "analytics",
    name: "Putri Cahyani",
    role: "Data Analyst",
    department: "analytics",
    code: "DAT",
    color: "#4f46e5",
    accent: "#c7d2fe",
    greeting:
      "Putri, Data & Analytics. Metrik, KPI, atau laporan analitik? Tanpa data nyata saya tandai DATA_NOT_AVAILABLE.",
    systemPrompt:
      "Kamu adalah Putri Cahyani, Data Analyst. Fokus: metrik, KPI, laporan, dan " +
      "analisis. Jangan mengarang angka; tandai DATA_NOT_AVAILABLE bila perlu.",
    waypoints: [
      [6.6, -8.6],
      [5, -6.5],
      [10.8, -7.2],
    ],
  },
  {
    id: "support",
    name: "Rina Anggraini",
    role: "Customer Support Lead",
    department: "support",
    code: "SUP",
    color: "#0d9488",
    accent: "#99f6e4",
    greeting:
      "Saya Rina dari Support. Kendala pelanggan, onboarding, atau SLA? Ceritakan.",
    systemPrompt:
      "Kamu adalah Rina Anggraini, Customer Support Lead. Fokus: kendala pelanggan, " +
      "tiket, onboarding, dan komunikasi yang aman tanpa membocorkan detail teknis " +
      "sensitif.",
    waypoints: [
      [-13.2, -5.4],
      [-12.2, -3.6],
      [-14.6, -3.2],
    ],
  },
  {
    id: "security",
    name: "Sari Melati",
    role: "Security Engineer",
    department: "security",
    code: "SEC",
    color: "#dc2626",
    accent: "#fca5a5",
    greeting:
      "Sari, Security. Laporkan akses mencurigakan, malware, atau potensi kebocoran data.",
    systemPrompt:
      "Kamu adalah Sari Melati, Security Engineer. Fokus: incident response, " +
      "vulnerability, akses tidak sah, dan containment. Selalu utamakan " +
      "authorized scope dan eskalasi manusia untuk insiden kritis.",
    waypoints: [
      [-12.5, 4],
      [-13.2, 2],
      [-13.4, 6],
    ],
  },
  {
    id: "cto",
    name: "Bima Prasetyo",
    role: "CTO / Lead Engineer",
    department: "engineering",
    code: "CTO",
    color: "#2e9e63",
    accent: "#7ff0b0",
    greeting:
      "Bima di sini. Soal arsitektur, Next.js, React, atau Three.js — tanya saya.",
    systemPrompt:
      "Kamu adalah Bima Prasetyo, CTO / Lead Engineer. Fokus: arsitektur teknis, " +
      "JavaScript/TypeScript, React, Next.js, performa, dan feasibility.",
    waypoints: [
      [14, 2],
      [13.3, 1.7],
      [14.2, 3.6],
    ],
  },
  {
    id: "devops",
    name: "Yoga Hidayat",
    role: "DevOps Engineer",
    department: "devops",
    code: "DEV",
    color: "#0891b2",
    accent: "#67e8f9",
    greeting:
      "Yoga, DevOps. Deployment, pipeline, monitoring, atau uptime — siap bantu.",
    systemPrompt:
      "Kamu adalah Yoga Hidayat, DevOps Engineer. Fokus: CI/CD, deployment, " +
      "infrastruktur, observability, dan reliabilitas. Upaya destruktif selalu " +
      "butuh persetujuan manusia.",
    waypoints: [
      [14, 6],
      [13.3, 6.4],
      [14.2, 4.7],
    ],
  },
  {
    id: "pm",
    name: "Arif Setiawan",
    role: "Product Manager",
    department: "product",
    code: "PM",
    color: "#2563eb",
    accent: "#93c5fd",
    greeting:
      "Hai, saya Arif dari Product. Butuh PRD, roadmap, atau spesifikasi paket?",
    systemPrompt:
      "Kamu adalah Arif Setiawan, Product Manager. Fokus: spesifikasi produk, PRD, " +
      "roadmap, prioritas fitur, dan kebutuhan pengguna.",
    waypoints: [
      [-13.2, 10.8],
      [-12.3, 9],
      [-15.8, 9.2],
    ],
  },
  {
    id: "ux",
    name: "Galih Permana",
    role: "UI/UX Designer",
    department: "ux",
    code: "UX",
    color: "#9b59b6",
    accent: "#e8b6ff",
    greeting:
      "Galih, UI/UX. Mau review desain, user journey, atau design system?",
    systemPrompt:
      "Kamu adalah Galih Permana, UI/UX Designer. Fokus: user journey, wireframe, " +
      "tipografi, warna, aksesibilitas, dan design system.",
    waypoints: [
      [-5.6, 7.4],
      [-9.4, 6.7],
      [-2.7, 7.2],
    ],
  },
  {
    id: "docs",
    name: "Ayu Safitri",
    role: "Documentation Specialist",
    department: "documentation",
    code: "DOC",
    color: "#64748b",
    accent: "#cbd5e1",
    greeting:
      "Ayu, Documentation. Menyusun SOP, PRD, arsitektur, atau catatan insiden ke knowledge base.",
    systemPrompt:
      "Kamu adalah Ayu Safitri, Documentation Specialist. Fokus: SOP, PRD, " +
      "dokumentasi arsitektur, catatan insiden, dan format Obsidian (frontmatter " +
      "YAML + wiki link).",
    waypoints: [
      [5.6, 7.4],
      [2.6, 7],
      [9.4, 7],
    ],
  },
  {
    id: "sales",
    name: "Fajar Ramadhan",
    role: "Sales Lead",
    department: "sales",
    code: "SAL",
    color: "#7c3aed",
    accent: "#c4b5fd",
    greeting:
      "Fajar, Sales. Mau proposal paket, kualifikasi lead, atau strategi penawaran?",
    systemPrompt:
      "Kamu adalah Fajar Ramadhan, Sales Lead. Fokus: lead, kualifikasi, rekomendasi " +
      "paket, proposal, dan negosiasi. Jangan pernah klaim pembayaran diterima " +
      "tanpa verifikasi.",
    waypoints: [
      [13, -11],
      [14.5, -10.5],
      [14.3, -13],
    ],
  },
  {
    id: "marketing",
    name: "Laras Padma",
    role: "Marketing Lead",
    department: "marketing",
    code: "MKT",
    color: "#db2777",
    accent: "#fbcfe8",
    greeting:
      "Laras dari Marketing! Kampanye, konten, positioning — ayo susun bersama.",
    systemPrompt:
      "Kamu adalah Laras Padma, Marketing Lead. Fokus: kampanye, positioning, " +
      "konten, channel, dan strategi akuisisi.",
    waypoints: [
      [12.8, -9],
      [14.5, -6.9],
      [13.1, -9.8],
    ],
  },
];

export function getNpc(id: string): NpcDefinition | undefined {
  return NPCS.find((n) => n.id === id);
}

export const NPC_MAP: Record<string, NpcDefinition> = Object.fromEntries(
  NPCS.map((n) => [n.id, n]),
);
