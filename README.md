# Kantor AI Virtual · webrent.my.id

Kantor virtual 3D interaktif dengan karakter AI low-poly yang bisa diajak
mengobrol. Dibangun dengan **Next.js 15 + React 19 + TypeScript**,
**React Three Fiber v9**, dan **drei**.

## Fitur

- **Scene 3D kantor** — model hasil export Blender (`.glb`) yang di-load
  lewat `useGLTF`, dengan **fallback kantor prosedural** bila file belum ada.
- **Karakter 3D low-poly** — dibangun dari primitif R3F, animasi jalan &
  idle prosedural, tanpa aset biner yang perlu diunduh.
- **13 agent departemen** — CEO, COO, Product, Engineering, DevOps, Security,
  Sales, Marketing, Support, Finance, Analytics, UI/UX, dan Documentation.
  NPC berkeliling otomatis saat idle dan berhenti saat diajak bicara.
- **WebRent Orchestrator** — system prompt WebRent AI Virtual Office
  (`src/data/orchestrator.ts`, server-side) dijalankan sebagai lapisan otak;
  setiap karakter adalah persona satu departemen.
- **Chat LLM streaming** — API route Next.js yang kompatibel dengan endpoint
  OpenAI, dengan **mode mock** otomatis bila API key belum diisi.
- **HUD 2D** — overlay daftar NPC, panel obrolan, dan **minimap HTML canvas**.
- **Command Engine** — slash command ditangani deterministik di klien dengan
  state persisten (localStorage). Lihat daftar perintah di bawah.

## Founder Commands

Ketik di panel obrolan (tombol cepat tersedia di atas input):

```text
/office      /briefing     /status       /tasks      /tasks today
/tasks create <judul>       /tasks assign <id> <departemen>
/tasks review <id> <status>
/agents      /agents status
/incident <deskripsi>       /incidents    /security   /security status
/infrastructure  /product   /sales        /marketing  /finance
/support     /kpi           /report daily|weekly|monthly
/roadmap     /approve <DEC-id>            /decisions  /audit [n]
/search <kata>              /export [daily|weekly|monthly]      /help
```

Bahasa alami juga dikenali, mis. "kasih saya briefing pagi" ≡ `/briefing`.

State Task/Incident/Decision disimpan di `localStorage` (key
`webrent-office-v1`) melalui `useOfficeStore`.

## Sinkronisasi State ke Server

Selain localStorage (offline-first), state kantor disinkronkan ke server lewat
`/api/state` (GET load, PUT save). Adapter persistensi otomatis memilih driver:

| Kondisi | Driver | Penyimpanan |
|---|---|---|
| `KV_REST_API_URL` + `KV_REST_API_TOKEN` ada | `kv` | Vercel KV / Upstash |
| Tidak ada env di atas | `file` | `.data/office-state.json` (lokal) |

Alur: rehidrasi localStorage → GET server → pakai state server bila ada, jika
kosong unggah state lokal → perubahan berikutnya di-push (debounce 800 ms, saat
tab kembali fokus). Status ditampilkan di HUD ("tersinkron" / "offline").

Untuk produksi, hubungkan Vercel KV (atau Upstash Redis) dan isi env di atas
agar state dibagi antar pengguna.

## Peran (Founder / Departemen / Guest) & Audit Log

Auth aktif bila **minimal satu passcode** diisi (`FOUNDER_PASSCODE` atau
`<DEPARTEMEN>_PASSCODE`). Role ditentukan otomatis dari passcode yang cocok.

| Role | Hak akses |
|---|---|
| `founder` | Semua perintah |
| departemen (mis. `security`) | Baca + mutasi sesuai departemennya |
| guest | Hanya baca |

Aturan mutasi:
- `/tasks create` → hanya departemen yang disebut pada judul (mis. kata
  "security"/"keamanan"), atau Founder.
- `/tasks assign` & `/tasks review` → hanya Founder.
- `/incident` → hanya Security atau Operations (atau Founder).
- `/approve` → hanya Founder.

Login lewat tombol **Masuk (Founder / Departemen)** di HUD → `POST /api/auth`.
Sesi berupa cookie HttpOnly `wr_founder` bersignature HMAC-SHA256
(`FOUNDER_SECRET`). `GET /api/auth/roles` mengembalikan daftar departemen yang
terdaftar.

