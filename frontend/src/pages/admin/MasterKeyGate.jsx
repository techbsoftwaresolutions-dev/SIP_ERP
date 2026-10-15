import { createContext, useCallback, useContext, useState } from "react";
import { readAdminAuth } from "../../api/adminClient";
import PasswordInput from "../../components/forms/PasswordInput";

const STORAGE_KEY = "siperp_master_key";

export function getMasterKey() {
  try {
    return sessionStorage.getItem(STORAGE_KEY) || "";
  } catch  {
    return "";
  }
}

function storeMasterKey(key) {
  try {
    sessionStorage.setItem(STORAGE_KEY, key);
  } catch  {
    // Worst case it just gets asked for again next request — never block on this.
  }
}

// Header to attach to every /api/admin/* request. The backend is the
// only place that actually validates the key — this just remembers what
// the user typed for the rest of the browser session.
export function masterKeyHeader() {
  // A signed-in super admin is already authenticated, so their session token
  // is sent instead of asking for the master key on top of it. The backend
  // accepts either (see requireMasterKey in tenantAdminRoutes.js); the key is
  // only the fallback for anyone reaching these routes outside /admin.
  const adminToken = readAdminAuth()?.token;
  if (adminToken) return { Authorization: `Bearer ${adminToken}` };
  const key = getMasterKey();
  return key ? { "X-Master-Key": key } : {};
}

export function clearMasterKey() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch  {
    // ignore
  }
}

const MasterKeyContext = createContext(null);

// Lets an admin screen throw the key away and re-prompt. Storing a key is not
// the same as it being correct — without this, one typo left the screen stuck
// on "Invalid master key." forever, because the gate treats "a key exists" as
// "unlocked" and there was no way to enter a different one.
export function useMasterKey() {
  return useContext(MasterKeyContext) || { relock: () => {} };
}

// Call from an admin page's catch block: a 401 means the stored key is wrong,
// so drop it and send the user back to the unlock form.
export function useRelockOnInvalidKey() {
  const { relock } = useMasterKey();
  return useCallback(
    (err) => {
      if (err && err.status === 401) {
        relock("That master key was rejected. Please enter it again.");
        return true;
      }
      return false;
    },
    [relock]
  );
}

// Wraps the admin screens: asks once per browser session for the master admin
// key (the same value set as MASTER_ADMIN_KEY in the backend's .env) before
// rendering anything. The key lives only in this tab's sessionStorage — never
// in code, never sent anywhere except the X-Master-Key header on
// /api/admin/* requests, cleared when the tab closes.
export default function MasterKeyGate({ children }) {
  // Already signed in to the control plane? Then there is nothing to unlock.
  const [unlocked, setUnlocked] = useState(() => Boolean(readAdminAuth()?.token) || Boolean(getMasterKey()));
  const [input, setInput] = useState("");
  const [notice, setNotice] = useState("");

  const relock = useCallback((message) => {
    clearMasterKey();
    setInput("");
    setNotice(message || "");
    setUnlocked(false);
  }, []);

  if (unlocked) {
    return <MasterKeyContext.Provider value={{ relock }}>{children}</MasterKeyContext.Provider>;
  }

  return (
    <div>
      <div className="list-card add-page-card">
        <div className="section-title">Enter Master Key</div>
        {notice && <div className="login-error">{notice}</div>}
        <p className="field-hint">
          Managing clients and plans (adding, editing, or suspending them) requires the master
          admin key — the <code>MASTER_ADMIN_KEY</code> value set in the backend's <code>.env</code>.
        </p>
        <form
          className="add-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (!input.trim()) return;
            storeMasterKey(input.trim());
            setNotice("");
            setUnlocked(true);
          }}
        >
          <div className="field">
            <label><span>Master Key</span></label>
            <PasswordInput
              autoFocus
              placeholder="Enter master key"
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
          </div>
          <div className="add-form-actions">
            <button type="submit" className="btn btn-primary">Unlock</button>
          </div>
        </form>
      </div>
    </div>
  );
}
