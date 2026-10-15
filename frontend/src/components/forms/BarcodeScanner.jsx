import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import Modal from "../ui/Modal";
import Icon from "../ui/Icon";

// Camera-based QR/barcode scanner, opened from a "Scan" button wherever a
// barcode can be used (Item form, Purchase Invoice, Sales Invoice line
// entry). A USB/Bluetooth hardware scanner needs none of this — it types
// straight into whichever text field has focus, like a fast keyboard — so
// this component only exists for scanning with a phone/laptop camera.
export default function BarcodeScanner({ title = "Scan a barcode or QR code", onDetect, onClose }) {
  const videoRef = useRef(null);
  const readerRef = useRef(null);
  const [error, setError] = useState("");
  const [manual, setManual] = useState("");

  useEffect(() => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setError("This browser can't access the camera. Enter the code below instead.");
      return;
    }
    const reader = new BrowserMultiFormatReader();
    readerRef.current = reader;
    let stopped = false;

    reader
      .decodeFromConstraints(
        { video: { facingMode: { ideal: "environment" } } },
        videoRef.current,
        (result) => {
          if (result && !stopped) {
            stopped = true;
            onDetect(result.getText());
          }
        }
      )
      .catch((err) => {
        setError(
          err && err.name === "NotAllowedError"
            ? "Camera access was blocked. Allow it in your browser's site settings, or enter the code below."
            : "Could not start the camera. Enter the code below instead."
        );
      });

    return () => {
      stopped = true;
      try {
        BrowserMultiFormatReader.releaseAllStreams();
      } catch (_) {
        // best-effort cleanup — nothing to do if the stream was never opened
      }
    };
  }, [onDetect]);

  // A plain div, not a <form> — this modal can open from inside a page's own
  // form (Add Item, Purchase/Sales Invoice), and a <form> nested inside
  // another <form> is invalid HTML with unreliable submit behavior.
  const submitManual = () => {
    const code = manual.trim();
    if (code) onDetect(code);
  };

  return (
    <Modal title={title} onClose={onClose}>
      <div className="scan-modal">
        {!error && (
          <div className="scan-video-wrap">
            <video ref={videoRef} className="scan-video" muted playsInline />
            <div className="scan-frame" />
          </div>
        )}
        {error && <div className="login-error">{error}</div>}
        <p className="field-hint" style={{ marginTop: error ? 0 : 12 }}>
          Point the camera at a barcode or QR code, or type it in manually.
        </p>
        <div className="scan-manual-row">
          <input
            type="text"
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submitManual();
              }
            }}
            placeholder="Enter code manually"
            autoFocus={Boolean(error)}
          />
          <button type="button" className="btn btn-primary" disabled={!manual.trim()} onClick={submitManual}>
            <Icon name="check" size={15} /> Use
          </button>
        </div>
      </div>
    </Modal>
  );
}
