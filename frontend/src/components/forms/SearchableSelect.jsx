import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Icon from "../ui/Icon";

// The app's dropdown. Opening it always shows EVERY option with the current
// one highlighted; typing then filters. When `onCreate` is given and the typed
// text doesn't match an existing option, an "+ Add ..." row lets the user
// create it on the fly (e.g. a new Category/Brand) — it's saved via `onCreate`,
// then selected immediately, without leaving the form.
//
// `options` are plain strings, or { value, label } when what is stored differs
// from what is shown. { header: "Group name" } adds a non-selectable group
// heading. `onChange` always receives the option's value.
//
// A short fixed list with no `onCreate` (a status, a unit, a payment mode) has
// nothing worth searching, so it behaves as a plain pick-one dropdown: click to
// open, no text cursor. Longer lists, and anything creatable, stay searchable.
// Pass `searchable` to force either behaviour.
//
// Keyboard: ↑/↓ move, Enter picks, Esc closes.
//
// The option menu is rendered through a portal into <body>, positioned with
// `position: fixed` from the control's own bounding box. This is what lets
// it escape any ancestor's `overflow: hidden`/`auto` clipping — e.g. a
// scrollable table wrapper (ItemsEditor) or a modal — which a plain
// `position: absolute` child would get cut off by. It opens upward when there
// isn't room below.
const MENU_MAX = 240;
const SEARCHABLE_ABOVE = 7;

const normalize = (o) =>
  o !== null && typeof o === "object"
    ? o.header !== undefined
      ? { header: String(o.header) }
      : { value: String(o.value ?? ""), label: String(o.label ?? o.value ?? ""), disabled: Boolean(o.disabled) }
    : { value: String(o), label: String(o), disabled: false };

