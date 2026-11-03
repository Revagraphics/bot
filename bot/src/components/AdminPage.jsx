import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import IntentsAdmin from './IntentsAdmin';
import ApiExplorer from './ApiExplorer';
import { adminApi, clearAdminCredentials, setAdminCredentials } from '../services/api';
import {
  Alert,
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  Icon,
  PageHeader,
  SearchInput,
  Spinner,
  TextField,
  inputCls,
  prefersReducedMotion,
} from './ProductCatalog';

const TABS = [
  { id: 'Products', label: 'Products', icon: 'products' },
  { id: 'Intents', label: 'Intents', icon: 'intents' },
  { id: 'Unanswered', label: 'Unanswered', icon: 'unanswered' },
  { id: 'Test bot', label: 'Test bot', icon: 'test' },
  { id: 'API Explorer', label: 'API Explorer', icon: 'api' },
];

/* ------------------------------------------------------------------ */
/* Brand mark                                                          */
/* ------------------------------------------------------------------ */
function Brand({ light = true }) {
  return (
    <div className="flex items-center gap-3">
      <span
        aria-hidden="true"
        className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-500 text-base font-bold text-slate-950"
      >
        E
      </span>
      <div className="leading-tight">
        <p className={`text-sm font-semibold ${light ? 'text-white' : 'text-slate-900'}`}>Eezy-Office</p>
        <p className={`text-xs ${light ? 'text-slate-400' : 'text-slate-500'}`}>Admin console</p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Login                                                               */
/* ------------------------------------------------------------------ */
function Login({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    setAdminCredentials(username, password);

    try {
      const result = await adminApi.getProducts();
      onLogin(result.products || []);
    } catch (requestError) {
      clearAdminCredentials();
      setError(requestError.message || 'Unable to sign in to the admin API.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <aside className="hidden flex-col justify-between bg-slate-900 p-12 text-white lg:flex">
        <Brand />
        <div>
          <h2 className="max-w-md text-4xl font-bold leading-tight tracking-tight">
            Manage your catalog and chatbot in one place.
          </h2>
          <p className="mt-4 max-w-md text-slate-400">
            Add products, train intents, review unanswered questions and test the assistant — all from a single
            dashboard.
          </p>
        </div>
        <p className="text-xs text-slate-500">Authorised administrators only.</p>
      </aside>

      <main className="flex items-center justify-center bg-slate-50 px-4 py-12 sm:px-8">
        <form onSubmit={submit} className="w-full max-w-md space-y-5">
          <div className="lg:hidden">
            <Brand light={false} />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Sign in</h1>
            <p className="mt-2 text-sm text-slate-600">
              Use the admin username and password configured on the backend.
            </p>
          </div>

          <Card className="space-y-4 p-6">
            <TextField
              label="Username"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
            <div>
              <label htmlFor="admin-password" className="mb-1.5 block text-sm font-medium text-slate-700">
                Password <span className="text-rose-600" aria-hidden="true">*</span>
              </label>
              <div className="relative">
                <input
                  id="admin-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className={`${inputCls} pr-11`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-pressed={showPassword}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-slate-500 hover:text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-600"
                >
                  <Icon name={showPassword ? 'eyeOff' : 'eye'} className="h-4 w-4" />
                </button>
              </div>
            </div>
            <Alert>{error}</Alert>
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? 'Checking credentials…' : 'Sign in'}
            </Button>
          </Card>

          <a
            href="/"
            className="block rounded text-center text-sm text-slate-600 hover:text-teal-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
          >
            ← Back to chat
          </a>
        </form>
      </main>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Products                                                            */
/* ------------------------------------------------------------------ */
const EMPTY_PRODUCT = {
  name: '',
  code: '',
  price: '',
  currency: 'INR',
  category: '',
  description: '',
  imageUrl: '',
};

function Stat({ label, value }) {
  return (
    <Card className="p-4 sm:p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
    </Card>
  );
}

function ProductsPanel({ products, setProducts }) {
  const [form, setForm] = useState(EMPTY_PRODUCT);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [toDelete, setToDelete] = useState(null);
  const formRef = useRef(null);

  const categories = useMemo(
    () => [...new Set(products.map((p) => p.category).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [products]
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      if (categoryFilter !== 'all' && (p.category || 'Other') !== categoryFilter) return false;
      if (!q) return true;
      return [p.name, p.code, p.category, p.description].some((v) => (v || '').toLowerCase().includes(q));
    });
  }, [products, query, categoryFilter]);

  const setField = (field) => (event) => setForm((c) => ({ ...c, [field]: event.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);
    const payload = {
      ...form,
      name: form.name.trim(),
      code: form.code.trim(),
      price: Number(form.price),
      currency: form.currency.trim().toUpperCase(),
      category: form.category.trim() || 'Other',
      description: form.description.trim(),
      imageUrl: form.imageUrl.trim(),
    };

    try {
      const result = editingId
        ? await adminApi.updateProduct(editingId, payload)
        : await adminApi.createProduct(payload);
      setProducts((current) => {
        const next = current.filter((product) => product._id !== result.product._id);
        return [...next, result.product].sort((a, b) => a.name.localeCompare(b.name));
      });
      setSuccess(editingId ? 'Product updated.' : 'Product added to the catalog.');
      setForm(EMPTY_PRODUCT);
      setEditingId(null);
    } catch (requestError) {
      setError(requestError.message || 'Unable to save this product.');
    } finally {
      setSaving(false);
    }
  };

  const editProduct = (product) => {
    setEditingId(product._id);
    setError('');
    setSuccess('');
    setForm({
      name: product.name,
      code: product.code,
      price: String(product.price),
      currency: product.currency,
      category: product.category || '',
      description: product.description || '',
      imageUrl: product.imageUrl || '',
    });
    const node = formRef.current;
    if (node) {
      node.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
      node.querySelector('input')?.focus({ preventScroll: true });
    }
  };

  const confirmDelete = async () => {
    const product = toDelete;
    setToDelete(null);
    if (!product) return;
    setError('');
    setSuccess('');
    try {
      await adminApi.removeProduct(product._id);
      setProducts((current) => current.filter((item) => item._id !== product._id));
      if (editingId === product._id) {
        setEditingId(null);
        setForm(EMPTY_PRODUCT);
      }
      setSuccess(`"${product.name}" was deleted.`);
    } catch (requestError) {
      setError(requestError.message || 'Unable to delete this product.');
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm(EMPTY_PRODUCT);
    setError('');
    setSuccess('');
  };

  return (
    <section aria-labelledby="products-heading" className="space-y-8">
      <PageHeader
        title="Products"
        description="Products appear in the customer catalog and can be found by the chat assistant."
      />
      <span id="products-heading" className="sr-only">
        Products
      </span>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        <Stat label="Total products" value={products.length} />
        <Stat label="Categories" value={categories.length} />
        <div className="col-span-2 lg:col-span-1">
          <Stat label="Showing" value={`${visible.length} of ${products.length}`} />
        </div>
      </div>

      <Card>
        <form ref={formRef} onSubmit={submit} className="scroll-mt-20 space-y-5 p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-slate-900">
              {editingId ? 'Edit product' : 'Add a product'}
            </h2>
            {editingId && <Badge tone="amber">Editing “{form.name || 'product'}”</Badge>}
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <TextField label="Product name" value={form.name} onChange={setField('name')} required />
            <TextField label="Product code" value={form.code} onChange={setField('code')} required />
            <TextField
              label="Price"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={form.price}
              onChange={setField('price')}
              required
            />
            <TextField
              label="Currency code"
              value={form.currency}
              onChange={setField('currency')}
              maxLength={3}
              hint="3-letter code, e.g. INR"
              required
            />
            <div>
              <TextField
                label="Category"
                value={form.category}
                onChange={setField('category')}
                list="product-categories"
                hint="Pick an existing one or type a new one"
              />
              <datalist id="product-categories">
                {categories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
            <TextField
              label="Image URL (optional)"
              type="url"
              value={form.imageUrl}
              onChange={setField('imageUrl')}
              placeholder="https://…"
            />
          </div>

          <TextField
            label="Product description"
            multiline
            rows={3}
            maxLength={2000}
            value={form.description}
            onChange={setField('description')}
            hint={`${form.description.length}/2000 characters`}
            required
          />

          <Alert>{error}</Alert>
          <Alert tone="success">{success}</Alert>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button type="submit" disabled={saving} icon={editingId ? 'check' : 'plus'} className="sm:w-auto">
              {saving ? 'Saving…' : editingId ? 'Save changes' : 'Add product'}
            </Button>
            {editingId && (
              <Button variant="secondary" onClick={cancelEdit}>
                Cancel
              </Button>
            )}
          </div>
        </form>
      </Card>

      <div>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Product catalog ({products.length})</h2>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <div className="sm:w-64">
              <SearchInput
                label="Search products"
                value={query}
                onChange={setQuery}
                placeholder="Search name, code or category"
              />
            </div>
            <div>
              <label htmlFor="category-filter" className="sr-only">
                Filter by category
              </label>
              <select
                id="category-filter"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className={`${inputCls} sm:w-44`}
              >
                <option value="all">All categories</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {products.length === 0 ? (
          <EmptyState icon="products" title="No products yet">
            Use the form above to add your first product.
          </EmptyState>
        ) : visible.length === 0 ? (
          <EmptyState icon="search" title="No matching products">
            Try a different search term or category.
          </EmptyState>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {visible.map((product) => (
              <li key={product._id || product.code}>
                <Card className="flex h-full flex-col overflow-hidden">
                  {product.imageUrl ? (
                    <img
                      src={product.imageUrl}
                      alt={product.name}
                      loading="lazy"
                      className="h-40 w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-24 items-center justify-center bg-slate-100 text-slate-400">
                      <Icon name="products" className="h-8 w-8" />
                    </div>
                  )}
                  <div className="flex flex-1 flex-col p-5">
                    <div className="flex items-start justify-between gap-2">
                      <Badge tone="teal">{product.category || 'Other'}</Badge>
                      <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-700">
                        {product.code}
                      </span>
                    </div>
                    <h3 className="mt-3 break-words text-base font-semibold text-slate-900">{product.name}</h3>
                    {product.description && (
                      <p className="mt-2 line-clamp-3 text-sm text-slate-600">{product.description}</p>
                    )}
                    <p className="mt-4 text-xl font-bold text-slate-900">
                      <span className="text-sm font-medium text-slate-500">{product.currency}</span>{' '}
                      {new Intl.NumberFormat('en-IN').format(product.price)}
                    </p>
                    <div className="mt-auto flex gap-2 pt-4">
                      <Button
                        variant="secondary"
                        size="sm"
                        icon="edit"
                        className="flex-1"
                        onClick={() => editProduct(product)}
                        aria-label={`Edit ${product.name}`}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        icon="trash"
                        className="flex-1"
                        onClick={() => setToDelete(product)}
                        aria-label={`Delete ${product.name}`}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </div>

      <ConfirmDialog
        open={Boolean(toDelete)}
        title="Delete product?"
        confirmLabel="Delete product"
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      >
        “{toDelete?.name}” will be removed from the catalog. This can’t be undone.
      </ConfirmDialog>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Unanswered                                                          */
/* ------------------------------------------------------------------ */
function UnansweredPanel() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await adminApi.getUnanswered();
      setItems(result.items || []);
    } catch (requestError) {
      setError(requestError.message || 'Unable to load unanswered queries.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refresh();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  const dismiss = async (id) => {
    setError('');
    try {
      await adminApi.removeUnanswered(id);
      setItems((current) => current.filter((item) => item._id !== id));
    } catch (requestError) {
      setError(requestError.message || 'Unable to dismiss this query.');
    }
  };

  return (
    <section aria-labelledby="unanswered-heading">
      <PageHeader
        title="Unanswered queries"
        description="Questions the assistant could not answer. Use them to decide which intents to add next."
        actions={
          <Button variant="secondary" icon="refresh" onClick={refresh} disabled={loading}>
            Refresh
          </Button>
        }
      />
      <span id="unanswered-heading" className="sr-only">
        Unanswered queries
      </span>
      <Alert className="mb-4">{error}</Alert>
      {loading ? (
        <Spinner label="Loading queries…" />
      ) : items.length === 0 ? (
        <EmptyState icon="unanswered" title="All caught up">
          No unanswered queries to review.
        </EmptyState>
      ) : (
        <>
          <p className="mb-3 text-sm text-slate-600" aria-live="polite">
            {items.length} {items.length === 1 ? 'query' : 'queries'} to review
          </p>
          <ul className="space-y-3">
            {items.map((item) => (
              <li key={item._id}>
                <Card className="flex flex-col justify-between gap-4 p-4 sm:flex-row sm:items-center sm:p-5">
                  <div className="min-w-0">
                    <p className="break-words font-medium text-slate-900">{item.message}</p>
                    <div className="mt-2">
                      <Badge tone={item.count > 2 ? 'amber' : 'slate'}>Asked {item.count} times</Badge>
                    </div>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    icon="check"
                    onClick={() => dismiss(item._id)}
                    aria-label={`Dismiss: ${item.message}`}
                  >
                    Dismiss
                  </Button>
                </Card>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Test bot                                                            */
/* ------------------------------------------------------------------ */
function TestPanel() {
  const [message, setMessage] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setResult(null);
    try {
      setResult({ ok: true, data: await adminApi.testMessage(message) });
    } catch (error) {
      setResult({ ok: false, data: { status: error.status, error: error.message } });
    } finally {
      setLoading(false);
    }
  };

  return (
    <section aria-labelledby="test-heading" className="max-w-3xl">
      <PageHeader
        title="Test the bot"
        description="Try product questions or trained intent answers without adding a chat message."
      />
      <span id="test-heading" className="sr-only">
        Test the bot
      </span>
      <Card>
        <form onSubmit={submit} className="space-y-4 p-5 sm:p-6">
          <TextField
            label="Message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="e.g. What chairs do you have?"
            required
          />
          <Button type="submit" disabled={loading} icon="test">
            {loading ? 'Testing…' : 'Test message'}
          </Button>
        </form>
      </Card>

      <div aria-live="polite" className="mt-5">
        {result && (
          <Card className={`overflow-hidden ${result.ok ? 'border-emerald-300' : 'border-rose-300'}`}>
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
              <h2 className="text-sm font-semibold text-slate-900">Response</h2>
              <Badge tone={result.ok ? 'emerald' : 'rose'}>{result.ok ? 'Success' : 'Error'}</Badge>
            </div>
            <pre
              tabIndex={0}
              className="max-h-96 overflow-auto bg-slate-900 p-5 text-xs leading-relaxed text-teal-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-400"
            >
              {JSON.stringify(result.data, null, 2)}
            </pre>
          </Card>
        )}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Navigation                                                          */
/* ------------------------------------------------------------------ */
function SideNav({ activeTab, onSelect, onSignOut }) {
  return (
    <aside className="hidden w-64 shrink-0 flex-col bg-slate-900 lg:sticky lg:top-0 lg:flex lg:h-screen">
      <div className="px-5 py-6">
        <Brand />
      </div>
      <nav aria-label="Admin sections" className="flex-1 space-y-1 px-3">
        {TABS.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onSelect(tab.id)}
              aria-current={active ? 'page' : undefined}
              className={`flex min-h-[44px] w-full items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 ${
                active ? 'bg-teal-500/15 text-teal-300' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Icon name={tab.icon} className="h-5 w-5" />
              {tab.label}
            </button>
          );
        })}
      </nav>
      <div className="space-y-1 border-t border-slate-800 p-3">
        <a
          href="/"
          className="flex min-h-[44px] items-center gap-3 rounded-lg px-3 text-sm text-slate-300 hover:bg-slate-800 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
        >
          <Icon name="intents" className="h-5 w-5" />
          Open chat
        </a>
        <button
          type="button"
          onClick={onSignOut}
          className="flex min-h-[44px] w-full items-center gap-3 rounded-lg px-3 text-sm text-slate-300 hover:bg-slate-800 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
        >
          <Icon name="logout" className="h-5 w-5" />
          Sign out
        </button>
      </div>
    </aside>
  );
}

function MobileNav({ activeTab, onSelect, onSignOut }) {
  return (
    <div className="sticky top-0 z-30 bg-slate-900 shadow-md lg:hidden">
      <div className="flex items-center justify-between px-4 py-3">
        <Brand />
        <div className="flex items-center gap-1">
          <a
            href="/"
            className="rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
          >
            Chat
          </a>
          <button
            type="button"
            onClick={onSignOut}
            aria-label="Sign out"
            className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
          >
            <Icon name="logout" />
          </button>
        </div>
      </div>
      <nav aria-label="Admin sections" className="flex gap-1 overflow-x-auto px-3 pb-3">
        {TABS.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onSelect(tab.id)}
              aria-current={active ? 'page' : undefined}
              className={`flex min-h-[40px] shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-3.5 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 ${
                active ? 'bg-teal-500 text-slate-950' : 'bg-slate-800 text-slate-300 hover:text-white'
              }`}
            >
              <Icon name={tab.icon} className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */
export default function AdminPage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [activeTab, setActiveTab] = useState(TABS[0].id);
  const [products, setProducts] = useState([]);

  const signOut = () => {
    clearAdminCredentials();
    setAuthenticated(false);
    setProducts([]);
    setActiveTab(TABS[0].id);
  };

  const signIn = (catalog) => {
    setProducts(catalog);
    setAuthenticated(true);
  };

  const selectTab = (id) => {
    setActiveTab(id);
    window.scrollTo({ top: 0, behavior: 'auto' });
  };

  if (!authenticated) return <Login onLogin={signIn} />;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 lg:flex">
      <a
        href="#main-content"
        className="sr-only rounded-lg bg-white px-4 py-2 text-sm font-medium text-teal-800 shadow-lg focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50"
      >
        Skip to content
      </a>

      <MobileNav activeTab={activeTab} onSelect={selectTab} onSignOut={signOut} />
      <SideNav activeTab={activeTab} onSelect={selectTab} onSignOut={signOut} />

      <main id="main-content" tabIndex={-1} className="min-w-0 flex-1 px-4 py-6 focus:outline-none sm:px-6 lg:px-10 lg:py-10">
        <div className="mx-auto max-w-6xl">
          {activeTab === 'Products' && <ProductsPanel products={products} setProducts={setProducts} />}
          {activeTab === 'Intents' && <IntentsAdmin />}
          {activeTab === 'Unanswered' && <UnansweredPanel />}
          {activeTab === 'Test bot' && <TestPanel />}
          {activeTab === 'API Explorer' && <ApiExplorer />}
        </div>
      </main>
    </div>
  );
}
