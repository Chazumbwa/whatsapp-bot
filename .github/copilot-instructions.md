# WhatsApp Bot — AI Assistant Instructions

Purpose: help an AI coding agent be productive in this Baileys-based WhatsApp bot.

1. Architecture (big picture)
- `index.js`: single process entry — handles Baileys connection, QR auth, message routing, and built-in commands.
- `commands/`: each command is a self-contained module (example: `commands/play.js` exports an async handler used by `index.js`).
- `data/`: runtime state — `auth_info/` (Baileys credentials — do not edit), `usage.json` (daily limits), `premium.json` (30-day subscriptions).
- `tmp/`: transient files created when downloading/transcoding media; items must be removed after send.

2. How commands work (concrete patterns)
- Trigger: messages starting with `.` (dot). Example: `.play Despacito`.
- Signature: command handlers receive `(sock, chatId, msg)`; parse text with
	`const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || msg.message?.imageMessage?.caption || ""`.
- Query parsing example: `const query = text.split(" ").slice(1).join(" ").trim()`.
- Always reply using `{ quoted: msg }` to preserve context and threading.

3. Concurrency & safety
- Use an in-memory `Set` (commonly `activeChats`) to prevent concurrent processing per chat. Add at start, remove in `finally`.
- Always wrap downloads/transcoding in `try/finally` to ensure temp files in `tmp/` are deleted.

4. Media handling specifics
- Downloads use `yt-dlp` + `ffmpeg` (Dockerfile includes these). Use `yt-dlp-exec` and `ffmpeg-static` where present.
- WhatsApp size constraint: send videos as documents if approaching ~95MB; check file size before sending.
- Use safe filenames: strip unsafe chars, limit length. Example: `title.replace(/[^\\w\\s.-]/g, '').substring(0,50)`.

5. Rate-limiting & premium
- Limits are enforced in `rateLimit.js` / `premium.js`: default limits — 5 songs/day for `.play`, 3 videos/day for `.video`/`.short`/`.instagram`/`.spotify`.
- Limits are applied per-sender (user JID) — not per-group chat. The rate limiter keys usage by the sender JID in `data/usage.json` and resets daily.
- Premium users are stored in `data/premium.json` with `addedAt`/`expiresAt` (ms). Admins add premium via `.addpremium`.

6. Adding or modifying commands
- Pattern: export an async function that performs work and returns after sending media/message. Example scaffold in `commands/play.js`.
- Register new command in `index.js`'s routing switch so it appears in `.menu`.

7. Developer workflows & running
- Local run: `npm start` (first run requires QR scan; credentials persist in `data/auth_info/`).
- Docker: `Dockerfile` includes `yt-dlp` and `ffmpeg` for media handling; use it when host lacks binary dependencies.

8. Key files to inspect quickly
- [index.js](index.js) — router and built-in commands
- [commands/play.js](commands/play.js) — audio download pattern + cleanup
- [commands/video.js](commands/video.js) — video download + size checks
- [rateLimit.js](rateLimit.js) — usage tracking and reset logic
- [premium.js](premium.js) — premium checks and `.addpremium` behavior

9. Safe edit rules for agents
- Never modify files under `data/auth_info/`.
- Keep `{ quoted: msg }` in user-facing replies.
- Delete all `tmp/` artifacts after use; prefer `try/finally`.
- Avoid adding long-running synchronous work on the main event loop.

Feedback: if any command module deviates from these patterns, tell me which file to inspect and I will update these instructions.