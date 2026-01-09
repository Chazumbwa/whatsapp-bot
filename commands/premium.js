import fs from "fs";
import path from "path";
import { checkAndIncrementLimit } from "../rateLimit.js";

const PREMIUM_FILE = "/data/premium.json";
const DATA_DIR = "/data";
const adminJids = [
  "265995551995@s.whatsapp.net",
  "265890061520@s.whatsapp.net"
];

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
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
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

export function checkLimitOrPremium(sender, type) {
  // Admins are always unlimited
  if (adminJids.includes(sender)) return true;

  // Premium users are unlimited
  if (isPremium(sender)) return true;

  // Everyone else is rate-limited
  return checkAndIncrementLimit(sender, type);
}
