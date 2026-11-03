import { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import gsap from 'gsap';
import { chatApi } from '../services/api';
import icon from "/favicon.png";

/* ------------------------------------------------------------------ */
/* Edit these to match your catalogue                                  */
/* ------------------------------------------------------------------ */
const SUGGESTIONS = [
  { icon: '🛋️', label: 'Show me sofas' },
  { icon: '🍽️', label: 'Dining tables under 20000' },
  { icon: '🪑', label: 'Office chairs' },
  { icon: '🛏️', label: 'Queen size beds' },
];

// Your original code hides the bot's text when product cards are shown.
// Flip this to true if you want the intro sentence above the cards.
const SHOW_TEXT_WITH_PRODUCTS = false;

const nowTime = () =>
  new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const formatPrice = (n) => new Intl.NumberFormat('en-IN').format(n);

/* ------------------------------------------------------------------ */
/* Small pieces                                                        */
/* ------------------------------------------------------------------ */
function BotAvatar() {
  return (
    <div
      aria-hidden="true"
      className="mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#f2e196] text-base text-[#2b2b2b]"
    >
      <img src={icon} alt="Eezy Assistant" className="h-5 w-5" />
    </div>
  );
}

function ProductCard({ product, onAsk }) {
  const [copied, setCopied] = useState(false);

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(product.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked: ignore */
    }
  };

  return (
    <article
      data-card
      className="group overflow-hidden rounded-xl border border-white/10 bg-[#2b2b2b] transition hover:-translate-y-0.5 hover:border-[#f2e196]/70"
    >
      {/* Image area: uses product.image if your API sends one */}
      <div className="grid h-28 place-items-center bg-[#3a3a3a]">
        {product.image ? (
          <img
            src={product.image}
            alt={product.name}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="text-4xl opacity-60" aria-hidden="true">
            🪑
          </span>
        )}
      </div>

      <div className="p-3.5">
        <p className="line-clamp-2 font-semibold leading-snug text-white">
          {product.name}
        </p>

        <div className="mt-2 flex items-center justify-between gap-2">
          <p className="text-lg font-semibold text-[#f2e196]">
            {product.currency} {formatPrice(product.price)}
          </p>
          <button
            type="button"
            onClick={copyCode}
            title="Copy product code"
            className="rounded-md border border-white/15 px-2 py-0.5 font-mono text-[11px] text-slate-300 transition hover:border-[#f2e196] hover:text-[#f2e196]"
          >
            {copied ? 'Copied ✓' : product.code}
          </button>
        </div>

        <button
          type="button"
          onClick={() => onAsk(`Tell me more about ${product.name} (${product.code})`)}
          className="mt-3 w-full rounded-lg bg-white/5 py-1.5 text-xs font-medium text-slate-200 transition hover:bg-[#f2e196] hover:text-[#2b2b2b]"
        >
          Ask about this
        </button>
      </div>
    </article>
  );
}

