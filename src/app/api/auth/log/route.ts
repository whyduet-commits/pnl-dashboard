// src/app/api/auth/log/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { user_id, email, name } = await req.json();
    if (!user_id || !email) return NextResponse.json({ error: "missing" }, { status: 400 });

    // IP 추출
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      ?? req.headers.get("x-real-ip")
      ?? "unknown";

    // 1시간 이내 동일 유저 미로그아웃 기록 있으면 스킵
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: recent } = await supabase
      .from("access_logs").select("id")
      .eq("user_id", user_id)
      .gte("login_at", oneHourAgo)
      .is("logout_at", null)
      .limit(1).single();

    if (recent) return NextResponse.json({ skipped: true });

    await supabase.from("access_logs").insert({
      user_id, email, name: name ?? null,
      login_at: new Date().toISOString(),
      ip_address: ip,
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}