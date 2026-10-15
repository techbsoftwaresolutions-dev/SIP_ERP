// Resolves an incoming request's tenant (from the X-Tenant header — see
// frontend/src/api/client.js) to a database, and binds every model from
// models/index.js onto that database.
//
// Uses mongoose.connection.useDb(dbName, { useCache: true }) — this reuses
// the ONE existing connection/pool this process already opened via
// connectDB() (db.js) and just switches which database on the cluster it
// points at, instead of opening a brand-new connection per tenant. Requires
// no .env changes: MONGODB_URI keeps working exactly as it does today for
// whichever database it currently names — that's simply the fallback
// ("default") database for any request that doesn't carry a recognized
// tenant header.
const mongoose = require("mongoose");
const defaultModels = require("../models/index");
const { schema: tenantSchema } = require("../models/Tenant");
const { schema: planSchema } = require("../models/Plan");
const { schema: subscriptionOrderSchema } = require("../models/SubscriptionOrder");
const { schema: moduleSchema } = require("../models/Module");
const { schema: addOnSchema } = require("../models/AddOn");
const { schema: globalRoleSchema } = require("../models/GlobalRole");
const { schema: globalPermissionSchema } = require("../models/GlobalPermission");
const { schema: menuItemSchema } = require("../models/MenuItem");
const { schema: themeSchema } = require("../models/Theme");
const { schema: invoiceTemplateSchema } = require("../models/InvoiceTemplate");
const { schema: paymentMethodSchema } = require("../models/PaymentMethod");
const { schema: approvalRuleSchema } = require("../models/ApprovalRule");
const { schema: notificationTypeSchema } = require("../models/NotificationType");
const { schema: announcementSchema } = require("../models/Announcement");
const { schema: adminAuditLogSchema } = require("../models/AdminAuditLog");
const { schema: clientSessionSchema } = require("../models/ClientSession");
const { schema: demoRequestSchema } = require("../models/DemoRequest");
const { schema: superAdminSchema } = require("../models/SuperAdmin");
const { schema: adminSessionSchema } = require("../models/AdminSession");
const { schema: paymentGatewayConfigSchema } = require("../models/PaymentGatewayConfig");
const { evaluateSubscription } = require("./subscription");
const { MONGODB_URI } = require("../config/db");

const MASTER_DB_NAME = process.env.MASTER_DB || "master_db";
const CACHE_TTL_MS = 60 * 1000; // how long a tenant->database lookup is cached before re-checking master_db

// The database any request with no recognized tenant falls back to — curl
// scripts, local dev, or a frontend build that predates this feature. Kept
// in sync with whatever MONGODB_URI already points at, so nothing about
// today's single-database behavior changes until a tenant row is added.
const DEFAULT_DB_NAME = (() => {
  const match = (MONGODB_URI || "").match(/^mongodb(?:\+srv)?:\/\/[^/?]+\/([^?]*)/);
  return (match && match[1]) || "siperp_crm";
})();

let tenantRegistryModel = null;
function getTenantRegistryModel() {
  if (tenantRegistryModel) return tenantRegistryModel;
  const masterConn = mongoose.connection.useDb(MASTER_DB_NAME, { useCache: true });
  tenantRegistryModel = masterConn.models.Tenant || masterConn.model("Tenant", tenantSchema);
  return tenantRegistryModel;
}

// Subscription plans also live in the master database, next to the registry.
let planModel = null;
function getPlanModel() {
  if (planModel) return planModel;
  const masterConn = mongoose.connection.useDb(MASTER_DB_NAME, { useCache: true });
  planModel = masterConn.models.Plan || masterConn.model("Plan", planSchema);
  return planModel;
}

// The platform module registry (models/Module.js) — commercial metadata for
// the code catalogue in permissions.js. Master database, same as Plan.
let moduleModel = null;
function getModuleModel() {
  if (moduleModel) return moduleModel;
  const masterConn = mongoose.connection.useDb(MASTER_DB_NAME, { useCache: true });
  moduleModel = masterConn.models.Module || masterConn.model("Module", moduleSchema);
  return moduleModel;
}

// Paid extras sold on top of a plan (models/AddOn.js).
let addOnModel = null;
function getAddOnModel() {
  if (addOnModel) return addOnModel;
  const masterConn = mongoose.connection.useDb(MASTER_DB_NAME, { useCache: true });
  addOnModel = masterConn.models.AddOn || masterConn.model("AddOn", addOnSchema);
  return addOnModel;
}

