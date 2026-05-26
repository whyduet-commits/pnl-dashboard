// src/app/auth/callback/route.ts
// Google OAuth 완료 후 리디렉션되는 엔드포인트
import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

const supabase = createSupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);
  const code  = searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=no_code`);
  }

  // code → session 교환
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    return NextResponse.redirect(`${origin}/login?error=auth_failed`);
  }

  const user = data.user;

  // ── 승인 계정 확인 ──────────────────────────────────────
  const { data: allowed } = await supabase
    .from("allowed_users")
    .select("email")
    .eq("email", user.email)
    .single();

  if (!allowed) {
    // 승인되지 않은 계정 → 즉시 로그아웃 후 에러 메시지
    await supabase.auth.signOut();
    return NextResponse.redirect(
      `${origin}/login?error=not_allowed`
    );
  }

  // ── 접속 로그 ────────────────────────────────────────────
  try {
    await supabase.from("access_logs").insert({
      user_id:  user.id,
      email:    user.email,
      name:     user.user_metadata?.full_name ?? null,
      login_at: new Date().toISOString(),
    });
  } catch {
    console.warn("access_logs insert 실패");
  }

  return NextResponse.redirect(`${origin}/`);
}