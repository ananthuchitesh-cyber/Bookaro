import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { getTripPlanById } from "@/lib/plans";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Please sign in first" }, { status: 401 });
    }

    const params = await context.params;
    const planId = Number(params.id);
    if (!Number.isFinite(planId)) {
      return NextResponse.json({ error: "Invalid plan id" }, { status: 400 });
    }

    const plan = await getTripPlanById(planId, Number(user.id));
    if (!plan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    return NextResponse.json({
      id: plan.id,
      title: plan.title,
      plan: plan.plan_json,
      form: plan.form_json,
      createdAt: plan.created_at,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load plan";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
