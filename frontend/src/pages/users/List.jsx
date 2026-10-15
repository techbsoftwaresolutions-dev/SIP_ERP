import { useState } from "react";
import SimpleListPage from "../../components/data/SimpleListPage";
import StatusBadge from "../../components/ui/StatusBadge";
import Icon from "../../components/ui/Icon";
import api from "../../api/client";

export default function Users() {
  // The result of the last invite: what to show the admin, including the raw
  // link when there is no mail server to send it for them.
  const [invite, setInvite] = useState(null);
  const [busyId, setBusyId] = useState("");
  const [copied, setCopied] = useState(false);

  const sendInvite = async (row) => {
    if (!row.email) {
      window.alert("This user has no email address to send an invite to.");
      return;
    }
    setBusyId(row.id);
    setCopied(false);
    try {
      const res = await api.post(`/api/users/${encodeURIComponent(row.id)}/invite`, {});
      setInvite({ ...res, user: row });
    } catch (err) {
      window.alert(err.message || "Could not send that invitation.");
    } finally {
      setBusyId("");
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(invite.link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch  {
      // Clipboard access can be refused; the link is on screen to select.
    }
  };

  const columns = [
    { key: "id", header: "User Code", render: (r) => <span className="cell-link">{r.id}</span> },
    { key: "name", header: "Name", render: (r) => <span className="cell-primary">{r.name}</span> },
    { key: "email", header: "Email" },
    { key: "role", header: "Role" },
    { key: "lastLogin", header: "Last Login" },
    {
      key: "status",
      header: "Status",
      // An account waiting on its invitation is worth distinguishing from one
      // that has been switched off — both are "not signing in", for opposite
      // reasons.
      render: (r) => (
        <span className="user-status-cell">
          <StatusBadge status={r.status} />
          {r.invitePending && <span className="user-invite-flag">invite sent</span>}
        </span>
      ),
    },
  ];

  const addConfig = { buttonLabel: "+ Add User" };

  return (
    <>
      {invite && (
        <div className={`invite-result${invite.emailed ? " is-sent" : ""}`}>
          <Icon name={invite.emailed ? "checkCircle" : "alertCircle"} size={18} />
          <div className="invite-result-body">
            <strong>
              {invite.emailed
                ? `Invitation emailed to ${invite.user.email}`
                : `Invitation ready for ${invite.user.name}`}
            </strong>
            {invite.emailed ? (
              <em>The link works once and expires in 48 hours.</em>
            ) : (
              <>
                <em>
                  {invite.smtpConfigured
                    ? `Email could not be sent (${invite.emailError}). Send this link to them yourself:`
                    : "No mail server is set up in Settings → Email, so send this link to them yourself:"}
                </em>
                <code className="invite-link">{invite.link}</code>
              </>
            )}
          </div>
          <div className="invite-result-actions">
            {!invite.emailed && (
              <button type="button" className="btn" onClick={copyLink}>
                {copied ? "Copied" : "Copy link"}
              </button>
            )}
            <button type="button" className="icon-btn" title="Dismiss" onClick={() => setInvite(null)}>
              <Icon name="close" />
            </button>
          </div>
        </div>
      )}

      <SimpleListPage
        title="Users"
        crumbs={["Dashboard", "Users & Roles", "Users"]}
        endpoint="/api/users"
        columns={columns}
        addConfig={addConfig}
        addHref="/users/new"
        editHref={(row) => `/users/${encodeURIComponent(row.id)}/edit`}
        rowActions={(row) => (
          <button
            type="button"
            className="icon-btn"
            title={row.hasPassword ? "Send a password reset link" : "Send an invitation to set a password"}
            disabled={busyId === row.id}
            onClick={() => sendInvite(row)}
          >
            <Icon name="mail" />
          </button>
        )}
        pageSize={8}
      />
    </>
  );
}
