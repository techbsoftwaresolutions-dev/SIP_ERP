import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import RecordFormPage from "../../components/forms/RecordFormPage";
import api from "../../api/client";

// Until roles are configured the dropdown offers only Administrator — the one
// role the backend recognises by name whatever the Roles collection holds
// (see ADMIN_ROLE in backend/permissions.js). Inventing plausible-looking
// extras would let someone pick a role that grants nothing.
const BUILT_IN_ROLES = ["Administrator"];

export default function UserForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const [roleNames, setRoleNames] = useState(BUILT_IN_ROLES);

  useEffect(() => {
    api
      .get("/api/roles?page=1&pageSize=100")
      .then((r) => {
        const names = (r.data || []).map((x) => x.name).filter(Boolean);
        if (names.length) setRoleNames(names);
      })
      .catch(() => {
        // Keep the fallback list — a failed lookup shouldn't block user admin.
      });
  }, []);

  // No password field, on purpose. An admin typing a password on somebody
  // else's behalf means two people know it — and in practice it gets said
  // out loud across an office. The account is created dormant and the person
  // sets their own through a one-time link (the Invite button on the list).
  const fields = [
    { key: "name", label: "Name", required: true, placeholder: "Enter your name" },
    {
      key: "email",
      label: "Email",
      required: true,
      placeholder: "Where their invitation is sent",
    },
    // Sourced from the roles this client has defined, so a typo can't
    // silently grant nothing. AddRecordForm keeps an existing value that
    // isn't in the list as its own option, so nobody's role is rewritten.
    { key: "role", label: "Role", type: "select", options: roleNames },
  ];

  return (
    <RecordFormPage
      entity="User"
      endpoint="/api/users"
      listPath="/users"
      crumbs={["Dashboard", "Users & Roles", "Users"]}
      fields={fields}
    />
  );
}
