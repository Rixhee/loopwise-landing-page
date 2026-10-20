#!/usr/bin/env bash
# One-time Cloudflare setup + deploy for the Loopwise landing page.
# Run from anywhere:  bash scripts/setup-cloudflare.sh
# Safe to re-run: it reuses the database and project if they already exist.
set -euo pipefail
cd "$(dirname "$0")/.."

PROJECT="getloopwise"
DB="loopwise"
W="npx --yes wrangler"

echo "==> Installing dependencies"
npm install --no-audit --no-fund --silent

echo "==> Checking Cloudflare login"
$W whoami >/dev/null 2>&1 || { echo "Not logged in. Run: npx wrangler login"; exit 1; }

echo "==> Database"
find_db_id() {
  $W d1 list --json 2>/dev/null | node -e '
    let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{
      try{const j=JSON.parse(s);const d=(Array.isArray(j)?j:j.result||[]).find(x=>x.name===process.argv[1]);
      process.stdout.write(d?(d.uuid||d.id||""):"")}catch(e){}})' "$DB"
}
DB_ID="$(find_db_id)"
if [ -z "$DB_ID" ]; then
  echo "    creating D1 database '$DB'"
  $W d1 create "$DB" </dev/null >/dev/null 2>&1 || true
  DB_ID="$(find_db_id)"
fi
if [ -z "$DB_ID" ]; then echo "Could not create or find the D1 database."; exit 1; fi
echo "    database id: $DB_ID"
sed -i.bak -E "s/^database_id = \".*\"/database_id = \"$DB_ID\"/" wrangler.toml && rm -f wrangler.toml.bak

echo "==> Creating / upgrading tables"
CI=true $W d1 migrations apply "$DB" --remote

echo "==> Pages project"
$W pages project create "$PROJECT" --production-branch main >/dev/null 2>&1 || echo "    (already exists)"

echo "==> Deploying"
$W pages deploy --project-name "$PROJECT" --branch main --commit-dirty=true

if ! $W pages secret list --project-name "$PROJECT" 2>/dev/null | grep -q ADMIN_KEY; then
  echo
  echo "==> Choose a password for your /admin stats page (it won't show as you type)"
  $W pages secret put ADMIN_KEY --project-name "$PROJECT"
  echo "==> Redeploying so the password takes effect"
  $W pages deploy --project-name "$PROJECT" --branch main --commit-dirty=true >/dev/null
fi

echo
SUB="$($W pages project list --json 2>/dev/null | node -e '
  let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const j=JSON.parse(s);
  const p=j.find(x=>(x["Project Name"]||x.name)===process.argv[1]);
  process.stdout.write(p?String(p["Project Domains"]||p.subdomain||"").split(",")[0].trim():"")}catch(e){}})' "$PROJECT")"
[ -z "$SUB" ] && SUB="$PROJECT.pages.dev"
echo "Done! Your site:  https://$SUB"
echo "Stats page:      https://$SUB/admin"
