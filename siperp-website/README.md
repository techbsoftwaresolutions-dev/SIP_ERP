# SIPERP website (siperp.in)

The public marketing site for SIPERP: Home, Features, Industries, Pricing, Book a Demo,
About, Contact, Privacy Policy, plus a Login button that goes to the existing app at


It is plain HTML, CSS and one small JS file, the same approach as the Techb Software
Solutions site. No framework runs on the server, so it works on any Hostinger plan.

## How it is made

Pages share a header, footer and form, so they are generated from a few source files:

```
siperp-website/
  build.mjs          builds dist/ (run: node build.mjs)
  src/layout.mjs     header, footer, contact details, icons, the lead form
  src/pages.mjs      the content of every page except Home (+ plan prices)
  src/home.mjs       the landing page (Home)
  src/static/        css/, js/, img/ (logo, favicons, share image), .htaccess (copied into dist as-is)
  brand/             the original logo and every generated size
  dist/              the finished site. Upload THIS. (generated, not committed)
```

To preview locally: `npm start` (builds in development mode, then serves http://localhost:8080). In development mode the Login button goes to the local app (http://localhost:5173/login) and the demo form posts to the local API (http://localhost:5000). `npm run build` makes the production site, which uses the addresses at the top of `site.config.json`.

To change wording, prices, phone number or the menu: edit `src/pages.mjs` or
`src/layout.mjs`, run `npm run build` (same as `node build.mjs`), and upload the new `dist/` contents.
Where the Login button and the demo form point is set in `site.config.json` (`loginUrl`, `apiUrl`, and the `development` block), not in the code.

## Deploy on Hostinger (static, about 5 minutes)

1. hPanel -> Websites -> Add website -> **siperp.in** (point the domain's nameservers at Hostinger first if it isn't there).
2. Open **File Manager -> public_html** and upload the **contents** of `dist/`
   (or upload `siperp-site.zip` and extract it there). `index.html` and `.htaccess` must sit directly inside `public_html`.
3. hPanel -> **Security -> Force HTTPS** on for siperp.in, and issue the free SSL if it is not active.
4. Open https://siperp.in and check every page, and that Login opens the app's sign-in page (`loginUrl` in `site.config.json`; clients then sign in on their own address such as abc.siperp.in, and the Super Admin on admin.siperp.in).

## The Book a Demo / Contact forms

They post to `https://api.techbsoftwaresolutions.com/api/public/demo-requests` (the SIPERP
backend). Leads appear in **Super Admin -> Demo Requests**, where you can mark each one
New / Contacted / Won / Lost and add a note.

This only works once the **updated backend is deployed** (the new endpoint is in it).
Until then the form shows a friendly "please call us" message instead of failing silently.

Safeguards: a hidden honeypot field for bots, 5 submissions per hour per visitor, strict
length limits.

## Before launch: things to confirm

- **Prices** in `src/pages.mjs` (`PLANS`) are taken from the platform's starter plans
  (Basic Rs 499, Professional Rs 1,499, Enterprise Rs 2,999 per month + GST; yearly = 10 months; one-time setup Rs 3,000 / 5,000 / 10,000). Compare with
  Super Admin -> Subscription Plans and edit if they differ.
- **Contact details** (`src/layout.mjs`, `SITE`): currently the Techb phone, email
  (info@techbsoftwaresolutions.com) and Hosur address. Add a siperp.in mailbox if you want one.
- **Privacy Policy** is a plain-language starter. Have it reviewed before launch.
- **Logo and share image** are generated from `brand/siperp-logo-original.jpg` (transparent PNGs, icons and the 1200x630 `og-image.png` are in `brand/` and `src/static/img/`). If the logo changes, replace the original and regenerate those files.
- Add real **screenshots** and customer logos/testimonials later, once you have permission to use them. The dashboard picture is a labelled illustration.
- After launch, submit `https://siperp.in/sitemap.xml` to Google Search Console.

