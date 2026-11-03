const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  code: { type: String, required: true, unique: true, trim: true, uppercase: true, maxlength: 40 },
  price: { type: Number, required: true, min: 0 },
  currency: {
    type: String,
    required: true,
    trim: true,
    uppercase: true,
    match: /^[A-Z]{3}$/
  },
  category: { type: String, default: 'Other', trim: true, maxlength: 60 },
  description: { type: String, required: true, trim: true, maxlength: 2000 },
  imageUrl: {
    type: String,
    trim: true,
    validate: {
      validator: value => !value || /^https?:\/\/\S+$/i.test(value),
      message: 'imageUrl must be an http or https URL'
    }
  }
}, { timestamps: true });

module.exports = mongoose.model('Product', productSchema);
