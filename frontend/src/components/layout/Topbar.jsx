import { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import api from "../../api/client";
import Modal from "../ui/Modal";
import Icon from "../ui/Icon";
import PasswordInput from "../forms/PasswordInput";

function formatToday() {
  const d = new Date();
  const day = d.getDate();
  const month = d.toLocaleString("en-US", { month: "short" });
  const year = d.getFullYear();
  return `${day} ${month} ${year}`;
}

function timeAgo(dateStr) {
  if (!dateStr) return "";
  const then = new Date(dateStr).getTime();
  if (Number.isNaN(then)) return dateStr;
  const diffMs = Date.now() - then;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function Topbar({ onMenuClick }) {
  const { user, logout, updateUser, updateToken } = useAuth();
  const { theme, setTheme, themes: availableThemes } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const [bellOpen, setBellOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [notifTotal, setNotifTotal] = useState(0);
  const [loadingNotifs, setLoadingNotifs] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchRef = useRef(null);
  const searchTimer = useRef(null);

  const [logo, setLogo] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [profile, setProfile] = useState({ adminName: "", adminAvatar: "", username: "" });
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [draftAvatar, setDraftAvatar] = useState("");
  const [draftUsername, setDraftUsername] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState("");

  // The built-in admin's login username is a Company Settings field, so it's
  // only shown for that account — a Users & Roles account logs in with its
  // email instead and has no separate "username" of its own.
  const isBuiltinAccount = !user?.id;

  // Change-password is its own section with its own save action, on purpose:
  // it needs the current password to verify, which name/photo/username
  // don't, and a failed password change shouldn't block saving the rest.
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const newPasswordWeak = newPassword !== "" && (newPassword.length < 8 || !/[A-Za-z]/.test(newPassword) || !/d/.test(newPassword));
  const confirmMismatch = confirmPassword !== "" && newPassword !== confirmPassword;
  const confirmMatches = confirmPassword !== "" && newPassword === confirmPassword;

  const bellRef = useRef(null);
  const userRef = useRef(null);

  // Show whoever is actually signed in: a Users & Roles account keeps its own
  // name, and the built-in admin's `user.name` is already the Company Settings
  // "Edit Profile" name (set server-side at login). `profile.adminName` is
  // only a fallback so it can't mask a real user.
  const displayName = user?.name || profile.adminName || "Admin";
  const displayAvatar = String(user?.avatar || "").startsWith("data:")
    ? user.avatar
    : profile.adminAvatar || "";
  const displayRole = user?.role || "Administrator";

  const loadProfile = () => {
    api
      .get("/api/settings")
      .then((s) => {
        setProfile({ adminName: s?.adminName || "", adminAvatar: s?.adminAvatar || "", username: s?.username || "admin" });
        setLogo(s?.logo || "");
        setCompanyName(s?.companyName || "");
      })
      .catch(() => { });
  };

  // Closes the whole user dropdown, including the theme submenu if it was open.
  const closeUserMenu = () => {
    setUserOpen(false);
    setThemeMenuOpen(false);
  };

  useEffect(() => {
    const onClickOutside = (e) => {
      if (bellRef.current && !bellRef.current.contains(e.target)) setBellOpen(false);
      if (userRef.current && !userRef.current.contains(e.target)) closeUserMenu();
      if (searchRef.current && !searchRef.current.contains(e.target)) setSearchOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchQuery(value);
    setSearchOpen(true);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (value.trim().length < 2) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }
    setSearchLoading(true);
    searchTimer.current = setTimeout(async () => {
      try {
        const r = await api.get(`/api/search?q=${encodeURIComponent(value.trim())}`);
        setSearchResults(r.results || []);
      } catch  {
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 300);
  };

  const goToResult = (result) => {
    setSearchOpen(false);
    setSearchQuery("");
    setSearchResults([]);
    navigate(result.path);
  };

  useEffect(() => {
    loadProfile();
    // The bell surfaces things that need action (overdue payments, low
    // stock, late deliveries). Past activity lives on the Audit Logs page.
    // Not needed to paint the page, and it is the heaviest startup call —
    // so it waits until the screen has drawn instead of competing with it.
    const timer = setTimeout(() => {
      api
        .swr("/api/reminders", (r) => setNotifTotal((r.counts && r.counts.total) || 0))
        .catch(() => { });
    }, 1200);
    return () => clearTimeout(timer);
  }, []);

  const openBell = async () => {
    const next = !bellOpen;
    setBellOpen(next);
    closeUserMenu();
    if (next) {
      setLoadingNotifs(true);
      try {
        const r = await api.get("/api/reminders");
        setNotifications((r.items || []).slice(0, 6));
        setNotifTotal((r.counts && r.counts.total) || 0);
      } catch  {
        setNotifications([]);
      } finally {
        setLoadingNotifs(false);
      }
    }
  };

  const openUser = () => {
    setUserOpen((v) => {
      const next = !v;
      if (!next) setThemeMenuOpen(false);
      return next;
    });
    setBellOpen(false);
  };

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  const goSubscription = () => {
    closeUserMenu();
    navigate("/subscription");
  };

  const goSettings = () => {
    closeUserMenu();
    navigate("/settings/company");
  };

  const openProfileModal = () => {
    closeUserMenu();
    setDraftName(displayName);
    setDraftAvatar(profile.adminAvatar || "");
    setDraftUsername(profile.username || "admin");
    setProfileError("");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setPasswordError("");
    setPasswordSuccess("");
    setProfileModalOpen(true);
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setProfileError("That image is too large. Please choose a photo under 5MB.");
      e.target.value = "";
      return;
    }
    setProfileError("");
    const reader = new FileReader();
    reader.onload = () => {
      // Downscale to a small square before storing — the avatar renders at
      // 36px, so a multi-MB original just bloats /api/settings and can flash
      // full-size while it decodes.
      const img = new Image();
      img.onload = () => {
        const SIZE = 160;
        const canvas = document.createElement("canvas");
        canvas.width = SIZE;
        canvas.height = SIZE;
        const side = Math.min(img.width, img.height);
        const sx = (img.width - side) / 2;
        const sy = (img.height - side) / 2;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, sx, sy, side, side, 0, 0, SIZE, SIZE);
        setDraftAvatar(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.onerror = () => setDraftAvatar(reader.result); // fall back to the raw image
      img.src = reader.result;
    };
    reader.onerror = () => setProfileError("Could not read that image. Please try a different file.");
    reader.readAsDataURL(file);
  };

  const saveProfile = async () => {
    if (isBuiltinAccount && !draftUsername.trim()) {
      setProfileError("Username can't be empty.");
      return;
    }
    setSavingProfile(true);
    setProfileError("");
    try {
      const payload = { adminName: draftName.trim(), adminAvatar: draftAvatar };
      if (isBuiltinAccount) payload.username = draftUsername.trim();
      const updated = await api.put("/api/settings", payload);
      setProfile({ adminName: updated.adminName || "", adminAvatar: updated.adminAvatar || "", username: updated.username || "admin" });
      // "Edit Profile" is the built-in admin's own profile — reflect the new
      // name/photo in the header now. A Users & Roles account keeps its own
      // name (its user.name never matched the company admin name).
      if (isBuiltinAccount) {
        updateUser({ name: updated.adminName || user?.name, avatar: updated.adminAvatar || user?.avatar || "🙂" });
      }
      setProfileModalOpen(false);
    } catch (err) {
      setProfileError(err.message || "Failed to save profile. Please try again.");
    } finally {
      setSavingProfile(false);
    }
  };

  // Available to every account, built-in admin or Users & Roles alike — the
  // backend branches on which one is signed in. Kept separate from
  // saveProfile() above: it needs the current password to verify, and a
  // wrong current password shouldn't also block saving the name/photo.
  const changePassword = async () => {
    setPasswordError("");
    setPasswordSuccess("");
    if (!currentPassword || !newPassword) {
      setPasswordError("Enter your current password and a new password.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("New password and confirmation don't match.");
      return;
    }
    setChangingPassword(true);
    try {
      const result = await api.post("/api/auth/change-password", { currentPassword, newPassword });
      // Changing the password ends every session for this account, including
      // this one — the response carries a freshly issued token for exactly
      // this browser, which has to replace the stored one or the very next
      // request 401s and silently signs this tab out.
      updateToken(result.token, result.expiresAt);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordSuccess("Password changed.");
    } catch (err) {
      setPasswordError(err.message || "Could not change your password. Please try again.");
    } finally {
      setChangingPassword(false);
    }
  };

  const handleSelectTheme = (themeId) => {
    setTheme(themeId);
    closeUserMenu();
  };

  const isHome = location.pathname === "/dashboard" || location.pathname === "/";

  return (
    <header className={`topbar ${isHome ? "" : "topbar-subpage"}`}>
      <button type="button" className="topbar-menu-btn" onClick={onMenuClick} aria-label="Open menu"><Icon name="menu" size={20} /></button>
      <div className="topbar-brand-mobile">
        {logo ? (
          <img src={logo} alt={companyName || "Company logo"} />
        ) : companyName ? (
          <span className="topbar-brand-text-only">{companyName}</span>
        ) : null}
      </div>
      <div className="topbar-search-wrap" ref={searchRef}>
        <div className="topbar-search">
          <Icon name="search" size={16} />
          <input
            type="text"
            placeholder="Search customers, orders, products..."
            value={searchQuery}
            onChange={handleSearchChange}
            onFocus={() => setSearchOpen(true)}
          />
        </div>
        {searchOpen && searchQuery.trim().length >= 2 && (
          <div className="topbar-dropdown search-dropdown">
            {searchLoading ? (
              <div className="topbar-dropdown-empty">Searching...</div>
            ) : searchResults.length === 0 ? (
              <div className="topbar-dropdown-empty">No matches found.</div>
            ) : (
              <ul className="search-result-list">
                {searchResults.map((r, idx) => (
                  <li key={`${r.type}-${r.label}-${idx}`}>
                    <button type="button" className="search-result-item" onClick={() => goToResult(r)}>
                      <span className="search-result-type">{r.type}</span>
                      <span className="search-result-label">{r.label}</span>
                      {r.sub && <span className="search-result-sub">{r.sub}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
      <div className="topbar-right">
        <div className="topbar-date"><Icon name="calendar" size={16} /> {formatToday()}</div>

        <div className="topbar-dropdown-wrap" ref={bellRef}>
          <button type="button" className="topbar-bell" onClick={openBell} aria-label="Notifications">
            <Icon name="bell" size={18} />
            {notifTotal > 0 && <span className="badge">{notifTotal > 9 ? "9+" : notifTotal}</span>}
          </button>
          {bellOpen && (
            <div className="topbar-dropdown notif-dropdown">
              <div className="topbar-dropdown-header">Reminders</div>
              {loadingNotifs ? (
                <div className="topbar-dropdown-empty">Loading...</div>
              ) : notifications.length === 0 ? (
                <div className="topbar-dropdown-empty">Nothing needs attention.</div>
              ) : (
                <>
                  <ul className="notif-list">
                    {notifications.map((r, i) => (
                      <li key={`${r.type}-${i}`}>
                        <div className="notif-action">{r.title}</div>
                        {r.subtitle && <div className="notif-details">{r.subtitle}</div>}
                        <div className={`notif-time ${r.severity}`}>
                          {r.days === null || r.days === undefined
                            ? r.dueDate
                            : r.days < 0
                              ? `${Math.abs(r.days)} day${Math.abs(r.days) === 1 ? "" : "s"} overdue`
                              : r.days === 0
                                ? "Due today"
                                : `Due in ${r.days} days`}
                        </div>
                      </li>
                    ))}
                  </ul>
                  <Link to="/reminders" className="notif-viewall" onClick={() => setBellOpen(false)}>
                    View all reminders
                  </Link>
                </>
              )}
            </div>
          )}
        </div>

        <div className="topbar-dropdown-wrap" ref={userRef}>
          <button type="button" className="topbar-user" onClick={openUser}>
            <div className="topbar-avatar">
              {displayAvatar ? <img src={displayAvatar} alt={displayName} /> : (user?.avatar || <Icon name="user" size={18} />)}
            </div>
            <div>
              <div className="topbar-user-name">{displayName}</div>
              <div className="topbar-user-role">{displayRole}</div>
            </div>
          </button>

          {userOpen && !themeMenuOpen && (
            <div className="topbar-dropdown user-dropdown">
              <div className="topbar-dropdown-header">
                {displayName}
                <div className="topbar-dropdown-subtext">{displayRole}</div>
              </div>
              <button type="button" className="topbar-dropdown-item" onClick={openProfileModal}><Icon name="image" size={15} /> Account Settings</button>
              <button type="button" className="topbar-dropdown-item" onClick={() => setThemeMenuOpen(true)}><Icon name="palette" size={15} /> Theme</button>
              <button type="button" className="topbar-dropdown-item" onClick={goSubscription}><Icon name="wallet" size={15} /> My Subscription</button>
              <button type="button" className="topbar-dropdown-item" onClick={goSettings}><Icon name="settings" size={15} /> Company Settings</button>
              <button type="button" className="topbar-dropdown-item danger" onClick={handleLogout}><Icon name="logout" size={15} /> Logout</button>
            </div>
          )}

          {userOpen && themeMenuOpen && (
            <div className="topbar-dropdown theme-submenu">
              <button type="button" className="theme-back-btn" onClick={() => setThemeMenuOpen(false)}>
                <Icon name="arrowLeft" size={15} /> Theme
              </button>
              {availableThemes.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`theme-option ${theme === t.id ? "active" : ""}`}
                  onClick={() => handleSelectTheme(t.id)}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {t.swatch && (
                      <span
                        className="theme-option-swatch"
                        style={{ background: t.swatch }}
                      />
                    )}
                    {t.label}
                  </span>
                  {theme === t.id && <span className="theme-option-check"><Icon name="check" size={14} /></span>}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {profileModalOpen && (
        <Modal title="Account Settings" onClose={() => setProfileModalOpen(false)}>
          {profileError && <div className="login-error">{profileError}</div>}
          <div className="profile-avatar-row">
            <div className="profile-avatar-preview">
              {draftAvatar ? <img src={draftAvatar} alt="Avatar" /> : <span><Icon name="user" size={24} /></span>}
            </div>
            <label className="btn logo-upload-btn">
              Upload Photo
              <input type="file" accept="image/*" onChange={handleAvatarChange} hidden />
            </label>
            {draftAvatar && (
              <button type="button" className="btn" onClick={() => setDraftAvatar("")}>Remove</button>
            )}
          </div>
          <div className="add-form" style={{ marginTop: "16px" }}>
            <div className="field">
              <label>Display Name</label>
              <input
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                placeholder="Enter your display name"
                autoComplete="off"
              />
            </div>
            {isBuiltinAccount && (
              <div className="field">
                <label>Username</label>
                <input
                  value={draftUsername}
                  onChange={(e) => setDraftUsername(e.target.value)}
                  placeholder="Enter a login username"
                  autoComplete="off"
                />
                <span className="field-hint">What you type in the Username box on the login screen.</span>
              </div>
            )}
          </div>
          <div className="txn-form-actions" style={{ marginTop: "20px" }}>
            <button type="button" className="btn" onClick={() => setProfileModalOpen(false)} disabled={savingProfile}>Cancel</button>
            <button type="button" className="btn btn-primary" onClick={saveProfile} disabled={savingProfile}>
              {savingProfile ? "Saving..." : "Save"}
            </button>
          </div>

          <div className="profile-section-divider" />
          <div className="section-title" style={{ marginBottom: 4 }}>Change Password</div>
          {passwordError && <div className="login-error">{passwordError}</div>}
          {passwordSuccess && <div className="field-hint field-hint-ok">{passwordSuccess}</div>}
          <div className="add-form" style={{ marginTop: "12px" }}>
            <div className="field" style={{ gridColumn: "1 / -1" }}>
              <label>Current Password</label>
              <PasswordInput
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter your current password"
                autoComplete="current-password"
              />
            </div>
            <div className={`field${newPasswordWeak ? " has-error" : ""}`}>
              <label>New Password</label>
              <PasswordInput
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 8 characters, a letter and a number"
                autoComplete="new-password"
              />
              {newPasswordWeak && <span className="field-error">Use at least 8 characters, with a letter and a number.</span>}
            </div>
            <div className={`field${confirmMismatch ? " has-error" : ""}`}>
              <label>Confirm New Password</label>
              <PasswordInput
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter the new password"
                autoComplete="new-password"
              />
              {confirmMismatch && <span className="field-error">Passwords do not match.</span>}
              {confirmMatches && <span className="field-hint field-hint-ok" style={{ display: "block", marginTop: 5 }}>Passwords match.</span>}
            </div>
          </div>
          <div className="txn-form-actions" style={{ marginTop: "16px" }}>
            <button type="button" className="btn btn-primary" onClick={changePassword} disabled={changingPassword || confirmMismatch || newPasswordWeak}>
              {changingPassword ? "Changing..." : "Change Password"}
            </button>
          </div>
        </Modal>
      )}
    </header>
  );
}