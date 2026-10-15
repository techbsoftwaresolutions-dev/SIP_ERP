// Adds any starter theme that is missing from the Theme registry (matched by
// code). Existing themes are never touched, so edits an admin has made stay,
// and it is safe to run again. A theme an admin deliberately deleted WILL come
// back if it is a starter one — delete it again, or archive it instead.
//
//   node scripts/add-starter-themes.js

require("dotenv").config();
const mongoose = require("mongoose");
const { connectDB } = require("../config/db");
const { getThemeModel } = require("../tenancy/tenantModels");
const { STARTER_THEMES } = require("../catalogues/themeCatalogue");

(async () => {
  await connectDB();
  const Theme = getThemeModel();
  const existing = new Set((await Theme.find({}, { code: 1 }).lean()).map((t) => t.code));
  const missing = STARTER_THEMES.filter((t) => !existing.has(t.code));
  if (missing.length) await Theme.insertMany(missing);
  console.log(missing.length ? `Added: ${missing.map((t) => t.name).join(", ")}` : "Nothing to add — every starter theme already exists.");
  await mongoose.disconnect();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
