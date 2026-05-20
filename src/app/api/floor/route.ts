// src/app/api/floor/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

const supabaseAdmin = createSupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BUCKET = "floor-plans";

const ORG_FILES: Record<number, string> = {
  2:  "gangnам.pdf",
  3:  "mokdong.pdf",
  4:  "bundang.pdf",
  5:  "daegu.pdf",
  6:  "daejeon.pdf",
  7:  "top.pdf",
  8:  "male.pdf",
  9:  "female.pdf",
  10: "general.pdf",
  11: "daechi.pdf",
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const orgId  = Number(searchParams.get("org_id") ?? 0);
  const action = searchParams.get("action") ?? "pdf";

  if (!orgId) return NextResponse.json({ error: "org_id required" }, { status: 400 });

  // ── PDF 바이너리를 서버에서 직접 프록시 ──────────────────────
  if (action === "pdf") {
    const fileName = ORG_FILES[orgId];
    if (!fileName) return NextResponse.json({ error: "no file mapped" }, { status: 404 });

    const { data, error } = await supabaseAdmin.storage
      .from(BUCKET)
      .download(fileName);

    if (error || !data) {
      return NextResponse.json({ error: "file not found" }, { status: 404 });
    }

    const buf = await data.arrayBuffer();
    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${fileName}"`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  }

  // ── 저장된 배치 데이터 반환 ───────────────────────────────────
  if (action === "layout") {
    const { data, error } = await supabaseAdmin
      .from("floor_layouts")
      .select("layout_json, updated_at")
      .eq("org_id", orgId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) return NextResponse.json({ error }, { status: 500 });
    return NextResponse.json({
      layout: data?.layout_json ?? null,
      updated_at: data?.updated_at ?? null,
    });
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}

// ── 배치 데이터 저장 ──────────────────────────────────────────
export async function POST(req: NextRequest) {
  const { org_id, layout_json } = await req.json();
  if (!org_id || !layout_json) {
    return NextResponse.json({ error: "org_id and layout_json required" }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("floor_layouts")
    .upsert(
      { org_id, layout_json, updated_at: new Date().toISOString() },
      { onConflict: "org_id" }
    );

  if (error) return NextResponse.json({ error }, { status: 500 });
  return NextResponse.json({ ok: true });
}