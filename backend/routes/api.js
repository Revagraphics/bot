const express = require('express');
const adminAuth = require('../middleware/adminAuth');
const deps = require('../deps');
const chatRoutes = require('./chat');
const adminRoutes = require('./admin');
const Product = require('../model/Product');

const router = express.Router();

function initChatbotDeps(injected) {
  Object.assign(deps, injected);
}

router.get('/health', (req, res) => res.json({ status: 'ok' }));
router.get('/products', async (req, res) => {
  try {
    const products = await Product.find({}).sort({ name: 1 });
    return res.json({ count: products.length, products });
  } catch (error) {
    console.error('Product catalog request failed:', error.message);
    return res.status(500).json({ error: 'Unable to load the product catalog' });
  }
});
router.use('/chat', chatRoutes);
router.use('/admin', adminAuth, adminRoutes);

module.exports = { router, initChatbotDeps };
