// src/app/auth/callback/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=no_code`);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey     = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  // 응답 객체를 먼저 생성 (쿠키 설정용)
  const res = NextResponse.redirect(`${origin}/`);

  // PKCE 코드 검증을 위해 요청 쿠키를 읽고 응답 쿠키에 저장하는 클라이언트
  const supabase = createServerClient(supabaseUrl, anonKey, {
    cookies: {
      getAll() {
        return req.cookies.getAll();
      },
      setAll(cookieList) {
        cookieList.forEach(({ name, value, options }) => {
          res.cookies.set(name, value, options);
        });
      },
    },
  });

  try {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error || !data?.user || !data?.session) {
      console.error("[callback] exchangeCodeForSession 실패:", error?.message);
      return NextResponse.redirect(`${origin}/login?error=auth_failed`);
    }

    const { user } = data;

    // ── 승인 계정 확인 ──────────────────────────────────────
    const admin = createSupabaseClient(supabaseUrl, serviceKey);
    const { data: allowed } = await admin
      .from("allowed_users")
      .select("email")
      .eq("email", user.email)
      .single();

    if (!allowed) {
      await supabase.auth.signOut();
      return NextResponse.redirect(`${origin}/login?error=not_allowed`);
    }

    // ── profiles 자동 생성 (Google 로그인 최초 시) ──────────
    const { data: profile } = await admin
      .from("profiles").select("name").eq("id", user.id).maybeSingle();

    if (!profile) {
      await admin.from("profiles").insert({
        id:   user.id,
        name: user.user_metadata?.full_name ?? user.email?.split("@")[0] ?? "사용자",
        role: "user",
      }).catch(() => {});
    }

    const userName = profile?.name ?? user.user_metadata?.full_name ?? null;

    // ── 접속 로그 (중복 방지 + IP 수집) ────────────────────
    try {
      await fetch(`${origin}/api/auth/log`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-forwarded-for": req.headers.get("x-forwarded-for") ?? "" },
        body: JSON.stringify({
          user_id: user.id,
          email:   user.email ?? "",
          name:    userName,
        }),
      });
    } catch { /* 로그 실패가 로그인을 막지 않도록 */ }

    return res;

  } catch (e: any) {
    console.error("[callback] 처리 오류:", e?.message ?? e);
    return NextResponse.redirect(`${origin}/login?error=auth_failed`);
  }
}