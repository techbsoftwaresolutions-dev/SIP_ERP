import { useEffect, useRef, useState } from "react";
import api from "../../api/client";
import PageHeader from "../../components/layout/PageHeader";
import Icon from "../../components/ui/Icon";
import Loader from "../../components/ui/Loader";

const EXAMPLES = [
  "Which customers have unpaid invoices?",
  "Show sales orders pending dispatch",
  "Top 10 customers by outstanding amount",
  "Invoices created in the last 7 days",
  "Items below minimum stock level",
  "Purchase orders that are still in draft",
];

const MONEY_KEYS = new Set([
  "amount", "paidAmount", "balance", "outstanding", "subTotal", "taxTotal",
  "sellingPrice", "purchasePrice", "unitPrice",
]);

function formatCell(key, value) {
  if (value == null || value === "") return "—";
  if (MONEY_KEYS.has(key) && typeof value === "number") {
    return `₹${value.toLocaleString("en-IN")}`;
  }
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function ResultTable({ rows }) {
  if (!rows || rows.length === 0) return null;
  const cols = Array.from(
    rows.reduce((set, r) => {
      Object.keys(r).forEach((k) => set.add(k));
      return set;
    }, new Set())
  );
  return (
    <div className="items-table-wrap" style={{ marginTop: 12 }}>
      <table className="items-table">
        <thead>
          <tr>{cols.map((c) => <th key={c}>{c}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {cols.map((c) => <td key={c}>{formatCell(c, r[c])}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function AiAssistant() {
  const [configured, setConfigured] = useState(null); // null = unknown
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [thread, setThread] = useState([]); // { q, a, executed, rows, error }
  const inputRef = useRef(null);

  useEffect(() => {
    api
      .get("/api/ai/status")
      .then((s) => setConfigured(Boolean(s && s.configured)))
      .catch(() => setConfigured(false));
  }, []);

  const ask = async (text) => {
    const q = (text ?? question).trim();
    if (!q || busy) return;
    setBusy(true);
    setQuestion("");
    setThread((t) => [{ q, pending: true }, ...t]);
    try {
      const res = await api.post("/api/ai/ask", { question: q });
      setThread((t) =>
        t.map((item, i) =>
          i === 0
            ? { q, a: res.answer, executed: res.executed || [], rows: res.rows || [] }
            : item
        )
      );
    } catch (err) {
      setThread((t) =>
        t.map((item, i) => (i === 0 ? { q, error: err.message || "Something went wrong." } : item))
      );
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      ask();
    }
  };

  return (
    <div>
      <PageHeader
        title="AI Assistant"
        crumbs={["Dashboard", "AI Assistant"]}
        actions={<div className="sales-filter-pill"><Icon name="sparkles" size={15} /> Ask about your data</div>}
      />

      {configured === false && (
        <div className="list-card" style={{ borderLeft: "3px solid var(--blue)" }}>
          <div className="section-title">
            <Icon name="sparkles" size={16} /> AI Assistant is coming soon
          </div>
          <p style={{ margin: 0, color: "var(--text-light)", lineHeight: 1.6 }}>
            We're getting it ready. Soon you'll be able to ask questions about your sales,
            customers and stock in plain language and get answers straight from your own data.
            We'll let you know as soon as it's live.
          </p>
        </div>
      )}

      <div className="list-card">
        <div className="ai-ask-row">
          <textarea
            ref={inputRef}
            className="ai-ask-input"
            rows={2}
            placeholder="e.g. Which customers have not paid their invoices?"
            value={question}
            disabled={configured === false || busy}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={onKeyDown}
          />
          <button
            type="button"
            className="btn btn-primary"
            disabled={configured === false || busy || !question.trim()}
            onClick={() => ask()}
          >
            {busy ? "Thinking…" : "Ask"}
          </button>
        </div>

        <div className="ai-examples">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              className="ai-chip"
              disabled={configured === false || busy}
              onClick={() => ask(ex)}
            >
              {ex}
            </button>
          ))}
        </div>
      </div>

      {thread.map((item, i) => (
        <div className="list-card ai-turn" key={thread.length - i}>
          <div className="ai-q"><Icon name="user" size={14} /> {item.q}</div>
          {item.pending ? (
            <div className="ai-a loading-row" style={{ padding: "8px 0" }}><Loader small /></div>
          ) : item.error ? (
            <div className="ai-a login-error">{item.error}</div>
          ) : (
            <>
              <div className="ai-a" style={{ whiteSpace: "pre-wrap" }}>{item.a}</div>
              <ResultTable rows={item.rows} />
              {item.executed && item.executed.length > 0 && (
                <div className="ai-meta">
                  {item.executed
                    .map((e) => `${e.count} ${e.collection}${e.count === 1 ? "" : ""} matched`)
                    .join(" · ")}
                </div>
              )}
            </>
          )}
        </div>
      ))}
    </div>
  );
}
