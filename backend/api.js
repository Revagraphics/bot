const express = require('express');
const adminAuth = require('../middleware/adminAuth');
const deps = require('./deps');
const chatRoutes = require('./chat');
const adminRoutes = require('./admin');

const router = express.Router();

// Called from server.js (unchanged signature)
function initChatbotDeps(injected) {
  Object.assign(deps, injected);
}

// Public
router.get('/health', (req, res) => res.json({ status: 'ok' }));
router.use('/chat', chatRoutes);

// Protected: every /api/admin/* route requires username + password
router.use('/admin', adminAuth, adminRoutes);

module.exports = { router, initChatbotDeps };