Setiap mutasi state dicatat di **audit log** (`/audit`) — waktu, aktor (mengikuti
role), aksi, target, detail — dan ikut tersinkron ke server.

Bila tidak ada passcode sama sekali, aplikasi berjalan **mode lokal** (auth
nonaktif) untuk memudahkan pengembangan.

> Passcode lokal sudah dibuatkan otomatis di `.env.local` (di-gitignore);
> contohnya di `.env.local.example`. Ganti nilainya kapan saja — setelah
> `FOUNDER_SECRET` diubah, semua sesi lama otomatis tidak valid.

### Otorisasi Server-Side

`PUT /api/state` **tidak mempercayai klien**. Server memuat state saat ini lalu
menggabungkannya dengan payload masuk lewat `applyScopedUpdate()`
(`src/lib/authz.ts`), dibatasi oleh role:

| Role | Boleh mengubah |
|---|---|
| founder | seluruh snapshot |
| departemen | task miliknya, insiden (security/ops), audit miliknya |
| guest | tidak boleh (401) |

Perubahan di luar wewenang ditolak dan dilaporkan pada respons
(`applied` / `rejected`); klien otomatis menyelaraskan kembali dengan snapshot
server. Contoh: Security Lead menulis ulang task milik Finance → ditolak
(`task.forbidden`), sedangkan patch ke departemennya sendiri diterapkan.

### Optimistic Concurrency (Versi Snapshot)

Setiap snapshot membawa `version` yang naik setiap penyimpanan sukses.

- `PUT /api/state` menyertakan `version` klien. Bila tidak cocok dengan versi
  server → **409 Conflict** beserta `serverVersion`, `clientVersion`, dan
  snapshot server terbaru.
- Saat `409`, klien menjalankan **three-way per-field merge**
  (`src/lib/merge.ts`): perubahan lokal di-*rebase* di atas snapshot server
  memakai `baseline` (versi server terakhir yang diketahui).
  - lokal berubah & server tidak → pakai lokal
  - server berubah & lokal tidak → pakai server
  - keduanya berubah berbeda → server menang (konflik dicatat)
  - item lokal baru (mis. task yang baru dibuat) tetap dipertahankan
  Hasil gabungan dikirim ulang (maks. 3 percobaan).
- Strategi dapat diganti via `NEXT_PUBLIC_SYNC_STRATEGY=server-wins` untuk
  perilaku sederhana (buang perubahan lokal saat konflik).
- Snapshot yang benar-benar tersimpan selalu dikembalikan pada respons PUT,
  dan klien menyelaraskan diri terhadapnya (mencegah desync, terutama untuk
  role ter-scope).

### Compare-and-Set (Anti Race Condition)

Penyimpanan memakai **CAS atomik** sehingga dua penulis bersamaan tidak saling
menimpa:

- **KV/Upstash** — versi disimpan di key terpisah (`…:version`); penulisan
  memakai skrip Lua `EVAL` yang memeriksa versi lalu menulis dalam satu operasi
  atomik. Bila versi berubah → tidak menulis.
- **file** — dibungkus lock in-process (serialisasi request pada proses yang
  sama; bukan lock lintas-proses).
- Route mencoba ulang otomatis hingga 5 kali bila `compareAndSave` gagal karena
  balapan, lalu mengembalikan **409** dengan state terbaru.

Teruji: dua `PUT` paralel dengan versi identik → satu **200**, satu **409**,
`version` naik satu langkah saja (tanpa kehilangan data secara diam-diam).

## Security Hardening

- **Rate limit** (`src/lib/rateLimit.ts`) — sliding window per IP/role.
  Endpoint login dibatasi `AUTH_RATE_LIMIT` percobaan / `AUTH_RATE_WINDOW`
  detik (default 8/300) → **429 + Retry-After**. Endpoint tulis state
  dibatasi `STATE_RATE_LIMIT`/`STATE_RATE_WINDOW` (default 60/60).
  Di KV memakai ZSET + Lua atomik; tanpa KV memakai fallback memori per-proses.
- **Proteksi CSRF** (`src/lib/security.ts`) — request yang mengubah state harus
  berasal dari origin yang sama; jika tidak → **403**. Klien non-browser
  (tanpa Origin/Referer) diizinkan karena cookie hanya dikirim otomatis
  oleh browser.
- **Security headers** (`next.config.ts`) — `X-Content-Type-Options`,
  `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`,
  `Cross-Origin-Opener-Policy`, `Cross-Origin-Resource-Policy` untuk semua rute.
