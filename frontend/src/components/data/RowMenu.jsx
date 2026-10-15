import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import Icon from "../ui/Icon";

// The "..." button at the end of a row, opening a small menu of that row's
// actions. The menu is drawn in a portal with fixed positioning so a table that
// scrolls sideways can never clip it.
//
//   items: [{ label, icon?, onClick?, to?, danger?, disabled?, hidden? }]
const MENU_W = 210;

export default function RowMenu({ items = [], label = "More actions" }) {
  const btnRef = useRef(null);
  const menuRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const visible = items.filter((i) => !i.hidden);

  const place = () => {
    const el = btnRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const estH = visible.length * 38 + 12;
    const below = window.innerHeight - r.bottom;
    const top = below >= estH + 8 || r.top < estH + 8 ? r.bottom + 6 : r.top - estH - 6;
    const left = Math.max(8, Math.min(r.right - MENU_W, window.innerWidth - MENU_W - 8));
    setPos({ top, left });
  };

  useLayoutEffect(() => {
    if (open) place();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (menuRef.current && menuRef.current.contains(e.target)) return;
      if (btnRef.current && btnRef.current.contains(e.target)) return;
      setOpen(false);
    };
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    const close = () => setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  if (visible.length === 0) return null;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className="row-menu-btn"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        title={label}
        onClick={() => setOpen((v) => !v)}
      >
        <Icon name="ellipsis" size={18} />
      </button>
      {open &&
        createPortal(
          <div ref={menuRef} className="row-menu" role="menu" style={{ top: pos.top, left: pos.left, width: MENU_W }}>
            {visible.map((item) => {
              const inner = (
                <>
                  {item.icon ? <Icon name={item.icon} size={15} /> : null}
                  <span>{item.label}</span>
                </>
              );
              const cls = `row-menu-item${item.danger ? " danger" : ""}${item.disabled ? " disabled" : ""}`;
              return item.to && !item.disabled ? (
                <Link key={item.label} to={item.to} role="menuitem" className={cls} onClick={() => setOpen(false)}>
                  {inner}
                </Link>
              ) : (
                <button
                  key={item.label}
                  type="button"
                  role="menuitem"
                  className={cls}
                  disabled={item.disabled}
                  onClick={() => {
                    setOpen(false);
                    if (item.onClick) item.onClick();
                  }}
                >
                  {inner}
                </button>
              );
            })}
          </div>,
          document.body
        )}
    </>
  );
}
