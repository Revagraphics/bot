const express = require('express');
const cors = require('cors');
const { NlpManager, SpellCheck } = require('node-nlp');
const Intent = require('./model/Intent');
const Product = require('./model/Product');
const SystemSetting = require('./model/SystemSetting');
const { defaultProducts } = require('./products');
const connectToDatabase = require('./utils/database');
const { router, initChatbotDeps } = require('./routes/api');

const app = express();
const allowedOrigins = [
  'http://localhost:5173',
  'https://bot-psi-ochre-62.vercel.app',
  ...(process.env.FRONTEND_URL || '').split(',')
]
  .map(origin => origin.trim().replace(/\/+$/, ''))
  .filter(Boolean);

app.use(cors({ origin: allowedOrigins }));
app.use(express.json());

// ======================
// NLP state
// ======================
let manager = new NlpManager({ languages: ['en'], forceNER: true });
let spellCheck = new SpellCheck({});
let hasTrainingData = false;

async function trainBotFromDB() {
  console.log('Fetching training data from MongoDB...');
  const intentsData = await Intent.find({});
  const nextManager = new NlpManager({ languages: ['en'], forceNER: true });
  const vocabulary = {};

  intentsData.forEach(doc => {
    doc.utterances.forEach(utterance => {
      nextManager.addDocument('en', utterance, doc.intent);
    });

    [...doc.utterances, ...doc.answers].forEach(phrase => {
      phrase.toLowerCase().match(/[\p{L}\p{N}']+/gu)?.forEach(word => {
        vocabulary[word] = (vocabulary[word] || 0) + 1;
      });
    });

    doc.answers.forEach(answer => {
      nextManager.addAnswer('en', doc.intent, answer);
    });
  });

  if (intentsData.length > 0) {
    console.log('Training bot...');
    await nextManager.train();
    nextManager.save();
    console.log('🤖 Bot is trained and ready!');
  } else {
    console.log('No intents found in the database. Add some first!');
  }

  manager = nextManager;
  spellCheck = new SpellCheck(vocabulary);
  hasTrainingData = intentsData.length > 0;
}

// Inject dependencies into the router
initChatbotDeps({
  manager: () => manager,
  spellCheck: () => spellCheck,
  hasTrainingData: () => hasTrainingData,
  trainBotFromDB
});

// Mount all API routes under /api
app.use('/api', router);

// ======================
// Start server
// ======================
async function startServer() {
  await connectToDatabase();
  console.log('✅ Connected to MongoDB');
  const catalogSeed = await SystemSetting.findOne({ key: 'default-products-seeded' });
  if (!catalogSeed) {
    const existingProducts = await Product.find({
      code: { $in: defaultProducts.map(product => product.code) }
    }).select('code').lean();
    const existingCodes = new Set(existingProducts.map(product => product.code));
    const missingProducts = defaultProducts.filter(product => !existingCodes.has(product.code));
    if (missingProducts.length > 0) {
      await Product.insertMany(missingProducts);
    }
    await SystemSetting.create({ key: 'default-products-seeded', value: 'true' });
  }
  await trainBotFromDB();

  const port = process.env.PORT || 5000;
  app.listen(port, () => {
    console.log(`🚀 Server is running on port ${port}`);
  });
}

startServer().catch(error => {
  console.error('❌ Backend startup failed:', error.message);
  process.exitCode = 1;
});