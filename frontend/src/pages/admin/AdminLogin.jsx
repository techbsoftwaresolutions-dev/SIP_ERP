import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAdminAuth } from "../../context/AdminAuthContext";
import Icon from "../../components/ui/Icon";

// Separate sign-in for the control plane. There is no sign-up link and no
// password reset by design: the first account is created with
// `npm run create-admin`, and the same command resets a lost password.
export default function AdminLogin() {
  const { login, isAuthenticated } = useAdminAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (isAuthenticated) return <Navigate to="/admin" replace />;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!email.trim() || !password) {
      setError("Enter both email and password.");
      return;
    }
    setSubmitting(true);
    try {
      await login(email.trim(), password);
      navigate("/admin", { replace: true });
    } catch (err) {
      setError(err.message || "Sign in failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="admin-login-page">
      <div className="admin-login-grid" aria-hidden="true" />
      <div className="admin-login-glow admin-login-glow-a" aria-hidden="true" />
      <div className="admin-login-glow admin-login-glow-b" aria-hidden="true" />

      <div className="admin-login-shell">
        <div className="admin-login-brand">
          <div className="admin-login-mark">
            <img src="/logo-mark.png" alt="SIPERP" />
          </div>
          <div className="admin-login-brand-text">
            <strong>SIPERP</strong>
            <span>Control Plane</span>
          </div>
        </div>

        <form className="admin-login-card" onSubmit={handleSubmit}>
          <span className="admin-login-eyebrow">Platform Admin</span>
          <h1>Welcome back</h1>
          {error && <div className="login-error">{error}</div>}

          <label className="admin-login-label" htmlFor="admin-email">
            Email
          </label>
          <div className="admin-login-input-wrap">
            <Icon name="mail" size={16} className="admin-login-input-icon" />
            <input
              id="admin-email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>

          <label className="admin-login-label" htmlFor="admin-password">
            Password
          </label>
          <div className="admin-login-input-wrap password-input-wrap">
            <Icon name="lock" size={16} className="admin-login-input-icon" />
            <input
              id="admin-password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
            />
            <button
              type="button"
              className="password-toggle-btn"
              onClick={() => setShowPassword((v) => !v)}
              tabIndex={-1}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              <Icon name={showPassword ? "eyeOff" : "eye"} size={18} />
            </button>
          </div>

          <button type="submit" className="btn btn-primary admin-login-btn" disabled={submitting}>
            {submitting ? "Signing in..." : "Sign in"}
          </button>

          <a href="/login" className="admin-login-alt">
            Looking for the client app?
            <Icon name="chevronRight" size={14} />
          </a>
        </form>

        <p className="admin-login-footer">
          <Icon name="lock" size={12} /> Protected access · TechB Software Solutions
        </p>
      </div>
    </div>
  );
}