// Self-service upgrade orders (see models/SubscriptionOrder.js) — same
// database, same reasoning.
let subscriptionOrderModel = null;
function getSubscriptionOrderModel() {
  if (subscriptionOrderModel) return subscriptionOrderModel;
  const masterConn = mongoose.connection.useDb(MASTER_DB_NAME, { useCache: true });
  subscriptionOrderModel =
    masterConn.models.SubscriptionOrder || masterConn.model("SubscriptionOrder", subscriptionOrderSchema);
  return subscriptionOrderModel;
}

// Platform-level role templates (models/GlobalRole.js).
let globalRoleModel = null;
function getGlobalRoleModel() {
  if (globalRoleModel) return globalRoleModel;
  const masterConn = mongoose.connection.useDb(MASTER_DB_NAME, { useCache: true });
  globalRoleModel = masterConn.models.GlobalRole || masterConn.model("GlobalRole", globalRoleSchema);
  return globalRoleModel;
}

// Which actions each module offers, platform-wide (models/GlobalPermission.js).
let globalPermissionModel = null;
function getGlobalPermissionModel() {
  if (globalPermissionModel) return globalPermissionModel;
  const masterConn = mongoose.connection.useDb(MASTER_DB_NAME, { useCache: true });
  globalPermissionModel =
    masterConn.models.GlobalPermission || masterConn.model("GlobalPermission", globalPermissionSchema);
  return globalPermissionModel;
}

// Sidebar presentation overrides (models/MenuItem.js).
let menuItemModel = null;
function getMenuItemModel() {
  if (menuItemModel) return menuItemModel;
  const masterConn = mongoose.connection.useDb(MASTER_DB_NAME, { useCache: true });
  menuItemModel = masterConn.models.MenuItem || masterConn.model("MenuItem", menuItemSchema);
  return menuItemModel;
}

// White-label themes (models/Theme.js).
let themeModel = null;
function getThemeModel() {
  if (themeModel) return themeModel;
  const masterConn = mongoose.connection.useDb(MASTER_DB_NAME, { useCache: true });
  themeModel = masterConn.models.Theme || masterConn.model("Theme", themeSchema);
  return themeModel;
}

// Invoice template tiers and availability (models/InvoiceTemplate.js).
let invoiceTemplateModel = null;
function getInvoiceTemplateModel() {
  if (invoiceTemplateModel) return invoiceTemplateModel;
  const masterConn = mongoose.connection.useDb(MASTER_DB_NAME, { useCache: true });
  invoiceTemplateModel =
    masterConn.models.InvoiceTemplate || masterConn.model("InvoiceTemplate", invoiceTemplateSchema);
  return invoiceTemplateModel;
}

// Payment methods offered on the invoice form (models/PaymentMethod.js).
let paymentMethodModel = null;
function getPaymentMethodModel() {
  if (paymentMethodModel) return paymentMethodModel;
  const masterConn = mongoose.connection.useDb(MASTER_DB_NAME, { useCache: true });
  paymentMethodModel =
    masterConn.models.PaymentMethod || masterConn.model("PaymentMethod", paymentMethodSchema);
  return paymentMethodModel;
}

// Approval rules (models/ApprovalRule.js).
let approvalRuleModel = null;
function getApprovalRuleModel() {
  if (approvalRuleModel) return approvalRuleModel;
  const masterConn = mongoose.connection.useDb(MASTER_DB_NAME, { useCache: true });
  approvalRuleModel =
    masterConn.models.ApprovalRule || masterConn.model("ApprovalRule", approvalRuleSchema);
  return approvalRuleModel;
}

// Notification settings and platform announcements.
let notificationTypeModel = null;
function getNotificationTypeModel() {
  if (notificationTypeModel) return notificationTypeModel;
  const masterConn = mongoose.connection.useDb(MASTER_DB_NAME, { useCache: true });
  notificationTypeModel =
    masterConn.models.NotificationType || masterConn.model("NotificationType", notificationTypeSchema);
  return notificationTypeModel;
}

let announcementModel = null;
function getAnnouncementModel() {
  if (announcementModel) return announcementModel;
  const masterConn = mongoose.connection.useDb(MASTER_DB_NAME, { useCache: true });
  announcementModel =
    masterConn.models.Announcement || masterConn.model("Announcement", announcementSchema);
  return announcementModel;
}

