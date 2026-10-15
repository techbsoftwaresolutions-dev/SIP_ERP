import Screen from "../../components/layout/Screen";
import { ErrorBox } from "../../components/ui";
import { usePermissions } from "../../context/SessionContext";
import { useParams } from "../../navigation/router";
import {
  BackupSettings,
  CompanySettings,
  CustomFieldsSettings,
  EmailSettings,
  GeneralSettings,
  InvoiceThemeSettings,
  NumberingSettings,
  SettingsHome,
  TaxSettings,
  WhatsAppSettings,
} from ".";

export { SettingsHome };

// /settings/:tab — same tab keys and per-tab menu gate as the web SettingsTabs.
const TAB_SCREENS = {
  company: ["settings:company", CompanySettings],
  numbering: ["settings:numbering", NumberingSettings],
  "invoice-theme": ["settings:invoice-theme", InvoiceThemeSettings],
  general: ["settings:general", GeneralSettings],
  email: ["settings:email", EmailSettings],
  whatsapp: ["settings:whatsapp", WhatsAppSettings],
  tax: ["settings:tax", TaxSettings],
  backup: ["settings:backup", BackupSettings],
  "custom-fields": ["settings:custom-fields", CustomFieldsSettings],
};

export function SettingsTab() {
  const { tab } = useParams();
  const { can } = usePermissions();
  const entry = TAB_SCREENS[tab];
  if (!entry) return <SettingsHome />;
  const [menu, Component] = entry;
  if (!can(menu, "view")) {
    return (
      <Screen title="Settings">
        <ErrorBox message="Your role doesn't include this settings page." />
      </Screen>
    );
  }
  return <Component />;
}
