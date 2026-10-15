// "Which copies?" for a document's Print and Download buttons: one checkbox per
// copy (Original, Duplicate, Office). Print, PDF and Word include exactly the
// ticked ones, in this order. The starting selection comes from Settings ->
// General (the first N copies); changing it here only affects this preview.
//
//   labels:   every copy's name, e.g. ["ORIGINAL COPY", "DUPLICATE COPY", "OFFICE COPY"]
//   selected: indexes of the ticked copies, e.g. [0, 1]
//   onChange: called with the new, sorted list of indexes
//
// At least one copy always stays ticked, so Print can never produce nothing.
const nice = (label) => label.replace(/ COPY$/, "").replace(/ — .*/, "");

export default function CopiesPicker({ labels = [], selected = [0], onChange }) {
  const toggle = (i) => {
    const on = selected.includes(i);
    if (on && selected.length === 1) return;
    onChange((on ? selected.filter((x) => x !== i) : [...selected, i]).sort((a, b) => a - b));
  };

  return (
    <div>
      <div className="invoice-side-panel-title">Print options: copies</div>
      <div className="copies-checks" role="group" aria-label="Copies to print">
        {labels.map((label, i) => (
          <label key={i} className={selected.includes(i) ? "on" : ""}>
            <input
              type="checkbox"
              checked={selected.includes(i)}
              onChange={() => toggle(i)}
              disabled={selected.includes(i) && selected.length === 1}
            />
            <span>{nice(label)}</span>
          </label>
        ))}
      </div>
      <div className="copies-picker-hint">
        {selected.map((i) => nice(labels[i] || "")).join(" · ")}
      </div>
    </div>
  );
}
