// Slows down password guessing on the sign-in endpoints.
//
// A failed attempt (the handler answers 401/403) is counted against two keys:
// this IP + this account, and this IP alone. Once either passes its limit the
// next attempts are refused with 429 until the window passes. A successful
// sign-in clears the account counter, so a person who mistypes twice and then
// gets in is never affected.
//
// Counted per IP+account rather than per account alone on purpose: otherwise
// anyone could lock a real user out just by guessing at their address.
//
// In memory, so it resets on a restart and is per server process — good enough
// to make brute-forcing impractical on a single-instance deployment; a
// multi-instance deployment would need a shared store.

const WINDOW_MS = 15 * 60 * 1000;
const buckets = new Map(); // key -> { count, first }

const cleanup = setInterval(() => {
  const now = Date.now();
  for (const [k, b] of buckets) if (now - b.first >= WINDOW_MS) buckets.delete(k);
}, 5 * 60 * 1000);
if (cleanup.unref) cleanup.unref();

function isBlocked(key, max) {
  const b = buckets.get(key);
  return Boolean(b) && Date.now() - b.first < WINDOW_MS && b.count >= max;
}

function bump(key) {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || now - b.first >= WINDOW_MS) buckets.set(key, { count: 1, first: now });
  else b.count += 1;
}

// keyFor(req) names the account being signed in to (e.g. "acme|jane@x.com").
function loginThrottle({ keyFor, maxPerAccount = 8, maxPerIp = 60 }) {
  return (req, res, next) => {
    const ip = String(req.ip || "").replace(/^::ffff:/, "") || "unknown";
    const accountKey = `acct|${ip}|${String(keyFor(req) || "").toLowerCase()}`;
    const ipKey = `ip|${ip}`;

    if (isBlocked(accountKey, maxPerAccount) || isBlocked(ipKey, maxPerIp)) {
      const b = buckets.get(accountKey) || buckets.get(ipKey);
      const wait = Math.max(Math.ceil((WINDOW_MS - (Date.now() - b.first)) / 1000), 1);
      res.set("Retry-After", String(wait));
      return res.status(429).json({
        success: false,
        message: "Too many failed sign-in attempts. Please wait a few minutes and try again.",
      });
    }

    res.on("finish", () => {
      if (res.statusCode === 401 || res.statusCode === 403) {
        bump(accountKey);
        bump(ipKey);
      } else if (res.statusCode < 400) {
        buckets.delete(accountKey);
      }
    });
    next();
  };
}

// A plain "no more than max requests per window" cap, for endpoints that cost
// money or CPU per call (the AI assistant spends the platform's API credit).
// keyFor(req) decides who shares a budget — e.g. a whole client.
const usage = new Map(); // key -> { count, first }
function requestLimit({ keyFor, max = 60, windowMs = 10 * 60 * 1000, message }) {
  return (req, res, next) => {
    const key = String(keyFor(req) || "anon");
    const now = Date.now();
    let u = usage.get(key);
    if (!u || now - u.first >= windowMs) {
      u = { count: 0, first: now };
      usage.set(key, u);
    }
    u.count += 1;
    if (u.count > max) {
      res.set("Retry-After", String(Math.max(Math.ceil((windowMs - (now - u.first)) / 1000), 1)));
      return res.status(429).json({ message: message || "Too many requests. Please slow down and try again shortly." });
    }
    next();
  };
}

module.exports = { loginThrottle, requestLimit };
