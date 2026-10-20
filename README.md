# Loopwise landing page

One-page early-access site for Loopwise. It explains the product and collects emails from Etsy sellers who want to try it.

- **Frontend:** plain HTML/CSS/JS in `public/`. No build step.
- **Backend:** Cloudflare Pages Functions in `functions/api/`, which store data in a Cloudflare D1 (SQLite) database.
- **Analytics:** Cloudflare Web Analytics for traffic, plus our own event log for what people do on the page.

```
public/            the website (index.html, styles.css, app.js, admin/)
functions/api/     signup, contact, event, admin/stats, admin/export
lib/util.js        shared helpers for the functions
migrations/        database tables (signups, messages, events), one file per change
wrangler.toml      Cloudflare config
```

## What gets tracked

| Data | Where to see it |
|---|---|
| Visits, page views, referrers, countries, devices | Cloudflare dashboard → Web Analytics |
| Email signups (+ shop size, which form, `?src=` tag, country) | `/admin` page, or CSV download |
| Contact form messages | `/admin` page, or CSV download |
| Sections reached (how far people scroll), FAQ questions opened, hero toggle, version-history clicks, CTA clicks | `/admin` page, or `events` CSV |

**Track where signups come from** by adding `?src=` to every link you share, e.g.

- `https://getloopwise.pages.dev/?src=reddit`
- `https://getloopwise.pages.dev/?src=interview`
- `https://getloopwise.pages.dev/?src=instagram`

The `/admin` page then shows visitors and signups for each source, which gives you conversion per channel.

## Deploy to Cloudflare

**Quickest:** run `npx wrangler login`, then `bash scripts/setup-cloudflare.sh`. The script creates the database and tables, deploys the site, and asks you to choose the /admin password. After any later change, run `npm run deploy`.

### Manual steps (what the script does)

You need a free Cloudflare account and Node.js installed.

```bash
cd ~/Github/loopwise-landing-page
npm install
npx wrangler login                     # opens your browser to sign in to Cloudflare
npx wrangler d1 create loopwise        # prints a database_id
```

1. Paste the printed `database_id` into `wrangler.toml` in place of `REPLACE_WITH_YOUR_D1_DATABASE_ID`.
2. Create the tables:
   ```bash
   npm run db:migrate:remote
   ```
3. Create the site and deploy:
   ```bash
   npx wrangler pages project create getloopwise --production-branch main
   npm run deploy
   ```
   Wrangler prints the live URL (something like `https://getloopwise.pages.dev`).
4. Set the admin password for `/admin` (pick any long random string):
   ```bash
   npx wrangler pages secret put ADMIN_KEY --project-name getloopwise
   npm run deploy
   ```
5. Turn on Web Analytics: Cloudflare dashboard → **Workers & Pages** → `getloopwise` → **Metrics** → **Enable Web Analytics**. Then redeploy once (`npm run deploy`) so the snippet is injected.

## Auto-deploy on every push (GitHub Actions)

`.github/workflows/deploy.yml` deploys the site whenever anything is pushed:

- a push to `main` updates the live site
- a push to any other branch gets its own preview link, shown in the Actions log

One-time setup, so GitHub is allowed to deploy to your Cloudflare account:

1. **Create a Cloudflare API token.** Go to dash.cloudflare.com → My Profile → API Tokens → Create Token → Create Custom Token, and give it these permissions:
   - Account → **Cloudflare Pages** → Edit
   - Account → **D1** → Edit

   Copy the token.
2. **Find your account ID.** Run `npx wrangler whoami`, or copy it from the right sidebar of any Cloudflare dashboard page.
3. **Add both to GitHub.** Open the repo → Settings → Secrets and variables → Actions → New repository secret, and add:
   - `CLOUDFLARE_API_TOKEN` = the token
   - `CLOUDFLARE_ACCOUNT_ID` = the account ID

   Or, with the GitHub CLI: `gh secret set CLOUDFLARE_API_TOKEN` and `gh secret set CLOUDFLARE_ACCOUNT_ID`.
4. Push anything (or Actions → Deploy to Cloudflare Pages → Run workflow). The site redeploys in about a minute.

The `/admin` password (`ADMIN_KEY`) lives in Cloudflare, not GitHub, so it carries over between deploys.

## Custom domain

The free address is `https://getloopwise.pages.dev`. To use your own domain, like `loopwise.app`:

1. Buy the domain. Cloudflare Registrar (dashboard → Domain Registration) sells at cost, about $10–15 a year for a .com. Any registrar, such as Namecheap or Porkbun, works too.
2. In Cloudflare, go to Workers & Pages → `getloopwise` → **Custom domains** → Set up a custom domain, and type the domain.
3. If the domain is on Cloudflare, it connects automatically. If not, Cloudflare shows a CNAME record to add at your registrar. HTTPS is set up for you either way.

Add both `loopwise.app` and `www.loopwise.app` so either one works.

## Run it locally

```bash
npm install
npm run db:migrate:local
echo "ADMIN_KEY=dev" > .dev.vars
npm run dev                            # http://localhost:8788  and  /admin (key: dev)
```

## Peek at the data from the terminal

```bash
npx wrangler d1 execute loopwise --remote --command "SELECT email, listings, source, created_at FROM signups ORDER BY id DESC LIMIT 20"
```

## Bots and your own visits

New sites get visited by automated scanners within minutes of going live. To keep the numbers honest:

- Every event is stored, but each one is checked against its browser signature, signs of an automated browser, a missing language header, and whether it came from a cloud or hosting network (where scanners run). Suspected bots are flagged, not deleted.
- A browser only counts as a **real visitor** once it scrolls, taps, clicks or types, and only if none of its events were flagged.
- **Your own visits are excluded.** Opening `/admin` marks that browser as "you." On your phone or other devices, visit the site once with `?internal=1`; `?internal=0` undoes it.
- `/admin` shows what was left out and why ("Not counted as visitors, and why"), and the events CSV includes `is_bot`, `bot_reason` and the network for each row.
- Signups are never rejected for looking like a bot, because real people use VPNs. They're flagged so you can check them yourself.

## Changing the database

Add a new numbered file in `migrations/`, such as `0003_something.sql`. The deploy workflow applies only the files that haven't run yet. To apply one by hand, run `npm run db:migrate:remote`.

## Notes

- Spam protection: a hidden honeypot field plus a minimum time-to-submit. Bots get a fake "success" so they don't retry.
- Duplicate emails aren't stored twice. The person sees "You're already on the list."
- `/admin` and `/api` are excluded from search engines.
- Contact messages don't send you an email. Check `/admin`. Cloudflare Email Routing or a service like Resend can be added later if you want notifications.
