import { useEffect, useState } from "react";
import api from "../../api/client";
import { masterKeyHeader } from "./MasterKeyGate";

// Shared menu-access picker, used by both the plan editor (what a tier
// unlocks) and the client editor (what this one client actually gets).
//
// Keys are stored at their finest level: a sub-page key for menus that have
// sub-pages, the menu key itself for the ones that don't. Records saved
// before sub-pages existed hold a bare parent key ("purchase"), which the
// server still reads as "all of this menu" — so on load those are expanded
// into their children and everything lines up.

export function selectableKeys(tree) {
  return tree.flatMap((m) => (m.children && m.children.length ? m.children.map((c) => c.key) : [m.key]));
}

export function expandStored(tree, stored) {
  const set = new Set(stored || []);
  const out = [];
  for (const m of tree) {
    const kids = m.children || [];
    if (!kids.length) {
      if (set.has(m.key)) out.push(m.key);
      continue;
    }
    if (set.has(m.key)) out.push(...kids.map((c) => c.key));
    else out.push(...kids.filter((c) => set.has(c.key)).map((c) => c.key));
  }
  return out;
}

// Loads the menu catalogue once. Returns [] until it arrives, so callers can
// simply skip rendering the picker while it is empty.
export function useMenuTree() {
  const [tree, setTree] = useState([]);
  useEffect(() => {
    api
      .get("/api/admin/permission-catalogue", masterKeyHeader())
      .then((c) => setTree(c.menuTree || []))
      .catch(() => setTree([]));
  }, []);
  return tree;
}

// One menu and its sub-pages. Ticking the menu takes all of its sub-pages
// with it; the box shows a dash while only some of them are on.
function MenuGroup({ menu, selected, setKeys, disabledKeys, disabledTitle }) {
  const kids = menu.children || [];
  const keys = kids.length ? kids.map((c) => c.key) : [menu.key];
  const enabled = keys.filter((k) => !disabledKeys.has(k));
  const on = keys.filter((k) => selected.has(k)).length;
  const all = enabled.length > 0 && enabled.every((k) => selected.has(k));
  const some = on > 0 && !all;
  // Nothing in this group is available on the plan, so the whole group is
  // out of reach rather than merely unticked.
  const groupDisabled = enabled.length === 0;

  return (
    <div className={`plan-menu-group${groupDisabled ? " is-disabled" : ""}`}>
      <label className="plan-module plan-module-parent">
        <input
          type="checkbox"
          checked={all}
          disabled={groupDisabled}
          ref={(el) => el && (el.indeterminate = some)}
          onChange={() => setKeys(enabled, !all)}
        />
        {menu.label}
        {kids.length > 0 && (
          <span className="plan-module-count">
            {on}/{keys.length}
          </span>
        )}
      </label>
      {kids.map((c) => {
        const off = disabledKeys.has(c.key);
        return (
          <label
            key={c.key}
            className={`plan-module plan-module-child${off ? " is-disabled" : ""}`}
            title={off ? disabledTitle : undefined}
          >
            <input
              type="checkbox"
              checked={selected.has(c.key)}
              disabled={off}
              onChange={() => setKeys([c.key], !selected.has(c.key))}
            />
            {c.label}
          </label>
        );
      })}
    </div>
  );
}

export default function MenuPicker({ tree, value, onChange, label, note, limitTo, exclude, disabledTitle }) {
  if (!tree.length) return null;

  const all = selectableKeys(tree);
  // Two independent ways a key can be out of reach:
  //   `limitTo` — the plan's menu list on the client editor: anything
  //      outside it can't be ticked, because a per-client override narrows
  //      what was sold, it never widens it. Empty/absent means no ceiling.
  //   `exclude` — top-level modules this picker must not offer at all, used
  //      by the plan editor to keep add-on-only modules out of plans.
  const ceiling = limitTo && limitTo.length ? new Set(expandStored(tree, limitTo)) : null;
  const excluded = new Set(exclude || []);
  const disabledKeys = new Set(
    all.filter((k) => {
      if (ceiling && !ceiling.has(k)) return true;
      const parent = k.includes(":") ? k.split(":")[0] : k;
      return excluded.has(k) || excluded.has(parent);
    })
  );
  const selectable = all.filter((k) => !disabledKeys.has(k));

  const selected = new Set(value);
  const setKeys = (keys, on) => {
    const next = new Set(value);
    keys.forEach((k) => (on ? next.add(k) : next.delete(k)));
    onChange(all.filter((k) => next.has(k)));
  };

  return (
    <div className="plan-modules">
      <div className="plan-modules-head">
        <span>
          {label} <em className="plan-modules-note">{note}</em>
        </span>
        <button type="button" className="btn" onClick={() => onChange(value.length ? [] : selectable)}>
          {value.length ? "Clear all" : "Select all"}
        </button>
      </div>
      <div className="plan-modules-grid">
        {tree.map((m) => (
          <MenuGroup
            key={m.key}
            menu={m}
            selected={selected}
            setKeys={setKeys}
            disabledKeys={disabledKeys}
            disabledTitle={disabledTitle || "Not available here"}
          />
        ))}
      </div>
    </div>
  );
}
