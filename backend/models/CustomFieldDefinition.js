const { mongoose, baseOptions } = require("./_shared");

// Lets a client add their own extra fields to a form (e.g. PAN on Customers)
// without any code change. One row per field; the entity's own document
// stores the actual value in its `customFields` map, keyed by `key`.
//
// Deleting a definition here does NOT touch data already saved under that
// key on existing records — it only stops the field appearing on the form.
// That mirrors how removing a Category/Brand elsewhere in this app leaves
// past records holding the name they were saved with.
const customFieldDefinitionSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    seq: { type: Number, required: true },
    // Which form this field shows on: "customer" | "supplier" | "item".
    entity: { type: String, required: true },
    // Machine key the value is stored under, e.g. "pan". Unique per entity,
    // enforced in the route handler (not a compound index — see sync-indexes
    // notes elsewhere in this file set for why simple fields stay un-unique
    // by default).
    key: { type: String, required: true },
    label: { type: String, required: true },
    type: { type: String, default: "text" }, // text | textarea | number | date | select
    // Only meaningful when type is "select".
    options: { type: [String], default: [] },
    required: { type: Boolean, default: false },
    order: { type: Number, default: 0 },
  },
  baseOptions
);

module.exports = mongoose.model("CustomFieldDefinition", customFieldDefinitionSchema);
