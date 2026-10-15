import SettingsSectionPage from "../../components/forms/SettingsSectionPage";

export default function EmailSettings() {
  const fields = [
    ["smtpHost", "SMTP Host"],
    ["smtpPort", "SMTP Port"],
    ["smtpUser", "SMTP Username"],
    ["smtpPassword", "SMTP Password (leave blank to keep the saved one)", "password"],
    ["fromEmail", "From Email"],
  ];

  return (
    <SettingsSectionPage
      title="Email Settings"
      crumbs={["Dashboard", "Settings", "Email Settings"]}
      sectionTitle="Outgoing Email (SMTP)"
      fields={fields}
    />
  );
}
