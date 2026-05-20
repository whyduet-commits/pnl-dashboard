"use client";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { useTheme } from "@/lib/theme";

const MENU = [
  { icon: "⊞",  label: "대시보드",      path: "/" },
  { icon: "🏫", label: "학원 상세 분석", path: null, sub: [
    { icon: "📋", label: "월간 보고서", path: "/report" },
  ]},
  { icon: "👥", label: "재원생 분석", path: null, sub: [
    { icon: "📊", label: "등록 추이(전체)",   path: "/students/enrollment/all" },
    { icon: "📈", label: "등록 추이(학원별)", path: "/students/enrollment" },
    { icon: "🎯", label: "입결 현황",         path: "/students/scores" },
  ]},
  { icon: "🗺",   label: "FloorEdit",       path: "/floor"      },
  { icon: "📊",   label: "단과 판매 분석", path: "/sales"      },
  { icon: "👨‍🏫", label: "개별 강사 현황", path: "/instructor" },
];

function NavBtn({ icon, label, active, onClick, sub = false, T }: {
  icon: string; label: string; active: boolean;
  onClick: () => void; sub?: boolean; T: any;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%", display: "flex", alignItems: "center",
        gap: sub ? 6 : 9,
        padding: sub ? "6px 10px" : "8px 10px",
        borderRadius: 10, marginBottom: 1,
        background: active ? `rgba(245,196,24,0.12)` : "transparent",
        color: active ? "#F5C418" : T.textMuted,
        border: active ? "1px solid rgba(245,196,24,0.2)" : "1px solid transparent",
        cursor: "pointer",
        fontSize: sub ? 11 : 12,
        fontWeight: active ? 700 : 400,
        textAlign: "left" as const,
        transition: "all 0.12s",
        borderLeft: active ? "2px solid #F5C418" : "2px solid transparent",
      }}
    >
      {sub && (
        <span style={{ fontSize: 9, color: active ? "#F5C418" : T.textHint }}>└</span>
      )}
      <span style={{ fontSize: sub ? 11 : 13 }}>{icon}</span>
      <span>{label}</span>
    </button>
  );
}

export default function Sidebar() {
  const router   = useRouter();
  const pathname = usePathname();
  const supabase = createClient();
  const { T }    = useTheme();

  const handleLogout = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: lastLog } = await supabase
        .from("access_logs").select("id, login_at")
        .eq("user_id", user.id).is("logout_at", null)
        .order("login_at", { ascending: false }).limit(1).single();
      if (lastLog) {
        const duration = Math.floor(
          (Date.now() - new Date(lastLog.login_at).getTime()) / 1000
        );
        await supabase.from("access_logs").update({
          logout_at: new Date().toISOString(), duration_sec: duration,
        }).eq("id", lastLog.id);
      }
    }
    await supabase.auth.signOut();
    router.push("/login");
  };

  // 정확한 경로 매칭:
  // "/" 는 완전 일치, 나머지는 startsWith — 단, 더 긴 경로가 먼저 매칭되도록
  // "/students/enrollment/all" vs "/students/enrollment" 충돌 방지
  const isActive = (path: string | null): boolean => {
    if (!path) return false;
    if (path === "/") return pathname === "/";
    // 정확히 일치하거나, path + "/" 로 시작하는 경우만 active
    return pathname === path || pathname.startsWith(path + "/");
  };

  return (
    <aside style={{
      width: 200, flexShrink: 0,
      background: T.bgSurface,
      display: "flex", flexDirection: "column",
      padding: "0 0 24px",
      height: "100vh", position: "sticky", top: 0,
      borderRight: `1px solid ${T.border}`,
    }}>
      {/* 로고 */}
      <div
        style={{
          padding: "18px 18px 16px",
          borderBottom: `1px solid ${T.border}`,
          display: "flex", alignItems: "center", gap: 8, cursor: "pointer",
        }}
        onClick={() => router.push("/")}
      >
        <div style={{
          width: 26, height: 26, background: "#F5C418",
          borderRadius: 6, flexShrink: 0,
        }} />
        <div style={{ fontSize: 12, fontWeight: 700, color: T.textPri }}>
          손익 Dashboard
        </div>
      </div>

      {/* 메뉴 */}
      <nav style={{ flex: 1, padding: "12px 10px", overflowY: "auto" }}>
        <div style={{
          fontSize: 8, color: T.textHint,
          padding: "10px 10px 3px", letterSpacing: "0.1em", textTransform: "uppercase",
        }}>
          메인
        </div>

        {MENU.slice(0, 1).map(m => (
          <NavBtn key={m.label} icon={m.icon} label={m.label} T={T}
            active={isActive(m.path)}
            onClick={() => m.path && router.push(m.path)} />
        ))}

        <div style={{
          fontSize: 8, color: T.textHint,
          padding: "10px 10px 3px", letterSpacing: "0.1em", textTransform: "uppercase",
        }}>
          분석
        </div>

        {MENU.slice(1).map(m => (
          <div key={m.label}>
            <NavBtn icon={m.icon} label={m.label} T={T}
              active={isActive(m.path)}
              onClick={() => m.path && router.push(m.path)} />
            {m.sub && (
              <div style={{ paddingLeft: 10, marginBottom: 2 }}>
                {m.sub.map(s => (
                  <NavBtn key={s.label} icon={s.icon} label={s.label} T={T}
                    active={isActive(s.path)}
                    onClick={() => router.push(s.path)}
                    sub />
                ))}
              </div>
            )}
          </div>
        ))}

        <div style={{ borderTop: `1px solid ${T.border}`, marginTop: 8, paddingTop: 8 }}>
          <NavBtn icon="🔐" label="접속 로그" T={T}
            active={isActive("/admin")} onClick={() => router.push("/admin")} />
          <NavBtn icon="🚪" label="로그아웃" T={T}
            active={false} onClick={handleLogout} />
        </div>
      </nav>

      {/* 유저 정보 */}
      <div style={{ padding: "12px 14px", borderTop: `1px solid ${T.border}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            width: 30, height: 30,
            background: T.bgCard,
            border: `1px solid ${T.border}`,
            borderRadius: "50%",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13,
          }}>
            👤
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: T.textPri }}>
              홍길동 관리자
            </div>
            <div style={{ fontSize: 9, color: T.textMuted }}>중점본부</div>
          </div>
        </div>
      </div>
    </aside>
  );
}