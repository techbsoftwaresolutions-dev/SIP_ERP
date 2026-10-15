import { lazy, Suspense, useEffect, useRef, useState } from "react";
import Icon from "../ui/Icon";

const BarcodeScanner = lazy(() => import("./BarcodeScanner"));

// A line-item cell holding a LIST of values rather than one — used for
// per-unit serial/warranty numbers, where a single line (e.g. "Battery x5")
// can carry up to five distinct codes. Enter or a comma adds one; each shows
// as a removable chip. `scan` adds a camera button that appends a scanned
// code the same way a hardware scanner typing + Enter would.
export default function TagsCell({ values, onChange, scan, placeholder = "Add and press Enter" }) {
  const [text, setText] = useState("");
  const [scanning, setScanning] = useState(false);
  // Mirrors `values` synchronously so several additions in quick succession
  // (fast typing, comma-separated codes committed together, a hardware
  // scanner fired twice before the parent's state round-trips back down as a
  // fresh prop) each build on the true latest list instead of a `values`
  // snapshot that hasn't caught up yet — otherwise the earlier of two rapid
  // additions gets silently overwritten by the later one.
  const valuesRef = useRef(values);
  useEffect(() => {
    valuesRef.current = values;
  }, [values]);

  const addMany = (raws) => {
    const next = [...valuesRef.current];
    let changed = false;
    raws.forEach((raw) => {
      const v = String(raw || "").trim();
      if (v && !next.includes(v)) {
        next.push(v);
        changed = true;
      }
    });
    if (changed) {
      valuesRef.current = next;
      onChange(next);
    }
  };

  const remove = (v) => {
    const next = valuesRef.current.filter((x) => x !== v);
    valuesRef.current = next;
    onChange(next);
  };

  const commit = () => {
    addMany(text.split(","));
    setText("");
  };

  return (
    <div className="tags-cell">
      {values.length > 0 && (
        <div className="tags-cell-chips">
          {values.map((v) => (
            <span key={v} className="tags-cell-chip">
              {v}
              <button type="button" onClick={() => remove(v)} aria-label={`Remove ${v}`}>×</button>
            </span>
          ))}
        </div>
      )}
      <div className="tags-cell-input-row">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              commit();
            }
          }}
          onBlur={commit}
          placeholder={placeholder}
        />
        {scan && (
          <button type="button" className="icon-btn" title="Scan a serial number" onClick={() => setScanning(true)}>
            <Icon name="scan" size={14} />
          </button>
        )}
      </div>
      {scanning && (
        <Suspense fallback={null}>
          <BarcodeScanner
            title="Scan a serial / warranty number"
            onDetect={(code) => {
              setScanning(false);
              addMany([code]);
            }}
            onClose={() => setScanning(false)}
          />
        </Suspense>
      )}
    </div>
  );
}
