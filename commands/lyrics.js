import axios from "axios";
import yts from "yt-search";

export async function lyricsCommand(sock, chatId, msg) {
  try {
    const text =
      msg.message?.conversation ||
      msg.message?.extendedTextMessage?.text ||
      "";

    const query = text.split(" ").slice(1).join(" ").trim();

    if (!query) {
      return sock.sendMessage(chatId, {
        text: "📄 Usage: .lyrics song name"
      }, { quoted: msg });
    }

    // Search song (to get artist + title cleanly)
    const search = await yts(query);
    if (!search.videos.length) {
      return sock.sendMessage(chatId, {
        text: "❌ Song not found."
      }, { quoted: msg });
    }

    const video = search.videos[0];
    const title = video.title;

    // Try to split artist - title
    let artist = "";
    let song = title;

    if (title.includes("-")) {
      [artist, song] = title.split("-").map(t => t.trim());
    } else {
      song = title;
      artist = search.videos[0].author?.name || "";
    }

    await sock.sendMessage(chatId, {
      text: `📄 Fetching lyrics for:\n*${song}* — ${artist}`
    }, { quoted: msg });

    const res = await axios.get(
      `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(song)}`
    );

    const lyrics = res.data?.lyrics;

    if (!lyrics) {
      return sock.sendMessage(chatId, {
        text: "❌ Lyrics not found."
      }, { quoted: msg });
    }

    // WhatsApp message length safety
    const trimmedLyrics = lyrics.length > 3500
      ? lyrics.substring(0, 3500) + "\n\n…(truncated)"
      : lyrics;

    await sock.sendMessage(chatId, {
      text: `📄 *Lyrics for: ${song} - ${artist}*\n\n${trimmedLyrics}\n\n🎤 Powered by lyrics.ovh`
    }, { quoted: msg });

  } catch (err) {
    console.error("LYRICS ERROR:", err.message);
    await sock.sendMessage(chatId, {
      text: "❌ Failed to fetch lyrics. Try another song."
    }, { quoted: msg });
  }
}
