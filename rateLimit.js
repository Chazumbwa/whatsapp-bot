import fs from "fs";
import path from "path";

const USAGE_FILE = path.join("data", "usage.json");

function getToday() {
  return new Date().toISOString().split("T")[0]; // YYYY-MM-DD
}

function loadUsage() {
  try {
    if (!fs.existsSync(USAGE_FILE)) {
      return {};
    }
    const data = fs.readFileSync(USAGE_FILE, "utf8");
    return JSON.parse(data);
  } catch (err) {
    console.error("Error loading usage:", err);
    return {};
  }
}

function saveUsage(usage) {
  try {
    if (!fs.existsSync("data")) fs.mkdirSync("data");
    fs.writeFileSync(USAGE_FILE, JSON.stringify(usage, null, 2));
  } catch (err) {
    console.error("Error saving usage:", err);
  }
}

export function checkAndIncrementLimit(chatId, type) {
  const today = getToday();
  const usage = loadUsage();

  if (!usage[chatId]) {
    usage[chatId] = { date: today, songs: 0, videos: 0 };
  }

  const userUsage = usage[chatId];

  // Reset if date changed
  if (userUsage.date !== today) {
    userUsage.date = today;
    userUsage.songs = 0;
    userUsage.videos = 0;
  }

  const limit = type === "song" ? 5 : 3;
  const current = userUsage[type + "s"]; // songs or videos

  if (current >= limit) {
    return false; // Limit reached
  }

  userUsage[type + "s"]++;
  saveUsage(usage);
  return true;
}