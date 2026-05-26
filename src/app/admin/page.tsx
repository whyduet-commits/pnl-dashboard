"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/dashboard/Sidebar";

export default function AdminPage() {
  const supabase = createClient();
  const router = useRouter();
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role, name")
        .eq("id", user.id)
        .single();

      if (profile?.role !== "admin") {
        alert("관리자만 접근 가능합니다.");
        router.push("/");
        return;
      }
      setIsAdmin(true);

      const { data: logData } = await supabase
        .from("access_logs")
        .select("*")
        .order("login_at", { ascending: false })
        .limit(200);

      setLogs(logData ?? []);
      setLoading(false);
    };
    init();
  }, []);

  const formatDate = (iso: string | null) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleString("ko-KR", {
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    });
  };

  const formatDuration = (sec: number | null) => {
    if (!sec) return "—";
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (h > 0) return `${h}시간 ${m}분 ${s}초`;
    if (m > 0) return `${m}분 ${s}초`;
    return `${s}초`;
  };

  if (!isAdmin && !loading) return null;

  return (
    <div style={{ display:"flex", height:"100vh", width:"100vw", overflow:"hidden", fontFamily:"'Pretendard','Noto Sans KR',sans-serif" }}>
      <Sidebar />
      <div style={{ flex:1, overflow:"auto", background:"#FAF8F2", padding:"32px" }}>

        {/* 헤더 */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:28 }}>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <div style={{ width:40, height:40, background:"#F5C418", borderRadius:20, display:"flex", alignItems:"center", justifyContent:"center", fontSize:20 }}>🔐</div>
            <div>
              <div style={{ fontSize:18, fontWeight:800, color:"#1C1C1C" }}>접속 로그 관리</div>
              <div style={{ fontSize:12, color:"#9ca3af" }}>계정별 로그인/로그아웃 기록</div>
            </div>
          </div>
        </div>

        {/* 요약 카드 */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4, 1fr)", gap:16, marginBottom:24 }}>
          {[
            { label:"전체 접속 수", value:logs.length, icon:"📋" },
            { label:"오늘 접속 수", value:logs.filter(l => new Date(l.login_at).toDateString() === new Date().toDateString()).length, icon:"📅" },
            { label:"현재 접속 중", value:logs.filter(l => !l.logout_at).length, icon:"🟢" },
            { label:"고유 사용자",  value:new Set(logs.map(l => l.email)).size, icon:"👤" },
          ].map((card) => (
            <div key={card.label} style={{ background:"#fff", borderRadius:16, padding:"20px", boxShadow:"0 2px 12px rgba(0,0,0,0.06)" }}>
              <div style={{ fontSize:24, marginBottom:8 }}>{card.icon}</div>
              <div style={{ fontSize:28, fontWeight:800, color:"#1C1C1C" }}>{card.value}</div>
              <div style={{ fontSize:12, color:"#9ca3af", marginTop:4 }}>{card.label}</div>
            </div>
          ))}
        </div>

        {/* 로그 테이블 */}
        <div style={{ background:"#fff", borderRadius:20, padding:"20px", boxShadow:"0 2px 12px rgba(0,0,0,0.06)" }}>
          <div style={{ fontSize:14, fontWeight:700, marginBottom:16, color:"#1C1C1C" }}>
            접속 이력 ({logs.length}건)
          </div>
          {loading
            ? <div style={{ textAlign:"center", padding:40, color:"#9ca3af" }}>로딩 중...</div>
            : (
            <div style={{ overflowX:"auto" }}>
              <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
                <thead>
                  <tr style={{ borderBottom:"2px solid #EDE8D8", background:"#FDFBF4" }}>
                    {["#","이메일","이름","IP","로그인 시각","로그아웃 시각","체류시간","상태"].map(h => (
                      <th key={h} style={{ padding:"10px 12px", textAlign:"left", color:"#6b7280", fontWeight:600, whiteSpace:"nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log, i) => (
                    <tr key={log.id} style={{
                      borderBottom:"1px solid #f3f4f6",
                      background: !log.logout_at ? "#F0FDF4" : "transparent",
                    }}
                      onMouseEnter={e => { e.currentTarget.style.background = "#FDFBF4"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = !log.logout_at ? "#F0FDF4" : "transparent"; }}
                    >
                      <td style={{ padding:"10px 12px", color:"#9ca3af" }}>{i + 1}</td>
                      <td style={{ padding:"10px 12px", fontWeight:600 }}>{log.email}</td>
                      <td style={{ padding:"10px 12px", color:"#6b7280" }}>{log.name ?? "—"}</td>
                      <td style={{ padding:"10px 12px", color:"#6b7280", fontFamily:"monospace", fontSize:12 }}>{log.ip_address ?? "—"}</td>
                      <td style={{ padding:"10px 12px", whiteSpace:"nowrap" }}>{formatDate(log.login_at)}</td>
                      <td style={{ padding:"10px 12px", whiteSpace:"nowrap", color:"#6b7280" }}>{formatDate(log.logout_at)}</td>
                      <td style={{ padding:"10px 12px", whiteSpace:"nowrap" }}>{formatDuration(log.duration_sec)}</td>
                      <td style={{ padding:"10px 12px" }}>
                        {!log.logout_at
                          ? <span style={{ background:"#dcfce7", color:"#16a34a", padding:"2px 10px", borderRadius:20, fontSize:11, fontWeight:700 }}>접속중</span>
                          : <span style={{ background:"#f3f4f6", color:"#6b7280", padding:"2px 10px", borderRadius:20, fontSize:11 }}>종료</span>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}