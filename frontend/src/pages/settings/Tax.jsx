import SettingsSectionPage from "../../components/forms/SettingsSectionPage";

export default function TaxSettings() {
  const fields = [
    ["taxName", "Tax Name"],
    ["defaultTaxRate", "Default Tax Rate (%)", "number"],
    ["taxRegistrationNo", "Tax Registration No."],
  ];

  return (
    <SettingsSectionPage
      title="Tax Settings"
      crumbs={["Dashboard", "Settings", "Tax Settings"]}
      sectionTitle="Tax Configuration"
      fields={fields}
    />
  );
}
