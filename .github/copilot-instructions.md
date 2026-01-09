# WhatsApp Bot — AI Assistant Instructions

**Purpose**: Help AI agents be immediately productive in this Baileys-based WhatsApp bot. The bot downloads and streams media (songs, videos, reels) on demand, with daily rate limits and optional premium subscriptions.

## 1. Architecture (big picture)
- **`index.js`**: Single process entry—handles Baileys connection, QR auth, message routing, and simple built-in commands (`.ping`, `.menu`, `.alive`, `.developer`, `.addpremium`, `.vv` for viewing disappeared messages).
- **`commands/`**: Self-contained modules for media downloads. Each exports an async handler `(sock, chatId, msg)`. Examples: `play.js` (YouTube audio), `video.js` (YouTube video), `instagram.js`, `spotify.js`, `short.js`, `lyrics.js`.
- **`data/`**: Runtime state storage:
  - `auth_info/` (Baileys credentials — never edit manually)
  - `usage.json` (daily per-sender limits: songs & videos)
  - `premium.json` (30-day subscription records with `addedAt` & `expiresAt` timestamps)
- **`tmp/`**: Temporary files (downloaded media) cleaned up after send via `try/finally`. Directory created if missing.
- **`rateLimit.js`**: Tracks daily usage per sender JID (not per chat). Resets at UTC midnight. Export: `checkAndIncrementLimit(senderJid, type)`.
- **`Dockerfile`**: Includes `node:20`, `ffmpeg`, `yt-dlp`, and Python for binary dependencies.

## 2. Command Patterns (how to add/modify)
- **Trigger**: Messages starting with `.` (dot). Example: `.play Despacito`.
- **Handler signature**: `async function myCommand(sock, chatId, msg)` where:
  - `sock`: Baileys socket for sending messages.
  - `chatId`: Recipient (user or group JID).
  - `msg`: WhatsApp message object containing parsed media.
- **Text extraction** (standard pattern across all commands):
  ```javascript
  const text = msg.message?.conversation || 
               msg.message?.extendedTextMessage?.text || 
               msg.message?.imageMessage?.caption || "";
  ```
- **Query parsing**: `const query = text.split(" ").slice(1).join(" ").trim()` removes command name.
- **Always reply with `{ quoted: msg }`** to preserve threading and context.
- **Registration**: Add route in `index.js` message handler switch statement. Include in `.menu` text.

## 3. Concurrency & File Safety
- **Prevent duplicate work**: Use in-memory `Set` (e.g., `activeChats`) to lock per-chat processing. Add sender JID at start, delete in `finally`.
  ```javascript
  if (activeChats.has(chatId)) return sock.sendMessage(...);
  activeChats.add(chatId);
  try { /* work */ } finally { activeChats.delete(chatId); }
  ```
- **Temp file cleanup**: Always wrap downloads in `try/finally`. Example from `play.js`:
  ```javascript
  try {
    const filePath = path.join("tmp", `${Date.now()}.mp3`);
    // ... download to filePath ...
    await sock.sendMessage(chatId, { audio: fs.readFileSync(filePath) });
  } finally {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
  ```

