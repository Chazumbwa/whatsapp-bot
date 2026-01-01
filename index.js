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
import { join } from "path";
import qrcode from "qrcode-terminal";

/* ===========================
   GLOBAL CRASH PROTECTION
   =========================== */
process.on("uncaughtException", (err) => console.error("UNCAUGHT EXCEPTION:", err));
process.on("unhandledRejection", (reason) => console.error("UNHANDLED REJECTION:", reason));

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

    try {
      if (body.startsWith(".ping")) {
        await sock.sendMessage(chatId, { text: "✅ Bot Online!" }, { quoted: msg });
      } else if (body.startsWith(".menu")) {
        await sock.sendMessage(chatId, {
          text: "📜 Menu: .ping | .menu | .alive | .play | .lyrics | .video | .short | .vv | .developer"
        }, { quoted: msg });
      } else if (body.startsWith(".alive")) {
        await sock.sendMessage(chatId, { text: "✅ Webs Bot is alive!" }, { quoted: msg });
      } else if (body.startsWith(".developer")) {
        await sock.sendMessage(chatId, { text: "Developed by Webs — UNIMA" }, { quoted: msg });
      } else if (body.startsWith(".play")) {
        await playCommand(sock, chatId, msg);
      } else if (body.startsWith(".lyrics")) {
        await lyricsCommand(sock, chatId, msg);
      } else if (body.startsWith(".video")) {
        await videoCommand(sock, chatId, msg);
      } else if (body.startsWith(".short")) {
        await shortCommand(sock, chatId, msg);
      } else if (body.startsWith(".vv")) {
        const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        if (!quoted) return sock.sendMessage(chatId, { text: "❗ Reply to a ViewOnce media." }, { quoted: msg });

        const buffer = await downloadMediaMessage({ message: quoted }, "buffer", {}, { logger: P({ level: "silent" }) });
        await sock.sendMessage(chatId, { image: buffer, caption: "👁 ViewOnce revealed" }, { quoted: msg });
      }
    } catch (err) {
      console.error("COMMAND ERROR:", err);
      await sock.sendMessage(chatId, { text: "❌ Internal error." }, { quoted: msg });
    }
  });
}

/* ===========================
   BOOT
   =========================== */
startSock();
