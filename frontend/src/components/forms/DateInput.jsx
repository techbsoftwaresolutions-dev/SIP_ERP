import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Icon from "../ui/Icon";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const POPOVER_W = 296;
const POPOVER_H = 372;
const TIME_ROW_H = 52;

const pad = (n) => String(n).padStart(2, "0");
const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function parseISO(v) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v || "");
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

function timeOf(v) {
  const m = /T(d{2}):(d{2})/.exec(v || "");
  return m ? { h: m[1], mi: m[2] } : { h: "09", mi: "00" };
}

function display(v, withTime) {
  const d = parseISO(v);
  if (!d) return "";
  const base = `${pad(d.getDate())} ${MONTHS[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`;
  if (!withTime) return base;
  const t = timeOf(v);
  return `${base}, ${t.h}:${t.mi}`;
}

// Drop-in replacement for <input type="date">: same "YYYY-MM-DD" value and an
// onChange that receives { target: { value } }, so existing handlers keep
// working. The native browser calendar cannot be styled, so this draws its own.
export default function DateInput({ value = "", onChange, min, max, disabled, readOnly, withTime, placeholder = "Select date", className, style, id }) {
  const inputRef = useRef(null);
  const popRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState("days"); // "days" | "months"
  const selected = parseISO(value);
  const today = new Date();
  const [view, setView] = useState(() => {
    const base = selected || today;
    return { y: base.getFullYear(), m: base.getMonth() };
  });
  const [pos, setPos] = useState({ top: 0, left: 0 });

  const minD = parseISO(min);
  const maxD = parseISO(max);

  const popH = POPOVER_H + (withTime ? TIME_ROW_H : 0);
  const place = () => {
    const el = inputRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const below = window.innerHeight - r.bottom;
    const top = below >= popH + 8 || r.top < popH + 8 ? r.bottom + 6 : r.top - popH - 6;
    const left = Math.max(8, Math.min(r.left, window.innerWidth - POPOVER_W - 8));
    setPos({ top: Math.max(8, Math.min(top, window.innerHeight - popH - 8)), left });
  };

  useLayoutEffect(() => {
    if (!open) return undefined;
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (popRef.current?.contains(e.target) || inputRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const openPicker = () => {
    if (disabled || readOnly) return;
    const base = parseISO(value) || new Date();
    setView({ y: base.getFullYear(), m: base.getMonth() });
    setMode("days");
    setOpen(true);
  };

  const emit = (v) => onChange && onChange({ target: { value: v } });
  const t = timeOf(value);
  const stamp = (d, time = t) => (withTime ? `${toISO(d)}T${time.h}:${time.mi}` : toISO(d));
  const pick = (d) => {
    emit(stamp(d));
    if (!withTime) setOpen(false);
  };
  const setTime = (patch) => {
    const next = { ...t, ...patch };
    emit(stamp(selected || new Date(), next));
  };
  const isOut = (d) => (minD && d < minD) || (maxD && d > maxD);

  const shiftMonth = (delta) => {
    const d = new Date(view.y, view.m + delta, 1);
    setView({ y: d.getFullYear(), m: d.getMonth() });
  };

  const first = new Date(view.y, view.m, 1);
  const start = new Date(view.y, view.m, 1 - first.getDay());
  const cells = Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
  const sameDay = (a, b) => a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  return (
    <div className={`dp-wrap${className ? ` ${className}` : ""}`} style={style}>
      <input
        id={id}
        ref={inputRef}
        type="text"
        readOnly
        disabled={disabled}
        className={`dp-input${readOnly ? " field-readonly" : ""}`}
        value={display(value, withTime)}
        placeholder={placeholder}
        autoComplete="off"
        onClick={openPicker}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
            e.preventDefault();
            openPicker();
          }
        }}
      />
      <span className="dp-icon" aria-hidden="true">
        <Icon name="calendar" size={18} />
      </span>

      {open &&
        createPortal(
          <div ref={popRef} className="dp-pop" style={{ top: pos.top, left: pos.left, width: POPOVER_W }} role="dialog" aria-label="Choose date">
            {mode === "days" ? (
              <>
                <div className="dp-head">
                  <button type="button" className="dp-nav" onClick={() => shiftMonth(-1)} aria-label="Previous month">
                    <Icon name="chevronLeft" size={16} />
                  </button>
                  <button type="button" className="dp-title" onClick={() => setMode("months")}>
                    {MONTHS[view.m]} {view.y}
                    <Icon name="chevronDown" size={13} />
                  </button>
                  <button type="button" className="dp-nav" onClick={() => shiftMonth(1)} aria-label="Next month">
                    <Icon name="chevronRight" size={16} />
                  </button>
                </div>
                <div className="dp-grid dp-week">
                  {WEEKDAYS.map((w) => (
                    <span key={w}>{w}</span>
                  ))}
                </div>
                <div className="dp-grid">
                  {cells.map((d) => {
                    const other = d.getMonth() !== view.m;
                    const cls = ["dp-day", other ? "other" : "", sameDay(d, selected) ? "selected" : "", sameDay(d, today) ? "today" : ""].join(" ");
                    return (
                      <button key={d.getTime()} type="button" className={cls} disabled={isOut(d)} onClick={() => pick(d)}>
                        {d.getDate()}
                      </button>
                    );
                  })}
                </div>
                <div className="dp-foot">
                  <button
                    type="button"
                    onClick={() => {
                      emit("");
                      setOpen(false);
                    }}
                  >
                    Clear
                  </button>
                  <button type="button" onClick={() => !isOut(today) && pick(today)}>
                    Today
                  </button>
                </div>
                {withTime && (
                  <div className="dp-time">
                    <span>Time</span>
                    <select value={t.h} onChange={(e) => setTime({ h: e.target.value })} aria-label="Hour">
                      {Array.from({ length: 24 }, (_, i) => pad(i)).map((h) => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                    <b>:</b>
                    <select value={t.mi} onChange={(e) => setTime({ mi: e.target.value })} aria-label="Minute">
                      {Array.from({ length: 60 }, (_, i) => pad(i)).map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                    <button type="button" className="dp-done" onClick={() => setOpen(false)}>Done</button>
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="dp-head">
                  <button type="button" className="dp-nav" onClick={() => setView((v) => ({ ...v, y: v.y - 1 }))} aria-label="Previous year">
                    <Icon name="chevronLeft" size={16} />
                  </button>
                  <span className="dp-title static">{view.y}</span>
                  <button type="button" className="dp-nav" onClick={() => setView((v) => ({ ...v, y: v.y + 1 }))} aria-label="Next year">
                    <Icon name="chevronRight" size={16} />
                  </button>
                </div>
                <div className="dp-months">
                  {MONTHS.map((name, i) => (
                    <button
                      key={name}
                      type="button"
                      className={`dp-month${i === view.m ? " selected" : ""}`}
                      onClick={() => {
                        setView((v) => ({ ...v, m: i }));
                        setMode("days");
                      }}
                    >
                      {name.slice(0, 3)}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>,
          document.body
        )}
    </div>
  );
}
