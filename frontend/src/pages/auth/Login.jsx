import { useEffect, useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useAuth, takeSessionExpiredFlag } from "../../context/AuthContext";
import Icon from "../../components/ui/Icon";

const REMEMBER_KEY = "siperp_remember_user";
// The design is drawn on a 1536 x 1024 canvas; on wide screens the whole
// canvas is scaled to fit so every element keeps its exact designed position.
const STAGE_W = 1536;
const STAGE_H = 1024;
const STAGE_MIN_VIEWPORT = 900;

function readRemembered() {
  try {
    return localStorage.getItem(REMEMBER_KEY) || "";
  } catch  {
    return "";
  }
}

function useStageScale() {
  const compute = () => ({
    scale: window.innerWidth < STAGE_MIN_VIEWPORT ? 0 : Math.min(window.innerWidth / STAGE_W, window.innerHeight / STAGE_H),
    vw: window.innerWidth,
    vh: window.innerHeight,
  });
  const [state, setState] = useState(compute);
  useEffect(() => {
    const onResize = () => setState(compute());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return state;
}

// The SIPERP "SIP" mark (public/logo-mark.png).
function SiperpMark() {
  return <img src="/logo-mark.png" alt="SIPERP" height="44" style={{ height: 44, width: "auto" }} />;
}

// Left half of the wide login screen. Real HTML laid out on the same 1536 x 1024
// canvas as the sign-in card, so it scales with it.
const HERO_MODULES = [
  ["cart", "Sales &", "Invoicing"],
  ["package", "Purchase &", "Inventory"],
  ["wrench", "Manufacturing", "& Maintenance"],
  ["chart", "Reports &", "Dashboard"],
];

function LoginHero() {
  return (
    <>
      <img className="tb-hero-logo" src="/logo-full.png" alt="SIPERP – Smart Industry Platform, a product by TechB Solutions" />
      <div className="tb-hero-tag">
        SIPERP ERP <i />
        <span>Smart Industry Platform</span>
      </div>

      <div className="tb-hero-eyebrow">SMART <i /> CONNECTED <i /> GST-READY</div>
      <h1 className="tb-hero-title">
        <b>One platform</b> to run your whole business
      </h1>
      <p className="tb-hero-text">
        Sales, purchase, inventory, manufacturing and reports, connected in one place and always up to date.
      </p>

      <div className="tb-hero-modules">
        {HERO_MODULES.map(([icon, a, b]) => (
          <div key={a}>
            <span><Icon name={icon} size={24} /></span>
            {a}
            <br />
            {b}
          </div>
        ))}
      </div>

      <div className="tb-hero-mock" aria-hidden="true">
        <div className="tb-mock-bar"><i /><i /><i /></div>
        <div className="tb-mock-body">
          <div className="tb-mock-side"><span /><span /><span /><span /><span /></div>
          <div className="tb-mock-main">
            <div className="tb-mock-kpis">
              <div><small>Sales</small><strong>₹12.4L</strong></div>
              <div><small>Receivable</small><strong>₹3.1L</strong></div>
              <div><small>Stock items</small><strong>248</strong></div>
            </div>
            <div className="tb-mock-chart">
              {[35, 52, 44, 68, 60, 82, 74, 90].map((h, i) => <span key={i} style={{ height: `${h}%` }} />)}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function GoogleG() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.6 5.9c4.4-4.1 7-10.1 7-17.6z" />
      <path fill="#FBBC05" d="M10.5 28.7c-.5-1.4-.8-3-.8-4.7s.3-3.2.8-4.7l-7.9-6.1C.9 16.5 0 20.1 0 24s.9 7.5 2.6 10.8l7.9-6.1z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.9 2.3-8.3 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
    </svg>
  );
}

export default function Login() {
  const { login, register, googleLogin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { scale } = useStageScale();
  const [mode, setMode] = useState("signin"); // "signin" | "register"
  const [username, setUsername] = useState(readRemembered);
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(() => Boolean(readRemembered()));
  const [name, setName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  // Read once on mount (the getter clears the flag), so landing here after a
  // session ends explains why — and a later manual visit to /login doesn't.
  const [sessionExpired] = useState(takeSessionExpiredFlag);

  const from = location.state?.from?.pathname || "/dashboard";
  const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";

  const handleGoogleSuccess = async (tokenOrCredential) => {
    setError("");
    setSubmitting(true);
    try {
      const result = await googleLogin(tokenOrCredential);
      if (result && result.success === false) {
        setError(result.message || "Google sign-in failed. Please try again.");
        return;
      }
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.message || "Google sign-in failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;

    const initGsi = () => {
      if (!window.google?.accounts?.id) return;
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: (response) => {
          if (response?.credential) {
            handleGoogleSuccess({ credential: response.credential });
          }
        },
      });
      window.google.accounts.id.prompt();
    };

    if (window.google?.accounts?.id) {
      initGsi();
    } else {
      const timer = setInterval(() => {
        if (window.google?.accounts?.id) {
          clearInterval(timer);
          initGsi();
        }
      }, 300);
      return () => clearInterval(timer);
    }
  }, [GOOGLE_CLIENT_ID]);

  const handleGoogleClick = () => {
    if (!GOOGLE_CLIENT_ID) {
      setError("Google Sign-In is not configured yet. Please add VITE_GOOGLE_CLIENT_ID in frontend/.env.");
      return;
    }

    if (!window.google?.accounts?.oauth2) {
      setError("Google authentication service is still loading. Please check your internet connection or try again in a moment.");
      return;
    }

    try {
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: "email profile openid",
        callback: (resp) => {
          if (resp.error) {
            setError(resp.error_description || "Google sign-in was cancelled.");
            return;
          }
          if (resp.access_token) {
            handleGoogleSuccess({ access_token: resp.access_token });
          }
        },
      });
      client.requestAccessToken();
    } catch (err) {
      setError("Unable to launch Google Sign-In: " + err.message);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!username.trim() || !password.trim()) {
      setError("Please enter both username and password.");
      return;
    }
    setSubmitting(true);
    try {
      const result = await login(username.trim(), password);
      if (result && result.success === false) {
        setError(result.message || "Login failed. Please try again.");
        return;
      }
      try {
        if (remember) localStorage.setItem(REMEMBER_KEY, username.trim());
        else localStorage.removeItem(REMEMBER_KEY);
      } catch  {
        // ignore storage failures
      }
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.message || "Login failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!name.trim()) {
      setError("Please enter your full name.");
      return;
    }
    if (!regEmail.trim()) {
      setError("Please enter your email address.");
      return;
    }
    if (!regPassword) {
      setError("Please enter a password.");
      return;
    }
    if (regPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (!/[a-zA-Z]/.test(regPassword) || !/[0-9]/.test(regPassword)) {
      setError("Password must contain at least one letter and one number.");
      return;
    }
    if (regPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      const result = await register({
        name: name.trim(),
        email: regEmail.trim(),
        password: regPassword,
      });
      if (result && result.success === false) {
        setError(result.message || "Registration failed. Please try again.");
        return;
      }
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.message || "Registration failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const card = (
    <div className="tb-card">
      <div className="tb-card-mark"><SiperpMark /></div>
      <h2>{mode === "signin" ? "Welcome Back" : "Create Account"}</h2>
      <p className="tb-card-sub">
        {mode === "signin" ? "Sign in to your SIPERP account" : "Join SIPERP to get started"}
      </p>

      {(error || sessionExpired) && (
        <div className={`tb-msg ${error ? "err" : ""}`}>
          {error || "Your session has ended. Please sign in again."}
        </div>
      )}

      {mode === "signin" ? (
        <form onSubmit={handleSubmit} noValidate>
          <label className="tb-label" htmlFor="username">Email Address</label>
          <div className="tb-input">
            <span className="tb-input-icon"><Icon name="mail" size={20} /></span>
            <input
              id="username"
              type="text"
              placeholder="Enter your email address"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              autoFocus
            />
          </div>

          <label className="tb-label pw" htmlFor="password">Password</label>
          <div className="tb-input">
            <span className="tb-input-icon"><Icon name="lock" size={20} /></span>
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
            <button
              type="button"
              className="tb-input-toggle"
              onClick={() => setShowPassword((v) => !v)}
              tabIndex={-1}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              <Icon name={showPassword ? "eyeOff" : "eye"} size={20} />
            </button>
          </div>

          <div className="tb-row">
            <label className="tb-remember">
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
              <span>Remember me</span>
            </label>
            <Link to="/forgot-password">Forgot password?</Link>
          </div>

          <button className="tb-submit" type="submit" disabled={submitting}>
            {submitting ? "Signing in..." : <>Sign In <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg></>}
          </button>
        </form>
      ) : (
        <form onSubmit={handleRegisterSubmit} noValidate>
          <label className="tb-label compact" htmlFor="reg-name">Full Name</label>
          <div className="tb-input">
            <span className="tb-input-icon"><Icon name="user" size={20} /></span>
            <input
              id="reg-name"
              type="text"
              placeholder="Enter your full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              autoFocus
            />
          </div>

          <label className="tb-label compact" htmlFor="reg-email">Email Address</label>
          <div className="tb-input">
            <span className="tb-input-icon"><Icon name="mail" size={20} /></span>
            <input
              id="reg-email"
              type="email"
              placeholder="Enter your email address"
              value={regEmail}
              onChange={(e) => setRegEmail(e.target.value)}
              autoComplete="email"
            />
          </div>

          <label className="tb-label compact" htmlFor="reg-password">Password</label>
          <div className="tb-input">
            <span className="tb-input-icon"><Icon name="lock" size={20} /></span>
            <input
              id="reg-password"
              type={showRegPassword ? "text" : "password"}
              placeholder="Min 8 chars, 1 letter & 1 number"
              value={regPassword}
              onChange={(e) => setRegPassword(e.target.value)}
              autoComplete="new-password"
            />
            <button
              type="button"
              className="tb-input-toggle"
              onClick={() => setShowRegPassword((v) => !v)}
              tabIndex={-1}
              aria-label={showRegPassword ? "Hide password" : "Show password"}
            >
              <Icon name={showRegPassword ? "eyeOff" : "eye"} size={20} />
            </button>
          </div>

          <label className="tb-label compact" htmlFor="confirm-password">Confirm Password</label>
          <div className="tb-input">
            <span className="tb-input-icon"><Icon name="lock" size={20} /></span>
            <input
              id="confirm-password"
              type={showConfirmPassword ? "text" : "password"}
              placeholder="Confirm your password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
            />
            <button
              type="button"
              className="tb-input-toggle"
              onClick={() => setShowConfirmPassword((v) => !v)}
              tabIndex={-1}
              aria-label={showConfirmPassword ? "Hide password" : "Show password"}
            >
              <Icon name={showConfirmPassword ? "eyeOff" : "eye"} size={20} />
            </button>
          </div>

          <button className="tb-submit" type="submit" disabled={submitting}>
            {submitting ? "Creating Account..." : <>Create Account <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg></>}
          </button>
        </form>
      )}

      <div className="tb-or"><span>OR</span></div>
      <button
        type="button"
        className="tb-google"
        disabled={submitting}
        onClick={handleGoogleClick}
      >
        <GoogleG /> {submitting ? "Connecting..." : "Continue with Google"}
      </button>

      <div className="tb-switch-mode">
        {mode === "signin" ? (
          <>
            Don't have an account?{" "}
            <button
              type="button"
              onClick={() => {
                setMode("register");
                setError("");
              }}
            >
              Create Account
            </button>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <button
              type="button"
              onClick={() => {
                setMode("signin");
                setError("");
              }}
            >
              Sign In
            </button>
          </>
        )}
      </div>

      <div className="tb-copy">
        © 2026 SIPERP, a product of TechB Software Solutions Pvt. Ltd.
        <br />
        All rights reserved.
        <br />
        <a href="https://siperp.in/terms-and-conditions/" target="_blank" rel="noopener noreferrer">Terms &amp; Conditions</a>
        {" · "}
        <a href="https://siperp.in/privacy-policy/" target="_blank" rel="noopener noreferrer">Privacy Policy</a>
      </div>
    </div>
  );

  if (!scale) {
    return <div className="tb-login-mobile">{card}</div>;
  }

  const stageW = STAGE_W * scale;
  const stageH = STAGE_H * scale;

  return (
    <div className="tb-login-wide">
      <div className="tb-stage-box" style={{ width: stageW, height: stageH }}>
        <div className="tb-stage" style={{ width: STAGE_W, height: STAGE_H, transform: `scale(${scale})` }}>
          <LoginHero />
          <div className="tb-card-slot">{card}</div>
        </div>
      </div>
    </div>
  );
}
