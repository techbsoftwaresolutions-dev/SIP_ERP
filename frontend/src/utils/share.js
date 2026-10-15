// Shared "Share" action for print pages (Purchase Order, Invoice, Delivery
// Challan, etc). Builds the exact same PDF the Download button produces, then
// hands it off to WhatsApp / Email.
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

// Renders one print sheet DOM node — or an array of them, one PDF page each
// (used by Invoice/Delivery Challan, which print Original/Duplicate/Triplicate
// copies) — into a PDF Blob. Identical output to each page's own "Download
// PDF" button, so what gets shared is exactly what gets downloaded.
export async function buildPdfBlob(sheetEl) {
  const nodes = (Array.isArray(sheetEl) ? sheetEl : [sheetEl]).filter(Boolean);
  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  for (let i = 0; i < nodes.length; i++) {
    const canvas = await html2canvas(nodes[i], { scale: 2, backgroundColor: "#ffffff", useCORS: true });
    // JPEG, not PNG: a 3-copy invoice as full-page 2x PNGs runs 5-15 MB, which
    // trips "remove large inline images or attachments" when shared to email.
    // JPEG at q0.9 of a mostly-white document is ~1/8 the size with no
    // visible quality loss (the canvas is already opaque white).
    const imgData = canvas.toDataURL("image/jpeg", 0.9);
    let renderWidth = pageWidth;
    let renderHeight = (canvas.height * renderWidth) / canvas.width;
    if (renderHeight > pageHeight) {
      renderHeight = pageHeight;
      renderWidth = (canvas.width * renderHeight) / canvas.height;
    }
    if (i > 0) pdf.addPage();
    pdf.addImage(imgData, "JPEG", (pageWidth - renderWidth) / 2, 0, renderWidth, renderHeight);
  }
  return pdf.output("blob");
}

// Document numbers can contain "/" (e.g. SIS/26-27/0001), which is not a
// legal filename character. Browsers mangle it inconsistently, so strip it
// here — every download in the app funnels through downloadBlob/shareDocument.
export function safeFileName(name) {
  return String(name || "document")
    .replace(/[\/:*?"<>|]+/g, "-") // illegal in filenames on Windows
    .replace(/\s+/g, " ")
    .replace(/-{2,}/g, "-")
    .trim();
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = safeFileName(filename);
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    a.remove();
    URL.revokeObjectURL(url);
  }, 1000);
}

// Shares a print sheet as a PDF over WhatsApp or Email.
//
// Prefers the browser's native share sheet (navigator.share) with the actual
// PDF file attached — supported on most mobile browsers and recent desktop
// Chrome/Edge — so the user picks WhatsApp/Gmail/etc. themselves with the
// real file already attached. When file-sharing isn't supported, falls back
// to downloading the PDF and opening the target app pre-filled with a text
// summary, so the user only has to attach the file they just downloaded.
export async function shareDocument({ sheetEl, filename, title, text, channel }) {
  const blob = await buildPdfBlob(sheetEl);
  const file = new File([blob], safeFileName(filename), { type: "application/pdf" });

  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title, text });
      return { shared: true };
    } catch (err) {
      if (err && err.name === "AbortError") return { shared: false, cancelled: true };
      // Any other failure (e.g. no share target installed) — fall through
      // to the manual fallback below instead of surfacing an error.
    }
  }

  downloadBlob(blob, filename);
  // mailto:/wa.me URLs can't carry a file — the PDF was just downloaded, so
  // spell out that the user needs to attach it themselves.
  const withAttachNote = `${text}\n\n(PDF "${filename}" was downloaded to your device — please attach it to this message.)`;
  if (channel === "whatsapp") {
    window.open(`https://wa.me/?text=${encodeURIComponent(withAttachNote)}`, "_blank", "noopener");
  } else if (channel === "email") {
    window.location.href = `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(withAttachNote)}`;
  }
  return { shared: false, downloaded: true };
}
