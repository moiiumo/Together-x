"use client";

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // Fails loudly in dev if env vars are missing — much easier to debug
  // than a silent 401 from Supabase later.
  console.warn(
    "[together-x] Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY. " +
      "Copy .env.example to .env.local and fill them in."
  );
}

export const supabase = createClient(url, anonKey, {
  auth: {
    // Remembers the *session* (so RBAC/queries keep working), but per spec
    // we still force a password re-entry on every fresh login screen visit —
    // see app/login/page.jsx, which does NOT autofill password, only username.
    persistSession: true,
    autoRefreshToken: true,
  },
});

// Role metadata used across the UI
export const ROLES = {
  super_admin: { label: "Super Admin", labelTh: "ผู้ดูแลระบบสูงสุด" },
  business: { label: "Business", labelTh: "ฝ่ายธุรกิจ" },
  tech_manager: { label: "Tech Manager", labelTh: "หัวหน้าสายเทค" },
  developer: { label: "Developer", labelTh: "นักพัฒนา" },
  studio_manager: { label: "Studio Manager", labelTh: "หัวหน้าสตูดิโอ" },
  creator: { label: "Creator / Designer", labelTh: "ครีเอทีฟ/ดีไซเนอร์" },
};

export const PIPELINE_PHASES = {
  pre_sales: ["lead", "meeting", "requirement", "tor", "quote", "contract"],
  execution: ["kickoff", "dev_design", "uat"],
  closing: ["delivery", "acceptance", "invoice", "maintenance", "closed"],
};
