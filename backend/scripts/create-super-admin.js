// Creates (or updates) a platform super-admin account in master_db.
//
//   npm run create-admin -- --email=you@techb.com --password=... --name="Your Name" --role=owner
//   npm run create-admin -- --list
//
// The very first account must be created this way — there is deliberately no
// self-service sign-up for the control plane, and no default credentials
// baked into the code. Re-running for an existing email resets that account's
// password, which is also the recovery path if one is lost.
require("dotenv").config();
const mongoose = require("mongoose");
const { connectDB } = require("../config/db");
const { getSuperAdminModel } = require("../tenancy/tenantModels");
const { hashPassword } = require("../auth/superAdminAuth");

function arg(name) {
  const hit = process.argv.slice(2).find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (!hit) return null;
  const i = hit.indexOf("=");
  return i === -1 ? true : hit.slice(i + 1);
}

async function main() {
  await connectDB();
  const SuperAdmin = getSuperAdminModel();

  if (arg("list")) {
    const rows = await SuperAdmin.find().sort({ createdAt: 1 }).lean();
    if (rows.length === 0) {
      console.log("\nNo super admins yet. Create one with:");
      console.log('  npm run create-admin -- --email=you@example.com --password=... --name="Your Name" --role=owner\n');
    } else {
      console.log(`\n${rows.length} super admin(s):\n`);
      rows.forEach((r) =>
        console.log(
          `  ${r.email.padEnd(32)} ${String(r.role).padEnd(9)} ${r.status.padEnd(9)} ` +
            `last login: ${r.lastLoginAt ? new Date(r.lastLoginAt).toISOString().slice(0, 16).replace("T", " ") : "never"}`
        )
      );
      console.log("");
    }
    await mongoose.disconnect();
    return;
  }

  const email = String(arg("email") || "").trim().toLowerCase();
  const password = String(arg("password") || "");
  const name = String(arg("name") || "").trim();
  const role = arg("role") === "operator" ? "operator" : "owner";

  if (!email || !password) {
    console.error("\nBoth --email and --password are required.");
    console.error('  npm run create-admin -- --email=you@example.com --password=... --name="Your Name"\n');
    process.exitCode = 1;
    await mongoose.disconnect();
    return;
  }
  if (password.length < 10) {
    console.error("\nPassword must be at least 10 characters — this account can reach every client's data.\n");
    process.exitCode = 1;
    await mongoose.disconnect();
    return;
  }

  const existing = await SuperAdmin.findOne({ email });
  if (existing) {
    existing.passwordHash = hashPassword(password);
    if (name) existing.name = name;
    existing.status = "active";
    await existing.save();
    console.log(`\nPassword reset for existing super admin: ${email} (${existing.role})\n`);
  } else {
    const created = await SuperAdmin.create({
      name: name || email.split("@")[0],
      email,
      passwordHash: hashPassword(password),
      role,
    });
    console.log(`\nSuper admin created: ${created.email} (${created.role})`);
    console.log("Sign in at /admin/login\n");
  }

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error("Failed:", err.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
