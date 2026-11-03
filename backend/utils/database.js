const path = require('path');
const dotenv = require('dotenv');
const dns = require('dns');
const mongoose = require('mongoose');

dotenv.config({ path: path.resolve(__dirname, '..', 'bot.env') });

const dnsServers = process.env.DNS_SERVERS
  ?.split(',')
  .map(server => server.trim())
  .filter(Boolean);

if (dnsServers?.length) {
  dns.setServers(dnsServers);
}

async function connectToDatabase() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error('MONGODB_URI is missing from backend/bot.env');
  }

  return mongoose.connect(uri);
}

module.exports = connectToDatabase;
