// Creates the indexes the schemas declare, on every database that exists.
//
// Mongoose used to do this on every boot (autoIndex), which also created a
// collection per model per tenant and drove the cluster into Atlas's
// 500-collection limit. It is off now — see the note in ../db.js — so index
// creation is this script's job instead.
//
// Run it:
//   * after any schema change that adds, removes or alters an index
//   * after adding a client, if you want their indexes built up front rather
//     than on first write
//
//   npm run sync-indexes            # every database in the registry
//   npm run sync-indexes -- samagra # one client, by subdomain
//
// Safe to run repeatedly: syncIndexes() creates what is missing and drops
// indexes the schema no longer declares. It does NOT touch documents.
//
// Deliberately only touches databases that ALREADY EXIST. Building indexes on
// a client who has never written anything would recreate exactly the empty
// collections this change exists to avoid.

require("dotenv").config();
const mongoose = require("mongoose");
const { connectDB } = require("../config/db");
const defaultModels = require("../models/index");
const { MASTER_DB_NAME, DEFAULT_DB_NAME } = require("../tenancy/tenantModels");

const only = process.argv[2];

async function syncDatabase(dbName, label) {
  const conn = mongoose.connection.useDb(dbName, { useCache: true });
  const existing = new Set((await conn.db.listCollections().toArray()).map((c) => c.name));

  let synced = 0;
  let skipped = 0;
  for (const [name, model] of Object.entries(defaultModels)) {
    const bound = conn.models[name] || conn.model(name, model.schema);
    // Only for collections that already hold something. Syncing a collection
    // that does not exist would create it, which is the whole problem.
    if (!existing.has(bound.collection.name)) {
      skipped++;
      continue;
    }
    try {
      await bound.syncIndexes();
      synced++;
    } catch (err) {
      console.error(`    ! ${name}: ${err.message}`);
    }
  }
  console.log(`  ${label.padEnd(30)} ${synced} synced, ${skipped} not yet created`);
}

(async () => {
  await connectDB();

  const Tenant = mongoose.connection
    .useDb(MASTER_DB_NAME, { useCache: true })
    .collection("tenants");
  const tenants = await Tenant.find({}).toArray();

  const targets = [];
  if (!only) {
    // The fallback database first — it is what an unrecognised subdomain and
    // local development both land on, so it is easy to forget.
    targets.push({ db: DEFAULT_DB_NAME, label: `${DEFAULT_DB_NAME} (fallback)` });
    for (const t of tenants) targets.push({ db: t.databaseName, label: `${t.databaseName} (${t.subdomain})` });
  } else {
    const t = tenants.find((x) => x.subdomain === only || x.databaseName === only);
    if (!t) {
      console.error(`No client matches "${only}". Known: ${tenants.map((x) => x.subdomain).join(", ")}`);
      process.exit(1);
    }
    targets.push({ db: t.databaseName, label: `${t.databaseName} (${t.subdomain})` });
  }

  // De-duplicate: two subdomains can legitimately point at one database.
  const seen = new Set();
  console.log(`Syncing indexes across ${targets.length} database(s)\n`);
  for (const target of targets) {
    if (seen.has(target.db)) continue;
    seen.add(target.db);
    await syncDatabase(target.db, target.label);
  }

  console.log("\nDone. Collections that do not exist yet were skipped — their");
  console.log("indexes are built the first time something is written to them.");
  await mongoose.disconnect();
})().catch((err) => {
  console.error("sync-indexes failed:", err.message);
  process.exit(1);
});
