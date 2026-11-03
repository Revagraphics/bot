const express = require('express');
const mongoose = require('mongoose');
const Intent = require('../model/Intent');
const Product = require('../model/Product');
const UnansweredQuery = require('../model/UnansweredQuery');
const deps = require('../deps');
const { answerProductQuestion } = require('../products');

// All routes here are mounted behind adminAuth (see routes/api.js)
const router = express.Router();

const RESERVED_INTENTS = ['none']; // node-nlp uses "None" internally

// ----------------------
// Helpers
// ----------------------
function validateIntentPayload(payload, { partial = false } = {}) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { error: 'Request body must be a JSON object' };
  }

  const allowedFields = ['intent', 'utterances', 'answers'];
  const unknownFields = Object.keys(payload).filter(key => !allowedFields.includes(key));
  if (unknownFields.length > 0) {
    return { error: `Unknown field(s): ${unknownFields.join(', ')}` };
  }
  if (partial && Object.keys(payload).length === 0) {
    return { error: 'At least one field must be provided' };
  }

  const normalized = {};
  for (const field of allowedFields) {
    if (!(field in payload)) {
      if (!partial) return { error: `${field} is required` };
      continue;
    }

    const value = payload[field];
    if (field === 'intent') {
      if (typeof value !== 'string' || !value.trim()) {
        return { error: 'intent must be a non-empty string' };
      }
      if (RESERVED_INTENTS.includes(value.trim().toLowerCase())) {
        return { error: `"${value.trim()}" is a reserved intent name` };
      }
      normalized.intent = value.trim();
      continue;
    }

    if (!Array.isArray(value) || value.length === 0
      || value.some(item => typeof item !== 'string' || !item.trim())) {
      return { error: `${field} must be a non-empty array of non-empty strings` };
    }
    normalized[field] = value.map(item => item.trim());
  }

  return { value: normalized };
}

function validateProductPayload(payload, { partial = false } = {}) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { error: 'Request body must be a JSON object' };
  }

  const allowedFields = ['name', 'code', 'price', 'currency', 'category', 'description', 'imageUrl'];
  const unknownFields = Object.keys(payload).filter(key => !allowedFields.includes(key));
  if (unknownFields.length > 0) {
    return { error: `Unknown field(s): ${unknownFields.join(', ')}` };
  }
  if (partial && Object.keys(payload).length === 0) {
    return { error: 'At least one field must be provided' };
  }

  const normalized = {};
  for (const field of allowedFields) {
    if (!(field in payload)) {
      if (!partial && ['name', 'code', 'price', 'currency', 'description'].includes(field)) {
        return { error: `${field} is required` };
      }
      continue;
    }

    const value = payload[field];
    if (field === 'price') {
      if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
        return { error: 'price must be a number greater than or equal to 0' };
      }
      normalized.price = value;
      continue;
    }

    if (typeof value !== 'string' || (!['category', 'imageUrl'].includes(field) && !value.trim())) {
      return { error: `${field} must be a non-empty string` };
    }
    const trimmed = value.trim();
    if (field === 'imageUrl' && trimmed && !/^https?:\/\/\S+$/i.test(trimmed)) {
      return { error: 'imageUrl must be an http or https URL' };
    }
    normalized[field] = field === 'currency' ? trimmed.toUpperCase() : trimmed;
  }

  if (normalized.currency && !/^[A-Z]{3}$/.test(normalized.currency)) {
    return { error: 'currency must be a three-letter currency code' };
  }

  return { value: normalized };
}

function sendAdminError(res, error) {
  if (error.code === 11000) {
    const duplicateField = Object.keys(error.keyPattern || {})[0];
    const duplicateLabel = duplicateField === 'code'
      ? 'product code'
      : duplicateField === 'intent'
        ? 'intent name'
        : 'record with this unique value';
    return res.status(409).json({ error: `A ${duplicateLabel} already exists` });
  }
  if (error.name === 'ValidationError' || error.name === 'CastError') {
    return res.status(400).json({ error: error.message });
  }
  console.error('Admin request failed:', error.message);
  return res.status(500).json({ error: 'Unable to complete the admin request' });
}

function requireValidId(req, res, next) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ error: 'id must be a valid MongoDB ObjectId' });
  }
  next();
}

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ----------------------
// Intents (CRUD)
// ----------------------

router.get('/products', async (req, res) => {
  try {
    const products = await Product.find({}).sort({ name: 1 });
    return res.json({ count: products.length, products });
  } catch (error) {
    return sendAdminError(res, error);
  }
});

router.post('/products', async (req, res) => {
  const validation = validateProductPayload(req.body);
  if (validation.error) return res.status(400).json({ error: validation.error });

  try {
    const product = await Product.create(validation.value);
    return res.status(201).json({ message: 'Product added successfully', product });
  } catch (error) {
    return sendAdminError(res, error);
  }
});

