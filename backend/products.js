const defaultProducts = [
  {
    name: 'High Back Chair',
    code: 'EEZY323A',
    price: 60000,
    currency: 'INR',
    category: 'chair',
    description: 'A high-back chair designed for comfortable, supportive seating.'
  },
  {
    name: 'Executive Ergonomic Chair',
    code: 'CHR-ERG-091',
    price: 14500,
    currency: 'INR',
    category: 'chair',
    description: 'An ergonomic executive chair for everyday office use.'
  },
  {
    name: 'Solid Oak Dining Table',
    code: 'TBL-OAK-502',
    price: 32000,
    currency: 'INR',
    category: 'table',
    description: 'A solid oak dining table with a durable, classic finish.'
  },
  {
    name: '3-Seater Velvet Sofa',
    code: 'SFA-VLT-103',
    price: 48500,
    currency: 'INR',
    category: 'sofa',
    description: 'A three-seater sofa upholstered in soft velvet.'
  }
];

function normalize(value) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function formatProduct(product) {
  const price = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(product.price);
  return `${product.name} (Code: ${product.code}) - Price: ${product.currency} ${price}${product.description ? ` - ${product.description}` : ''}`;
}

function getProductsForQuestion(message, products = defaultProducts) {
  const normalizedMessage = normalize(message);
  const namedProduct = products.find(product =>
    normalizedMessage.includes(normalize(product.code))
      || normalizedMessage.includes(normalize(product.name)));

  if (namedProduct) {
    return [namedProduct];
  }

  const categoryMatch = message.match(/\b(chairs?|tables?|sofas?)\b/i);
  if (categoryMatch) {
    const category = categoryMatch[1].toLowerCase().replace(/s$/, '');
    const matchingProducts = products.filter(product => normalize(product.category || '') === category);
    if (matchingProducts.length > 0) {
      return matchingProducts;
    }
  }

  if (/\b(products?|catalog(?:ue)?|items?|furniture|prices?|rates?|sell|offer|available|buy|purchase)\b/i.test(message)) {
    return products;
  }

  return null;
}

function answerProductQuestion(message, products = defaultProducts) {
  const matchingProducts = getProductsForQuestion(message, products);
  return matchingProducts ? matchingProducts.map(formatProduct).join('\n') : null;
}

module.exports = { defaultProducts, answerProductQuestion, getProductsForQuestion };
