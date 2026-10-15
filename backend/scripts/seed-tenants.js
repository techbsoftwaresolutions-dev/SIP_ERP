// Seeds (or updates) rows in the master tenant registry — the mapping from
// each client's frontend subdomain to the database their data lives in.
// Safe to re-run any time: upserts by subdomain, never duplicates or
// deletes a row. To add a new client later, add a line to TENANTS below and
// run this again — no other code change or redeploy of anything but this
// script is required.
//
// Run from backend/:
//   npm run seed-tenants
require("dotenv").config();
const mongoose = require("mongoose");
const { schema } = require("../models/Tenant");

const MASTER_DB = process.env.MASTER_DB || "master_db";

// Add a client here to register it. `subdomain` must match what that
// client's frontend sends as X-Tenant (see frontend/src/api/client.js,
// which derives it from window.location.hostname automatically).
// The new SIPERP cluster starts empty with just the main workspace. Clients are
// normally added from Super Admin -> Clients; the ones below are the clients of the
// previous cluster, kept only as a reference for migrating them later.
const TENANTS = [
  { subdomain: "crm", databaseName: "siperp_crm", companyName: "SIPERP", status: "active" },
  // { subdomain: "samagra", databaseName: "samagra_crm", companyName: "Samagra", status: "active" },
  // { subdomain: "hcl", databaseName: "hcl_crm", companyName: "HCL", status: "active" },
  // { subdomain: "rockford", databaseName: "rockford_crm", companyName: "Rockford", status: "active" },
];

// Reuses whatever cluster/credentials MONGODB_URI already has, regardless
// of which database its own path currently names — the master registry
// always lives in its own database (MASTER_DB) on that same cluster.
function baseUri(uri) {
  const match = uri.match(/^(mongodb(?:\+srv)?:\/\/[^/?]+)/);
  if (!match) throw new Error("Could not parse MONGODB_URI to connect to the master database.");
  return match[1];
}

async function run() {
  const uri = `${baseUri(process.env.MONGODB_URI)}/${MASTER_DB}?appName=SIPERP`;
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
  const Tenant = mongoose.model("Tenant", schema);

  for (const t of TENANTS) {
    await Tenant.findOneAndUpdate({ subdomain: t.subdomain }, { $set: t }, { upsert: true });
    console.log(`Upserted tenant "${t.subdomain}" -> ${t.databaseName}`);
  }

  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error("Seeding tenants failed:", err.message);
  process.exit(1);
});
