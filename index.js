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
import { instagramCommand } from "./commands/instagram.js";
import { spotifyCommand } from "./commands/spotify.js"; 
import { addPremium } from "./premium.js";

import P from "pino";
import qr from "qr-image";
import fs from "fs";
import { join } from "path";
import qrcode from "qrcode-terminal";

/* ===========================
   GLOBAL CRASH PROTECTION
   =========================== */
process.on("uncaughtException", (err) => console.error("UNCAUGHT EXCEPTION:", err));
process.on("unhandledRejection", (reason) => console.error("UNHANDLED REJECTION:", reason));

const adminJid = "265995551995@s.whatsapp.net"; // Admin JID for premium commands

/* ===========================
   START SOCKET
   =========================== */
async function startSock() {
  const authPath = join(process.cwd(), "data", "auth_info"); // persistent folder
  const { state, saveCreds } = await useMultiFileAuthState(authPath);

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

    // Only save QR if no session exists
    const sessionFile = join(authPath, "creds.json");
    if (qrCode) {
  console.log("📸 Scan this QR Code (ONLY ONCE):");
  console.log("QR Data:", qrCode);
  qrcode.generate(qrCode, { small: true });
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
┃ 📸 .instagram
┃ 🎧 .spotify
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

    // ===== .instagram =====
    else if (body.startsWith(".instagram")) {
        await instagramCommand(sock, chatId, msg);
      }

    // ===== .spotify =====
    else if (body.startsWith(".spotify")) {
        await spotifyCommand(sock, chatId, msg);
      }

    // ===== .addpremium =====
    else if (body.startsWith(".addpremium")) {
      const sender = msg.key.participant || msg.key.remoteJid;
      if (sender !== adminJid) {
        return sock.sendMessage(chatId, { text: "❌ Admin only command." }, { quoted: msg });
      }
      const args = body.split(" ").slice(1);
      if (args.length !== 1) {
        return sock.sendMessage(chatId, { text: "Usage: .addpremium <phone_number>" }, { quoted: msg });
      }
      const phone = args[0].replace(/\D/g, '');
      const country = "265"; // Malawi country code
      const fullPhone = phone.startsWith(country) ? phone : country + phone;
      const jid = fullPhone + "@s.whatsapp.net";
      addPremium(jid);
      await sock.sendMessage(chatId, { text: `✅ Added premium for ${jid} (30 days)` }, { quoted: msg });
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