import makeWASocket, {
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason,
  downloadMediaMessage
} from "@whiskeysockets/baileys";

import { playCommand } from "./commands/play.js";
import { lyricsCommand } from "./commands/lyrics.js";
import { videoCommand } from "./commands/video.js";
import { shortCommand } from "./commands/short.js";
import readline from "readline";
import P from "pino";
import qrcode from "qrcode-terminal";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function startSock() {
  const { state, saveCreds } = await useMultiFileAuthState("auth_info");
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    logger: P({ level: "silent" })
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log("📸 Scan this QR Code:");
      qrcode.generate(qr, { small: true });
    }

    if (connection === "open") {
      console.log("✅ Bot connected successfully!");
      rl.close();
    }

    if (connection === "close") {
      const shouldReconnect =
        lastDisconnect?.error?.output?.statusCode !==
        DisconnectReason.loggedOut;

      console.log("❌ Connection closed. Reconnecting:", shouldReconnect);
      if (shouldReconnect) startSock();
    }
  });

  sock.ev.on("messages.upsert", async ({ messages }) => {
    const msg = messages[0];
    if (!msg?.message || msg.key.fromMe) return;

    const chatId = msg.key.remoteJid;

    const body =
      msg.message?.conversation ||
      msg.message?.extendedTextMessage?.text ||
      msg.message?.imageMessage?.caption ||
      "";

    // ===== .ping =====
    if (body.startsWith(".ping")) {
      await sock.sendMessage(chatId, {
        text: `╭─「 *Webs BOT STATUS* 」
│⚡ Speed: Fast
│🟢 Status: Online
╰─────────────`
      }, { quoted: msg });
    }

    // ===== .menu =====
    else if (body.startsWith(".menu")) {
      await sock.sendMessage(chatId, {
        text: `
┏━━〔 🤖 *Webs Bot Menu* 〕━━┓
┃ ⚙️ .ping
┃ 📜 .menu
┃ ✅ .alive
┃ ▶️ .play
┃ 👁 .vv
┃ 👤 .developer
┃ 🎵 .lyrics
┃ 📌 .play
┃ 🎥 .video
┃ 📱 .short
┗━━━━━━━━━━━━━━━━━━━━━━┛`.trim()
      }, { quoted: msg });
    }

    // ===== .alive =====
    else if (body.startsWith(".alive")) {
      await sock.sendMessage(chatId, {
        text: "✅ Webs Bot is alive and running!"
      }, { quoted: msg });
    }

    // ===== .developer =====
    else if (body.startsWith(".developer")) {
      await sock.sendMessage(chatId, {
        text: "Developed by Webs — Information Systems student at UNIMA\n📞 099 555 1995"
      }, { quoted: msg });
    }

    // ===== .play =====
    else if (body.startsWith(".play")) {
      await playCommand(sock, chatId, msg);
    }

    // ===== .lyrics =====
    else if (body.startsWith(".lyrics")) {
        await lyricsCommand(sock, chatId, msg);
      }

    // ===== .video =====
    else if (body.startsWith(".video")) {
        await videoCommand(sock, chatId, msg);
      }
      
    // ===== .short =====
    else if (body.startsWith(".short")) {
        await shortCommand(sock, chatId, msg);
      }

   // ===== .vv =====
    else if (body.startsWith(".vv")) {
      const quoted =
        msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;

      if (!quoted) {
        return sock.sendMessage(chatId, {
          text: "❗ Reply to a ViewOnce image/video."
        }, { quoted: msg });
      }

      try {
        const buffer = await downloadMediaMessage(
          { message: quoted },
          "buffer",
          {},
          { logger: P({ level: "silent" }) }
        );

        await sock.sendMessage(chatId, {
          image: buffer,
          caption: "👁 ViewOnce revealed"
        }, { quoted: msg });

      } catch {
        await sock.sendMessage(chatId, {
          text: "❌ Failed to reveal media."
        }, { quoted: msg });
      }
    }
  });
}

startSock();
