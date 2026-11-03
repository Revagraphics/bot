const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

dotenv.config({ path: path.resolve(__dirname, '..', 'bot.env') });

async function connectToDatabase() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error('MONGODB_URI is not configured in the environment or backend/bot.env');
  }

  return mongoose.connect(uri);
}

module.exports = connectToDatabase;
