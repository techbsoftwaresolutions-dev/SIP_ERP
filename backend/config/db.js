require("dotenv").config();
const mongoose = require("mongoose");

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/siperp_crm";

async function connectDB() {
  mongoose.set("strictQuery", true);
  // GLOBAL, not just on the connect() options below: every tenant database
  // is a separate Connection made with connection.useDb(), and those do NOT
  // inherit autoIndex from the parent. Setting it only in connect() left each
  // tenant still creating all ~34 collections on bind — which looked fixed
  // and was not.
  mongoose.set("autoIndex", false);
  await mongoose.connect(MONGODB_URI, {
    serverSelectionTimeoutMS: 8000,
    // One shared pool for the whole process (all tenant DBs reuse it via
    // connection.useDb) — keep a few sockets warm so requests don't pay
    // connection setup, and allow enough headroom for concurrent load.
    maxPoolSize: 50,
    minPoolSize: 5,
    socketTimeoutMS: 45000,

    // Do NOT create indexes (and therefore collections) automatically.
    //
    // Every tenant binds all ~34 models, and with autoIndex on Mongoose
    // creates a collection for each one just to build its indexes — even for
    // a client who has never opened Manufacturing. At four clients that is
    // 136 collections; at 200 it would be 6,800, against an Atlas limit of
    // 500. That ceiling is not theoretical: it was reached during testing and
    // writes began failing with "already using 525 collections of 500".
    //
    // With this off, a collection appears the first time something is written
    // to it, and index creation becomes a deliberate step:
    //     npm run sync-indexes
    // Run that after any schema change that adds or alters an index.
    autoIndex: false,
  });
  console.log("MongoDB connected");
}

module.exports = { connectDB, MONGODB_URI };
