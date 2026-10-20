# Loopwise landing page

One-page early-access site for Loopwise. It explains the product and collects emails from Etsy sellers who want to try it.

- **Frontend:** plain HTML/CSS/JS in `public/`. No build step.
- **Backend:** Cloudflare Pages Functions in `functions/api/`, which store data in a Cloudflare D1 (SQLite) database.
- **Analytics:** Cloudflare Web Analytics for traffic, plus our own event log for what people do on the page.

```
public/            the website (index.html, styles.css, app.js, admin/)
functions/api/     signup, contact, event, admin/stats, admin/export
lib/util.js        shared helpers for the functions
schema.sql         database tables: signups, messages, events
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

- `https://loopwise.pages.dev/?src=reddit`
- `https://loopwise.pages.dev/?src=interview`
- `https://loopwise.pages.dev/?src=instagram`

The `/admin` page then shows visitors and signups for each source, which gives you conversion per channel.

## Deploy to Cloudflare (one time, about 10 minutes)

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
   npm run db:init:remote
   ```
3. Create the site and deploy:
   ```bash
   npx wrangler pages project create loopwise-landing-page --production-branch main
   npm run deploy
   ```
   Wrangler prints the live URL (something like `https://loopwise-landing-page.pages.dev`).
4. Set the admin password for `/admin` (pick any long random string):
   ```bash
   npx wrangler pages secret put ADMIN_KEY --project-name loopwise-landing-page
   npm run deploy
   ```
5. Turn on Web Analytics: Cloudflare dashboard → **Workers & Pages** → `loopwise-landing-page` → **Metrics** → **Enable Web Analytics**. Then redeploy once (`npm run deploy`) so the snippet is injected.

### Optional: auto-deploy on every `git push`

In the dashboard, go to Workers & Pages → Create → Pages → **Connect to Git**, then pick `Rixhee/loopwise-landing-page`. Set the build command to empty and the output directory to `public`. Under Settings → Bindings, add a **D1 database** binding named `DB` pointing to `loopwise`. Under Settings → Variables and Secrets, add `ADMIN_KEY`. After that, every push to `main` goes live.

### Optional: custom domain

Workers & Pages → your project → **Custom domains** → add something like `loopwise.app` if you buy one.

## Run it locally

```bash
npm install
npm run db:init:local
echo "ADMIN_KEY=dev" > .dev.vars
npm run dev                            # http://localhost:8788  and  /admin (key: dev)
```

## Peek at the data from the terminal

```bash
npx wrangler d1 execute loopwise --remote --command "SELECT email, listings, source, created_at FROM signups ORDER BY id DESC LIMIT 20"
```

## Notes

- Spam protection: a hidden honeypot field plus a minimum time-to-submit. Bots get a fake "success" so they don't retry.
- Duplicate emails aren't stored twice. The person sees "You're already on the list."
- `/admin` and `/api` are excluded from search engines.
- Contact messages don't send you an email. Check `/admin`. Cloudflare Email Routing or a service like Resend can be added later if you want notifications.
