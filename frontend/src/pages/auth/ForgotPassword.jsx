import { useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api/client";
import Icon from "../../components/ui/Icon";

// Asking for a reset link. The server answers identically whether or not the
// address belongs to an account, and so does this screen — a page that said
// "no such user" would be a way to find out who works at a company.
export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setSending(true);
    try {
      await api.post("/api/auth/forgot-password", { email });
      setSent(true);
    } catch (err) {
      setError(err.message || "Could not send a reset link.");
      setSending(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-split">
        <div className="login-panel-left">
          <div className="login-card">
            {sent ? (
              <div className="setpw-done">
                <Icon name="mail" size={34} />
                <h2>Check your email</h2>
                <p>
                  If that address belongs to an account, a reset link is on its way. It works once and expires in
                  48 hours.
                </p>
                <Link to="/login" className="btn login-submit" style={{ textAlign: "center", marginTop: 14 }}>
                  Back to sign in
                </Link>
              </div>
            ) : (
              <>
                <h2 className="setpw-title">Forgot your password?</h2>
                <p className="field-hint" style={{ marginTop: 0 }}>
                  Enter the email address on your account and we’ll send you a link to set a new password.
                </p>

                {error && <div className="login-error">{error}</div>}

                <form className="login-form" onSubmit={submit}>
                  <div className="field">
                    <label>Email</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@company.com"
                      autoComplete="email"
                      autoFocus
                    />
                  </div>
                  <button type="submit" className="login-submit" disabled={sending || !email.trim()}>
                    {sending ? "Sending…" : "Send reset link"}
                  </button>
                </form>

                <p className="field-hint" style={{ textAlign: "center", marginTop: 14 }}>
                  <Link to="/login">Back to sign in</Link>
                </p>
              </>
            )}
          </div>
        </div>
        <div className="login-panel-right" />
      </div>
    </div>
  );
}
