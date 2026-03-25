## Travel Planner

This project now uses two separate PostgreSQL databases:

- `TRAVEL_DB_URL` for the travel reference data built from your `TravelApp.zip`
- `USER_DB_URL` for user login records and saved trip plans

## Database Setup

Add these to `.env.local`:

```bash
TRAVEL_DB_URL=postgresql://postgres:root@localhost:5432/travel_planner
USER_DB_URL=postgresql://postgres:root@localhost:5432/bookaro_users
```

Initialize both databases:

```bash
npm run db:init
```

Build the compiled travel dataset from `d:\TravelApp.zip`, create the travel tables, and seed the fresh travel database:

```bash
npm run db:setup:travel
```

Run the full fresh setup for both databases:

```bash
npm run db:setup:all
```

## Development

Start the app:

```bash
npm run dev
```

Open `http://localhost:3000`.

## File Map

- `db/travel-schema.sql` contains the travel-data schema
- `db/user-schema.sql` contains the auth and trip-plan schema
- `scripts/build_travel_data_from_zip.py` rebuilds `db/compiled/india-travel-data.json` from your ZIP file
- `scripts/seed-travel-db.mjs` loads that compiled dataset into `TRAVEL_DB_URL`