- **CSP nonce per-request** (`src/middleware.ts` + `src/lib/csp.ts`) — header
  `Content-Security-Policy` dibuat per-request dengan nonce acak (Web Crypto
  API, Edge-compatible): `script-src 'self' 'nonce-…' 'strict-dynamic'`,
  `frame-ancestors 'none'`, `object-src 'none'`, `upgrade-insecure-requests`.
  Nonce diteruskan ke Server Component via request header `x-nonce` (cookie
  `__nonce` hanya cadangan). Di dev, `unsafe-eval` + `ws:` diizinkan untuk HMR.
- **Rotasi `FOUNDER_SECRET`** (`src/lib/auth.ts`) — mendukung multi-secret
  dipisahkan koma (`baru,lama`): cookie baru ditandatangani secret pertama,
  verifikasi mencoba semuanya. Alur rotasi: tambah secret baru di depan →
  tunggu sesi lama kedaluwarsa → hapus secret lama.

## Panel Operasional (Actionable)

Tombol **Panel Operasional** di HUD membuka panel untuk mengeksekusi state
tanpa mengetik perintah:

- **Pending Approvals** — Founder dapat *Setujui/Tolak* keputusan (menyetujui
  sekaligus meng-`APPROVED` task berisiko tinggi milik pengaju).
- **Insiden Aktif** — Security/Operations/Founder dapat *Kontain* / *Selesaikan*.
- **Menunggu Persetujuan** — daftar task berisiko tinggi.

Tombol difilter sesuai role; aksi mutasi tercatat di audit log.

## Export Knowledge Base (Obsidian)

Perintah `/export [daily|weekly|monthly]` menghasilkan file Markdown
berformat Obsidian (YAML frontmatter + wiki link `[[...]]`) berisi index,
seluruh task, insiden, keputusan, dan audit log. File otomatis diunduh dari
panel obrolan. Builder-nya ada di `src/lib/obsidian.ts`.

Snapshot contoh sudah tersedia di folder `vault/` (36 catatan: index, 13 agent,
13 departemen, 3 task, 1 keputusan, audit log, topik) — langsung bisa dibuka
sebagai vault Obsidian (Open folder as vault).

## Menjalankan

```bash
npm install
cp .env.local.example .env.local   # opsional, untuk mengaktifkan LLM
npm run dev
```

Buka http://localhost:3000.

Tanpa mengisi `LLM_API_KEY`, aplikasi tetap berjalan dan NPC menjawab dalam
**mode mock**. Untuk jawaban AI sungguhan, isi `.env.local`:

```env
LLM_BASE_URL=https://api.openai.com/v1
LLM_API_KEY=sk-...
LLM_MODEL=gpt-4o-mini
```

## Model kantor dari Blender

Aplikasi memakai kantor prosedural secara default. Untuk memakai model
Blender yang lebih detail:

1. Jalankan Blender (3.x/4.x):

   ```bash
   blender --background --python blender/build_office.py
   ```

2. Salin hasilnya:

   ```bash
   # Windows
   copy blender\office.glb public\models\office.glb

   # macOS / Linux
   cp blender/office.glb public/models/office.glb
   ```

3. Refresh aplikasi. `useGLTF` akan otomatis memuat `office.glb`.

## Karakter low-poly Kenney (opsional)

