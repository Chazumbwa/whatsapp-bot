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

import P from "pino";
import qr from "qr-image";
import fs from "fs";

/* ===========================
   GLOBAL CRASH PROTECTION
   =========================== */
process.on("uncaughtException", (err) => {
  console.error("UNCAUGHT EXCEPTION:", err);
});

process.on("unhandledRejection", (reason) => {
  console.error("UNHANDLED REJECTION:", reason);
});

/* ===========================
   START SOCKET
   =========================== */
async function startSock() {
  const { state, saveCreds } = await useMultiFileAuthState("auth_info");
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    logger: P({ level: "silent" }),
    printQRInTerminal: false
  });

  sock.ev.on("creds.update", saveCreds);

  /* ===========================
     CONNECTION HANDLER
     =========================== */
  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect, qr: qrCode } = update;

    if (qrCode) {
      console.log("📸 QR Code received, saving as qr.png...");
      try {
        const qrImage = qr.image(qrCode, { type: "png" });
        qrImage.pipe(fs.createWriteStream("qr.png"));
      } catch (err) {
        console.error("❌ Failed to save QR:", err);
      }
    }

    if (connection === "open") {
      console.log("✅ Bot connected successfully!");
    }

    if (connection === "close") {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      if (statusCode === DisconnectReason.loggedOut) {
        console.log("❌ Logged out. Delete auth_info and restart deployment.");
      } else {
        console.log("⚠ Connection lost. Reconnecting...");
        startSock();
      }
    }
  });

  /* ===========================
     MESSAGE HANDLER
     =========================== */
  sock.ev.on("messages.upsert", async ({ messages }) => {
    const msg = messages[0];
    if (!msg?.message || msg.key.fromMe) return;

    const chatId = msg.key.remoteJid;

    const body =
      msg.message?.conversation ||
      msg.message?.extendedTextMessage?.text ||
      msg.message?.imageMessage?.caption ||
      "";

    try {
      if (body.startsWith(".ping")) {
        await sock.sendMessage(chatId, {
          text: `╭─「 *Webs BOT STATUS* 」
│⚡ Speed: Fast
│🟢 Status: Online
╰─────────────`
        }, { quoted: msg });
      }

      else if (body.startsWith(".menu")) {
        await sock.sendMessage(chatId, {
          text: `
┏━━〔 🤖 *Webs Bot Menu* 〕━━┓
┃ ⚙️ .ping
┃ 📜 .menu
┃ ✅ .alive
┃ ▶️ .play
┃ 🎵 .lyrics
┃ 🎥 .video
┃ 📱 .short
┃ 👁 .vv
┃ 👤 .developer
┗━━━━━━━━━━━━━━━━━━━━━━┛`.trim()
        }, { quoted: msg });
      }

      else if (body.startsWith(".alive")) {
        await sock.sendMessage(chatId, {
          text: "✅ Webs Bot is alive and running!"
        }, { quoted: msg });
      }

      else if (body.startsWith(".developer")) {
        await sock.sendMessage(chatId, {
          text: "Developed by Webs — Information Systems student at UNIMA"
        }, { quoted: msg });
      }

      else if (body.startsWith(".play")) {
        await playCommand(sock, chatId, msg);
      }

      else if (body.startsWith(".lyrics")) {
        await lyricsCommand(sock, chatId, msg);
      }

      else if (body.startsWith(".video")) {
        await videoCommand(sock, chatId, msg);
      }

      else if (body.startsWith(".short")) {
        await shortCommand(sock, chatId, msg);
      }

      else if (body.startsWith(".vv")) {
        const quoted =
          msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;

        if (!quoted) {
          return sock.sendMessage(chatId, {
            text: "❗ Reply to a ViewOnce image/video."
          }, { quoted: msg });
        }

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
      }

    } catch (err) {
      console.error("COMMAND ERROR:", err);
      await sock.sendMessage(chatId, {
        text: "❌ An internal error occurred."
      }, { quoted: msg });
    }
  });
}

/* ===========================
   BOOT
   =========================== */
startSock();