function TypingDots() {
  return (
    <div className="flex items-end gap-2">
      <BotAvatar />
      <div
        className="rounded-2xl rounded-bl-none border border-white/10 bg-[#3f3f3f] px-4 py-3"
        aria-label="Assistant is typing"
      >
        <div className="flex gap-1">
          <span className="h-2 w-2 animate-bounce rounded-full bg-slate-300" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-slate-300 [animation-delay:0.12s]" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-slate-300 [animation-delay:0.24s]" />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main component                                                      */
/* ------------------------------------------------------------------ */
export default function Chat({ initialMessage }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const nextId = useRef(1);
  const animatedCount = useRef(0);

  const push = useCallback((msg) => {
    setMessages((prev) => [...prev, { id: nextId.current++, time: nowTime(), ...msg }]);
  }, []);

  /* Scroll only the chat box (scrollIntoView can jump the whole page) */
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  /* GSAP entrance for newly added messages + product cards */
  useLayoutEffect(() => {
    const root = scrollRef.current;
    if (!root) return;

    const rows = Array.from(root.querySelectorAll('[data-msg]'));
    const fresh = rows.slice(animatedCount.current);
    animatedCount.current = rows.length;
    if (!fresh.length) return;

    gsap.from(fresh, {
      opacity: 0,
      y: 16,
      duration: 0.4,
      ease: 'power2.out',
      stagger: 0.05,
      clearProps: 'opacity,transform',
    });

    const cards = fresh.flatMap((r) => Array.from(r.querySelectorAll('[data-card]')));
    if (cards.length) {
      gsap.from(cards, {
        opacity: 0,
        y: 14,
        scale: 0.97,
        duration: 0.4,
        delay: 0.15,
        stagger: 0.08,
        ease: 'power2.out',
        clearProps: 'opacity,transform',
      });
    }
  }, [messages]);

  /* Prefill from the parent, exactly like before */
  useEffect(() => {
    if (initialMessage?.message) {
      setInput(initialMessage.message);
      inputRef.current?.focus();
    }
  }, [initialMessage]);

  /* Calls the API and appends the bot (or error) message */
  const request = useCallback(
    async (text) => {
      setLoading(true);
      try {
        const res = await chatApi.sendMessage(text);
        push({
          role: 'bot',
          text: res.answer,
          intent: res.intent,
          score: res.score,
          products: res.products || [],
          suggestion: res.suggestion,
          correctedMessage: res.correctedMessage,
        });
      } catch (err) {
        push({
          role: 'error',
          text: err.message || 'Something went wrong',
          retryText: text,
        });
      } finally {
        setLoading(false);
      }
    },
    [push]
  );

  /* Used by the form, chips, "Ask about this", and "Did you mean" */
  const sendText = useCallback(
    (raw) => {
      const text = raw.trim();
      if (!text || loading) return;
      push({ role: 'user', text });
      setInput('');
      request(text);
    },
    [loading, push, request]
  );

  const retry = (msg) => {
    if (loading) return;
    setMessages((prev) => prev.filter((m) => m.id !== msg.id));
    request(msg.retryText);
  };

  const clearChat = () => {
    animatedCount.current = 0;
    setMessages([]);
  };

  const onSubmit = (e) => {
    e.preventDefault();
    sendText(input);
  };

  return (
    <div className="flex h-[70vh] min-h-[420px] flex-col overflow-hidden rounded-2xl border border-[#f2e196] bg-[#535353] shadow-2xl shadow-black/30">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-white/10 bg-[#2b2b2b] px-5 py-3">
        <div className="grid h-9 w-9 place-items-center rounded-full bg-[#f2e196] text-lg text-[#2b2b2b]">
          <img src={icon} alt="Eezy Assistant" className="h-5 w-5" />
        </div>
        <div className="flex-1 leading-tight">
          <p className="text-sm font-semibold text-white">Eezy Assistant</p>
          <p className="flex items-center gap-1.5 text-xs text-slate-400">
            <span className="h-2 w-2 rounded-full bg-emerald-400" /> Online
          </p>
        </div>
        {messages.length > 0 && (
          <button
            type="button"
            onClick={clearChat}
            className="rounded-lg border border-white/15 px-3 py-1 text-xs text-slate-300 transition hover:border-[#f2e196] hover:text-[#f2e196]"
          >
            Clear
          </button>
        )}
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        role="log"
        aria-live="polite"
        className="flex-1 space-y-4 overflow-y-auto p-5 sm:p-6"
      >
        {messages.length === 0 && !loading && (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="mb-3 text-5xl">🛋️</div>
            <h3 className="text-lg font-semibold text-white">
              How can we help you furnish your space?
            </h3>
            <p className="mt-1 max-w-sm text-sm text-slate-300">
              Ask about products, prices or product codes, or tap a suggestion to get started.
            </p>

            <div className="mt-5 grid w-full max-w-md grid-cols-1 gap-2 sm:grid-cols-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s.label}
                  type="button"
                  onClick={() => sendText(s.label)}
                  className="flex items-center gap-2 rounded-xl border border-white/15 bg-[#2b2b2b]/60 px-3 py-2.5 text-left text-sm text-slate-100 transition hover:border-[#f2e196] hover:bg-[#2b2b2b]"
                >
                  <span aria-hidden="true">{s.icon}</span>
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          const isError = msg.role === 'error';
          const hasProducts = msg.products?.length > 0;
          const showText = !hasProducts || SHOW_TEXT_WITH_PRODUCTS;
          const showCorrection =
            msg.correctedMessage &&
            msg.correctedMessage.trim().toLowerCase() !== '' &&
            !hasProducts;

          return (
            <div
              key={msg.id}
              data-msg
              className={`flex items-end gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}
            >
              {!isUser && !isError && <BotAvatar />}

              <div className={`flex max-w-[85%] flex-col ${isUser ? 'items-end' : 'items-start'}`}>
                <div
                  className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    isUser
                      ? 'rounded-br-none bg-[#f2e196] font-medium text-[#2b2b2b]'
                      : isError
                      ? 'border border-red-700 bg-red-900/50 text-red-200'
                      : 'rounded-bl-none border border-white/10 bg-[#3f3f3f] text-slate-100'
                  }`}
                >
                  {showText && msg.text && (
                    <p className="whitespace-pre-wrap">{msg.text}</p>
                  )}

                  {hasProducts && (
                    <div
                      className={`grid gap-3 sm:grid-cols-2 ${showText && msg.text ? 'mt-4' : ''}`}
                    >
                      {msg.products.map((product) => (
                        <ProductCard key={product.code} product={product} onAsk={sendText} />
                      ))}
                    </div>
                  )}

                  {msg.suggestion && !hasProducts && (
                    <p className="mt-2 text-xs text-[#f2e196]/90">{msg.suggestion}</p>
                  )}

                  {showCorrection && (
                    <button
                      type="button"
                      onClick={() => sendText(msg.correctedMessage)}
                      className="mt-3 rounded-full border border-[#f2e196]/60 px-3 py-1 text-xs text-[#f2e196] transition hover:bg-[#f2e196] hover:text-[#2b2b2b]"
                    >
                      Did you mean “{msg.correctedMessage}”?
                    </button>
                  )}

                  {isError && (
                    <button
                      type="button"
                      onClick={() => retry(msg)}
                      className="mt-2 rounded-md border border-red-400/60 px-3 py-1 text-xs text-red-100 transition hover:bg-red-400/20"
                    >
                      ↻ Try again
                    </button>
                  )}
                </div>

                <span className="mt-1 px-1 text-[11px] text-slate-300/70">{msg.time}</span>
              </div>
            </div>
          );
        })}

        {loading && <TypingDots />}
      </div>

      {/* Quick suggestions once a chat is underway */}
      {messages.length > 0 && !loading && (
        <div className="flex gap-2 overflow-x-auto border-t border-white/10 bg-[#2b2b2b]/70 px-4 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {SUGGESTIONS.map((s) => (
            <button
              key={s.label}
              type="button"
              onClick={() => sendText(s.label)}
              className="shrink-0 rounded-full border border-white/15 px-3 py-1 text-xs text-slate-200 transition hover:border-[#f2e196] hover:text-[#f2e196]"
            >
              {s.label}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <form onSubmit={onSubmit} className="border-t border-white/10 bg-[#05060b] p-4">
        <div className="flex gap-3">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Search a product, price or code…"
            aria-label="Message"
            maxLength={300}
            disabled={loading}
            className="flex-1 rounded-xl border border-[#535353] bg-slate-800 px-4 py-3 text-sm text-white placeholder-slate-500 focus:border-[#f2e196] focus:outline-none focus:ring-2 focus:ring-[#f2e196]/30 disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="rounded-xl bg-[#f2e196] px-6 py-3 text-sm font-semibold text-[#2b2b2b] transition hover:brightness-110 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}