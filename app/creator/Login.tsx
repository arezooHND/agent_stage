"use client";

import { useState } from "react";

export default function Login({ onSuccess }: { onSuccess: () => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const login = async (e: React.FormEvent) => {
    e.preventDefault();

    const res = await fetch("/api/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username,
        password,
      }),
    });

    if (!res.ok) {
      alert("Wrong username or password");
      return;
    }

    onSuccess();

    alert("Wrong username or password");
  };

  return (
    <div className="min-h-screen bg-[#0c0e14] flex items-center justify-center">
      <div className="w-[420px] rounded-2xl border border-slate-800 bg-[#0e1018] p-8 shadow-2xl">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-indigo-500 flex items-center justify-center">
            🎭
          </div>

          <div>
            <h1 className="text-white text-xl font-bold">AgentStage Creator</h1>

            <p className="text-slate-400 text-sm">Sign in to continue</p>
          </div>
        </div>

        <form onSubmit={login} className="space-y-5">
          <div>
            <label className="text-sm text-slate-400">Username</label>

            <input
              className="mt-2 w-full rounded-xl bg-slate-900 border border-slate-700 px-4 py-3 text-white outline-none focus:border-indigo-500"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>

          <div>
            <label className="text-sm text-slate-400">Password</label>

            <input
              type="password"
              className="mt-2 w-full rounded-xl bg-slate-900 border border-slate-700 px-4 py-3 text-white outline-none focus:border-indigo-500"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button className="w-full rounded-xl bg-indigo-500 hover:bg-indigo-400 py-3 text-white font-semibold transition">
            Sign In
          </button>
        </form>
      </div>
    </div>
  );
}
