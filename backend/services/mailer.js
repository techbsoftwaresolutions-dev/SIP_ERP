// Sending email, with no new dependency.
//
// The rest of this codebase avoids adding packages where Node can already do
// the job (scrypt instead of bcrypt, for instance), and SMTP is a small enough
// protocol to speak directly. This handles the two arrangements that actually
// occur: implicit TLS on 465, and STARTTLS on 587/25.
//
// IMPORTANT: sending is best-effort by design. Every caller also receives the
// link it would have emailed, so an unconfigured or unreachable mail server
// never blocks somebody from being invited — the admin can pass the link on by
// hand. A password system that stops working because SMTP is down is worse
// than one that asks a human to copy a URL.

const net = require("net");
const tls = require("tls");

const TIMEOUT_MS = 15000;

function smtpConfigured(settings) {
  return Boolean(settings && settings.smtpHost && settings.fromEmail);
}

// Reads one SMTP reply, which may span several lines ("250-FOO" then "250 OK").
function readReply(socket) {
  return new Promise((resolve, reject) => {
    let buf = "";
    const onData = (chunk) => {
      buf += chunk.toString("utf8");
      // The final line of a reply has a space in the 4th position, not a dash.
      const lines = buf.split(/\r?\n/).filter(Boolean);
      const last = lines[lines.length - 1];
      if (!last || !/^\d{3}[ ]/.test(last)) return;
      cleanup();
      resolve({ code: Number(last.slice(0, 3)), text: buf.trim() });
    };
    const onErr = (err) => {
      cleanup();
      reject(err);
    };
    const timer = setTimeout(() => onErr(new Error("SMTP timed out")), TIMEOUT_MS);
    function cleanup() {
      clearTimeout(timer);
      socket.removeListener("data", onData);
      socket.removeListener("error", onErr);
    }
    socket.on("data", onData);
    socket.on("error", onErr);
  });
}

async function say(socket, line, expect) {
  socket.write(line + "\r\n");
  const reply = await readReply(socket);
  if (expect && !expect.includes(reply.code)) {
    throw new Error(`SMTP ${line.split(" ")[0]} failed: ${reply.text}`);
  }
  return reply;
}

function connect(host, port, secure) {
  return new Promise((resolve, reject) => {
    const socket = secure
      ? tls.connect({ host, port, servername: host }, () => resolve(socket))
      : net.connect({ host, port }, () => resolve(socket));
    socket.setTimeout(TIMEOUT_MS);
    socket.once("error", reject);
    socket.once("timeout", () => reject(new Error("SMTP connection timed out")));
  });
}

// A message body must never contain a line that is just "." — that ends the
// DATA section. The fix is as old as SMTP: double any leading dot.
const dotStuff = (body) => body.replace(/\r?\n\./g, "\r\n..");

function buildMessage({ from, to, subject, text, html }) {
  const boundary = `b${Date.now().toString(36)}`;
  const headers = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
  ];
  const body = [
    `--${boundary}`,
    "Content-Type: text/plain; charset=utf-8",
    "",
    text,
    "",
    `--${boundary}`,
    "Content-Type: text/html; charset=utf-8",
    "",
    html,
    "",
    `--${boundary}--`,
    "",
  ];
  return dotStuff([...headers, ...body].join("\r\n"));
}

// Returns { sent: true } or { sent: false, error }. Never throws — see the
// note at the top about sending being best-effort.
async function sendMail(settings, { to, subject, text, html }) {
  if (!smtpConfigured(settings)) {
    return { sent: false, error: "No SMTP server is configured in Settings → Email." };
  }
  const host = String(settings.smtpHost).trim();
  const port = Number(settings.smtpPort) || 587;
  const from = String(settings.fromEmail).trim();
  const user = String(settings.smtpUser || "").trim();
  const pass = String(settings.smtpPassword || "");

  let socket;
  try {
    // 465 is implicit TLS; everything else starts plain and upgrades.
    socket = await connect(host, port, port === 465);
    await readReply(socket); // server greeting

    const ehlo = await say(socket, `EHLO ${from.split("@")[1] || "localhost"}`, [250]);

    if (port !== 465 && /STARTTLS/i.test(ehlo.text)) {
      await say(socket, "STARTTLS", [220]);
      const plain = socket;
      socket = await new Promise((resolve, reject) => {
        const upgraded = tls.connect({ socket: plain, servername: host }, () => resolve(upgraded));
        upgraded.once("error", reject);
      });
      await say(socket, `EHLO ${from.split("@")[1] || "localhost"}`, [250]);
    }

    if (user) {
      await say(socket, "AUTH LOGIN", [334]);
      await say(socket, Buffer.from(user).toString("base64"), [334]);
      await say(socket, Buffer.from(pass).toString("base64"), [235]);
    }

    await say(socket, `MAIL FROM:<${from}>`, [250]);
    await say(socket, `RCPT TO:<${to}>`, [250, 251]);
    await say(socket, "DATA", [354]);
    socket.write(buildMessage({ from, to, subject, text, html }) + "\r\n.\r\n");
    const done = await readReply(socket);
    if (done.code !== 250) throw new Error(`SMTP refused the message: ${done.text}`);
    await say(socket, "QUIT");
    socket.end();
    return { sent: true };
  } catch (err) {
    try {
      if (socket) socket.destroy();
    } catch (_) {
      /* already gone */
    }
    return { sent: false, error: err.message };
  }
}

// ---- the one message this system actually sends --------------------------

function setPasswordEmail({ name, companyName, link, purpose, expiresHours }) {
  const isReset = purpose === "reset";
  const who = companyName || "your SIPERP account";
  const subject = isReset ? `Reset your ${who} password` : `Set up your ${who} account`;
  const lead = isReset
    ? "Someone asked to reset your password. If that was not you, you can ignore this email — nothing has changed yet."
    : `An account has been created for you on ${who}. Choose a password to finish setting it up.`;
  const text = [
    `Hello ${name || "there"},`,
    "",
    lead,
    "",
    link,
    "",
    `This link works once and expires in ${expiresHours} hours.`,
  ].join("\n");
  const html = [
    `<p>Hello ${escapeHtml(name || "there")},</p>`,
    `<p>${escapeHtml(lead)}</p>`,
    `<p><a href="${escapeHtml(link)}" style="display:inline-block;padding:10px 18px;background:#2563eb;color:#fff;border-radius:8px;text-decoration:none">`,
    isReset ? "Reset password" : "Set password",
    "</a></p>",
    `<p style="color:#6b7280;font-size:13px">Or paste this into your browser:<br>${escapeHtml(link)}</p>`,
    `<p style="color:#6b7280;font-size:13px">This link works once and expires in ${expiresHours} hours.</p>`,
  ].join("");
  return { subject, text, html };
}

function escapeHtml(s) {
  return String(s || "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[c]);
}

module.exports = { sendMail, smtpConfigured, setPasswordEmail };
