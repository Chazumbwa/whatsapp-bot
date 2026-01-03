# WhatsApp Bot Coding Guidelines

## Architecture Overview
This is a Baileys-based WhatsApp bot with modular command handlers. Core structure:
- `index.js`: Main entry point handling WhatsApp connection, QR auth, and message routing
- `commands/`: Individual command modules (e.g., `play.js`, `video.js`) exporting async functions
- `data/auth_info/`: Persistent Baileys authentication state (auto-managed)
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

## Media Handling
- Downloads use `yt-dlp` with platform-specific formats (see `commands/video.js` for YouTube, `commands/short.js` for shorts)
- Audio/video sent as `document` with appropriate mimetypes (`audio/mpeg`, `video/mp4`)
- Size limits: Videos capped at 95MB for WhatsApp compatibility
- Temp files named with timestamps: `path.join("tmp", `${Date.now()}.mp3`)`
- Safe filenames: `video.title.replace(/[^\w\s.-]/g, "")`

## Concurrency Control
Use in-memory `Set` for chat-specific locks to prevent overlapping operations:
```javascript
const activeChats = new Set();
if (activeChats.has(chatId)) return; // Block concurrent requests
activeChats.add(chatId);
// ... process ...
activeChats.delete(chatId);
```

## Dependencies & Tools
- `yt-dlp`: Assumed installed system-wide (Dockerfile installs it)
- `ffmpeg-static`: Used for format conversion via `--ffmpeg-location` in yt-dlp args
- External APIs: `lyrics.ovh` for lyrics, YouTube search via `yt-search`
- Baileys: For WhatsApp connection, auth state in `data/auth_info/`

## Development Workflow
- `npm start`: Runs `node index.js`
- First run generates QR code for WhatsApp auth (scan once, persists in `data/auth_info/`)
- Logs: Pino logger set to silent level
- Docker deployment: Builds image with yt-dlp and ffmpeg pre-installed

## Key Files
- `index.js`: Message routing and connection logic (includes built-in commands like .ping, .menu)
- `commands/play.js`: yt-dlp audio download example with spawn and file cleanup
- `commands/video.js`: Video download with size checks
- `Dockerfile`: Deployment setup with system dependencies</content>
<parameter name="filePath">c:/Users/Ephron Cej2y Ricoh/Music/WhatsappBot/.github/copilot-instructions.md