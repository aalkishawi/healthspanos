# Run Numik HealthspanOS locally

**Prerequisites:** Node.js 20+ (tested on 24) and npm. No external database — dev uses SQLite.

## 1. Install + set up the database (one time)

```bash
npm install
cp .env.example .env        # Windows PowerShell: copy .env.example .env
npm run setup               # prisma generate + db push + seed demo tenants/users
```

## 2. Start the app

```bash
npm run dev
```

Open **http://localhost:3000** — the port is **3000**.

The public homepage has the **Launch Numik HealthspanOS** button, which links to the
website set in `NEXT_PUBLIC_APP_URL` (opens in a new tab). `.env.example` ships a default
production URL; blank the variable to fall back to the in-app Member portal (`/member`)
for local dev.

## Demo logins (password: `Demo123!`)

| Portal                          | Email                | Role             |
| ------------------------------- | -------------------- | ---------------- |
| Member portal                   | `member@acme.demo`   | MEMBER           |
| Enterprise portal               | `employer@acme.demo` | ENTERPRISE_ADMIN |
| Scientific & clinical review    | `reviewer@numik.demo`| REVIEWER         |
| Platform administration         | `admin@numik.demo`   | PLATFORM_ADMIN   |

## Tests

```bash
npm run typecheck     # TypeScript, no errors
npm test              # Vitest unit tests (RBAC + tenant isolation)
npx playwright install chromium   # one time, before the first e2e run
npm run test:e2e      # Playwright e2e (auto-starts the dev server)
```

## Production build (same as Vercel)

```bash
npm run build && npm run start   # serves on http://localhost:3000
```

## Deploy to Vercel

1. Push this folder to a Git repo and import it in Vercel (framework auto-detected as Next.js).
2. Set env vars in Vercel: `DATABASE_URL` (a Postgres/Neon URL — switch the provider in
   `prisma/schema.prisma` from `sqlite` to `postgresql`), `AUTH_SECRET` (long random string),
   and `NEXT_PUBLIC_APP_URL` (your deployed HTTPS URL, so the Launch button points at production).
3. The build command in `vercel.json` runs `prisma generate && prisma db push && next build`.
