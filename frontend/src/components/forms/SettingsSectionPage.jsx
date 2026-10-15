import { useEffect, useState } from "react";
import api, { clearSwrCache } from "../../api/client";
import PageHeader from "../layout/PageHeader";
import Icon from "../ui/Icon";
import Loader from "../ui/Loader";
import Select from "./Select";
import PasswordInput from "./PasswordInput";

// `imageFields`: [{ key, label }] — renders one upload row per entry (logo,
// signature, seal, etc.). `logoField` is kept for backward compatibility and
// is treated as a single-entry `imageFields` list.
export default function SettingsSectionPage({ title, crumbs, sectionTitle, fields, logoField, imageFields }) {
  const [settings, setSettings] = useState(null);
  const [savedSettings, setSavedSettings] = useState(null); // last-saved snapshot, for Cancel to revert to
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingKey, setUploadingKey] = useState(""); // which image field is currently being read, if any
  const [error, setError] = useState("");

  const images = imageFields || (logoField ? [{ key: logoField, label: "Company Logo" }] : []);

  useEffect(() => {
    api.get("/api/settings").then((s) => {
      setSettings(s);
      setSavedSettings(s);
    });
  }, []);

  if (!settings) {
    return (
      <div>
        <PageHeader title={title} crumbs={crumbs} />
        <div className="loading-row"><Loader /></div>
      </div>
    );
  }

  const handleChange = (key, type) => (e) => {
    let val = e.target.value;
    if (type === "phone") val = val.replace(/\D/g, "").slice(0, 10);
    if (type === "number") val = e.target.value;
    setSettings((s) => ({ ...s, [key]: val }));
    setSaved(false);
  };

  const handleSave = async () => {
    if (saving) return;
    setError("");
    setSaving(true);
    try {
      await api.put("/api/settings", settings);
      setSaved(true);
      setSavedSettings(settings);
      if (images.length) window.dispatchEvent(new Event("company-logo-updated"));
      // A new table template applies straight away on every list page.
      if (settings.tableStyle !== savedSettings.tableStyle) {
        clearSwrCache();
        window.dispatchEvent(new Event("table-style-changed"));
      }
    } catch (err) {
      setError(err.message || "Failed to save settings. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // Discards any unsaved edits, back to what's actually stored.
  const handleCancel = () => {
    setSettings(savedSettings);
    setSaved(false);
    setError("");
  };

  const handleImageChange = (key) => (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError("That image is too large. Please choose a file under 5MB.");
      e.target.value = "";
      return;
    }
    setError("");
    setUploadingKey(key);
    const reader = new FileReader();
    reader.onload = () => {
      setSettings((s) => ({ ...s, [key]: reader.result }));
      setSaved(false);
      setUploadingKey("");
    };
    reader.onerror = () => {
      setError("Could not read that image. Please try a different file.");
      setUploadingKey("");
    };
    reader.readAsDataURL(file);
  };

  const removeImage = (key) => () => {
    setSettings((s) => ({ ...s, [key]: "" }));
    setSaved(false);
  };

  return (
    <div>
      <PageHeader title={title} crumbs={crumbs} />
      <div className="list-card">
        <div className="section-title">{sectionTitle}</div>
        {error && <div className="login-error">{error}</div>}

        {images.length > 0 && (
          <div className="logo-upload-group">
            {images.map((img) => (
              <div className="logo-upload-row" key={img.key}>
                <div className="logo-preview">
                  {uploadingKey === img.key ? (
                    <span className="logo-placeholder">
                      <Icon name="upload" size={20} />
                      <span>Reading…</span>
                    </span>
                  ) : settings[img.key] ? (
                    <img src={settings[img.key]} alt={img.label} />
                  ) : (
                    <span className="logo-placeholder">
                      <Icon name="image" size={20} />
                      <span>Not set</span>
                    </span>
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="logo-upload-label">{img.label}</div>
                  <div className="logo-upload-actions">
                    <label className={`btn logo-upload-btn${uploadingKey === img.key ? " disabled" : ""}`}>
                      <Icon name="upload" size={15} /> {uploadingKey === img.key ? "Reading…" : "Upload"}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageChange(img.key)}
                        disabled={uploadingKey === img.key}
                        hidden
                      />
                    </label>
                    {settings[img.key] && (
                      <button type="button" className="btn" onClick={removeImage(img.key)} disabled={uploadingKey === img.key}>
                        <Icon name="trash" size={15} /> Remove
                      </button>
                    )}
                  </div>
                  {uploadingKey === img.key && (
                    <div className="field-hint">
                      Reading the file — click “Save Changes” below once it's staged to actually upload it.
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="settings-form">
          {fields.map(([key, label, type, full]) => (
            <div className={`field ${full ? "full" : ""}`} key={key}>
              <label>{label}</label>
              {/* An array in the `type` slot renders a dropdown of those
                  options instead of a free-text box. A value already stored
                  that isn't in the list is kept as its own option so an
                  existing setting is never silently changed. */}
              {Array.isArray(type) ? (
                <Select value={settings[key] ?? ""} onChange={handleChange(key)}>
                  {!type.includes(settings[key] ?? "") && (
                    <option value={settings[key] ?? ""}>{settings[key] || "— Select —"}</option>
                  )}
                  {type.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </Select>
              ) : type === "password" ? (
                <PasswordInput
                  value={settings[key] ?? ""}
                  onChange={handleChange(key, type)}
                  autoComplete="new-password"
                />
              ) : (
                <input
                  value={settings[key] ?? ""}
                  onChange={handleChange(key, type)}
                  type={type === "phone" ? "tel" : type === "number" ? "number" : "text"}
                  inputMode={type === "phone" ? "numeric" : undefined}
                  maxLength={type === "phone" ? 10 : undefined}
                />
              )}
            </div>
          ))}
        </div>

        <div className="add-form-actions">
          <button type="button" className="btn" onClick={handleCancel} disabled={saving}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : saved ? <>Saved <Icon name="check" size={15} /></> : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
