import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import api from "../../api/client";
import Icon from "../../components/ui/Icon";
import Loader from "../../components/ui/Loader";

// Where somebody lands from an invitation or a password-reset email. Public by
// necessity — the whole point is that it works before you have an account you
// can sign in to. The token in the URL is what authorises it, and it is
// checked against the server before the form is even shown.
export default function SetPassword() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const navigate = useNavigate();

  const [state, setState] = useState(null); // null = still checking
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) {
      setState({ valid: false, message: "This link is missing its token." });
      return;
    }
    api
      .get(`/api/auth/set-password/check?token=${encodeURIComponent(token)}`)
      .then(setState)
      .catch((err) =>
        setState({ valid: false, message: err.message || "This link has expired or has already been used." })
      );
  }, [token]);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (password !== confirm) return setError("The two passwords do not match.");
    setSaving(true);
    try {
      await api.post("/api/auth/set-password", { token, password });
      setDone(true);
      // Straight to the login screen — not signed in automatically, because
      // the point of the exercise is that they now know their own password.
      setTimeout(() => navigate("/login", { replace: true }), 2200);
    } catch (err) {
      setError(err.message || "Could not set that password.");
      setSaving(false);
    }
  };

  const isReset = state && state.purpose === "reset";

  return (
    <div className="login-page">
      <div className="login-split">
        <div className="login-panel-left">
          <div className="login-card">
            {state === null ? (
              <div className="loading-row"><Loader /></div>
            ) : !state.valid ? (
              <>
                <div className="login-error">{state.message}</div>
                <p className="field-hint">
                  Links can only be used once and expire after 48 hours. Ask an administrator to send a new
                  invitation, or use <Link to="/forgot-password">forgot password</Link>.
                </p>
                <Link to="/login" className="btn login-submit" style={{ textAlign: "center" }}>
                  Back to sign in
                </Link>
              </>
            ) : done ? (
              <div className="setpw-done">
                <Icon name="checkCircle" size={34} />
                <h2>Password set</h2>
                <p>Taking you to the sign-in screen…</p>
              </div>
            ) : (
              <>
                <h2 className="setpw-title">
                  {isReset ? "Choose a new password" : `Welcome${state.name ? `, ${state.name}` : ""}`}
                </h2>
                <p className="field-hint" style={{ marginTop: 0 }}>
                  {isReset
                    ? "Pick a new password for your account."
                    : "Set a password to finish setting up your account."}
                </p>

                {error && <div className="login-error">{error}</div>}

                <form className="login-form" onSubmit={submit}>
                  <div className="field">
                    <label>New password</label>
                    <div className="password-input-wrap">
                      <input
                        type={show ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder={`At least ${state.minLength || 8} characters`}
                        autoComplete="new-password"
                        autoFocus
                      />
                      <button
                        type="button"
                        className="password-toggle-btn"
                        onClick={() => setShow((s) => !s)}
                        aria-label={show ? "Hide password" : "Show password"}
                      >
                        <Icon name={show ? "eyeOff" : "eye"} size={16} />
                      </button>
                    </div>
                    <span className="field-hint">
                      At least {state.minLength || 8} characters, with a letter and a number.
                    </span>
                  </div>

                  <div className="field">
                    <label>Confirm password</label>
                    <input
                      type={show ? "text" : "password"}
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      placeholder="Type it again"
                      autoComplete="new-password"
                    />
                  </div>

                  <button type="submit" className="login-submit" disabled={saving || !password || !confirm}>
                    {saving ? "Saving…" : isReset ? "Reset password" : "Set password"}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
        <div className="login-panel-right" />
      </div>
    </div>
  );
}
