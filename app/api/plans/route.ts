import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { getUserTripPlans, saveTripPlan } from "@/lib/plans";

export async function GET() {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Please sign in first" }, { status: 401 });
    }

    const plans = await getUserTripPlans(Number(user.id));
    return NextResponse.json({
      plans: plans.map((plan) => ({
        id: plan.id,
        title: plan.title,
        source: plan.source,
        destination: plan.destination,
        startDate: plan.start_date,
        endDate: plan.end_date,
        travelers: plan.travelers,
        budget: plan.budget,
        createdAt: plan.created_at,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load plans";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Please sign in first" }, { status: 401 });
    }

    const body = await request.json();
    const form = body?.form;
    const plan = body?.plan;

    if (!form?.source || !form?.destination || !form?.startDate || !form?.endDate || !plan) {
      return NextResponse.json({ error: "Plan details are incomplete" }, { status: 400 });
    }

    const saved = await saveTripPlan({
      userId: Number(user.id),
      source: String(form.source),
      destination: String(form.destination),
      startDate: String(form.startDate),
      endDate: String(form.endDate),
      travelers: Number(form.travelers || 1),
      budget: Number(form.budget || 0),
      plan,
      form,
    });

    return NextResponse.json({ ok: true, planId: saved.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save plan";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
