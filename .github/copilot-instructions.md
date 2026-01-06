# WhatsApp Bot Coding Guidelines

## Architecture Overview
This is a Baileys-based WhatsApp bot with modular command handlers. Core structure:
- `index.js`: Main entry point handling WhatsApp connection, QR auth, and message routing
- `commands/`: Individual command modules (e.g., `play.js`, `video.js`) exporting async functions
- `data/auth_info/`: Persistent Baileys authentication state (auto-managed)
- `data/usage.json`: Daily usage tracking for rate limiting (resets daily)
- `data/premium.json`: Premium user data with expiration timestamps
- `tmp/`: Temporary files for downloads (cleaned after use)

## Command Pattern
Commands are triggered by messages starting with "." (e.g., ".play song name"). Each command:
- Takes `(sock, chatId, msg)` parameters
- Parses query from message text using `text.split(" ").slice(1).join(" ").trim()` where `text` is extracted as `msg.message?.conversation || msg.message?.extendedTextMessage?.text || msg.message?.imageMessage?.caption || ""`
- Sends progress messages with `{ quoted: msg }` to reply to user
- Uses try-catch with user-friendly error responses
- Cleans up temp files immediately after sending

# Copilot Instructions — WhatsApp Bot (Baileys)

Purpose: Help AI agents be immediately productive in this repo — quick architecture, conventions, and copy-paste examples.

Architecture (big picture)
- `index.js`: Connection, QR auth, message routing, built-in commands and dispatcher.
- `commands/*.js`: Modular command handlers, each exported as an async function accepting `(sock, chatId, msg)`.
- `data/`: persistent state: `auth_info/` (Baileys creds), `usage.json` (daily counts), `premium.json` (premium users).
- `tmp/`: ephemeral download files (must be removed after use).

Core conventions & examples
- Command trigger: messages starting with `.` (e.g., `.play track name`). See [index.js](index.js).
- Text extraction (canonical):
	`const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || msg.message?.imageMessage?.caption || ""`
	`const query = text.split(" ").slice(1).join(" ").trim();`
- Replies should include `{ quoted: msg }` to keep context in replies.
- Concurrency: use an in-memory `Set` (e.g., `activeChats`) to prevent duplicate processing for the same chat.
- Temp files: name with timestamp (`path.join("tmp", `${Date.now()}.mp3`)`) and always delete in `finally`.

Media & integration points
- Downloads rely on `yt-dlp` and `ffmpeg` (Dockerfile installs them). Respect WhatsApp size limits (videos ~95MB).
- Send media as `document` when appropriate; set mime types (`audio/mpeg`, `video/mp4`).
- Safe filename example used in code: `video.title.replace(/[^\w\s.-]/g, "")`.

Rate limiting & premium
- Limits: 5 songs/day for `.play`, 3 videos/day for `.video`/`.short`. Tracked in `data/usage.json`.
- Premium: stored in `data/premium.json` with `addedAt`/`expiresAt`. Admin-managed via `.addpremium` (admin JID: `265995551995@s.whatsapp.net`).
- Use `rateLimit.js` and `premium.js` helpers for checks like `isPremium()` and `checkAndIncrementLimit()`.

Developer workflows
- Run locally: `npm start` (runs `node index.js`). First run requires scanning QR; auth persists under `data/auth_info/`.
- Docker: use the provided `Dockerfile` for builds with `yt-dlp` and `ffmpeg` included.

Files to inspect first
- [index.js](index.js) — routing, built-in commands, and the dispatcher.
- [commands/play.js](commands/play.js) — example audio download flow and cleanup.
- [commands/video.js](commands/video.js) — video download + size-check pattern.
- [rateLimit.js](rateLimit.js), [premium.js](premium.js) — limit and premium business rules.

Editing notes for AI agents
- Preserve message quoting (`{ quoted: msg }`) in user-facing replies.
- Always delete temp files; prefer `try/finally` cleanup.
- Do not alter files under `data/auth_info/` structure — they're Baileys-managed credentials.
- When adding external APIs or secrets, ask whether to store them in environment variables (Docker) or local config.

If you want changes, tell me which sections to expand or which command examples to add.