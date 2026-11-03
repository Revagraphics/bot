const mongoose = require('mongoose');

// Questions the bot could not answer. Admins review these and
// turn them into new intents/responses.
const unansweredQuerySchema = new mongoose.Schema({
  message: { type: String, required: true, trim: true },
  key: { type: String, required: true, unique: true }, // lowercase version for de-duplication
  count: { type: Number, default: 1 },
  lastAskedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('UnansweredQuery', unansweredQuerySchema);
