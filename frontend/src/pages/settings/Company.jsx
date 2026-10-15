import SettingsSectionPage from "../../components/forms/SettingsSectionPage";

export default function CompanySettings() {
  const fields = [
    ["companyName", "Company Name"],
    ["legalName", "Legal Name"],
    ["gstin", "GSTIN"],
    ["phone", "Mobile No", "phone"],
    ["email", "Email"],
    ["website", "Website"],
    ["address", "Address", "text", true],
    ["bankAccountName", "Account Holder Name"],
    ["bankName", "Bank Name"],
    ["bankAccountNumber", "Bank Account Number"],
    ["bankIfsc", "IFSC Code"],
  ];

  return (
    <SettingsSectionPage
      title="Company Settings"
      crumbs={["Dashboard", "Settings", "Company Settings"]}
      sectionTitle="Company Information"
      fields={fields}
      imageFields={[
        { key: "logo", label: "Company Logo" },
        { key: "signature", label: "Authorized Signature" },
        { key: "seal", label: "Company Seal / Stamp" },
      ]}
    />
  );
}
