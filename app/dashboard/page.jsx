"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";

export default function DashboardPage() {
  const { profile } = useAuth();
  const [myTasks, setMyTasks] = useState([]);
  const [profitRows, setProfitRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    (async () => {
      const { data: tasks } = await supabase
        .from("tasks")
        .select("id, title, status, kpi_points, due_date, project_id, projects(name)")
        .eq("assignee_id", profile.id)
        .neq("status", "done")
        .order("due_date", { ascending: true });
      setMyTasks(tasks || []);

      // Row-level security decides what actually comes back here —
      // staff only see profit rows the admin has flagged visible_to_staff = true.
      const { data: profit } = await supabase
        .from("profit_pool")
        .select("id, project_id, revenue, cost, profit, projects(name)")
        .order("recorded_at", { ascending: false })
        .limit(5);
      setProfitRows(profit || []);

      setLoading(false);
    })();
  }, [profile]);

  const statusLabel = { todo: "To Do", in_progress: "กำลังทำ", review: "รอตรวจ", done: "เสร็จแล้ว" };

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold">สวัสดี, {profile?.full_name || profile?.username} 👋</h1>
        <p className="text-slate-500">นี่คือสรุปงานของคุณในสัปดาห์นี้ (แทนการตอกบัตร)</p>
      </div>

      <section className="bg-white rounded-2xl border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-lg">🎯 Quest ของฉัน</h2>
          <Link href="/quests" className="text-sm text-brand hover:underline">
            ดูทั้งหมด →
          </Link>
        </div>

        {loading ? (
          <p className="text-slate-400 text-sm">กำลังโหลด...</p>
        ) : myTasks.length === 0 ? (
          <p className="text-slate-400 text-sm">ไม่มี Quest ค้างอยู่ ทำได้ดีมาก!</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {myTasks.slice(0, 5).map((t) => (
              <li key={t.id} className="py-3 flex items-center justify-between">
                <div>
                  <p className="font-medium">{t.title}</p>
                  <p className="text-xs text-slate-400">{t.projects?.name}</p>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-amber-600">+{t.kpi_points} KPI</span>
                  <span className="px-2 py-1 rounded-full bg-slate-100 text-xs">
                    {statusLabel[t.status]}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {profitRows.length > 0 && (
        <section className="bg-white rounded-2xl border border-slate-200 p-6">
          <h2 className="font-semibold text-lg mb-4">💰 Transparent Profit Pool</h2>
          <ul className="space-y-2">
            {profitRows.map((p) => (
              <li key={p.id} className="flex items-center justify-between text-sm">
                <span>{p.projects?.name || "โปรเจกต์"}</span>
                <span className="font-medium text-emerald-600">
                  กำไร ฿{Number(p.profit).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-slate-400 mt-3">
            * แสดงเฉพาะโปรเจกต์ที่แอดมินเปิดให้ทีมเห็นตัวเลข
          </p>
        </section>
      )}
    </div>
  );
}
