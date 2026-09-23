"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { ROLES } from "@/lib/supabaseClient";

const NAV = [
  { href: "/dashboard", label: "หน้าหลัก", icon: "🏠", roles: null },
  { href: "/kanban", label: "Pipeline (Kanban)", icon: "📋", roles: null },
  { href: "/quests", label: "Quest ของฉัน", icon: "🎯", roles: null },
  { href: "/culture", label: "Together Board & Kudos", icon: "🎉", roles: null },
  {
    href: "/admin",
    label: "Super Admin",
    icon: "🛡️",
    roles: ["super_admin"],
  },
];

export default function DashboardLayout({ children }) {
  const { session, profile, loading, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !session) router.replace("/login");
  }, [loading, session, router]);

  if (loading || !session || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-400">
        กำลังโหลด...
      </div>
    );
  }

  const visibleNav = NAV.filter((item) => !item.roles || item.roles.includes(profile.role));

  return (
    <div className="min-h-screen flex">
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col">
        <div className="p-5 border-b border-slate-100">
          <p className="font-bold text-brand text-lg">Together x</p>
          <p className="text-xs text-slate-500 mt-1">
            {profile.full_name || profile.username} · {ROLES[profile.role]?.labelTh}
          </p>
          <p className="text-xs text-amber-600 mt-1">⭐ {profile.kudos_points} kudos</p>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {visibleNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition ${
                pathname === item.href
                  ? "bg-brand text-white"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="p-3 border-t border-slate-100">
          <button
            onClick={signOut}
            className="w-full text-left px-3 py-2 rounded-lg text-sm text-red-600 hover:bg-red-50"
          >
            ออกจากระบบ
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
