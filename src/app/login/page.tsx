"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password });

    if (authError || !authData.user) {
      setError("이메일 또는 비밀번호가 올바르지 않습니다.");
      setLoading(false);
      return;
    }

    // ── 접속 로그 insert ──────────────────────────────────
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("name")
        .eq("id", authData.user.id)
        .single();

      await supabase.from("access_logs").insert({
        user_id:  authData.user.id,
        email:    authData.user.email ?? email,
        name:     profile?.name ?? null,
        login_at: new Date().toISOString(),
      });
    } catch {
      // 로그 실패가 로그인을 막지 않도록 에러는 무시
      console.warn("access_logs insert 실패");
    }
    // ─────────────────────────────────────────────────────

    router.replace("/");
  };

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      height: "100vh",
      width: "100vw",
      overflow: "hidden",
      fontFamily: "'Pretendard','Noto Sans KR',sans-serif",
      background: "#020e1f",
      position: "relative",
    }}>

      {/* 배경 이미지 */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        backgroundImage: `url("/images/login_bg.png")`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }} />

      {/* ── 로그인 폼 (좌측) ── */}
      <div style={{
        position: "relative", zIndex: 10,
        width: 300,
        marginLeft: 80,
        background: "rgba(255,255,255,0.07)",
        border: "1px solid rgba(255,255,255,0.14)",
        borderRadius: 20,
        padding: "36px 30px",
        display: "flex",
        flexDirection: "column",
      }}>
        <h2 style={{
          fontSize: 22, fontWeight: 800, color: "#fff",
          letterSpacing: "-0.03em", marginBottom: 4,
        }}>
          로그인
        </h2>
        <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginBottom: 24 }}>
          계정 정보를 입력해 주세요.
        </p>

        <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label style={{
              fontSize: 11, fontWeight: 600,
              color: "rgba(255,255,255,0.55)",
              display: "block", marginBottom: 5,
            }}>
              이메일
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="example@megastudy.net"
              required
              style={{
                width: "100%", padding: "10px 13px",
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.16)",
                borderRadius: 9, fontSize: 12,
                color: "#fff", outline: "none",
                transition: "border-color 0.15s, background 0.15s",
              }}
              onFocus={e => {
                e.target.style.borderColor = "rgba(0,180,255,0.7)";
                e.target.style.background = "rgba(0,130,255,0.1)";
              }}
              onBlur={e => {
                e.target.style.borderColor = "rgba(255,255,255,0.16)";
                e.target.style.background = "rgba(255,255,255,0.08)";
              }}
            />
          </div>

          <div>
            <label style={{
              fontSize: 11, fontWeight: 600,
              color: "rgba(255,255,255,0.55)",
              display: "block", marginBottom: 5,
            }}>
              비밀번호
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="비밀번호를 입력해 주세요"
              required
              style={{
                width: "100%", padding: "10px 13px",
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.16)",
                borderRadius: 9, fontSize: 12,
                color: "#fff", outline: "none",
                transition: "border-color 0.15s, background 0.15s",
              }}
              onFocus={e => {
                e.target.style.borderColor = "rgba(0,180,255,0.7)";
                e.target.style.background = "rgba(0,130,255,0.1)";
              }}
              onBlur={e => {
                e.target.style.borderColor = "rgba(255,255,255,0.16)";
                e.target.style.background = "rgba(255,255,255,0.08)";
              }}
            />
          </div>

          {error && (
            <div style={{
              background: "rgba(239,68,68,0.18)",
              border: "1px solid rgba(239,68,68,0.4)",
              borderRadius: 8, padding: "9px 12px",
              fontSize: 11, color: "#FCA5A5", fontWeight: 500,
            }}>
              ⚠️ {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%", padding: "11px",
              background: loading ? "rgba(0,130,255,0.4)" : "#0082FF",
              border: "none", borderRadius: 9,
              fontSize: 13, fontWeight: 800, color: "#fff",
              cursor: loading ? "not-allowed" : "pointer",
              marginTop: 4,
              boxShadow: loading ? "none" : "0 4px 20px rgba(0,130,255,0.4)",
              transition: "all 0.15s",
            }}
          >
            {loading ? "로그인 중..." : "로그인"}
          </button>
        </form>
      </div>

    </div>
  );
}