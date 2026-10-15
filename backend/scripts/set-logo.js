// One-time helper: pushes scripts/assets/company-logo.png into the
// Settings.logo field as a base64 data URL, so it shows up as the company
// logo across the app (sidebar, invoices, login, etc.) without needing to
// use the Settings > Company Settings upload form manually.
//
// Run once from the backend/ folder:
//   node scripts/set-logo.js
//
// Needs network access to the MongoDB Atlas cluster configured in .env.
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");

const envPath = path.join(__dirname, "..", ".env");
const envContent = fs.readFileSync(envPath, "utf8");
const match = envContent.match(/^MONGODB_URI=(.+)$/m);
const uri = match[1].trim();

const IMG_PATH = path.join(__dirname, "assets", "company-logo-trimmed.png");

async function main() {
  const buf = fs.readFileSync(IMG_PATH);
  const dataUrl = `data:image/png;base64,${buf.toString("base64")}`;

  await mongoose.connect(uri);
  const Settings = mongoose.model("Settings", new mongoose.Schema({}, { strict: false, collection: "settings" }));
  const result = await Settings.findOneAndUpdate({}, { $set: { logo: dataUrl } }, { new: true, upsert: true });
  console.log("Logo updated. Settings id:", result._id.toString());
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
