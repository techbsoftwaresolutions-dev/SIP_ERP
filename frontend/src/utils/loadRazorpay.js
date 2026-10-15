// Loads the Razorpay Checkout widget script on demand — only when a client
// actually opens the upgrade flow, not on every page load. Cached so a
// second upgrade attempt in the same session doesn't refetch it.
let loadPromise = null;

export function loadRazorpayScript() {
  if (window.Razorpay) return Promise.resolve(true);
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => {
      loadPromise = null; // let a later attempt retry instead of staying stuck
      reject(new Error("Could not load the payment widget. Check your connection and try again."));
    };
    document.body.appendChild(script);
  });
  return loadPromise;
}
