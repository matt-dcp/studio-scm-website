# Studio SCM — website

Boutique travel house for families. Single-page marketing site plus room to grow
into private client forms (booking intake, passport info, etc.) at sub-paths.

Stack matches the `rcp-website` repo: plain static HTML/CSS/JS, no build step,
git → GitHub Actions → Netlify.

## Local development

```bash
# From this folder:
python3 -m http.server 8094
# → open http://localhost:8094
```

Or use the Claude Code preview: `studio-scm` is already wired in `.claude/launch.json`.

## File layout

```
studio-scm-website/
├── index.html            # homepage (Postcards design)
├── styles.css            # all styles, responsive
├── app.js                # parallax, reveal, inquiry stepper, form submit
├── netlify.toml          # publish = "."; pretty URLs on
├── assets/               # Studio SCM logos (black / white / pink)
├── .github/workflows/
│   └── deploy.yml        # push to main → Netlify production deploy
├── .gitignore
└── README.md
```

## Deploy flow

Mirrors the RCP repo:

1. Create a new Netlify site, connect it to the GitHub repo (or set it up once via
   `netlify init` then record the Site ID).
2. In the GitHub repo settings → Secrets, add:
   - `NETLIFY_AUTH_TOKEN` — from https://app.netlify.com/user/applications
   - `NETLIFY_SITE_ID` — from the Netlify site's Site configuration page
3. `git push origin main` triggers `.github/workflows/deploy.yml`, which runs
   `netlify deploy --prod --dir .` — that's the whole CI pipeline.

To publish an update: edit files locally, commit, push. That's it.

## Domain migration from Squarespace

Amy's email is on Google Workspace, which is MX-record based and stays untouched.
Only the website's A/CNAME records need to change.

1. **In Netlify** — add `studioscm.com` as a custom domain. Netlify will give you
   either (a) an Apex `A` record (75.2.60.5) + a `CNAME` for `www`, or (b) full
   nameserver records if you want Netlify to run DNS.
2. **In the domain registrar** — update DNS to match Netlify's instructions. Do
   **not** touch the MX records (Google Workspace email keeps working).
3. Let DNS propagate (usually < 1 hour), confirm the new site loads on
   `studioscm.com`, then cancel Squarespace.

Tip: don't cancel Squarespace until the new site is live and you've sent a test
inquiry form submission.

## Adding client-facing forms at sub-paths

Amy can send a direct link like `studioscm.com/booking/smith-family` to a new
client who needs to fill out intake info (passports, DOBs, dietary notes, etc.).
The pattern:

1. Create the folder + an `index.html`:
   ```
   /booking/index.html                      → studioscm.com/booking
   /booking/smith-family/index.html         → studioscm.com/booking/smith-family
   /clients/intake/index.html               → studioscm.com/clients/intake
   ```
2. Each page is a plain HTML file — copy `index.html` as a starting point, trim
   the marketing content, drop in a `<form netlify>` with whatever fields are
   needed (the homepage form is the model).
3. Commit + push → it's live at that URL.

With `pretty_urls = true` in `netlify.toml`, trailing slashes are handled for you.

### Form submissions

The homepage inquiry form already has `data-netlify="true"` and a hidden
`form-name="inquiry"` input. Netlify auto-detects it at deploy time and starts
capturing submissions.

- **See submissions:** Netlify dashboard → Forms.
- **Email Amy on new submissions:** Forms → Notifications → "Email notification"
  → `amy@studioscm.com`.
- **Free tier:** 100 submissions/month. Plenty for a new inquiry + a handful of
  active client intakes.

For any new sub-path form, reuse the same pattern:
```html
<form name="booking-smith" method="POST" data-netlify="true" netlify-honeypot="bot-field">
  <input type="hidden" name="form-name" value="booking-smith" />
  <p hidden><label>Don't fill this out: <input name="bot-field" /></label></p>
  <!-- real fields -->
</form>
```

Each uniquely-named form shows up as its own submissions bucket in the Netlify UI.

## Design source

This site implements the "Postcards from the Road" direction from the Claude
Design handoff bundle (`Studio SCM - Reimagined.html`). The original React/JSX
prototype was recreated as a pure static site for simpler hosting and easy
maintenance.
