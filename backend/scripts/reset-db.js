// Empties every collection — no demo/sample data is inserted.
//
//   npm run reset                 -> clears the database MONGODB_URI points at
//   npm run reset -- --db=NAME    -> clears that database on the same cluster
//   npm run reset -- --list       -> lists the databases and their doc counts
//
// Use this to wipe a tenant and start completely clean. It refuses to run
// without --yes so a stray command can't empty a live client's data.
require("dotenv").config();
const mongoose = require("mongoose");
const readline = require("readline");
const { connectDB, MONGODB_URI } = require("../config/db");
const models = require("../models/index");

const SYSTEM_DBS = ["admin", "local", "config"];

function arg(name) {
  const hit = process.argv.slice(2).find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (!hit) return null;
  const i = hit.indexOf("=");
  return i === -1 ? true : hit.slice(i + 1);
}

// The database MONGODB_URI names, i.e. what this script clears by default.
function uriDbName() {
  const match = (MONGODB_URI || "").match(/^mongodb(?:\+srv)?:\/\/[^/?]+\/([^?]*)/);
  return (match && match[1]) || "siperp_crm";
}

async function listDatabases() {
  const { databases } = await mongoose.connection.db.admin().listDatabases();
  console.log("\nDatabases on this cluster:\n");
  for (const d of databases) {
    if (SYSTEM_DBS.includes(d.name)) continue;
    const conn = mongoose.connection.useDb(d.name, { useCache: true });
    const cols = await conn.db.listCollections().toArray();
    let docs = 0;
    for (const c of cols) docs += await conn.db.collection(c.name).countDocuments();
    console.log(`  ${d.name.padEnd(24)} ${String(cols.length).padStart(3)} collections  ${String(docs).padStart(6)} docs`);
  }
  console.log("");
}

// Asks on the terminal unless --yes was passed. Returns true to proceed.
function confirm(question) {
  if (arg("yes")) return Promise.resolve(true);
  if (!process.stdin.isTTY) {
    console.error("Refusing to clear a database non-interactively. Re-run with --yes if you are sure.");
    return Promise.resolve(false);
  }
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() === "yes");
    });
  });
}

async function reset() {
  await connectDB();

  if (arg("list")) {
    await listDatabases();
    await mongoose.disconnect();
    return;
  }

  const target = arg("db") || uriDbName();
  if (SYSTEM_DBS.includes(target)) throw new Error(`Refusing to touch the system database "${target}".`);

  // Bind every model onto the target database, the same way a tenant request
  // does (see tenantModels.js), so --db can clear any client's data.
  const conn = mongoose.connection.useDb(target, { useCache: true });
  const bound = Object.entries(models).map(([name, model]) => [
    name,
    conn.models[name] || conn.model(name, model.schema),
  ]);

  const counts = await Promise.all(bound.map(async ([name, M]) => [name, await M.countDocuments()]));
  const populated = counts.filter(([, n]) => n > 0);
  const total = counts.reduce((a, [, n]) => a + n, 0);

  console.log(`\nTarget database: ${target}`);
  if (total === 0) {
    console.log("Already empty — nothing to do.\n");
    await mongoose.disconnect();
    return;
  }
  console.log(`${total} document(s) across ${populated.length} collection(s):`);
  populated.forEach(([name, n]) => console.log(`  ${name.padEnd(22)} ${n}`));

  const ok = await confirm(`\nThis permanently deletes all of it. Type "yes" to continue: `);
  if (!ok) {
    console.log("Aborted — nothing was deleted.\n");
    await mongoose.disconnect();
    return;
  }

  await Promise.all(bound.map(([, M]) => M.deleteMany({})));
  console.log(`\nDone — "${target}" is empty. Settings re-creates itself with blank defaults on next load.\n`);
  await mongoose.disconnect();
}

reset().catch(async (err) => {
  console.error("Reset failed:", err.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
