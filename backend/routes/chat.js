const express = require('express');
const UnansweredQuery = require('../model/UnansweredQuery');
const Product = require('../model/Product');
const deps = require('../deps');
const { answerProductQuestion, getProductsForQuestion } = require('../products');

const router = express.Router();

const MAX_MESSAGE_LENGTH = 500;
const FALLBACK_ANSWER = "I couldn't understand that. Please call our team at 8368769364 for assistance.";

async function logUnanswered(message) {
  const key = message.toLowerCase();
  await UnansweredQuery.findOneAndUpdate(
    { key },
    { $setOnInsert: { message, key }, $inc: { count: 1 }, $set: { lastAskedAt: new Date() } },
    { upsert: true }
  );
}

// POST /api/chat  -> public, used by the website
router.post('/', async (req, res) => {
  const userMessage = req.body && req.body.message;

  if (typeof userMessage !== 'string' || !userMessage.trim()) {
    return res.status(400).json({ error: 'Message is required and must be a non-empty string' });
  }
  if (userMessage.length > MAX_MESSAGE_LENGTH) {
    return res.status(400).json({ error: `Message must be at most ${MAX_MESSAGE_LENGTH} characters` });
  }

  try {
    const catalog = await Product.find({}).lean();
    const productAnswer = answerProductQuestion(userMessage.trim(), catalog);
    if (productAnswer) {
      return res.json({
        answer: productAnswer,
        intent: 'product.catalog',
        score: 1,
        products: getProductsForQuestion(userMessage.trim(), catalog)
      });
    }

    if (!deps.hasTrainingData()) {
      return res.status(503).json({ error: 'No intents are configured yet' });
    }

    const originalMessage = userMessage.trim();
    const words = originalMessage.match(/[\p{L}\p{N}']+|[^\p{L}\p{N}']+/gu) || [];
    const correctedMessage = words
      .map(part => /^[\p{L}\p{N}']+$/u.test(part)
        ? deps.spellCheck().checkToken(part.toLowerCase(), 1)
        : part)
      .join('');

    const response = await deps.manager().process('en', correctedMessage);
    const corrected = correctedMessage.toLowerCase() !== originalMessage.toLowerCase();

    // Remember questions the bot couldn't answer so admins can add responses
    if (!response.answer) {
      logUnanswered(originalMessage).catch(err =>
        console.error('Failed to log unanswered query:', err.message));
    }

    return res.json({
      answer: response.answer || FALLBACK_ANSWER,
      intent: response.intent,
      score: response.score,
      ...(corrected ? {
        suggestion: `Did you mean: "${correctedMessage}"?`,
        correctedMessage
      } : {})
    });
  } catch (error) {
    console.error('Chat request failed:', error.message);
    return res.status(500).json({ error: 'Unable to process the chat message' });
  }
});

module.exports = router;
