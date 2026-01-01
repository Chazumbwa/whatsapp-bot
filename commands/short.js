import fs from "fs";
import path from "path";
import { exec } from "child_process";
import ffmpegPath from "ffmpeg-static";

function isUrl(text) {
  return /^https?:\/\//i.test(text);
}

function detectPlatform(url) {
  if (/tiktok\.com/i.test(url)) return "tiktok";
  if (/instagram\.com/i.test(url)) return "instagram";
  if (/facebook\.com|fb\.watch/i.test(url)) return "facebook";
  if (/youtube\.com\/shorts/i.test(url)) return "youtube";
  return "generic";
}

function getFormat(platform) {
  // YouTube supports split streams
  if (platform === "youtube") {
    return `bv*[height<=480]+ba/best[height<=480]`;
  }

  // Shorts platforms use progressive MP4
  return "best";
}

export async function shortCommand(sock, chatId, msg) {
  try {
    const text =
      msg.message?.conversation ||
      msg.message?.extendedTextMessage?.text ||
      "";

    const url = text.split(" ").slice(1).join(" ").trim();

    if (!url || !isUrl(url)) {
      return sock.sendMessage(chatId, {
        text: "📱 Usage:\n.short <tiktok / instagram / facebook / yt shorts link>"
      }, { quoted: msg });
    }

    if (!fs.existsSync("tmp")) fs.mkdirSync("tmp");

    const platform = detectPlatform(url);
    const format = getFormat(platform);

    const safeName = `${platform}_${Date.now()}`;
    const filePath = path.join("tmp", `${safeName}.mp4`);

    await sock.sendMessage(chatId, {
      text: `📥 Downloading ${platform.toUpperCase()} short...\n⏳ Please wait`
    }, { quoted: msg });

    const cmd = `
yt-dlp \
-f "${format}" \
--merge-output-format mp4 \
--ffmpeg-location "${ffmpegPath}" \
-o "${filePath}" \
"${url}"
    `.trim();

    exec(cmd, async (err) => {
      if (err) {
        console.error("SHORT ERROR:", err);
        return sock.sendMessage(chatId, {
          text: `❌ Failed to download ${platform} short.`
        }, { quoted: msg });
      }

      if (!fs.existsSync(filePath)) {
        return sock.sendMessage(chatId, {
          text: "❌ Download failed (no file produced)."
        }, { quoted: msg });
      }

      const stats = fs.statSync(filePath);
      if (stats.size > 95 * 1024 * 1024) {
        fs.unlinkSync(filePath);
        return sock.sendMessage(chatId, {
          text: "⚠️ Video too large for WhatsApp."
        }, { quoted: msg });
      }

      await sock.sendMessage(chatId, {
        document: fs.readFileSync(filePath),
        mimetype: "video/mp4",
        fileName: `${safeName}.mp4`,
        caption: `📱 ${platform.toUpperCase()} short`
      }, { quoted: msg });

      fs.unlinkSync(filePath);
    });

  } catch (e) {
    console.error("SHORT COMMAND ERROR:", e);
    await sock.sendMessage(chatId, {
      text: "❌ Unexpected error occurred."
    }, { quoted: msg });
  }
}
