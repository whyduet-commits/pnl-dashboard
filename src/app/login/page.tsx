"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

export default function LoginPage() {
  const router   = useRouter();
  const supabase = createClient();
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [loading,  setLoading]  = useState(false);
  const [gLoading, setGLoading] = useState(false);
  const [error,    setError]    = useState("");

  // URL 에러 파라미터 처리 — useEffect로 클라이언트에서만 실행
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlError = params.get("error");
    if (urlError === "not_allowed") {
      setError("승인되지 않은 계정입니다. 관리자에게 문의하세요.");
      supabase.auth.signOut().catch(() => {});
    } else if (urlError === "auth_failed") {
      setError("Google 인증에 실패했습니다.");
    }
  }, []);

  // ── 승인 계정 확인 공통 함수 ─────────────────────────────
  const checkAllowed = async (userId: string, userEmail: string, userName: string | null) => {
    const { data: allowed } = await supabase
      .from("allowed_users")
      .select("email")
      .eq("email", userEmail)
      .single();

    if (!allowed) {
      await supabase.auth.signOut();
      setError("승인되지 않은 계정입니다. 관리자에게 문의하세요.");
      return false;
    }

    // 접속 로그 (중복 방지 + IP 수집)
    try {
      // profiles 조회 실패해도 로그는 기록
      const { data: profile } = await supabase
        .from("profiles").select("name").eq("id", userId).maybeSingle();
      await fetch("/api/auth/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          email:   userEmail,
          name:    profile?.name ?? userName ?? userEmail.split("@")[0],
        }),
      });
    } catch { console.warn("access_logs 실패"); }
    return true;
  };

  // ── 이메일/비밀번호 로그인 ───────────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { data: authData, error: authError } =
      await supabase.auth.signInWithPassword({ email, password });

    if (authError || !authData.user) {
      setError("이메일 또는 비밀번호가 올바르지 않습니다.");
      setLoading(false);
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("name")
      .eq("id", authData.user.id)
      .single();

    const ok = await checkAllowed(
      authData.user.id,
      authData.user.email ?? email,
      profile?.name ?? null
    );

    setLoading(false);
    if (ok) router.replace("/");
  };

  // ── Google 로그인 ────────────────────────────────────────
  const handleGoogle = async () => {
    setGLoading(true);
    setError("");

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${siteUrl}/auth/callback`,
      },
    });

    if (error) {
      setError("Google 로그인 중 오류가 발생했습니다.");
      setGLoading(false);
    }
    // 리디렉션되므로 setGLoading(false) 불필요
  };

  return (
    <div style={{
      display: "flex", alignItems: "center",
      height: "100vh", width: "100vw", overflow: "hidden",
      fontFamily: "'Pretendard','Noto Sans KR',sans-serif",
      background: "#020e1f", position: "relative",
    }}>
      {/* 배경 */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        backgroundImage: `url("/images/login_bg.png")`,
        backgroundSize: "cover", backgroundPosition: "center",
      }} />

      {/* 로그인 폼 */}
      <div style={{
        position: "relative", zIndex: 10, width: 300, marginLeft: 80,
        background: "rgba(255,255,255,0.07)",
        border: "1px solid rgba(255,255,255,0.14)",
        borderRadius: 20, padding: "36px 30px",
        display: "flex", flexDirection: "column",
      }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: "#fff",
          letterSpacing: "-0.03em", marginBottom: 4 }}>로그인</h2>
        <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginBottom: 24 }}>
          계정 정보를 입력해 주세요.
        </p>

        <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* 이메일 */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 600,
              color: "rgba(255,255,255,0.55)", display: "block", marginBottom: 5 }}>
              이메일
            </label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="example@megastudy.net" required
              style={{ width: "100%", padding: "10px 13px",
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.16)",
                borderRadius: 9, fontSize: 12, color: "#fff", outline: "none" }}
              onFocus={e => { e.target.style.borderColor="rgba(0,180,255,0.7)"; e.target.style.background="rgba(0,130,255,0.1)"; }}
              onBlur={e  => { e.target.style.borderColor="rgba(255,255,255,0.16)"; e.target.style.background="rgba(255,255,255,0.08)"; }}
            />
          </div>

          {/* 비밀번호 */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 600,
              color: "rgba(255,255,255,0.55)", display: "block", marginBottom: 5 }}>
              비밀번호
            </label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="비밀번호를 입력해 주세요" required
              style={{ width: "100%", padding: "10px 13px",
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.16)",
                borderRadius: 9, fontSize: 12, color: "#fff", outline: "none" }}
              onFocus={e => { e.target.style.borderColor="rgba(0,180,255,0.7)"; e.target.style.background="rgba(0,130,255,0.1)"; }}
              onBlur={e  => { e.target.style.borderColor="rgba(255,255,255,0.16)"; e.target.style.background="rgba(255,255,255,0.08)"; }}
            />
          </div>

          {/* 에러 */}
          {error && (
            <div style={{ background: "rgba(239,68,68,0.18)",
              border: "1px solid rgba(239,68,68,0.4)",
              borderRadius: 8, padding: "9px 12px",
              fontSize: 11, color: "#FCA5A5", fontWeight: 500 }}>
              ⚠️ {error}
            </div>
          )}

          {/* 로그인 버튼 */}
          <button type="submit" disabled={loading}
            style={{ width: "100%", padding: "11px",
              background: loading ? "rgba(0,130,255,0.4)" : "#0082FF",
              border: "none", borderRadius: 9,
              fontSize: 13, fontWeight: 800, color: "#fff",
              cursor: loading ? "not-allowed" : "pointer", marginTop: 4,
              boxShadow: loading ? "none" : "0 4px 20px rgba(0,130,255,0.4)" }}>
            {loading ? "로그인 중..." : "로그인"}
          </button>
        </form>

        {/* 구분선 */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "16px 0" }}>
          <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.12)" }} />
          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>또는</span>
          <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.12)" }} />
        </div>

        {/* Google 로그인 버튼 */}
        <button onClick={handleGoogle} disabled={gLoading}
          style={{ width: "100%", padding: "11px",
            background: gLoading ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.09)",
            border: "1px solid rgba(255,255,255,0.18)",
            borderRadius: 9, fontSize: 13, fontWeight: 700,
            color: "#fff", cursor: gLoading ? "not-allowed" : "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
            transition: "all 0.15s" }}
          onMouseEnter={e => { if (!gLoading) e.currentTarget.style.background="rgba(255,255,255,0.14)"; }}
          onMouseLeave={e => { if (!gLoading) e.currentTarget.style.background="rgba(255,255,255,0.09)"; }}
        >
          {/* Google SVG 아이콘 */}
          {!gLoading && (
            <svg width="18" height="18" viewBox="0 0 48 48">
              <path fill="#FFC107" d="M43.6 20H24v8h11.3C33.6 33.1 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.5 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20c11 0 20-9 20-20 0-1.3-.1-2.7-.4-4z"/>
              <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 16 19 13 24 13c3 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.5 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
              <path fill="#4CAF50" d="M24 44c5.2 0 9.9-1.9 13.5-5l-6.2-5.2C29.4 35.6 26.8 36 24 36c-5.2 0-9.6-2.9-11.3-7.1l-6.5 5C9.6 39.6 16.3 44 24 44z"/>
              <path fill="#1976D2" d="M43.6 20H24v8h11.3c-.9 2.4-2.5 4.4-4.6 5.8l6.2 5.2C40.6 35.7 44 30.3 44 24c0-1.3-.1-2.7-.4-4z"/>
            </svg>
          )}
          {gLoading ? "Google 연결 중..." : "Google 계정으로 로그인"}
        </button>

      </div>
    </div>
  );
}