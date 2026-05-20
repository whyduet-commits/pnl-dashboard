// src/lib/supabase.server.ts
// ★ 서버(API route)에서만 import할 것 — 브라우저 번들에 절대 포함 금지
import { createClient } from "@supabase/supabase-js";

export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);