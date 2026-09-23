"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";

const STATUSES = ["todo", "in_progress", "review", "done"];
const STATUS_LABEL = { todo: "To Do", in_progress: "กำลังทำ", review: "รอตรวจ", done: "เสร็จแล้ว" };

export default function QuestsPage() {
  const { profile, hasRole } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterMine, setFilterMine] = useState(true);
  const canAssign = hasRole("tech_manager", "studio_manager", "super_admin");

  const load = useCallback(async () => {
    let query = supabase
      .from("tasks")
      .select("id, title, status, kpi_points, github_url, due_date, assignee_id, project_id, users(username, full_name), projects(name)")
      .order("created_at", { ascending: false });
    if (filterMine) query = query.eq("assignee_id", profile.id);
    const { data } = await query;
    setTasks(data || []);

    const { data: projs } = await supabase.from("projects").select("id, name");
    setProjects(projs || []);
    setLoading(false);
  }, [filterMine, profile]);

  useEffect(() => {
    if (profile) load();
    const channel = supabase
      .channel("tasks-quests")
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, () => load())
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [profile, load]);

  const updateStatus = async (task, status) => {
    const { error } = await supabase.from("tasks").update({ status }).eq("id", task.id);
    if (error) alert("อัปเดตไม่สำเร็จ: " + error.message);
  };

  const updateGithub = async (task, github_url) => {
    await supabase.from("tasks").update({ github_url }).eq("id", task.id);
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">🎯 Quest Board</h1>
        <label className="text-sm flex items-center gap-2">
          <input
            type="checkbox"
            checked={filterMine}
            onChange={(e) => setFilterMine(e.target.checked)}
          />
          แสดงเฉพาะของฉัน
        </label>
      </div>

      {loading ? (
        <p className="text-slate-400">กำลังโหลด...</p>
      ) : tasks.length === 0 ? (
        <p className="text-slate-400">ไม่มี Quest</p>
      ) : (
        <div className="space-y-3">
          {tasks.map((t) => (
            <div key={t.id} className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold">{t.title}</p>
                  <p className="text-xs text-slate-400">
                    {t.projects?.name} · {t.users?.full_name || t.users?.username || "ยังไม่มอบหมาย"}
                  </p>
                </div>
                <span className="text-amber-600 text-sm font-medium">+{t.kpi_points} KPI</span>
              </div>

              <div className="flex items-center gap-2 mt-3">
                <select
                  value={t.status}
                  onChange={(e) => updateStatus(t, e.target.value)}
                  disabled={t.assignee_id !== profile.id && !canAssign}
                  className="text-sm rounded-lg border border-slate-300 px-2 py-1"
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABEL[s]}
                    </option>
                  ))}
                </select>

                <input
                  defaultValue={t.github_url || ""}
                  onBlur={(e) => updateGithub(t, e.target.value)}
                  placeholder="ลิงก์ GitHub/GitLab..."
                  className="flex-1 text-sm rounded-lg border border-slate-300 px-2 py-1"
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {canAssign && <CreateQuestForm projects={projects} onCreated={load} />}
    </div>
  );
}

function CreateQuestForm({ projects, onCreated }) {
  const [title, setTitle] = useState("");
  const [projectId, setProjectId] = useState("");
  const [kpi, setKpi] = useState(5);

  const submit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !projectId) return;
    const { error } = await supabase.from("tasks").insert({
      title: title.trim(),
      project_id: projectId,
      kpi_points: Number(kpi),
      status: "todo",
    });
    if (error) alert("สร้าง Quest ไม่สำเร็จ: " + error.message);
    setTitle("");
    onCreated();
  };

  return (
    <form onSubmit={submit} className="mt-8 bg-white border border-slate-200 rounded-xl p-4 space-y-3">
      <h2 className="font-semibold text-sm">+ สร้าง Quest ใหม่ (จ่ายงาน)</h2>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="ชื่องาน..."
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
      />
      <div className="flex gap-2">
        <select
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          className="flex-1 rounded-lg border border-slate-300 px-2 py-2 text-sm"
        >
          <option value="">เลือกโปรเจกต์...</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <input
          type="number"
          value={kpi}
          onChange={(e) => setKpi(e.target.value)}
          className="w-24 rounded-lg border border-slate-300 px-2 py-2 text-sm"
        />
        <button className="bg-brand text-white rounded-lg px-4 py-2 text-sm font-medium">
          สร้าง
        </button>
      </div>
    </form>
  );
}
