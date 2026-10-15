const mongoose = require("mongoose");

// Shared schema options for every model:
// - timestamps (createdAt/updatedAt)
// - toJSON strips Mongo's internal _id/__v so API responses keep the
//   same shape the frontend already expects (a plain "id" field).
const baseOptions = {
  // Never build indexes (and therefore never create the collection) just
  // because a model was bound. Set HERE rather than on the connection,
  // because schema options are the only level that reliably wins: every
  // tenant database is its own Connection made with useDb(), and neither the
  // connect() option nor mongoose.set("autoIndex") reaches those.
  //
  // Without this, binding models for one tenant creates all ~34 collections
  // whether or not that client uses them — which took the cluster past
  // Atlas's 500-collection limit and made writes start failing.
  //
  // Indexes are created deliberately instead: npm run sync-indexes.
  autoIndex: false,
  // And autoCreate, which is the one that actually does it. Mongoose creates
  // the collection on model compile SEPARATELY from building indexes, so
  // autoIndex: false alone still left all 34 appearing per tenant — verified
  // by binding the models against a scratch database and watching 0 become 34.
  autoCreate: false,
  timestamps: true,
  toJSON: {
    transform: (_doc, ret) => {
      delete ret._id;
      delete ret.__v;
      return ret;
    },
  },
};

module.exports = { mongoose, baseOptions };
