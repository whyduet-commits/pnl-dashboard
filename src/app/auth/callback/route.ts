// src/app/auth/callback/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createClient as createAdmin } from "@supabase/supabase-js";

const adminClient = createAdmin(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);
  const code  = searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=no_code`);
  }

  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll()         { return cookieStore.getAll(); },
        setAll(list)     { list.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); },
      },
    }
  );

  // code → session 교환
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    console.error("exchangeCodeForSession 오류:", error);
    return NextResponse.redirect(`${origin}/login?error=auth_failed`);
  }

  const user = data.user;

  // ── 승인 계정 확인 ──────────────────────────────────────
  const { data: allowed } = await adminClient
    .from("allowed_users")
    .select("email")
    .eq("email", user.email)
    .single();

  if (!allowed) {
    // signOut 없이 바로 리디렉션 (쿠키 충돌 방지)
    // 클라이언트에서 not_allowed 감지 후 세션 제거
    const res = NextResponse.redirect(`${origin}/login?error=not_allowed`);
    // 세션 쿠키 강제 삭제
    res.cookies.set("sb-access-token", "", { maxAge: 0 });
    res.cookies.set("sb-refresh-token", "", { maxAge: 0 });
    return res;
  }

  // ── 접속 로그 ────────────────────────────────────────────
  try {
    await adminClient.from("access_logs").insert({
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