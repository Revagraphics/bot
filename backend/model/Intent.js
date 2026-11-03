const mongoose = require('mongoose');

const intentSchema = new mongoose.Schema({
  intent: {
    type: String,
    required: true, 
    unique: true,
    trim: true
  },
  utterances: {
    type: [{ type: String, trim: true }],
    required: true,
    validate: {
      validator: values => values.length > 0 && values.every(value => value.length > 0),
      message: 'utterances must contain at least one non-empty string'
    }
  },
  answers: {
    type: [{ type: String, trim: true }],
    required: true,
    validate: {
      validator: values => values.length > 0 && values.every(value => value.length > 0),
      message: 'answers must contain at least one non-empty string'
    }
  }
});

module.exports = mongoose.model('Intent', intentSchema);