// The platform's own audit trail (models/AdminAuditLog.js). Deliberately NOT
// part of the cached registry — it is append-only and read on one screen.
let adminAuditLogModel = null;
function getAdminAuditLogModel() {
  if (adminAuditLogModel) return adminAuditLogModel;
  const masterConn = mongoose.connection.useDb(MASTER_DB_NAME, { useCache: true });
  adminAuditLogModel =
    masterConn.models.AdminAuditLog || masterConn.model("AdminAuditLog", adminAuditLogSchema);
  return adminAuditLogModel;
}

// Leads from the public SIPERP website (models/DemoRequest.js).
let demoRequestModel = null;
function getDemoRequestModel() {
  if (demoRequestModel) return demoRequestModel;
  const masterConn = mongoose.connection.useDb(MASTER_DB_NAME, { useCache: true });
  demoRequestModel =
    masterConn.models.DemoRequest || masterConn.model("DemoRequest", demoRequestSchema);
  return demoRequestModel;
}

// Client sign-in sessions (models/ClientSession.js). In the MASTER database
// on purpose — a session says which tenant a request belongs to, so it has
// to be resolvable before the tenant is known.
let clientSessionModel = null;
function getClientSessionModel() {
  if (clientSessionModel) return clientSessionModel;
  const masterConn = mongoose.connection.useDb(MASTER_DB_NAME, { useCache: true });
  clientSessionModel =
    masterConn.models.ClientSession || masterConn.model("ClientSession", clientSessionSchema);
  return clientSessionModel;
}

// The module registry and the add-on catalogue are consulted on EVERY gated
// request, so they are cached together and briefly, exactly like the plan
// cache in server.js. Both are small (a dozen or two rows) and change only
// when a super admin edits them — and those edits invalidate this straight
// away, so a change takes effect on the next request rather than in a minute.
let platformRegistry = null; // { modules, addOns, expiresAt }
const PLATFORM_REGISTRY_TTL_MS = 60 * 1000;

function invalidatePlatformRegistry() {
  platformRegistry = null;
}

async function getPlatformRegistry() {
  if (platformRegistry && platformRegistry.expiresAt > Date.now()) return platformRegistry;
  const [
    modules,
    addOns,
    permissions,
    menus,
    themes,
    invoiceTemplates,
    paymentMethods,
    approvalRules,
    notificationTypes,
    announcements,
  ] = await Promise.all([
    getModuleModel().find({}).lean(),
    getAddOnModel().find({}).lean(),
    getGlobalPermissionModel().find({}).lean(),
    getMenuItemModel().find({}).lean(),
    getThemeModel().find({}).lean(),
    getInvoiceTemplateModel().find({}).lean(),
    getPaymentMethodModel().find({}).lean(),
    getApprovalRuleModel().find({}).lean(),
    getNotificationTypeModel().find({}).lean(),
    getAnnouncementModel().find({}).lean(),
  ]);
  platformRegistry = {
    modules,
    addOns,
    permissions,
    menus,
    themes,
    invoiceTemplates,
    paymentMethods,
    approvalRules,
    notificationTypes,
    announcements,
    expiresAt: Date.now() + PLATFORM_REGISTRY_TTL_MS,
  };
  return platformRegistry;
}

// subdomain -> { tenant, expiresAt } — avoids a master_db round trip on every
// single request. `tenant` is null for a subdomain with no registry row. A new
// tenant added to master_db shows up within CACHE_TTL_MS, no backend restart
// required (and the admin routes in tenantAdminRoutes.js clear the relevant
// entry immediately on any change, so edits made through the Manage Clients
// screen take effect right away).
const registryCache = new Map();

function invalidateRegistryCache(subdomain) {
  if (subdomain) registryCache.delete(subdomain);
  else registryCache.clear();
}

