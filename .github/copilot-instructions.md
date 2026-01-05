# WhatsApp Bot Coding Guidelines

## Architecture Overview
This is a Baileys-based WhatsApp bot with modular command handlers. Core structure:
- `index.js`: Main entry point handling WhatsApp connection, QR auth, and message routing
- `commands/`: Individual command modules (e.g., `play.js`, `video.js`) exporting async functions
- `data/auth_info/`: Persistent Baileys authentication state (auto-managed)
- `data/usage.json`: Daily usage tracking for rate limiting (resets daily)
- `tmp/`: Temporary files for downloads (cleaned after use)

## Command Pattern
Commands are triggered by messages starting with "." (e.g., ".play song name"). Each command:
- Takes `(sock, chatId, msg)` parameters
- Parses query from message text using `text.split(" ").slice(1).join(" ").trim()` where `text` is extracted as `msg.message?.conversation || msg.message?.extendedTextMessage?.text || msg.message?.imageMessage?.caption || ""`
- Sends progress messages with `{ quoted: msg }` to reply to user
- Uses try-catch with user-friendly error responses
- Cleans up temp files immediately after sending

Example from `commands/play.js`:
```javascript
const query = text.split(" ").slice(1).join(" ").trim();
if (!query) return sock.sendMessage(chatId, { text: "Usage: .play song name" }, { quoted: msg });
```

## Built-in Commands
Core commands implemented directly in `index.js`:
- `.ping`: Status check with formatted response
- `.menu`: Lists all available commands
- `.alive`: Simple alive confirmation
- `.developer`: Developer info
- `.vv`: Reveals ViewOnce media using `downloadMediaMessage`

## Media Handling
- Downloads use `yt-dlp` with platform-specific formats (see `commands/video.js` for YouTube, `commands/short.js` for shorts/TikTok/Instagram)
- Audio/video sent as `document` with appropriate mimetypes (`audio/mpeg`, `video/mp4`)
- Size limits: Videos capped at 95MB for WhatsApp compatibility
- Temp files named with timestamps: `path.join("tmp", `${Date.now()}.mp3`)`
- Safe filenames: `video.title.replace(/[^\w\s.-]/g, "")` or `video.title.replace(/[^\w\s]/gi, "").substring(0, 50)`

## Concurrency Control
Use in-memory `Set` for chat-specific locks to prevent overlapping operations:
```javascript
const activeChats = new Set();
if (activeChats.has(chatId)) return; // Block concurrent requests
activeChats.add(chatId);
// ... process ...
activeChats.delete(chatId);
```

## Rate Limiting
To prevent resource exhaustion on Railway free tier:
- 5 songs/day per user (.play command)
- 3 videos/day per user (.video and .short commands)
- Usage tracked in `data/usage.json` with daily resets
- Check `checkAndIncrementLimit(chatId, "song"|"video")` before processing downloads
- When limit reached, prompt for monetization upgrade with payment details

## Premium System
- Admin-only command `.addpremium <phone_number>` to grant 30-day premium access
- Premium users bypass daily rate limits
- Stored in `data/premium.json` with `addedAt` and `expiresAt` timestamps
- Helper functions: `isPremium(jid)`, `addPremium(jid)`, `checkLimitOrPremium(sender, chatId, type)`
- Expired premiums cleaned up automatically on check

## Development Workflow
- `npm start`: Runs `node index.js`
- First run generates QR code for WhatsApp auth (scan once, persists in `data/auth_info/`)
- Logs: Pino logger set to silent level
- Docker deployment: Builds image with yt-dlp and ffmpeg pre-installed

## Key Files
- `index.js`: Message routing and connection logic (includes built-in commands like .ping, .menu)
- `commands/play.js`: yt-dlp audio download example with spawn and file cleanup
- `commands/video.js`: Video download with size checks
- `commands/short.js`: Multi-platform short video download with platform detection
- `commands/lyrics.js`: Lyrics fetch using yt-search for metadata and lyrics.ovh API
- `rateLimit.js`: Daily usage tracking and limit enforcement
- `premium.js`: Premium user management and limit bypass
- `Dockerfile`: Deployment setup with system dependencies</content>
<parameter name="filePath">c:/Users/Ephron Cej2y Ricoh/Music/WhatsappBot/.github/copilot-instructions.md