"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase, PIPELINE_PHASES } from "@/lib/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";

const STAGE_LABELS = {
  lead: "1. Lead",
  meeting: "2. Meeting",
  requirement: "3. Requirement",
  tor: "4. TOR",
  quote: "5. Quote",
  contract: "6. Contract",
  kickoff: "7. Kickoff",
  dev_design: "8. Dev/Design",
  uat: "9. UAT",
  delivery: "10. Delivery",
  acceptance: "11. Acceptance",
  invoice: "12. Invoice",
  maintenance: "13. Maintenance",
  closed: "14. Closed",
};

const ALL_STAGES = [
  ...PIPELINE_PHASES.pre_sales,
  ...PIPELINE_PHASES.execution,
  ...PIPELINE_PHASES.closing,
];

function phaseOf(status) {
  if (PIPELINE_PHASES.pre_sales.includes(status)) return "pre_sales";
  if (PIPELINE_PHASES.execution.includes(status)) return "execution";
  return "closing";
}

// Smart Visibility — who is *primarily* allowed to drag a card out of a phase.
// RLS on the `projects` table is the real gate; this only drives the UI.
const PHASE_EDITORS = {
  pre_sales: ["business", "super_admin"],
  execution: ["tech_manager", "studio_manager", "developer", "creator", "super_admin"],
  closing: ["business", "super_admin"],
};

export default function KanbanPage() {
  const { profile, hasRole } = useAuth();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState("tech");
  const canCreate = hasRole("business", "super_admin");

  const loadProjects = useCallback(async () => {
    const { data, error } = await supabase
      .from("projects")
      .select("id, name, type, status, project_value, client_name")
      .order("created_at", { ascending: false });
    if (!error) setProjects(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadProjects();

    // Real-time: Module B "Cross-Department Handoff" — everyone's board
    // updates instantly when a card's status changes, no refresh needed.
    const channel = supabase
      .channel("projects-kanban")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "projects" },
        () => loadProjects()
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [loadProjects]);

  const moveCard = async (project, direction) => {
    const idx = ALL_STAGES.indexOf(project.status);
    const nextIdx = idx + direction;
    if (nextIdx < 0 || nextIdx >= ALL_STAGES.length) return;
    const nextStatus = ALL_STAGES[nextIdx];

    const editorsOfCurrentPhase = PHASE_EDITORS[phaseOf(project.status)];
    if (!hasRole(...editorsOfCurrentPhase)) {
      alert("บทบาทของคุณไม่มีสิทธิ์ย้ายการ์ดในขั้นตอนนี้");
      return;
    }

    // Optimistic UI update; RLS on the server will reject unauthorized writes anyway.
    setProjects((prev) =>
      prev.map((p) => (p.id === project.id ? { ...p, status: nextStatus } : p))
    );
    const { error } = await supabase
      .from("projects")
      .update({ status: nextStatus, updated_at: new Date().toISOString() })
      .eq("id", project.id);
    if (error) {
      alert("อัปเดตไม่สำเร็จ: " + error.message);
      loadProjects();
    }
  };

  const createProject = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    const { error } = await supabase.from("projects").insert({
      name: newName.trim(),
      type: newType,
      status: "lead",
      owner_id: profile.id,
    });
    if (error) alert("สร้างโปรเจกต์ไม่สำเร็จ: " + error.message);
    setNewName("");
  };

  const grouped = ALL_STAGES.reduce((acc, stage) => {
    acc[stage] = projects.filter((p) => p.status === stage);
    return acc;
  }, {});

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">📋 Project Pipeline (14 Steps)</h1>
        {canCreate && (
          <form onSubmit={createProject} className="flex gap-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="ชื่อโปรเจกต์ใหม่..."
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
            />
            <select
              value={newType}
              onChange={(e) => setNewType(e.target.value)}
              className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
            >
              <option value="tech">Tech</option>
              <option value="studio">Studio</option>
            </select>
            <button className="bg-brand text-white rounded-lg px-4 py-1.5 text-sm font-medium">
              + เพิ่ม Lead
            </button>
          </form>
        )}
      </div>

      {loading ? (
        <p className="text-slate-400">กำลังโหลด...</p>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-4">
          {ALL_STAGES.map((stage) => (
            <div key={stage} className="min-w-[220px] w-[220px] flex-shrink-0">
              <div
                className={`text-xs font-semibold uppercase tracking-wide px-2 py-1 rounded-t-lg ${
                  phaseOf(stage) === "pre_sales"
                    ? "bg-indigo-100 text-indigo-700"
                    : phaseOf(stage) === "execution"
                    ? "bg-amber-100 text-amber-700"
                    : "bg-emerald-100 text-emerald-700"
                }`}
              >
                {STAGE_LABELS[stage]}
              </div>
              <div className="bg-slate-100 rounded-b-lg p-2 space-y-2 min-h-[120px]">
                {grouped[stage].map((p) => (
                  <div key={p.id} className="bg-white rounded-lg shadow-sm p-3 text-sm">
                    <p className="font-medium">{p.name}</p>
                    <p className="text-xs text-slate-400">
                      {p.type === "tech" ? "🖥️ Tech" : "🎨 Studio"}
                      {p.client_name ? ` · ${p.client_name}` : ""}
                    </p>
                    <div className="flex justify-between mt-2">
                      <button
                        onClick={() => moveCard(p, -1)}
                        className="text-xs text-slate-400 hover:text-brand"
                      >
                        ← ย้อน
                      </button>
                      <button
                        onClick={() => moveCard(p, 1)}
                        className="text-xs text-brand font-medium hover:underline"
                      >
                        ถัดไป →
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
