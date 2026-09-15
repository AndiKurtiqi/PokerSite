# Poker Home Games

A tracker for home poker games: accounts with admin approval, friends, guest
players, chip-set-aware buy-in calculation, live session tracking, and a
leaderboard.

## Stack

- Next.js 16 (App Router, Turbopack)
- Postgres via Docker Compose (local dev), Prisma 7 as the ORM
- NextAuth (Auth.js) v5 with a credentials (email/password) provider

## First-time setup

```bash
npm install
docker compose up -d       # starts Postgres on localhost:5433
npm run db:seed            # creates the first admin account
npm run dev                # http://localhost:3000
```

The seed script creates an admin user from these env vars (with fallbacks
baked in for local dev):

```bash
ADMIN_EMAIL=you@example.com ADMIN_PASSWORD=yourpassword ADMIN_NAME="Your Name" npm run db:seed
```

If you don't pass them, it defaults to `andikurtiqi@gmail.com` /
`changeme123` — log in and change the password by re-running the seed with a
real password once auth includes account settings (not built yet).

## Database

- `docker compose up -d` — start local Postgres (data persists in a Docker volume)
- `npx prisma migrate dev --name <description>` — create + apply a migration after editing `prisma/schema.prisma`
- `npm run db:studio` — Prisma Studio, a GUI for browsing/editing tables

Postgres runs on port **5433** (not 5432), since this machine already has a
Homebrew Postgres service bound to 5432.

## How accounts work

1. Anyone can request an account at `/signup` (email/password) — it's created with `PENDING` status.
2. An admin reviews requests at `/admin/requests` and approves or rejects.
3. Only `APPROVED` users can access the app; `PENDING` users are shown a waiting page.

## Current state

This is the foundation: auth + admin approval are fully wired up. Friends,
games (chip-set calculator, live buy-in/rebuy/cashout tracking), and the
leaderboard are scaffolded as placeholder pages/nav links and still need to
be built out — the data model for all of it already exists in
`prisma/schema.prisma`.
