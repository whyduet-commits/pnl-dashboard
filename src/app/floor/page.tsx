"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import Sidebar from "@/components/dashboard/Sidebar";
import FloorEdit from "@/components/dashboard/FloorEdit";

export default function FloorPage() {
  const router   = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) router.replace("/login");
    };
    check();
  }, []);

  return (
    <div style={{ display:"flex", height:"100vh", width:"100vw", overflow:"hidden" }}>
      <Sidebar />
      <div style={{ flex:1, minHeight:0 }}>
        <FloorEdit key="flooredit-canvas" />
      </div>
    </div>
  );
}