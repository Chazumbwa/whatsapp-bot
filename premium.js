import fs from "fs";
import path from "path";
import { checkAndIncrementLimit } from "./rateLimit.js";

const PREMIUM_FILE = path.join("data", "premium.json");

function loadPremium() {
  try {
    if (!fs.existsSync(PREMIUM_FILE)) {
      return {};
    }
    const data = fs.readFileSync(PREMIUM_FILE, "utf8");
    return JSON.parse(data);
  } catch (err) {
    console.error("Error loading premium:", err);
    return {};
  }
}

function savePremium(premium) {
  try {
    if (!fs.existsSync("data")) fs.mkdirSync("data");
    fs.writeFileSync(PREMIUM_FILE, JSON.stringify(premium, null, 2));
  } catch (err) {
    console.error("Error saving premium:", err);
  }
}

export function isPremium(jid) {
  const premium = loadPremium();
  if (!premium[jid]) return false;

  const now = Date.now();
  if (premium[jid].expiresAt < now) {
    delete premium[jid];
    savePremium(premium);
    return false;
  }
  return true;
}

export function addPremium(jid) {
  const premium = loadPremium();
  const addedAt = Date.now();
  const expiresAt = addedAt + 30 * 24 * 60 * 60 * 1000; // 30 days
  premium[jid] = { addedAt, expiresAt };
  savePremium(premium);
}

export function checkLimitOrPremium(sender, chatId, type) {
  if (isPremium(sender)) return true;
  return checkAndIncrementLimit(chatId, type);
}