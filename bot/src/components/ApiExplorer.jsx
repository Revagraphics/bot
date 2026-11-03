import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { adminApi, chatApi, intentsApi } from '../services/api';
import { Alert, Badge, Button, Card, PageHeader, TextField, inputCls, prefersReducedMotion } from './ProductCatalog';

const PRODUCT_EXAMPLE = {
  name: 'Oak Desk',
  code: 'DSK-001',
  price: 25000,
  currency: 'INR',
  category: 'desk',
  description: 'Solid oak desk for a home office.',
  imageUrl: '',
};

const ENDPOINTS = [
  {
    id: 'chat',
    group: 'Chat',
    method: 'POST',
    path: '/api/chat',
    description: 'Send a message to the chatbot',
    bodyExample: { message: 'hello' },
  },
  {
    id: 'get-products',
    group: 'Products',
    method: 'GET',
    path: '/api/admin/products',
    description: 'Get the product catalog',
  },
  {
    id: 'create-product',
    group: 'Products',
    method: 'POST',
    path: '/api/admin/products',
    description: 'Add a product to the catalog',
    bodyExample: PRODUCT_EXAMPLE,
  },
  {
    id: 'update-product',
    group: 'Products',
    method: 'PUT',
    path: '/api/admin/products/:id',
    description: 'Update a product (replace :id)',
    bodyExample: PRODUCT_EXAMPLE,
  },
  {
    id: 'delete-product',
    group: 'Products',
    method: 'DELETE',
    path: '/api/admin/products/:id',
    description: 'Delete a product (replace :id)',
  },
  {
    id: 'get-intents',
    group: 'Intents',
    method: 'GET',
    path: '/api/admin/intents',
    description: 'Get all intents',
  },
  {
    id: 'create-intent',
    group: 'Intents',
    method: 'POST',
    path: '/api/admin/intents',
    description: 'Create a new intent',
    bodyExample: {
      intent: 'greeting',
      utterances: ['hello', 'hi'],
      answers: ['Hello!', 'Hi there!'],
    },
  },
  {
    id: 'update-intent',
    group: 'Intents',
    method: 'PUT',
    path: '/api/admin/intents/:id',
    description: 'Update an intent (replace :id)',
    bodyExample: {
      intent: 'greeting',
      utterances: ['hello', 'hey'],
      answers: ['Hello again!'],
    },
  },
  {
    id: 'delete-intent',
    group: 'Intents',
    method: 'DELETE',
    path: '/api/admin/intents/:id',
    description: 'Delete an intent (replace :id)',
  },
];

const GROUPS = ['Chat', 'Products', 'Intents'];
const NEEDS_ID = ['update-intent', 'delete-intent', 'update-product', 'delete-product'];

const METHOD_TONE = { GET: 'emerald', POST: 'sky', PUT: 'amber', DELETE: 'rose' };

function MethodBadge({ method }) {
  return (
    <Badge tone={METHOD_TONE[method]} className="min-w-[3.75rem] justify-center font-bold">
      {method}
    </Badge>
  );
}

