// const BASE_URL = `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'}/api`;
const BASE_URL = `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'}/api`;
let adminAuthorization = null;

export function setAdminCredentials(username, password) {
  const bytes = new TextEncoder().encode(`${username}:${password}`);
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  adminAuthorization = `Basic ${btoa(binary)}`;
}

export function clearAdminCredentials() {
  adminAuthorization = null;
}

async function request(endpoint, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
    ...(adminAuthorization ? { Authorization: adminAuthorization } : {}),
  };
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw {
      status: res.status,
      message: data.error || res.statusText,
      data,
    };
  }

  return data;
}

export const chatApi = {
  sendMessage: (message) =>
    request('/chat', {
      method: 'POST',
      body: JSON.stringify({ message }),
    }),
};

export const catalogApi = {
  getProducts: () => request('/products'),
};

export const intentsApi = {
  getAll: () => request('/admin/intents'),
  create: (payload) =>
    request('/admin/intents', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  update: (id, payload, method = 'PUT') =>
    request(`/admin/intents/${id}`, {
      method,
      body: JSON.stringify(payload),
    }),
  remove: (id) =>
    request(`/admin/intents/${id}`, {
      method: 'DELETE',
    }),
};

export const adminApi = {
  getProducts: () => request('/admin/products'),
  createProduct: (payload) =>
    request('/admin/products', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateProduct: (id, payload) =>
    request(`/admin/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  removeProduct: (id) =>
    request(`/admin/products/${id}`, { method: 'DELETE' }),
  getUnanswered: () => request('/admin/unanswered'),
  removeUnanswered: (id) =>
    request(`/admin/unanswered/${id}`, { method: 'DELETE' }),
  testMessage: (message) =>
    request('/admin/test', {
      method: 'POST',
      body: JSON.stringify({ message }),
    }),
  retrain: () => request('/admin/retrain', { method: 'POST' }),
};