// Returns the tenant row for a subdomain, or null when there isn't one.
//
// Deliberately does NOT filter on status: a suspended (or expired) client must
// still resolve to their OWN row so the caller can refuse the request. The old
// `findOne({ subdomain, status: "active" })` meant a suspended client silently
// fell through to DEFAULT_DB_NAME — i.e. started reading another company's
// database. "Unknown subdomain" and "known but not allowed in" are different
// answers and only the first one may fall back.
async function resolveTenant(subdomain) {
  if (!subdomain) {
    const cached = registryCache.get("__default__");
    if (cached && cached.expiresAt > Date.now()) return cached.tenant;
    try {
      const Tenant = getTenantRegistryModel();
      const defaultTenant = await Tenant.findOne({ databaseName: DEFAULT_DB_NAME }).lean();
      registryCache.set("__default__", { tenant: defaultTenant || null, expiresAt: Date.now() + CACHE_TTL_MS });
      return defaultTenant || null;
    } catch (_) {
      return null;
    }
  }
  const cached = registryCache.get(subdomain);
  if (cached && cached.expiresAt > Date.now()) return cached.tenant;

  try {
    const Tenant = getTenantRegistryModel();
    const tenant = await Tenant.findOne({ subdomain }).lean();
    registryCache.set(subdomain, { tenant: tenant || null, expiresAt: Date.now() + CACHE_TTL_MS });
    return tenant || null;
  } catch (err) {
    // Master registry unreachable — never take the whole app down over it.
    // Treated as "unknown subdomain": falls back to the default database, the
    // same as before this feature existed. Not cached, so it retries.
    console.error("Tenant registry lookup failed, falling back to default database:", err.message);
    return null;
  }
}

// dbName -> { Customer, ... } bound to that database
const modelsByDb = new Map();

function bindModelsForDb(dbName) {
  if (modelsByDb.has(dbName)) return modelsByDb.get(dbName);
  const conn = mongoose.connection.useDb(dbName, { useCache: true });
  const models = {};
  for (const [name, model] of Object.entries(defaultModels)) {
    models[name] = conn.models[name] || conn.model(name, model.schema);
  }
  modelsByDb.set(dbName, models);
  return models;
}

// Resolves everything a request needs about its tenant in one go:
//   models       — bound to that tenant's database (default DB if unknown)
//   tenant       — the registry row, or null
//   subscription — { state, planName, subscriptionEnd, daysRemaining, ... }
// The caller (the tenant middleware in server.js) decides whether to serve or
// refuse based on `subscription.state`.
async function getRequestContext(subdomain) {
  const tenant = await resolveTenant(subdomain);
  const dbName = tenant ? tenant.databaseName : DEFAULT_DB_NAME;
  return {
    models: bindModelsForDb(dbName),
    tenant,
    subscription: evaluateSubscription(tenant),
  };
}

// Platform operators and their sessions — master_db only, never a client
// database, for the same reason the tenant registry lives there.
let superAdminModel = null;
function getSuperAdminModel() {
  if (superAdminModel) return superAdminModel;
  const masterConn = mongoose.connection.useDb(MASTER_DB_NAME, { useCache: true });
  superAdminModel = masterConn.models.SuperAdmin || masterConn.model("SuperAdmin", superAdminSchema);
  return superAdminModel;
}

let adminSessionModel = null;
function getAdminSessionModel() {
  if (adminSessionModel) return adminSessionModel;
  const masterConn = mongoose.connection.useDb(MASTER_DB_NAME, { useCache: true });
  adminSessionModel = masterConn.models.AdminSession || masterConn.model("AdminSession", adminSessionSchema);
  // Needed for the unique tokenHash index and the TTL on expiresAt.
  adminSessionModel.createIndexes().catch(() => {});
  return adminSessionModel;
}

let paymentGatewayConfigModel = null;
function getPaymentGatewayConfigModel() {
  if (paymentGatewayConfigModel) return paymentGatewayConfigModel;
  const masterConn = mongoose.connection.useDb(MASTER_DB_NAME, { useCache: true });
  paymentGatewayConfigModel =
    masterConn.models.PaymentGatewayConfig || masterConn.model("PaymentGatewayConfig", paymentGatewayConfigSchema);
  return paymentGatewayConfigModel;
}

module.exports = {
  getRequestContext,
  resolveTenant,
  getTenantRegistryModel,
  getSuperAdminModel,
  getAdminSessionModel,
  getPaymentGatewayConfigModel,
  getPlanModel,
  getSubscriptionOrderModel,
  getModuleModel,
  getAddOnModel,
  getGlobalRoleModel,
  getGlobalPermissionModel,
  getMenuItemModel,
  getThemeModel,
  getInvoiceTemplateModel,
  getPaymentMethodModel,
  getApprovalRuleModel,
  getNotificationTypeModel,
  getAnnouncementModel,
  getAdminAuditLogModel,
  getDemoRequestModel,
  getClientSessionModel,
  bindModelsForDb,
  getPlatformRegistry,
  invalidatePlatformRegistry,
  invalidateRegistryCache,
  DEFAULT_DB_NAME,
  MASTER_DB_NAME,
};
