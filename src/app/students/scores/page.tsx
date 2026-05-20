"use client";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { useEffect } from "react";
import Sidebar from "@/components/dashboard/Sidebar";

export default function ScoresPage() {
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) router.replace("/login");
    };
    checkAuth();
  }, []);

  return (
    <div style={{ display:"flex", height:"100vh", width:"100vw", overflow:"hidden", fontFamily:"'Pretendard','Noto Sans KR',sans-serif" }}>
      <Sidebar />
      <div style={{ flex:1, overflow:"auto", background:"#FAF8F2", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:16 }}>
        <div style={{ fontSize:48 }}>🎯</div>
        <div style={{ fontSize:22, fontWeight:800, color:"#1C1C1C" }}>입결 현황</div>
        <div style={{ fontSize:14, color:"#9ca3af" }}>준비 중입니다.</div>
        <button onClick={() => router.push("/")} style={{
          marginTop:8, padding:"10px 24px", borderRadius:12,
          background:"#1C1C1C", color:"#F5C418",
          border:"none", cursor:"pointer", fontSize:13, fontWeight:700,
        }}>← 대시보드로</button>
      </div>
    </div>
  );
}
