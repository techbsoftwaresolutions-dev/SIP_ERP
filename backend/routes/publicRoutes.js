// Endpoints the public SIPERP website (siperp.in) calls. No sign-in and no
// tenant — registered ABOVE the auth/tenant middleware in server.js, like the
// super-admin routes, because a visitor has neither.
//
// Because anyone on the internet can call these, they are deliberately narrow:
// one write endpoint, strict length limits, a hidden honeypot field for bots,
// and a per-address rate limit. Nothing here reads data back out.

const { getDemoRequestModel } = require("../tenancy/tenantModels");
const { requestLimit } = require("../middleware/loginThrottle");

const INDUSTRIES = [
  "Manufacturing",
  "Wholesale & Distribution",
  "Retail",
  "Packaging",
  "Trading",
  "Services & Maintenance",
  "Other",
];
const TEAM_SIZES = ["1-5", "6-20", "21-50", "51-200", "200+"];

const clip = (value, max) => String(value === undefined || value === null ? "" : value).trim().slice(0, max);

function registerPublicRoutes(app, { asyncHandler }) {
  // Five submissions an hour per visitor is generous for a person and useless
  // for a script. Per IP (req.ip honours Hostinger's proxy header).
  const submitLimit = requestLimit({
    keyFor: (req) => `demo|${String(req.ip || "").replace(/^::ffff:/, "")}`,
    max: 5,
    windowMs: 60 * 60 * 1000,
    message: "You have sent several requests already. We will get back to you shortly — or call us on +91 88921 84047.",
  });

  app.post(
    "/api/public/demo-requests",
    submitLimit,
    asyncHandler(async (req, res) => {
      const body = req.body || {};

      // Bots fill every field they find, including the one a person never sees.
      // Answer exactly as if it worked, so there is nothing to adapt to.
      if (clip(body.website, 200)) return res.status(201).json({ ok: true });

      const name = clip(body.name, 80);
      const phone = clip(body.phone, 20).replace(/[^\d+]/g, "");
      const email = clip(body.email, 120).toLowerCase();

      if (name.length < 2) return res.status(400).json({ message: "Please enter your name." });
      if (!phone && !email) {
        return res.status(400).json({ message: "Please give a phone number or an email so we can reach you." });
      }
      if (phone && phone.replace(/\D/g, "").length < 10) {
        return res.status(400).json({ message: "Please enter a valid phone number." });
      }
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
        return res.status(400).json({ message: "Please enter a valid email address." });
      }

      const industry = clip(body.industry, 60);
      const teamSize = clip(body.teamSize, 20);
      await getDemoRequestModel().create({
        name,
        company: clip(body.company, 120),
        phone,
        email,
        industry: INDUSTRIES.includes(industry) ? industry : "",
        teamSize: TEAM_SIZES.includes(teamSize) ? teamSize : "",
        message: clip(body.message, 1500),
        kind: body.kind === "contact" ? "contact" : "demo",
        page: clip(body.page, 120),
        ip: String(req.ip || "").replace(/^::ffff:/, ""),
        userAgent: clip(req.headers["user-agent"], 200),
      });
      res.status(201).json({ ok: true });
    })
  );
}

module.exports = { registerPublicRoutes, INDUSTRIES, TEAM_SIZES };
