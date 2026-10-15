// The platform control plane: super-admin sign-in and the cross-client
// dashboard. Everything here reads master_db (the tenant registry, plans and
// subscription orders) — never a single client's database.
//
// Mounted at /api/admin/*, which the per-tenant permission middleware already
// exempts, because these routes are gated by their own session instead.
const express = require("express");
const { loginThrottle } = require("../middleware/loginThrottle");
const {
  getSuperAdminModel,
  getAdminSessionModel,
  getTenantRegistryModel,
  getPlanModel,
  getSubscriptionOrderModel,
  getPaymentGatewayConfigModel,
  getAdminAuditLogModel,
} = require("../tenancy/tenantModels");
const razorpay = require("../services/razorpayClient");
const {
  hashPassword,
  verifyPassword,
  createSession,
  destroySession,
  forgetOtherSessions,
  requireSuperAdmin,
  requireOwner,
} = require("../auth/superAdminAuth");
const { evaluateSubscription } = require("../tenancy/subscription");

function registerSuperAdminRoutes(app, { asyncHandler }) {
  const router = express.Router();

  // ---- auth --------------------------------------------------------------

  router.post(
    "/auth/login",
    loginThrottle({ keyFor: (req) => String((req.body || {}).email || "").trim() }),
    asyncHandler(async (req, res) => {
      const email = String(req.body?.email || "").trim().toLowerCase();
      const password = String(req.body?.password || "");
      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required." });
      }

      const admin = await getSuperAdminModel().findOne({ email });
      // Same message either way, so this can't be used to discover which
      // email addresses have an account.
      const bad = () => res.status(401).json({ message: "Incorrect email or password." });
      if (!admin || !verifyPassword(password, admin.passwordHash)) return bad();
      if (admin.status !== "active") {
        return res.status(403).json({ message: "This admin account is disabled." });
      }

      const { token, expiresAt } = await createSession(String(admin._id), req);
      admin.lastLoginAt = new Date();
      await admin.save();

      res.json({ success: true, token, expiresAt, admin: admin.toJSON() });
    })
  );

  router.post(
    "/auth/logout",
    asyncHandler(async (req, res) => {
      const header = req.get("authorization") || "";
      const token = header.toLowerCase().startsWith("bearer ")
        ? header.slice(7).trim()
        : req.get("x-admin-token") || "";
      await destroySession(token);
      res.json({ success: true });
    })
  );

  // Lets the frontend confirm a stored token is still good on page load.
  router.get(
    "/auth/me",
    requireSuperAdmin,
    asyncHandler(async (req, res) => res.json({ admin: req.superAdmin.toJSON() }))
  );

  // ---- platform dashboard ------------------------------------------------

  router.get(
    "/dashboard",
    requireSuperAdmin,
    asyncHandler(async (_req, res) => {
      const Tenant = getTenantRegistryModel();
      const Plan = getPlanModel();
      const SubscriptionOrder = getSubscriptionOrderModel();

      const tenants = await Tenant.find().lean();

      // Subscription state is derived the same way the per-request middleware
      // derives it, so the dashboard can't disagree with what a client is
      // actually allowed to do.
      const evaluated = tenants.map((t) => ({ tenant: t, sub: evaluateSubscription(t) }));
      const byState = {};
      evaluated.forEach(({ sub }) => {
        byState[sub.state] = (byState[sub.state] || 0) + 1;
      });

      const suspended = tenants.filter((t) => t.status !== "active").length;

      // Recurring revenue, normalised to a month so plans on different terms
      // are comparable. A tenant with no term is treated as annual.
      const mrr = tenants
        .filter((t) => t.status === "active")
        .reduce((sum, t) => {
          const months = Number(t.termMonths) || 12;
          const payable = Number(t.amountPayable) || Number(t.price) || 0;
          return sum + (months > 0 ? payable / months : 0);
        }, 0);

      // Renewals worth chasing: anything lapsing inside 30 days.
      const soon = Date.now() + 30 * 24 * 60 * 60 * 1000;
      const expiringSoon = evaluated
        .filter(({ tenant }) => {
          const end = tenant.subscriptionEnd ? new Date(tenant.subscriptionEnd).getTime() : 0;
          return end && end <= soon;
        })
        .sort((a, b) => new Date(a.tenant.subscriptionEnd) - new Date(b.tenant.subscriptionEnd))
        .slice(0, 8)
        .map(({ tenant, sub }) => ({
          subdomain: tenant.subdomain,
          companyName: tenant.companyName,
          planName: tenant.planName,
          subscriptionEnd: tenant.subscriptionEnd,
          daysRemaining: sub.daysRemaining,
          state: sub.state,
        }));

      const plans = await Plan.find().lean();
      const planCounts = {};
      tenants.forEach((t) => {
        const key = t.planName || t.planCode || "Unassigned";
        planCounts[key] = (planCounts[key] || 0) + 1;
      });

      const [recentOrders, totalOrders] = await Promise.all([
        SubscriptionOrder.find().sort({ createdAt: -1 }).limit(5).lean(),
        SubscriptionOrder.countDocuments(),
      ]);

      res.json({
        stats: {
          totalClients: tenants.length,
          activeClients: tenants.filter((t) => t.status === "active").length,
          suspendedClients: suspended,
          totalPlans: plans.length,
          mrr: Math.round(mrr),
          totalOrders,
          expiringSoonCount: expiringSoon.length,
        },
        subscriptionStates: byState,
        planSpread: Object.entries(planCounts)
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count),
        expiringSoon,
        recentClients: [...tenants]
          .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
          .slice(0, 5)
          .map((t) => ({
            subdomain: t.subdomain,
            companyName: t.companyName,
            planName: t.planName,
            status: t.status,
            createdAt: t.createdAt,
          })),
        recentOrders,
      });
    })
  );

  // ---- my own account -----------------------------------------------------
  // Unlike the routes below, this needs no `requireOwner` — every admin,
  // operator or owner, can rename themselves and change their own password.
  // Role and status stay owner-only (see PUT /super-admins/:id).
  router.put(
    "/me",
    requireSuperAdmin,
    asyncHandler(async (req, res) => {
      const { name, currentPassword, newPassword } = req.body || {};
      const target = await getSuperAdminModel().findById(req.superAdmin._id);
      if (!target) return res.status(404).json({ message: "Account not found." });

      if (name !== undefined) {
        const clean = String(name).trim();
        if (!clean) return res.status(400).json({ message: "A name is required." });
        target.name = clean;
      }

      if (newPassword) {
        if (!currentPassword || !verifyPassword(String(currentPassword), target.passwordHash)) {
          return res.status(400).json({ message: "Current password is incorrect." });
        }
        const pw = String(newPassword);
        if (pw.length < 10) {
          return res.status(400).json({ message: "A new password must be at least 10 characters." });
        }
        target.passwordHash = hashPassword(pw);
      }

      await target.save();

      // Changing the password ends every OTHER session for this account —
      // this device keeps its own, since it's the one that just verified
      // the current password.
      if (newPassword) await forgetOtherSessions(target._id, req.superAdminToken);

      res.json(target.toJSON());
    })
  );

  // ---- super-admin accounts (owner only) ---------------------------------

  router.get(
    "/super-admins",
    requireSuperAdmin,
    asyncHandler(async (_req, res) => {
      const rows = await getSuperAdminModel().find().sort({ createdAt: -1 });
      res.json({ data: rows.map((r) => r.toJSON()) });
    })
  );

  router.post(
    "/super-admins",
    requireSuperAdmin,
    requireOwner,
    asyncHandler(async (req, res) => {
      const { name, email, password, role } = req.body || {};
      if (!name || !email || !password) {
        return res.status(400).json({ message: "Name, email and password are required." });
      }
      const SuperAdmin = getSuperAdminModel();
      const clean = String(email).trim().toLowerCase();
      if (await SuperAdmin.exists({ email: clean })) {
        return res.status(400).json({ message: "An admin with this email already exists." });
      }
      const created = await SuperAdmin.create({
        name,
        email: clean,
        passwordHash: hashPassword(password),
        role: role === "owner" ? "owner" : "operator",
      });
      res.status(201).json(created.toJSON());
    })
  );

  // Editing an existing account. Owner-only, like creating one.
  //
  // The email is deliberately NOT editable: it is what an admin signs in
  // with and what the audit trail records, so changing it would quietly
  // hand someone else an existing account's history. Retire the account and
  // add a new one instead.
  router.put(
    "/super-admins/:id",
    requireSuperAdmin,
    requireOwner,
    asyncHandler(async (req, res) => {
      const { name, role, status, password } = req.body || {};
      const SuperAdmin = getSuperAdminModel();
      const target = await SuperAdmin.findById(req.params.id);
      if (!target) return res.status(404).json({ message: "Super admin not found." });

      const isSelf = String(target._id) === String(req.superAdmin._id);
      const losingOwner = target.role === "owner" && role !== undefined && role !== "owner";
      const beingDisabled = status !== undefined && status !== "active" && target.status === "active";

      // Two ways to lock everybody out of the platform, both refused here:
      // demoting or disabling yourself, and removing the last owner.
      if (isSelf && (losingOwner || beingDisabled)) {
        return res.status(409).json({
          message: "You cannot remove your own access. Ask another owner to do it.",
        });
      }
      if (losingOwner || (beingDisabled && target.role === "owner")) {
        const owners = await SuperAdmin.countDocuments({ role: "owner", status: "active" });
        if (owners <= 1) {
          return res.status(409).json({
            message: "This is the last active owner — promote another account first.",
          });
        }
      }

      if (name !== undefined) {
        const clean = String(name).trim();
        if (!clean) return res.status(400).json({ message: "A name is required." });
        target.name = clean;
      }
      if (role !== undefined) target.role = role === "owner" ? "owner" : "operator";
      if (status !== undefined) target.status = status === "disabled" ? "disabled" : "active";

      // Optional: an owner may set a new password for someone who has lost
      // theirs, which is the in-app alternative to npm run create-admin.
      // Blank means 'leave it alone' rather than 'clear it'.
      if (password !== undefined && String(password).trim()) {
        const pw = String(password);
        if (pw.length < 10) {
          return res.status(400).json({ message: "A password must be at least 10 characters." });
        }
        target.passwordHash = hashPassword(pw);
      }

      await target.save();
      res.json(target.toJSON());
    })
  );

  // Removing an account. Owner-only, and it refuses the same two ways of
  // locking everybody out that disabling does: deleting yourself, and
  // deleting the last active owner. Disabling is the reversible alternative.
  router.delete(
    "/super-admins/:id",
    requireSuperAdmin,
    requireOwner,
    asyncHandler(async (req, res) => {
      const SuperAdmin = getSuperAdminModel();
      const target = await SuperAdmin.findById(req.params.id);
      if (!target) return res.status(404).json({ message: "Super admin not found." });

      if (String(target._id) === String(req.superAdmin._id)) {
        return res.status(409).json({ message: "You cannot delete your own account. Ask another owner to do it." });
      }
      if (target.role === "owner" && target.status === "active") {
        const owners = await SuperAdmin.countDocuments({ role: "owner", status: "active" });
        if (owners <= 1) {
          return res.status(409).json({ message: "This is the last active owner — promote another account first." });
        }
      }

      // Their signed-in devices go with the account.
      await getAdminSessionModel().deleteMany({ adminId: String(target._id) });
      await target.deleteOne();
      res.json({ success: true });
    })
  );

  // Signed-in devices, so access can be reviewed and cut off.
  router.get(
    "/sessions",
    requireSuperAdmin,
    asyncHandler(async (_req, res) => {
      const rows = await getAdminSessionModel().find().sort({ lastSeenAt: -1 }).limit(50).lean();
      const admins = await getSuperAdminModel().find().lean();
      const nameById = new Map(admins.map((a) => [String(a._id), a.name]));
      res.json({
        data: rows.map((s) => ({
          id: String(s._id),
          admin: nameById.get(s.adminId) || "(removed)",
          ip: s.ip,
          userAgent: s.userAgent,
          lastSeenAt: s.lastSeenAt,
          expiresAt: s.expiresAt,
        })),
      });
    })
  );

  router.delete(
    "/sessions/:id",
    requireSuperAdmin,
    requireOwner,
    asyncHandler(async (req, res) => {
      await getAdminSessionModel().deleteOne({ _id: req.params.id });
      res.json({ success: true });
    })
  );

  // ---- Payment Gateway (Razorpay) configuration ---------------------------

  function maskSecret(s) {
    if (!s) return "";
    if (s.length < 8) return "••••••••";
    return s.slice(0, 4) + "••••••••" + s.slice(-4);
  }

  router.get(
    "/payment-gateway",
    requireSuperAdmin,
    asyncHandler(async (_req, res) => {
      const config = await razorpay.getActiveConfig();
      const isConfigured = await razorpay.isConfigured();

      res.json({
        gateway: "razorpay",
        enabled: config.enabled,
        keyId: config.keyId || "",
        hasKeySecret: Boolean(config.keySecret),
        keySecretMasked: maskSecret(config.keySecret),
        webhookSecret: config.webhookSecret || "",
        companyName: config.companyName || "SIPERP",
        themeColor: config.themeColor || "#2563eb",
        isDbConfigured: config.isDbConfigured,
        isConfigured,
        isTestMode: (config.keyId || "").startsWith("rzp_test_"),
      });
    })
  );

  router.put(
    "/payment-gateway",
    requireSuperAdmin,
    asyncHandler(async (req, res) => {
      const { keyId, keySecret, webhookSecret, enabled, companyName, themeColor } = req.body || {};
      const PaymentGatewayConfig = getPaymentGatewayConfigModel();

      let record = await PaymentGatewayConfig.findOne({ gateway: "razorpay" });
      if (!record) {
        record = new PaymentGatewayConfig({ gateway: "razorpay" });
      }

      if (keyId !== undefined) record.keyId = String(keyId).trim();
      if (keySecret !== undefined && String(keySecret).trim() && !String(keySecret).includes("••••")) {
        record.keySecret = String(keySecret).trim();
      }
      if (webhookSecret !== undefined) record.webhookSecret = String(webhookSecret).trim();
      if (enabled !== undefined) record.enabled = Boolean(enabled);
      if (companyName !== undefined) record.companyName = String(companyName).trim() || "SIPERP";
      if (themeColor !== undefined) record.themeColor = String(themeColor).trim() || "#2563eb";
      record.updatedBy = req.superAdmin?.name || "Admin";

      await record.save();
      razorpay.invalidateConfigCache();

      try {
        const AdminAuditLog = getAdminAuditLogModel();
        if (AdminAuditLog) {
          await AdminAuditLog.create({
            adminId: String(req.superAdmin?._id || ""),
            adminName: req.superAdmin?.name || "Admin",
            action: "Updated Razorpay Gateway Settings",
            targetType: "PaymentGateway",
            targetId: "razorpay",
            details: { enabled: record.enabled, keyId: record.keyId },
          });
        }
      } catch (_) {}

      const isConfigured = await razorpay.isConfigured();
      res.json({
        success: true,
        message: "Payment gateway configuration saved successfully.",
        gateway: "razorpay",
        enabled: record.enabled,
        keyId: record.keyId,
        hasKeySecret: Boolean(record.keySecret),
        keySecretMasked: maskSecret(record.keySecret),
        webhookSecret: record.webhookSecret,
        companyName: record.companyName,
        themeColor: record.themeColor,
        isConfigured,
        isTestMode: record.keyId.startsWith("rzp_test_"),
      });
    })
  );

  router.post(
    "/payment-gateway/test",
    requireSuperAdmin,
    asyncHandler(async (req, res) => {
      const active = await razorpay.getActiveConfig();
      const keyId = req.body?.keyId !== undefined ? String(req.body.keyId).trim() : active.keyId;
      let keySecret = req.body?.keySecret !== undefined ? String(req.body.keySecret).trim() : active.keySecret;

      // If user passed masked secret or left empty, use active secret
      if (!keySecret || keySecret.includes("••••")) {
        keySecret = active.keySecret;
      }

      if (!keyId || !keySecret) {
        return res.status(400).json({
          success: false,
          message: "Both Razorpay Key ID and Key Secret are required to test connection.",
        });
      }

      try {
        const testRes = await razorpay.testCredentials({ keyId, keySecret });
        res.json(testRes);
      } catch (err) {
        res.status(err.status || 400).json({
          success: false,
          message: err.message || "Failed to connect to Razorpay.",
        });
      }
    })
  );

  // ---- Payment Transactions / Subscription Orders -------------------------

  router.get(
    "/transactions",
    requireSuperAdmin,
    asyncHandler(async (req, res) => {
      const SubscriptionOrder = getSubscriptionOrderModel();
      const page = Math.max(1, parseInt(req.query.page, 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
      const status = String(req.query.status || "all").trim().toLowerCase();
      const search = String(req.query.search || "").trim();

      const filter = {};
      if (status && status !== "all") {
        filter.status = status;
      }

      if (search) {
        const regex = new RegExp(search.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&"), "i");
        filter.$or = [
          { companyName: regex },
          { tenantSubdomain: regex },
          { planName: regex },
          { gatewayOrderId: regex },
          { gatewayPaymentId: regex },
        ];
      }

      const total = await SubscriptionOrder.countDocuments(filter);
      const orders = await SubscriptionOrder.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean();

      // Aggregate revenue and counts across all orders
      const [allStats] = await SubscriptionOrder.aggregate([
        {
          $group: {
            _id: null,
            totalRevenue: {
              $sum: {
                $cond: [{ $eq: ["$status", "paid"] }, "$amountPayable", 0],
              },
            },
            paidCount: {
              $sum: { $cond: [{ $eq: ["$status", "paid"] }, 1, 0] },
            },
            createdCount: {
              $sum: { $cond: [{ $eq: ["$status", "created"] }, 1, 0] },
            },
            failedCount: {
              $sum: { $cond: [{ $eq: ["$status", "failed"] }, 1, 0] },
            },
          },
        },
      ]);

      res.json({
        data: orders.map((o) => ({
          id: String(o._id),
          tenantSubdomain: o.tenantSubdomain,
          companyName: o.companyName || o.tenantSubdomain,
          planCode: o.planCode,
          planName: o.planName,
          price: o.price,
          termMonths: o.termMonths,
          amountPayable: o.amountPayable,
          currency: o.currency || "INR",
          status: o.status,
          gateway: o.gateway || "razorpay",
          gatewayOrderId: o.gatewayOrderId || "",
          gatewayPaymentId: o.gatewayPaymentId || "",
          errorMessage: o.errorMessage || "",
          createdAt: o.createdAt,
          updatedAt: o.updatedAt,
        })),
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit) || 1,
        },
        stats: {
          totalRevenue: allStats?.totalRevenue || 0,
          paidCount: allStats?.paidCount || 0,
          createdCount: allStats?.createdCount || 0,
          failedCount: allStats?.failedCount || 0,
        },
      });
    })
  );

  app.use("/api/admin", router);
}

module.exports = { registerSuperAdminRoutes };
