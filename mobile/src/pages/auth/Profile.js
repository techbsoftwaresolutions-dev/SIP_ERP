import { useEffect, useState } from "react";
import api from "../../api/client";
import Screen from "../../components/layout/Screen";
import { Button, Card, ErrorBox, KeyValueGrid, Note, SectionTitle } from "../../components/ui";
import { TextField } from "../../components/forms";
import { useAuth } from "../../context/AuthContext";

// Profile + change password — the web Topbar's profile modal.
export default function Profile() {
  const { user, updateUser, updateToken } = useAuth();
  const isBuiltinAccount = !user?.id;
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [profileError, setProfileError] = useState("");
  const [profileMsg, setProfileMsg] = useState("");
  const [saving, setSaving] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwError, setPwError] = useState("");
  const [pwMsg, setPwMsg] = useState("");
  const [changing, setChanging] = useState(false);

  useEffect(() => {
    if (!isBuiltinAccount) return;
    api
      .get("/api/settings")
      .then((s) => {
        setName(s?.adminName || "");
        setUsername(s?.username || "admin");
      })
      .catch(() => {});
  }, [isBuiltinAccount]);

  const saveProfile = async () => {
    if (!username.trim()) return setProfileError("Username can't be empty.");
    setSaving(true);
    setProfileError("");
    setProfileMsg("");
    try {
      const updated = await api.put("/api/settings", { adminName: name.trim(), username: username.trim() });
      updateUser({ name: updated.adminName || user?.name });
      setProfileMsg("Profile saved.");
    } catch (err) {
      setProfileError(err.message || "Failed to save profile.");
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async () => {
    setPwError("");
    setPwMsg("");
    if (!currentPassword || !newPassword) return setPwError("Enter your current password and a new password.");
    if (newPassword !== confirmPassword) return setPwError("New password and confirmation don't match.");
    setChanging(true);
    try {
      const result = await api.post("/api/auth/change-password", { currentPassword, newPassword });
      updateToken(result.token, result.expiresAt);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPwMsg("Password changed.");
    } catch (err) {
      setPwError(err.message || "Could not change your password.");
    } finally {
      setChanging(false);
    }
  };

  return (
    <Screen title="Profile & Password">
      <Card>
        <SectionTitle>Account</SectionTitle>
        <KeyValueGrid
          rows={[
            ["Name", user?.name],
            ["Role", user?.role],
            ["Username", user?.username],
            ["Email", user?.email],
          ]}
        />
      </Card>

      {isBuiltinAccount ? (
        <Card>
          <SectionTitle>Edit Profile</SectionTitle>
          <ErrorBox message={profileError} />
          {profileMsg ? <Note icon="checkCircle">{profileMsg}</Note> : null}
          <TextField label="Display name" value={name} onChangeText={setName} />
          <TextField label="Username" value={username} onChangeText={setUsername} autoCapitalize="none" />
          <Button title="Save profile" onPress={saveProfile} loading={saving} />
        </Card>
      ) : null}

      <Card>
        <SectionTitle>Change Password</SectionTitle>
        <ErrorBox message={pwError} />
        {pwMsg ? <Note icon="checkCircle">{pwMsg}</Note> : null}
        <TextField label="Current password" value={currentPassword} onChangeText={setCurrentPassword} secureTextEntry autoCapitalize="none" />
        <TextField label="New password" value={newPassword} onChangeText={setNewPassword} secureTextEntry autoCapitalize="none" />
        <TextField label="Confirm new password" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry autoCapitalize="none" />
        <Button title="Change password" onPress={changePassword} loading={changing} />
      </Card>
    </Screen>
  );
}
