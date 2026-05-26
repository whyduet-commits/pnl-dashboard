// src/app/auth/callback/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=no_code`);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey     = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const admin       = createClient(supabaseUrl, serviceKey);

  // 응답 객체 미리 생성 (쿠키 설정용)
  const res = NextResponse.redirect(`${origin}/`);

  // createServerClient: 요청 쿠키에서 code_verifier 자동으로 읽음
  const supabase = createServerClient(supabaseUrl, anonKey, {
    cookies: {
      getAll() {
        return req.cookies.getAll();
      },
      setAll(list) {
        list.forEach(({ name, value, options }) => {
          req.cookies.set(name, value);
          res.cookies.set(name, value, options);
        });
      },
    },
  });

  try {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error || !data?.user) {
      console.error("[callback] 실패:", error?.message);
      return NextResponse.redirect(`${origin}/login?error=auth_failed`);
    }

    const { user } = data;
    console.log("[callback] 성공:", user.email);

    // ── 승인 계정 확인 ──────────────────────────────────────
    const { data: allowed } = await admin
      .from("allowed_users").select("email")
      .eq("email", user.email).single();

    if (!allowed) {
      await supabase.auth.signOut();
      return NextResponse.redirect(`${origin}/login?error=not_allowed`);
    }

    // ── profiles 자동 생성 ───────────────────────────────────
    const { data: profile } = await admin
      .from("profiles").select("name").eq("id", user.id).maybeSingle();

    if (!profile) {
      try {
        await admin.from("profiles").insert({
          id:   user.id,
          name: user.user_metadata?.full_name ?? user.email?.split("@")[0] ?? "사용자",
          role: "user",
        });
      } catch {}
    }

    // ── 접속 로그 ────────────────────────────────────────────
    try {
      await admin.from("access_logs").insert({
        user_id:    user.id,
        email:      user.email ?? "",
        name:       profile?.name ?? user.user_metadata?.full_name ?? null,
        login_at:   new Date().toISOString(),
        ip_address: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown",
      });
    } catch {}

    return res;

  } catch (e: any) {
    console.error("[callback] 처리 오류:", e?.message ?? e);
    return NextResponse.redirect(`${origin}/login?error=auth_failed`);
  }
}