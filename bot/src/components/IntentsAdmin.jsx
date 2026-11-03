import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import gsap from 'gsap';
import { intentsApi } from '../services/api';
import {
  Alert,
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  PageHeader,
  SearchInput,
  Spinner,
  TextField,
  prefersReducedMotion,
} from './ProductCatalog';

const EMPTY_FORM = { intent: '', utterances: '', answers: '' };
const countLines = (text) => text.split('\n').map((l) => l.trim()).filter(Boolean).length;

export default function IntentsAdmin() {
  const [intents, setIntents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState('');
  const [toDelete, setToDelete] = useState(null);

  const listRef = useRef(null);
  const formRef = useRef(null);
  const animated = useRef(false);

  const fetchIntents = useCallback(async () => {
    try {
      const data = await intentsApi.getAll();
      setIntents(data.intents || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchIntents();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [fetchIntents]);

  // Animate the list in once, on first load (respects reduced-motion).
  useEffect(() => {
    if (loading || animated.current || !listRef.current || !intents.length) return;
    animated.current = true;
    if (prefersReducedMotion()) return;
    gsap.from(listRef.current.children, {
      opacity: 0,
      y: 15,
      stagger: 0.05,
      duration: 0.4,
      ease: 'power2.out',
      clearProps: 'all',
    });
  }, [loading, intents]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return intents;
    return intents.filter(
      (i) =>
        i.intent.toLowerCase().includes(q) ||
        i.utterances.some((u) => u.toLowerCase().includes(q)) ||
        i.answers.some((a) => a.toLowerCase().includes(q))
    );
  }, [intents, query]);

  const resetForm = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const payload = {
      intent: form.intent.trim(),
      utterances: form.utterances.split('\n').map((u) => u.trim()).filter(Boolean),
      answers: form.answers.split('\n').map((a) => a.trim()).filter(Boolean),
    };

    if (!payload.intent || !payload.utterances.length || !payload.answers.length) {
      setError('Please provide an intent name, at least one utterance and at least one answer.');
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        await intentsApi.update(editingId, payload);
        setSuccess('Intent updated & bot retrained.');
      } else {
        await intentsApi.create(payload);
        setSuccess('Intent created & bot retrained.');
      }
      resetForm();
      fetchIntents();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (intent) => {
    setEditingId(intent._id);
    setError('');
    setSuccess('');
    setForm({
      intent: intent.intent,
      utterances: intent.utterances.join('\n'),
      answers: intent.answers.join('\n'),
    });
    const node = formRef.current;
    if (node) {
      node.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
      node.querySelector('input')?.focus({ preventScroll: true });
    }
  };

  const confirmDelete = async () => {
    const target = toDelete;
    setToDelete(null);
    if (!target) return;
    setError('');
    setSuccess('');
    try {
      await intentsApi.remove(target._id);
      if (editingId === target._id) resetForm();
      setSuccess('Intent deleted & bot retrained.');
      fetchIntents();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <section aria-labelledby="intents-heading" className="space-y-8">
      <PageHeader
        title="Intents"
        description="Teach the assistant what people ask (utterances) and how it should reply (answers). The bot retrains on every change."
      />
      <span id="intents-heading" className="sr-only">
        Intents
      </span>

      {/* Form */}
      <Card>
        <form ref={formRef} onSubmit={handleSubmit} className="scroll-mt-20 space-y-5 p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-slate-900">
              {editingId ? 'Edit intent' : 'Create new intent'}
            </h2>
            {editingId && <Badge tone="amber">Editing “{form.intent || 'intent'}”</Badge>}
          </div>

          <TextField
            label="Intent name"
            value={form.intent}
            onChange={(e) => setForm({ ...form, intent: e.target.value })}
            placeholder="e.g. greeting"
            required
          />

          <div className="grid gap-4 md:grid-cols-2">
            <TextField
              label="Utterances (one per line)"
              multiline
              rows={6}
              value={form.utterances}
              onChange={(e) => setForm({ ...form, utterances: e.target.value })}
              placeholder={'hello\nhi there\ngood morning'}
              hint={`${countLines(form.utterances)} utterance(s) — phrases users might type`}
              required
            />
            <TextField
              label="Answers (one per line)"
              multiline
              rows={6}
              value={form.answers}
              onChange={(e) => setForm({ ...form, answers: e.target.value })}
              placeholder={'Hello! How can I help?\nHi there!'}
              hint={`${countLines(form.answers)} answer(s) — the bot picks one to reply with`}
              required
            />
          </div>

          <Alert>{error}</Alert>
          <Alert tone="success">{success}</Alert>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button type="submit" disabled={saving} icon={editingId ? 'check' : 'plus'}>
              {saving ? 'Saving & retraining…' : editingId ? 'Update & retrain' : 'Create & retrain'}
            </Button>
            {editingId && (
              <Button variant="secondary" onClick={resetForm}>
                Cancel
              </Button>
            )}
          </div>
        </form>
      </Card>

      {/* List */}
      <div>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold text-slate-900">All intents ({intents.length})</h2>
          <div className="sm:w-72">
            <SearchInput
              label="Search intents"
              value={query}
              onChange={setQuery}
              placeholder="Search intents, utterances, answers"
            />
          </div>
        </div>

        {loading ? (
          <Spinner label="Loading intents…" />
        ) : intents.length === 0 ? (
          <EmptyState icon="intents" title="No intents yet">
            Create your first intent above to start training the bot.
          </EmptyState>
        ) : filtered.length === 0 ? (
          <EmptyState icon="search" title="No matching intents">
            Try a different search term.
          </EmptyState>
        ) : (
          <ul ref={listRef} className="space-y-3">
            {filtered.map((intent) => (
              <li key={intent._id}>
                <Card className="p-4 sm:p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <h3 className="break-words font-semibold text-slate-900">{intent.intent}</h3>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Badge>{intent.utterances.length} utterances</Badge>
                        <Badge tone="teal">{intent.answers.length} answers</Badge>
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        icon="edit"
                        onClick={() => startEdit(intent)}
                        aria-label={`Edit intent ${intent.intent}`}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        icon="trash"
                        onClick={() => setToDelete(intent)}
                        aria-label={`Delete intent ${intent.intent}`}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>

                  <details className="mt-3 border-t border-slate-100 pt-3">
                    <summary className="cursor-pointer rounded text-sm font-medium text-teal-700 hover:text-teal-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600">
                      Preview utterances &amp; answers
                    </summary>
                    <div className="mt-3 grid gap-4 md:grid-cols-2">
                      <div>
                        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Utterances
                        </h4>
                        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
                          {intent.utterances.map((u, i) => (
                            <li key={i} className="break-words">
                              {u}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Answers
                        </h4>
                        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
                          {intent.answers.map((a, i) => (
                            <li key={i} className="break-words">
                              {a}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </details>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </div>

      <ConfirmDialog
        open={Boolean(toDelete)}
        title="Delete intent?"
        confirmLabel="Delete intent"
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      >
        “{toDelete?.intent}” will be removed and the bot will retrain. This can’t be undone.
      </ConfirmDialog>
    </section>
  );
}
