// The menu × action grid, shared by the client's own Roles screen and the
// platform's Global Roles editor so the two can never drift apart.
//
// Which cells exist is decided by the Global Permissions registry: each module
// in the catalogue carries the actions it actually offers, so a menu that only
// ever reads shows one checkbox instead of four. A withdrawn action renders as
// a dash rather than vanishing, because "this cannot be granted" and "nobody
// has granted it" are different things and the grid has to say which.
export default function PermissionMatrix({ modules, actions, value, onChange, disabled }) {
  const selected = value instanceof Set ? value : new Set(value || []);

  // An absent `actions` list on a module means the catalogue predates the
  // registry — treat it as offering everything, which is what the server does.
  const offers = (m, action) => !m.actions || m.actions.includes(action);

  const setKeys = (keys, on) => {
    if (disabled) return;
    const next = new Set(selected);
    keys.forEach((k) => (on ? next.add(k) : next.delete(k)));
    onChange([...next]);
  };

  const toggle = (key) => setKeys([key], !selected.has(key));

  const toggleRow = (m) => {
    const keys = actions.filter((a) => offers(m, a)).map((a) => `${m.key}.${a}`);
    setKeys(keys, !keys.every((k) => selected.has(k)));
  };

  const toggleColumn = (action) => {
    const keys = modules.filter((m) => offers(m, action)).map((m) => `${m.key}.${action}`);
    setKeys(keys, !keys.every((k) => selected.has(k)));
  };

  return (
    <div className="perm-matrix-wrap">
      <table className="perm-matrix">
        <thead>
          <tr>
            <th>Menu</th>
            {actions.map((a) => (
              <th key={a} className="num">
                <button
                  type="button"
                  className="perm-col-toggle"
                  onClick={() => toggleColumn(a)}
                  disabled={disabled}
                  title={`Toggle ${a} for every menu that offers it`}
                >
                  {a}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {modules.map((m) => (
            <tr key={m.key}>
              <td>
                <button
                  type="button"
                  className="perm-row-toggle"
                  onClick={() => toggleRow(m)}
                  disabled={disabled}
                  title="Toggle every action this menu offers"
                >
                  {m.label}
                </button>
              </td>
              {actions.map((a) => {
                const key = `${m.key}.${a}`;
                if (!offers(m, a)) {
                  return (
                    <td key={a} className="num perm-cell-off" title="Switched off for every client in Global Permissions">
                      —
                    </td>
                  );
                }
                return (
                  <td key={a} className="num">
                    <input
                      type="checkbox"
                      checked={disabled || selected.has(key)}
                      disabled={disabled}
                      onChange={() => toggle(key)}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
