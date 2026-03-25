import { getUserDbPool } from "@/lib/postgres";

type SavedPlanRow = {
  id: number;
  user_id: number;
  title: string;
  source: string;
  destination: string;
  start_date: string;
  end_date: string;
  travelers: number;
  budget: number;
  plan_json: unknown;
  form_json: unknown;
  created_at: string;
};

export async function ensurePlansTable() {
  const pool = getUserDbPool();
  if (!pool) {
    throw new Error("User database connection is not configured (USER_DB_URL missing)");
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS trip_plans (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      source TEXT NOT NULL,
      destination TEXT NOT NULL,
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      travelers INTEGER NOT NULL,
      budget INTEGER NOT NULL,
      plan_json JSONB NOT NULL,
      form_json JSONB NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_trip_plans_user_created
    ON trip_plans(user_id, created_at DESC)
  `);

  return pool;
}

export async function saveTripPlan(input: {
  userId: number;
  source: string;
  destination: string;
  startDate: string;
  endDate: string;
  travelers: number;
  budget: number;
  plan: unknown;
  form: unknown;
}) {
  const pool = await ensurePlansTable();
  const title = `${input.source} to ${input.destination}`;
  const result = await pool.query(
    `INSERT INTO trip_plans
      (user_id, title, source, destination, start_date, end_date, travelers, budget, plan_json, form_json)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb)
     RETURNING id, user_id, title, source, destination, start_date, end_date, travelers, budget, plan_json, form_json, created_at`,
    [
      input.userId,
      title,
      input.source,
      input.destination,
      input.startDate,
      input.endDate,
      input.travelers,
      input.budget,
      JSON.stringify(input.plan),
      JSON.stringify(input.form),
    ]
  );

  return result.rows[0] as SavedPlanRow;
}

export async function getUserTripPlans(userId: number) {
  const pool = await ensurePlansTable();
  const result = await pool.query(
    `SELECT id, user_id, title, source, destination, start_date, end_date, travelers, budget, plan_json, form_json, created_at
     FROM trip_plans
     WHERE user_id = $1
     ORDER BY created_at DESC`,
    [userId]
  );

  return result.rows as SavedPlanRow[];
}

export async function getTripPlanById(planId: number, userId: number) {
  const pool = await ensurePlansTable();
  const result = await pool.query(
    `SELECT id, user_id, title, source, destination, start_date, end_date, travelers, budget, plan_json, form_json, created_at
     FROM trip_plans
     WHERE id = $1 AND user_id = $2
     LIMIT 1`,
    [planId, userId]
  );

  return (result.rows[0] as SavedPlanRow | undefined) ?? null;
}
