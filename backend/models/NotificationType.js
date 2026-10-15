const { mongoose, baseOptions } = require("./_shared");

// Which notifications the bell raises, platform-wide. Master database.
//
// The reminders themselves are computed live from each client's own data (see
// ../reminders.js) — this collection only decides which of them are switched
// on and how far ahead each one starts warning. A row here is an OVERRIDE: a
// type with no row is on, using the client's own reminderDueSoonDays setting,
// which is how the bell behaved before this existed.
const notificationTypeSchema = new mongoose.Schema(
  {
    // A key from TYPES in ../notificationCatalogue.js. The reminder builder
    // produces these types in code, so a row for an unknown key does nothing.
    key: { type: String, required: true, unique: true },
    label: { type: String, default: "" },
    description: { type: String, default: "" },

    // Off takes this notification away from every client at once. Their data
    // is untouched — an overdue invoice is still overdue, it just stops
    // shouting from the bell.
    enabled: { type: Boolean, default: true },

    // How many days ahead counts as "due soon" for THIS type. null defers to
    // the client's own setting, so per-type lead times are opt-in.
    leadDays: { type: Number, default: null },

    order: { type: Number, default: 0 },
  },
  baseOptions
);

module.exports = { schema: notificationTypeSchema };
