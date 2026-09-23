"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";

export default function CulturePage() {
  const { profile } = useAuth();
  const [posts, setPosts] = useState([]);
  const [users, setUsers] = useState([]);
  const [newPostTitle, setNewPostTitle] = useState("");
  const [newPostBody, setNewPostBody] = useState("");
  const [kudosTo, setKudosTo] = useState("");
  const [kudosMsg, setKudosMsg] = useState("");

  const loadPosts = useCallback(async () => {
    const { data } = await supabase
      .from("board_posts")
      .select("id, title, body, created_at, users(username, full_name)")
      .order("created_at", { ascending: false })
      .limit(20);
    setPosts(data || []);
  }, []);

  useEffect(() => {
    loadPosts();
    supabase.from("users").select("id, username, full_name").then(({ data }) => setUsers(data || []));

    const channel = supabase
      .channel("culture-board")
      .on("postgres_changes", { event: "*", schema: "public", table: "board_posts" }, loadPosts)
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [loadPosts]);

  const submitPost = async (e) => {
    e.preventDefault();
    if (!newPostTitle.trim()) return;
    await supabase.from("board_posts").insert({
      title: newPostTitle.trim(),
      body: newPostBody.trim(),
      author_id: profile.id,
    });
    setNewPostTitle("");
    setNewPostBody("");
  };

  const sendKudos = async (e) => {
    e.preventDefault();
    if (!kudosTo) return;
    const { error } = await supabase.from("kudos").insert({
      from_user_id: profile.id,
      to_user_id: kudosTo,
      message: kudosMsg.trim(),
      points: 1,
    });
    if (!error) {
      // Bump the receiving user's kudos_points counter. NOTE: this
      // read-then-write is fine for a first pass but has a race condition
      // under concurrent kudos — swap for a `supabase.rpc('increment_kudos', ...)`
      // Postgres function once this needs to be exact.
      const target = users.find((u) => u.id === kudosTo);
      await supabase
        .from("users")
        .update({ kudos_points: (target?.kudos_points || 0) + 1 })
        .eq("id", kudosTo);
      setKudosMsg("");
      setKudosTo("");
    }
  };

  return (
    <div className="p-8 max-w-3xl mx-auto space-y-8">
      <h1 className="text-xl font-bold">🎉 Together Board & Kudos</h1>

      <section className="bg-white border border-slate-200 rounded-xl p-4">
        <h2 className="font-semibold text-sm mb-3">✨ ส่งคำชม (Kudos)</h2>
        <form onSubmit={sendKudos} className="flex gap-2">
          <select
            value={kudosTo}
            onChange={(e) => setKudosTo(e.target.value)}
            className="rounded-lg border border-slate-300 px-2 py-2 text-sm"
          >
            <option value="">เลือกเพื่อนร่วมงาน...</option>
            {users
              .filter((u) => u.id !== profile.id)
              .map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name || u.username}
                </option>
              ))}
          </select>
          <input
            value={kudosMsg}
            onChange={(e) => setKudosMsg(e.target.value)}
            placeholder="ข้อความชื่นชม..."
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <button className="bg-amber-500 text-white rounded-lg px-4 py-2 text-sm font-medium">
            ส่ง +1
          </button>
        </form>
      </section>

      <section className="bg-white border border-slate-200 rounded-xl p-4">
        <h2 className="font-semibold text-sm mb-3">📝 ตั้งกระทู้ใหม่</h2>
        <form onSubmit={submitPost} className="space-y-2">
          <input
            value={newPostTitle}
            onChange={(e) => setNewPostTitle(e.target.value)}
            placeholder="หัวข้อ..."
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <textarea
            value={newPostBody}
            onChange={(e) => setNewPostBody(e.target.value)}
            placeholder="รายละเอียด..."
            rows={2}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <button className="bg-brand text-white rounded-lg px-4 py-2 text-sm font-medium">
            โพสต์
          </button>
        </form>
      </section>

      <section className="space-y-3">
        {posts.map((p) => (
          <div key={p.id} className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="font-semibold">{p.title}</p>
            <p className="text-sm text-slate-600 mt-1">{p.body}</p>
            <p className="text-xs text-slate-400 mt-2">
              โดย {p.users?.full_name || p.users?.username} ·{" "}
              {new Date(p.created_at).toLocaleDateString("th-TH")}
            </p>
          </div>
        ))}
      </section>
    </div>
  );
}
