"use client";

import { useAuth } from "@/contexts/AuthContext";

/**
 * Wrap any section of UI that only certain roles should see.
 * This is a UX convenience only — the real enforcement is Supabase RLS
 * (see supabase/schema.sql). Never trust this component alone for security.
 */
export default function RoleGuard({ allow, children, fallback = null }) {
  const { hasRole } = useAuth();
  if (!hasRole(...allow)) return fallback;
  return children;
}
