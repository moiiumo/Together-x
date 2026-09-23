"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";

export default function AdminPage() {
  const { profile, hasRole } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [profitRows, setProfitRows] = useState([]);

  useEffect(() => {
    if (profile && !hasRole("super_admin")) router.replace("/dashboard");
  }, [profile, hasRole, router]);

  const loadAll = useCallback(async () => {
    const [{ data: u }, { data: p }, { data: pf }] = await Promise.all([
      supabase.from("users").select("*").order("username"),
      supabase.from("projects").select("id, name, status, project_value, type"),
      supabase
        .from("profit_pool")
        .select("id, project_id, revenue, cost, profit, visible_to_staff, projects(name)"),
    ]);
    setUsers(u || []);
    setProjects(p || []);
    setProfitRows(pf || []);
  }, []);

  useEffect(() => {
    if (hasRole("super_admin")) loadAll();
  }, [hasRole, loadAll]);

  const changeRole = async (userId, role) => {
    const { error } = await supabase.from("users").update({ role }).eq("id", userId);
    if (error) alert(error.message);
    else loadAll();
  };

  const toggleProfitVisibility = async (row) => {
    await supabase
      .from("profit_pool")
      .update({ visible_to_staff: !row.visible_to_staff })
      .eq("id", row.id);
    loadAll();
  };

  const overrideProjectStatus = async (projectId, status) => {
    await supabase.from("projects").update({ status }).eq("id", projectId);
    loadAll();
  };

  if (!hasRole("super_admin")) return null;

  const totalRevenue = profitRows.reduce((s, r) => s + Number(r.revenue), 0);
  const totalProfit = profitRows.reduce((s, r) => s + Number(r.profit), 0);

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">
      <h1 className="text-xl font-bold">🛡️ Super Admin — Global Override</h1>

      <section className="grid grid-cols-2 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs text-slate-400 uppercase">รายได้รวม</p>
          <p className="text-2xl font-bold">฿{totalRevenue.toLocaleString()}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs text-slate-400 uppercase">กำไรรวม</p>
          <p className="text-2xl font-bold text-emerald-600">฿{totalProfit.toLocaleString()}</p>
        </div>
      </section>

      <section className="bg-white border border-slate-200 rounded-xl p-5">
        <h2 className="font-semibold mb-3">💰 Profit Pool per Project</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-400 text-xs uppercase">
              <th className="pb-2">โปรเจกต์</th>
              <th className="pb-2">รายได้</th>
              <th className="pb-2">ต้นทุน</th>
              <th className="pb-2">กำไร</th>
              <th className="pb-2">แสดงให้ทีมเห็น</th>
            </tr>
          </thead>
          <tbody>
            {profitRows.map((r) => (
              <tr key={r.id} className="border-t border-slate-100">
                <td className="py-2">{r.projects?.name}</td>
                <td>฿{Number(r.revenue).toLocaleString()}</td>
                <td>฿{Number(r.cost).toLocaleString()}</td>
                <td className="text-emerald-600">฿{Number(r.profit).toLocaleString()}</td>
                <td>
                  <button
                    onClick={() => toggleProfitVisibility(r)}
                    className={`text-xs px-2 py-1 rounded-full ${
                      r.visible_to_staff ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {r.visible_to_staff ? "เปิดอยู่" : "ปิดอยู่"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="bg-white border border-slate-200 rounded-xl p-5">
        <h2 className="font-semibold mb-3">🧩 Global Override — สถานะโปรเจกต์</h2>
        <div className="space-y-2">
          {projects.map((p) => (
            <div key={p.id} className="flex items-center justify-between text-sm">
              <span>{p.name}</span>
              <select
                value={p.status}
                onChange={(e) => overrideProjectStatus(p.id, e.target.value)}
                className="rounded-lg border border-slate-300 px-2 py-1"
              >
                {[
                  "lead","meeting","requirement","tor","quote","contract",
                  "kickoff","dev_design","uat",
                  "delivery","acceptance","invoice","maintenance","closed",
                ].map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-white border border-slate-200 rounded-xl p-5">
        <h2 className="font-semibold mb-3">👥 จัดการผู้ใช้งาน & Roles</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-400 text-xs uppercase">
              <th className="pb-2">ชื่อ</th>
              <th className="pb-2">Skills</th>
              <th className="pb-2">Role</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-slate-100">
                <td className="py-2">{u.full_name || u.username}</td>
                <td className="text-xs text-slate-400">{(u.skills || []).join(", ")}</td>
                <td>
                  <select
                    value={u.role}
                    onChange={(e) => changeRole(u.id, e.target.value)}
                    className="rounded-lg border border-slate-300 px-2 py-1"
                  >
                    {[
                      "super_admin","business","tech_manager",
                      "developer","studio_manager","creator",
                    ].map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