## 4. Media Handling & Download Tools
- **Audio (MP3)**: Use `yt-dlp` with `--audio-format mp3` and `ffmpeg-static` location. `play.js` exports safe pattern.
- **Video (MP4)**: Use `yt-dlp` with resolution filter (e.g., `-f bv*[height<=480]+ba/best[height<=480]`) to stay within WhatsApp's ~95 MB soft limit. Check file size before send:
  ```javascript
  if (stats.size > 95 * 1024 * 1024) {
## 5. Rate-Limiting & Premium (per-sender)
- **Limits** (enforced via `checkLimitOrPremium(sender, type)` in `premium.js`):
  - **Songs** (`.play`, `.spotify`): 5/day
  - **Videos** (`.video`, `.short`, `.instagram`): 3/day
- **Scope**: Per **sender JID** (user), not per group. `data/usage.json` tracks `{ [senderJid]: { date, songs, videos } }` and resets at UTC midnight.
- **Premium** (`data/premium.json`): `{ [jid]: { addedAt, expiresAt } }` where `expiresAt` is 30 days from `addedAt` in milliseconds. Admins add via `.addpremium <phone|jid>`:
  - Phone format: `.addpremium 0993287093` → stores as `2650993287093@s.whatsapp.net`
  - JID format: `.addpremium 185624896229398@lid` → stores as-is (for linked devices)
- **Admin JIDs** hardcoded in `index.js` and `commands/premium.js` (must stay in sync). Only those IDs can run `.addpremium`.
- **Critical**: Users accessing via linked devices (companion app) have different JID formats (`@lid` suffix) than phone users (`@s.whatsapp.net`). Add premium for both formats if user accesses both ways. Check logs for "Sender JID:" to see actual format.
- **Safe filenames**: `title.replace(/[^\w\s.-]/g, "").substring(0, 50)` to avoid system errors.
- **Tools available**: `ffmpeg-static` (npm), `yt-dlp` binary (Docker or system install).

5. Rate-limiting & premium
- Limits are enforced in `rateLimit.js` / `premium.js`: default limits — 5 songs/day for `.play`, 3 videos/day for `.video`/`.short`/`.instagram`/`.spotify`.
## 6. Adding a New Command
1. Create file `commands/mycommand.js` exporting `async function myCommandName(sock, chatId, msg)`.
2. Import in `index.js`: `import { myCommandName } from "./commands/mycommand.js"`.
3. Add route in message handler: `else if (body.startsWith(".mycommand")) { await myCommandName(sock, chatId, msg); }`.
## 7. Running & Deployment
- **Local**: `npm start` (first run displays QR code in terminal for WhatsApp auth; credentials auto-persist in `data/auth_info/`).
- **Docker**: Build with `docker build -t whatsapp-bot .` and run. Includes `yt-dlp`, `ffmpeg`, `python` out-of-the-box. Use when host lacks binaries.- **Railway**: All data paths point to `/data` (absolute). Mount a volume at `/data` in Railway settings for persistence (`auth_info/`, `usage.json`, `premium.json`).- **Logs**: Node runs silent logger (pino). System errors and crashes are caught globally (see top of `index.js`)
## 8. Key Files Reference
| File | Purpose |
|------|---------|
| [index.js](index.js) | Router, Baileys setup, built-in commands (`.ping`, `.alive`, `.vv`, `.addpremium`) |
| [commands/play.js](commands/play.js) | Audio download pattern: yt-dlp → ffmpeg MP3, concurrency lock, cleanup |
| [commands/video.js](commands/video.js) | Video download: yt-dlp filtered MP4, size guard (95 MB), cleanup |
| [commands/premium.js](commands/premium.js) | Premium check, 30-day subscription logic |
## 9. Safe Edit Rules
- ❌ Never modify `data/auth_info/` (Baileys session storage).
- ✅ Always include `{ quoted: msg }` in user-facing replies (preserves threading).
- ✅ Wrap temp file downloads in `try/finally`; delete artifacts before function returns.
- ❌ Avoid long-running synchronous work on event loop (use streams or spawn background processes).
- ✅ Sender JID format: `phone@s.whatsapp.net` (e.g., `265995551995@s.whatsapp.net`).
- ✅ Check `msg.key.participant` for groups; fall back to `msg.key.remoteJid` for DM
- [rateLimit.js](rateLimit.js) — usage tracking and reset logic
- [premium.js](premium.js) — premium checks and `.addpremium` behavior

9. Safe edit rules for agents
- Never modify files under `data/auth_info/`.
- Keep `{ quoted: msg }` in user-facing replies.
- Delete all `tmp/` artifacts after use; prefer `try/finally`.
- Avoid adding long-running synchronous work on the main event loop.

Feedback: if any command module deviates from these patterns, tell me which file to inspect and I will update these instructions.