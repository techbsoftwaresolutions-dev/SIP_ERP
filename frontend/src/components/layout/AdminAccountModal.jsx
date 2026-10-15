import { useState } from "react";
import adminApi from "../../api/adminClient";
import { useAdminAuth } from "../../context/AdminAuthContext";
import Modal from "../ui/Modal";
import Icon from "../ui/Icon";
import PasswordInput from "../forms/PasswordInput";

// Self-service name + password change for the signed-in super admin —
// available to every role (operator or owner), unlike the Super Admins
// screen, which only an owner can use to manage OTHER accounts. See
// PUT /api/admin/me.
export default function AdminAccountModal({ onClose }) {
  const { admin, updateAdmin } = useAdminAuth();
  const [name, setName] = useState(admin?.name || "");
  const [savingName, setSavingName] = useState(false);
  const [nameError, setNameError] = useState("");
  const [nameSuccess, setNameSuccess] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");

  const newPasswordWeak = newPassword !== "" && newPassword.length < 10;
  const confirmMismatch = confirmPassword !== "" && newPassword !== confirmPassword;
  const confirmMatches = confirmPassword !== "" && newPassword === confirmPassword;

  const saveName = async () => {
    setNameError("");
    setNameSuccess("");
    const clean = name.trim();
    if (!clean) return setNameError("A name is required.");
    setSavingName(true);
    try {
      const updated = await adminApi.put("/api/admin/me", { name: clean });
      updateAdmin({ name: updated.name });
      setNameSuccess("Saved.");
      setTimeout(() => setNameSuccess(""), 2500);
    } catch (err) {
      setNameError(err.message || "Could not save your name.");
    } finally {
      setSavingName(false);
    }
  };

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
    if (newPasswordWeak) {
      setPasswordError("The new password must be at least 10 characters.");
      return;
    }
    setChangingPassword(true);
    try {
      await adminApi.put("/api/admin/me", { currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordSuccess("Password changed. Your other signed-in devices have been logged out.");
    } catch (err) {
      setPasswordError(err.message || "Could not change your password. Please try again.");
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <Modal title="Account Settings" onClose={onClose}>
      {nameError && <div className="login-error">{nameError}</div>}
      <div className="add-form">
        <div className="field">
          <label>Display Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter your name" autoComplete="off" />
        </div>
        <div className="field">
          <label>Email</label>
          <input value={admin?.email || ""} readOnly className="field-readonly" />
          <span className="field-hint">Sign-in address — fixed for the life of the account.</span>
        </div>
        <div className="field">
          <label>Role</label>
          <input value={admin?.role === "owner" ? "Owner" : "Operator"} readOnly className="field-readonly" />
        </div>
      </div>
      <div className="txn-form-actions" style={{ marginTop: 16 }}>
        {nameSuccess && <span className="field-hint field-hint-ok" style={{ marginRight: "auto" }}>{nameSuccess}</span>}
        <button type="button" className="btn btn-primary" onClick={saveName} disabled={savingName}>
          {savingName ? "Saving..." : "Save"}
        </button>
      </div>

      <div className="profile-section-divider" />
      <div className="section-title" style={{ marginBottom: 4 }}>Change Password</div>
      {passwordError && <div className="login-error">{passwordError}</div>}
      {passwordSuccess && <div className="field-hint field-hint-ok">{passwordSuccess}</div>}
      <div className="add-form" style={{ marginTop: 12 }}>
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
            placeholder="At least 10 characters"
            autoComplete="new-password"
          />
          {newPasswordWeak && <span className="field-error">Use at least 10 characters.</span>}
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
          {confirmMatches && (
            <span className="field-hint field-hint-ok" style={{ display: "block", marginTop: 5 }}>
              Passwords match.
            </span>
          )}
        </div>
      </div>
      <div className="txn-form-actions" style={{ marginTop: 16 }}>
        <button
          type="button"
          className="btn btn-primary"
          onClick={changePassword}
          disabled={changingPassword || confirmMismatch || newPasswordWeak}
        >
          <Icon name="lock" size={14} /> {changingPassword ? "Changing..." : "Change Password"}
        </button>
      </div>
    </Modal>
  );
}