Karakter saat ini dibuat secara prosedural dari primitif R3F agar proyek
langsung jalan tanpa aset eksternal. Untuk memakai model low-poly Kenney
(CC0, gratis di https://kenney.nl):

1. Unduh paket karakter dari kenney.nl.
2. Ekspor/konversi ke `.glb`, simpan di `public/models/characters/`.
3. Di `src/components/scene/CharacterModel.tsx`, ganti isi komponen dengan
   `useGLTF(...)` + `clone` model, memakai warna NPC dari `src/data/npcs.ts`.

## Struktur

```
src/
  app/
    api/chat/route.ts     # endpoint streaming LLM (OpenAI-compatible)
    api/state/route.ts    # GET/PUT state kantor (KV atau file)
    api/auth/route.ts     # login/logout/status (multi-role)
    api/auth/roles/route.ts  # daftar departemen terdaftar
    layout.tsx, page.tsx, globals.css
  components/
    scene/                # kanvas 3D, kantor, karakter, kontrol, cahaya
    hud/                  # TopBar, ChatPanel, Minimap, OfficePanel, Auth
  data/npcs.ts            # definisi 13 agent departemen
  data/agents.ts          # AGENT_REGISTRY WebRent
  data/departments.ts     # label departemen
  data/orchestrator.ts    # system prompt WebRent AI Virtual Office
  hooks/                  # store zustand (NPC, office), wander, chat
  lib/commands.ts         # command engine: parser + handler semua perintah
  lib/serverStore.ts      # persistensi + compare-and-set atomik (KV Lua EVAL / file lock)
  lib/officeData.ts       # tipe snapshot + seed data
  lib/auth.ts             # HMAC sesi multi-role (server)
  lib/authApi.ts          # klien auth
  lib/obsidian.ts         # builder export knowledge base
  lib/authz.ts            # merge state ter-scope per role (server)
  lib/kv.ts               # klien Redis REST bersama
  lib/rateLimit.ts        # rate limiter sliding window
  lib/security.ts         # IP klien + proteksi CSRF
  lib/merge.ts            # three-way per-field merge (klien, resolusi 409)
  lib/csp.ts              # builder CSP + nonce (Edge-compatible)
  middleware.ts           # CSP header per-request + teruskan nonce (x-nonce)
  lib/                    # geometri kantor + adapter LLM
  types/
blender/build_office.py   # generator model kantor -> office.glb
public/models/            # tempat menaruh office.glb hasil export
```

## Verifikasi

```bash
npm run lint       # eslint
npm run test       # vitest: merge, authz, auth, rate-limit, security, csp (38 test)
npm run build      # next build
```

Test otomatis (Vitest) mencakup logika kritis: three-way merge, otorisasi
ter-scope per role, sesi HMAC + rotasi secret, rate limiter, proteksi CSRF/IP,
dan builder CSP/nonce.

## Deploy ke Vercel (webrent.my.id)

### 1. Push repo & import ke Vercel

```bash
git add -A
git commit -m "WebRent AI Virtual Office"
# buat repo di GitHub lalu push, kemudian Import Project di vercel.com
```

> `.env.local` dan `.data/` sudah di-gitignore — secret lokal tidak ikut push.

### 2. Environment variable produksi (wajib)

Isi di Vercel → Project → Settings → Environment Variables:

```env
# LLM (atau kosongkan untuk mode mock)
LLM_BASE_URL=https://api.openai.com/v1
LLM_API_KEY=
LLM_MODEL=gpt-4o-mini

# Auth — buat nilai BARU khusus produksi (jangan pakai passcode lokal!)
FOUNDER_PASSCODE=<passcode-founder-produksi>
FOUNDER_SECRET=<string-acak-panjang-produksi>
SECURITY_PASSCODE=<opsional>
FINANCE_PASSCODE=<opsional>

# State bersama (wajib untuk produksi — driver file tidak persisten di serverless)
KV_REST_API_URL=https://xxx.upstash.io
KV_REST_API_TOKEN=AX...

# Rate limit (opsional, default sudah aman)
AUTH_RATE_LIMIT=8
AUTH_RATE_WINDOW=300
STATE_RATE_LIMIT=60
STATE_RATE_WINDOW=60
```

Buat KV di Vercel → Storage → Create Database → KV (Upstash), lalu hubungkan
(Connect) ke project — env `KV_REST_API_*` terisi otomatis.

### 3. Domain webrent.my.id

1. Vercel → Project → Settings → Domains → Add `webrent.my.id`.
2. Di DNS registrar domain, tambahkan record yang diminta Vercel
   (biasanya `A 76.76.21.21` untuk apex, atau `CNAME cname.vercel-dns.com`).
3. Tunggu propagasi DNS; Vercel menerbitkan sertifikat TLS otomatis.

### 4. Checklist pasca-deploy

- [ ] Buka `https://webrent.my.id` — kantor 3D tampil, HUD + minimap jalan.
- [ ] Cek header `content-security-policy` ada (DevTools → Network).
- [ ] Login Founder dengan passcode produksi → badge role tampil.
- [ ] `/briefing`, `/tasks create …`, `/approve …` berfungsi dan tersinkron.
- [ ] `GET /api/state` → `"driver":"kv"` (bukan `file`).
- [ ] Ganti `FOUNDER_SECRET` lokal vs produksi berbeda; rotasi via format
      `baru,lama` bila perlu tanpa logout paksa.