export default function SearchableSelect({
  value,
  onChange,
  options = [],
  placeholder = "Select...",
  onCreate,
  createLabel = (text) => `+ Add "${text}"`,
  searchable,
  disabled,
  className = "",
  style,
  ariaLabel,
  title,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const items = options.map(normalize);
  const choices = items.filter((i) => i.header === undefined);
  const current = value === null || value === undefined ? "" : String(value);
  // What the control shows for the stored value: the matching option's label,
  // or the raw value when it isn't in the list (so nothing is ever hidden).
  const selectedItem = choices.find((i) => i.value === current);
  const display = selectedItem ? selectedItem.label : current;

  const [query, setQuery] = useState(display);
  // True once the user has actually typed since opening — until then the
  // input just shows the current value and the list is not filtered by it.
  const [dirty, setDirty] = useState(false);
  const [active, setActive] = useState(-1);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [menuPos, setMenuPos] = useState(null);
  const rootRef = useRef(null);
  const menuRef = useRef(null);
  const inputRef = useRef(null);

  const canSearch = searchable !== undefined ? searchable : Boolean(onCreate) || choices.length > SEARCHABLE_ABOVE;

  const close = () => {
    setIsOpen(false);
    setDirty(false);
    setActive(-1);
    setError("");
  };

  // Keep the input's text in sync with the selected value whenever it
  // changes from outside (e.g. editing an existing record) while closed.
  useEffect(() => {
    if (!isOpen) setQuery(display);
  }, [display, isOpen]);

  const updateMenuPos = () => {
    if (!rootRef.current) return;
    const r = rootRef.current.getBoundingClientRect();
    const below = window.innerHeight - r.bottom - 12;
    const above = r.top - 12;
    const openUp = below < 180 && above > below;
    const maxHeight = Math.max(120, Math.min(MENU_MAX, openUp ? above : below));
    setMenuPos(
      openUp
        ? { bottom: window.innerHeight - r.top + 6, left: r.left, width: r.width, maxHeight, up: true }
        : { top: r.bottom + 6, left: r.left, width: r.width, maxHeight, up: false }
    );
  };

  const openMenu = () => {
    if (disabled) return;
    updateMenuPos();
    setIsOpen(true);
  };

  useEffect(() => {
    if (!isOpen) return;
    const onOutside = (e) => {
      const inRoot = rootRef.current && rootRef.current.contains(e.target);
      const inMenu = menuRef.current && menuRef.current.contains(e.target);
      if (!inRoot && !inMenu) {
        close();
        setQuery(display);
      }
    };
    // Reposition on scroll (capture phase so scrolling inside any nested
    // container — e.g. a table's own horizontal scrollbar — is caught too)
    // and on resize, so the menu stays glued to the control while open.
    document.addEventListener("mousedown", onOutside);
    window.addEventListener("scroll", updateMenuPos, true);
    window.addEventListener("resize", updateMenuPos);
    return () => {
      document.removeEventListener("mousedown", onOutside);
      window.removeEventListener("scroll", updateMenuPos, true);
      window.removeEventListener("resize", updateMenuPos);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, display]);

  const trimmed = dirty ? query.trim() : "";
  const needle = trimmed.toLowerCase();
  // Group headings only make sense while the list is unfiltered.
  const shown = needle
    ? choices.filter((o) => o.label.toLowerCase().includes(needle))
    : items;
  const selectable = shown.filter((i) => i.header === undefined && !i.disabled);
  const exactMatch = choices.some((o) => o.label.toLowerCase() === needle);
  const canCreate = Boolean(onCreate) && trimmed.length > 0 && !exactMatch;

  // Start on the current value so ↓/Enter feel natural; reset as the list changes.
  useEffect(() => {
    if (!isOpen) return;
    const i = selectable.findIndex((o) => o.value === current);
    setActive(i >= 0 ? i : selectable.length ? 0 : -1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, dirty, query, options.length]);

  // Keep the highlighted option visible while arrowing through a long list.
  useEffect(() => {
    if (!isOpen || active < 0 || !menuRef.current) return;
    const el = menuRef.current.querySelector(`[data-idx="${active}"]`);
    if (el && el.scrollIntoView) el.scrollIntoView({ block: "nearest" });
  }, [active, isOpen]);

  const selectOption = (opt) => {
    onChange(opt.value);
    setQuery(opt.label);
    close();
  };

  const handleCreate = async () => {
    if (!canCreate || creating) return;
    setCreating(true);
    setError("");
    try {
      const created = await onCreate(query.trim());
      const text = String(created || query.trim());
      onChange(text);
      setQuery(text);
      close();
    } catch (err) {
      setError(err.message || "Could not add that. Please try again.");
    } finally {
      setCreating(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Escape") {
      close();
      setQuery(display);
      inputRef.current && inputRef.current.blur();
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!isOpen) return openMenu();
      if (!selectable.length) return;
      const step = e.key === "ArrowDown" ? 1 : -1;
      setActive((a) => (a < 0 ? 0 : (a + step + selectable.length) % selectable.length));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (!isOpen) return openMenu();
      if (active >= 0 && selectable[active]) selectOption(selectable[active]);
      else if (canCreate) handleCreate();
    } else if (e.key === "Tab") {
      close();
      setQuery(display);
    }
  };

  // Running index among SELECTABLE rows, so mouse hover and keyboard share one
  // notion of "active" even with group headings in between.
  let selIdx = -1;

  return (
    <div className={`combo ${className}`.trim()} ref={rootRef} style={style} title={title}>
      <div
        className={`combo-control ${isOpen ? "open" : ""} ${canSearch ? "" : "combo-pick"} ${disabled ? "combo-disabled" : ""}`}
        onClick={() => {
          if (!canSearch && !disabled) isOpen ? close() : openMenu();
        }}
      >
        <input
          ref={inputRef}
          type="text"
          className="combo-input"
          placeholder={placeholder}
          value={query}
          readOnly={!canSearch || disabled}
          disabled={disabled}
          aria-label={ariaLabel}
          autoComplete="off"
          onFocus={() => !isOpen && openMenu()}
          onClick={() => canSearch && !isOpen && openMenu()}
          onChange={(e) => {
            setQuery(e.target.value);
            setDirty(true);
            if (!isOpen) updateMenuPos();
            setIsOpen(true);
            setError("");
          }}
          onKeyDown={handleKeyDown}
        />
        <Icon name="chevronDown" size={14} className={`combo-caret ${isOpen ? "open" : ""}`} />
      </div>

      {isOpen && menuPos &&
        createPortal(
          <div
            className={`combo-menu ${menuPos.up ? "up" : ""}`}
            ref={menuRef}
            style={{
              position: "fixed",
              ...(menuPos.up ? { bottom: menuPos.bottom } : { top: menuPos.top }),
              left: menuPos.left,
              width: menuPos.width,
              maxHeight: menuPos.maxHeight,
            }}
          >
            {shown.length > 0 ? (
              shown.map((opt, i) => {
                if (opt.header !== undefined) {
                  return <div key={`h-${i}`} className="combo-group">{opt.header}</div>;
                }
                if (opt.disabled) {
                  return <div key={`${opt.value}-${i}`} className="combo-option disabled"><span>{opt.label}</span></div>;
                }
                const idx = ++selIdx;
                return (
                  <div
                    key={`${opt.value}-${i}`}
                    data-idx={idx}
                    className={`combo-option ${opt.value === current ? "selected" : ""} ${idx === active ? "active" : ""}`}
                    onMouseEnter={() => setActive(idx)}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      selectOption(opt);
                    }}
                  >
                    <span>{opt.label}</span>
                    {opt.value === current && <Icon name="check" size={14} />}
                  </div>
                );
              })
            ) : !canCreate ? (
              <div className="combo-empty">No matches</div>
            ) : null}

            {canCreate && (
              <div
                className="combo-option combo-create"
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleCreate();
                }}
              >
                {creating ? "Adding..." : createLabel(trimmed)}
              </div>
            )}

            {error && <div className="combo-error">{error}</div>}
          </div>,
          document.body
        )}
    </div>
  );
}
