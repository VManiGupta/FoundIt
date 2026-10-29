# FoundIt — Campus Lost & Found

FoundIt is a campus-focused lost-and-found web app. People can report lost or found belongings, search community listings, submit claims, and review claim status.

## Features

- Responsive React UI for desktop and mobile
- Browse, search, and filter lost/found listings
- Auth with email and password
- Create listings with optional photos
- Submit claims with identifying details
- Item owner can approve/reject claims
- Status timeline and mark items as returned
- Supabase PostgreSQL, Row Level Security, and Storage
- Sample preview data when Supabase is not configured

## Tech stack

- React + Vite
- Supabase Auth + PostgreSQL + Storage
- Lucide icons
- Vercel deployment

## Run locally

Requirements: Node.js 18+ and npm.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open the local URL printed by Vite.

The app starts in preview mode with sample listings if you have not configured Supabase. Sample listings are read-only; authentication and live writes require a Supabase project.

## Configure Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. Open **SQL Editor** in the Supabase dashboard.
3. Paste and run [`supabase/schema.sql`](supabase/schema.sql).
4. In **Project Settings → API**, copy the Project URL and anon/publishable key.
5. Put those values in `.env.local`:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_OR_PUBLISHABLE_KEY
```

6. Restart the dev server after changing environment variables.
7. In Supabase Auth settings, configure your site URL and redirect URLs for local development and production. If email confirmation is enabled, users need to confirm their email before signing in.
8. The SQL script creates the `item-photos` public storage bucket and access policies. Public photos are visible to anyone, so do not upload private documents, student IDs, faces, or sensitive information.

### Security notes

- Only use the anon/publishable key in the frontend. **Never expose the Supabase service-role key.**
- Row Level Security is enabled on the tables.
- Listings are publicly readable by design; claims are only readable by the claimant and the owner of the item.
- The SQL trigger restricts claim updates to the claimant or item owner.
- For production use, review all policies, add rate limiting/abuse reporting, moderate content, and test authorization with multiple accounts.
- If you deploy for a real campus, provide a contact/moderation process and a way to report inappropriate listings.

## Build for production

```bash
npm run build
npm run preview
```

## Deploy to Vercel

1. Push the repository to GitHub.
2. Import the repository in Vercel.
3. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in the Vercel project environment variables.
4. Deploy.
5. Add the deployed domain to Supabase Auth's allowed redirect URLs and site URL.

Vite's default build output is `dist`.

## Suggested GitHub repo description

> Campus lost-and-found platform built with React, Vite, Supabase Auth, PostgreSQL, and Storage. Includes searchable listings, image uploads, claim review, status tracking, and responsive UI.

## Future improvements

- Email notifications when a claim is submitted or approved
- Moderation and report-abuse flow
- Pagination and server-side filtering for larger campuses
- Duplicate listing suggestions
- Admin dashboard and campus-specific access
- Audit history for item status changes
- Automated tests for critical flows
