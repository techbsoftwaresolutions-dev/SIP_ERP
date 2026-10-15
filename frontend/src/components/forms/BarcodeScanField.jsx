import { lazy, Suspense, useRef, useState } from "react";
import Icon from "../ui/Icon";

// Lazy for the same reason as in AddRecordForm.jsx — only loaded once the
// camera button is actually clicked.
const BarcodeScanner = lazy(() => import("./BarcodeScanner"));

// "Scan to add" row used above a line-items editor (Purchase Invoice, Sales
// Invoice). Handles BOTH scanning methods with the same box:
//   - a hardware USB/Bluetooth scanner types into this input like a fast
//     keyboard and ends with Enter, so no extra wiring is needed for it;
//   - the "Scan" button opens the camera for a phone/laptop with no scanner
//     attached.
// Either way, `onScan(code)` is called once with the decoded text — what
// happens with it (look up the item, add a row, show an error) is the
// caller's job, since that differs between forms.
export default function BarcodeScanField({ onScan, label = "Scan Barcode / QR", placeholder = "Scan, or type a code and press Enter" }) {
  const [value, setValue] = useState("");
  const [scanning, setScanning] = useState(false);
  const inputRef = useRef(null);

  const submit = (code) => {
    const c = String(code || "").trim();
    if (!c) return;
    onScan(c);
    setValue("");
    inputRef.current?.focus();
  };

  return (
    <div className="scan-add-row">
      <div className="field">
        <label>{label}</label>
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit(value);
            }
          }}
          placeholder={placeholder}
          autoComplete="off"
        />
      </div>
      <button type="button" className="btn field-scan-btn" onClick={() => setScanning(true)}>
        <Icon name="scan" size={15} /> Scan
      </button>
      {scanning && (
        <Suspense fallback={null}>
          <BarcodeScanner
            onDetect={(code) => {
              setScanning(false);
              submit(code);
            }}
            onClose={() => setScanning(false)}
          />
        </Suspense>
      )}
    </div>
  );
}
