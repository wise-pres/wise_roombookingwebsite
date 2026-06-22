# WISE Room Request Portal

A room-request intake and coordination portal for WISE U of T. Requesters receive capacity-based room suggestions, can view source-hosted room photos where available, and can submit a manual room option when the catalogue does not fit. Coordinators manage requests, rooms, photos, shared suitability tags, and urgent submissions.

## Local setup

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env.local` and fill in the deployment values.
3. Create a Supabase project, then run `supabase db push` to apply `supabase/migrations/202606210001_init.sql`.
4. Seed the room catalogue with `npm run seed:catalog` after setting `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.
5. Run `npm run dev` and open `http://localhost:3000`.

The dashboard passcode is compared to a SHA-256 hash. Generate the value for `ADMIN_DASHBOARD_PASSWORD_HASH` with:

```sh
node -e "const { createHash } = require('node:crypto'); console.log(createHash('sha256').update('replace-with-a-strong-passcode').digest('hex'))"
```

## Environment variables

- `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`: application database and protected storage access.
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`: Cloudflare Turnstile for public requests.
- `SLACK_WEBHOOK_URL`: private WISE Slack-channel alert webhook.
- `RESEND_API_KEY`, `EMAIL_FROM`: requester receipts and status emails.
- `ADMIN_DASHBOARD_PASSWORD_HASH`, `SESSION_SECRET`: shared-passcode dashboard protection.
- `CRON_SECRET`: protects Vercel's annual requester-name retention job.

## Catalogue maintenance

The seed is generated from `SOP Accessible Rooms - August 2024.pdf`; it contains every extracted SOP room plus the specified EngSoc Myhal rooms, `GB202`, and the UTSU Student Commons fifth-floor lounge. To regenerate it from an updated PDF, install `pypdf` and run:

```sh
python3 scripts/extract_sop_rooms.py /path/to/updated-room-list.pdf src/data/sop-rooms.json
npm run seed:catalog
```

The coordinator dashboard supports manual room creation, custom shared tags, external source-photo links, WISE-approved JPEG/PNG/WebP uploads, image removal, and disabling rooms while preserving request history.

## Important launch checks

- Confirm that WISE is permitted to display University-hosted images before enabling those source links in production. The app does not copy or proxy those files.
- Requesters may submit rooms not in the dropdown, but those entries remain request-only until a coordinator adds a verified catalogue room.
- Requests under seven days and UTSU-restricted time windows are still accepted, but are stored, alerted, and displayed as urgent.

## Verification

```sh
npm run typecheck
npm test
npm run lint
npm run build
```