router.put('/products/:id', requireValidId, async (req, res) => {
  const validation = validateProductPayload(req.body);
  if (validation.error) return res.status(400).json({ error: validation.error });

  try {
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { $set: validation.value },
      { new: true, runValidators: true }
    );
    if (!product) return res.status(404).json({ error: 'Product not found' });
    return res.json({ message: 'Product updated successfully', product });
  } catch (error) {
    return sendAdminError(res, error);
  }
});

router.delete('/products/:id', requireValidId, async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    return res.json({ message: 'Product deleted successfully', product });
  } catch (error) {
    return sendAdminError(res, error);
  }
});

// GET /api/admin/intents?q=price&page=1&limit=20
router.get('/intents', async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);

    const filter = {};
    if (typeof req.query.q === 'string' && req.query.q.trim()) {
      const regex = new RegExp(escapeRegex(req.query.q.trim()), 'i');
      filter.$or = [{ intent: regex }, { utterances: regex }, { answers: regex }];
    }

    const [total, intents] = await Promise.all([
      Intent.countDocuments(filter),
      Intent.find(filter).sort({ intent: 1 }).skip((page - 1) * limit).limit(limit)
    ]);

    return res.json({ total, page, limit, pages: Math.ceil(total / limit), intents });
  } catch (error) {
    return sendAdminError(res, error);
  }
});

router.get('/intents/:id', requireValidId, async (req, res) => {
  try {
    const intent = await Intent.findById(req.params.id);
    if (!intent) return res.status(404).json({ error: 'Intent not found' });
    return res.json({ intent });
  } catch (error) {
    return sendAdminError(res, error);
  }
});

async function createIntent(req, res) {
  const validation = validateIntentPayload(req.body);
  if (validation.error) return res.status(400).json({ error: validation.error });

  try {
    const intent = await Intent.create(validation.value);
    await deps.trainBotFromDB();
    return res.status(201).json({ message: 'Intent created and bot retrained', intent });
  } catch (error) {
    return sendAdminError(res, error);
  }
}

async function updateIntent(req, res) {
  const validation = validateIntentPayload(req.body, { partial: req.method === 'PATCH' });
  if (validation.error) return res.status(400).json({ error: validation.error });

  try {
    const intent = await Intent.findByIdAndUpdate(
      req.params.id,
      { $set: validation.value },
      { new: true, runValidators: true }
    );
    if (!intent) return res.status(404).json({ error: 'Intent not found' });

    await deps.trainBotFromDB();
    return res.json({ message: 'Intent updated and bot retrained', intent });
  } catch (error) {
    return sendAdminError(res, error);
  }
}

router.post('/intents', createIntent);
router.post('/intent', createIntent); // alias kept for backward compatibility
router.put('/intents/:id', requireValidId, updateIntent);
router.patch('/intents/:id', requireValidId, updateIntent);

router.delete('/intents/:id', requireValidId, async (req, res) => {
  try {
    const intent = await Intent.findByIdAndDelete(req.params.id);
    if (!intent) return res.status(404).json({ error: 'Intent not found' });

    await deps.trainBotFromDB();
    return res.json({ message: 'Intent deleted and bot retrained', intent });
  } catch (error) {
    return sendAdminError(res, error);
  }
});

// ----------------------
// Bot tools
// ----------------------

// POST /api/admin/retrain -> retrain manually from the database
router.post('/retrain', async (req, res) => {
  try {
    await deps.trainBotFromDB();
    return res.json({ message: 'Bot retrained from database' });
  } catch (error) {
    return sendAdminError(res, error);
  }
});

// POST /api/admin/test { "message": "..." } -> see how the bot would answer (no logging)
router.post('/test', async (req, res) => {
  const message = req.body && req.body.message;
  if (typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: 'message must be a non-empty string' });
  }

  try {
    const catalog = await Product.find({}).lean();
    const productAnswer = answerProductQuestion(message.trim(), catalog);
    if (productAnswer) {
      return res.json({
        answer: productAnswer,
        intent: 'product.catalog',
        score: 1,
        topMatches: []
      });
    }

    if (!deps.hasTrainingData()) {
      return res.status(503).json({ error: 'No intents are configured yet' });
    }

    const result = await deps.manager().process('en', message.trim());
    return res.json({
      answer: result.answer || null,
      intent: result.intent,
      score: result.score,
      topMatches: (result.classifications || []).slice(0, 3)
    });
  } catch (error) {
    return sendAdminError(res, error);
  }
});

// ----------------------
// Unanswered questions
// ----------------------

// GET /api/admin/unanswered -> most-asked first
router.get('/unanswered', async (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200);
    const items = await UnansweredQuery.find({}).sort({ count: -1, lastAskedAt: -1 }).limit(limit);
    return res.json({ count: items.length, items });
  } catch (error) {
    return sendAdminError(res, error);
  }
});

// DELETE /api/admin/unanswered/:id -> dismiss after you've handled it
router.delete('/unanswered/:id', requireValidId, async (req, res) => {
  try {
    const item = await UnansweredQuery.findByIdAndDelete(req.params.id);
    if (!item) return res.status(404).json({ error: 'Item not found' });
    return res.json({ message: 'Removed', item });
  } catch (error) {
    return sendAdminError(res, error);
  }
});

module.exports = router;