export default function ApiExplorer() {
  const [selected, setSelected] = useState(ENDPOINTS[0]);
  const [body, setBody] = useState(JSON.stringify(ENDPOINTS[0].bodyExample || {}, null, 2));
  const [pathParam, setPathParam] = useState('');
  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const responseRef = useRef(null);

  const hasBody = selected.method !== 'GET' && selected.method !== 'DELETE';
  const needsId = NEEDS_ID.includes(selected.id);
  const resolvedPath = needsId ? selected.path.replace(':id', pathParam.trim() || ':id') : selected.path;

  const handleSelect = (ep) => {
    setSelected(ep);
    setBody(JSON.stringify(ep.bodyExample || {}, null, 2));
    setResponse(null);
    setPathParam('');
    setCopied(false);
  };

  const resetBody = () => setBody(JSON.stringify(selected.bodyExample || {}, null, 2));

  const execute = async (event) => {
    event?.preventDefault();
    setLoading(true);
    setResponse(null);
    setCopied(false);
    const started = performance.now();

    try {
      let result;
      const id = pathParam.trim();

      if (selected.id === 'chat') {
        const parsed = JSON.parse(body);
        result = await chatApi.sendMessage(parsed.message);
      } else if (selected.id === 'get-products') {
        result = await adminApi.getProducts();
      } else if (selected.id === 'create-product') {
        result = await adminApi.createProduct(JSON.parse(body));
      } else if (selected.id === 'update-product') {
        if (!id) throw new Error('Please provide Product ID');
        result = await adminApi.updateProduct(id, JSON.parse(body));
      } else if (selected.id === 'delete-product') {
        if (!id) throw new Error('Please provide Product ID');
        result = await adminApi.removeProduct(id);
      } else if (selected.id === 'get-intents') {
        result = await intentsApi.getAll();
      } else if (selected.id === 'create-intent') {
        result = await intentsApi.create(JSON.parse(body));
      } else if (selected.id === 'update-intent') {
        if (!id) throw new Error('Please provide Intent ID');
        result = await intentsApi.update(id, JSON.parse(body));
      } else if (selected.id === 'delete-intent') {
        if (!id) throw new Error('Please provide Intent ID');
        result = await intentsApi.remove(id);
      }

      setResponse({ ok: true, data: result, ms: Math.round(performance.now() - started) });
    } catch (err) {
      const message = err instanceof SyntaxError ? `Invalid JSON in request body: ${err.message}` : err.message;
      setResponse({
        ok: false,
        ms: Math.round(performance.now() - started),
        data: { status: err.status, message, ...(err.data || {}) },
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!response || !responseRef.current || prefersReducedMotion()) return;
    gsap.from(responseRef.current, {
      opacity: 0,
      y: 12,
      duration: 0.4,
      ease: 'power2.out',
      clearProps: 'all',
    });
  }, [response]);

  const copyResponse = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(response.data, null, 2));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <section aria-labelledby="api-heading">
      <PageHeader
        title="API Explorer"
        description="Send requests to the chat and admin endpoints and inspect the responses."
      />
      <span id="api-heading" className="sr-only">
        API Explorer
      </span>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Endpoints */}
        <div className="lg:col-span-2">
          {/* Mobile: compact select */}
          <div className="lg:hidden">
            <label htmlFor="endpoint-select" className="mb-1.5 block text-sm font-medium text-slate-700">
              Endpoint
            </label>
            <select
              id="endpoint-select"
              value={selected.id}
              onChange={(e) => handleSelect(ENDPOINTS.find((ep) => ep.id === e.target.value))}
              className={inputCls}
            >
              {GROUPS.map((group) => (
                <optgroup key={group} label={group}>
                  {ENDPOINTS.filter((ep) => ep.group === group).map((ep) => (
                    <option key={ep.id} value={ep.id}>
                      {ep.method} {ep.path} — {ep.description}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          {/* Desktop: grouped list */}
          <nav aria-label="Endpoints" className="hidden space-y-5 lg:block">
            {GROUPS.map((group) => (
              <div key={group}>
                <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">{group}</h2>
                <ul className="space-y-2">
                  {ENDPOINTS.filter((ep) => ep.group === group).map((ep) => {
                    const active = selected.id === ep.id;
                    return (
                      <li key={ep.id}>
                        <button
                          type="button"
                          onClick={() => handleSelect(ep)}
                          aria-pressed={active}
                          className={`w-full rounded-xl border px-4 py-3 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2 ${
                            active
                              ? 'border-teal-600 bg-teal-50 shadow-sm'
                              : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <MethodBadge method={ep.method} />
                            <span className="break-all font-mono text-xs text-slate-800">{ep.path}</span>
                          </div>
                          <p className="mt-1.5 text-xs text-slate-500">{ep.description}</p>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        {/* Request + response */}
        <div className="min-w-0 space-y-5 lg:col-span-3">
          <Card>
            <form onSubmit={execute} className="space-y-4 p-5 sm:p-6">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Request</h2>
                <div className="mt-2 flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2">
                  <MethodBadge method={selected.method} />
                  <code className="min-w-0 break-all font-mono text-xs text-slate-800 sm:text-sm">
                    {resolvedPath}
                  </code>
                </div>
                <p className="mt-2 text-sm text-slate-600">{selected.description}</p>
              </div>

              {needsId && (
                <TextField
                  label={selected.id.includes('product') ? 'Product ID' : 'Intent ID'}
                  value={pathParam}
                  onChange={(e) => setPathParam(e.target.value)}
                  placeholder="MongoDB ObjectId"
                  className="font-mono"
                  required
                />
              )}

              {hasBody && (
                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <label htmlFor="request-body" className="text-sm font-medium text-slate-700">
                      Body (JSON)
                    </label>
                    <button
                      type="button"
                      onClick={resetBody}
                      className="rounded text-xs font-medium text-teal-700 hover:text-teal-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
                    >
                      Reset to example
                    </button>
                  </div>
                  <textarea
                    id="request-body"
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    rows={10}
                    spellCheck={false}
                    className="block w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-3 font-mono text-xs leading-relaxed text-teal-100 focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-400/40 sm:text-sm"
                  />
                </div>
              )}

              <Button type="submit" disabled={loading} icon="test" className="w-full sm:w-auto">
                {loading ? 'Sending…' : 'Send request'}
              </Button>
            </form>
          </Card>

          {/* Response */}
          <div aria-live="polite">
            {response && (
              <div ref={responseRef}>
              <Card className={`overflow-hidden ${response.ok ? 'border-emerald-300' : 'border-rose-300'}`}>
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-5 py-3">
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-semibold text-slate-900">Response</h2>
                    <Badge tone={response.ok ? 'emerald' : 'rose'}>{response.ok ? 'Success' : 'Error'}</Badge>
                    <span className="text-xs text-slate-500">{response.ms} ms</span>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={copied ? 'check' : 'copy'}
                    onClick={copyResponse}
                  >
                    {copied ? 'Copied' : 'Copy'}
                  </Button>
                </div>
                {!response.ok && (
                  <Alert className="m-4 mb-0">{response.data.message}</Alert>
                )}
                <pre
                  tabIndex={0}
                  className="max-h-[28rem] overflow-auto whitespace-pre-wrap break-words bg-slate-900 p-5 font-mono text-xs leading-relaxed text-teal-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-400"
                >
                  {JSON.stringify(response.data, null, 2)}
                </pre>
              </Card>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
