"use client";

import { useState, useRef, useCallback } from "react";
import type { Scene, VideoClip } from "@/lib/scene";
import { scene as defaultScene } from "@/lib/scene";

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = 1 | 2 | 3 | 4;

interface TestResult {
  reply: string;
  expected: number | null;
  got: number | null;
  ok: boolean | null;
  loading: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function StepDot({
  n,
  current,
  onClick,
}: {
  n: Step;
  current: Step;
  onClick: () => void;
}) {
  const done = n < current;
  const active = n === current;
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 text-sm transition-colors ${
        active
          ? "text-white font-medium"
          : done
            ? "text-white/70"
            : "text-white/30"
      }`}
    >
      <span
        className={`w-6 h-6 rounded-full flex items-center justify-center text-xs border transition-colors ${
          active
            ? "bg-white text-black border-white"
            : done
              ? "bg-white/20 border-white/40 text-white"
              : "border-white/20 text-white/30"
        }`}
      >
        {n}
      </span>
      <span className="hidden sm:inline">
        {["Scene", "Character", "Videos", "Share"][n - 1]}
      </span>
    </button>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-white/60 uppercase tracking-wider">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-white/30">{hint}</p>}
    </div>
  );
}

function Input({ ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-white/30 w-full"
    />
  );
}

function Textarea({
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-white/30 w-full resize-none"
    />
  );
}

function Btn({
  children,
  onClick,
  variant = "default",
  disabled,
  className = "",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "default" | "primary" | "danger" | "ghost";
  disabled?: boolean;
  className?: string;
}) {
  const base =
    "inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed";
  const variants = {
    default: "bg-white/10 hover:bg-white/15 text-white border border-white/10",
    primary: "bg-white text-black hover:bg-white/90",
    danger:
      "bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/20",
    ghost: "text-white/50 hover:text-white/80",
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

// ─── Step 1: Scene basics ─────────────────────────────────────────────────────

function StepScene({
  scene,
  onChange,
}: {
  scene: Scene;
  onChange: (s: Scene) => void;
}) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-light text-white mb-1">Scene basics</h2>
        <p className="text-sm text-white/40">
          The core identity of this experience.
        </p>
      </div>

      <Field label="Scene name" hint="Internal label — not shown to visitors">
        <Input
          value={scene.name}
          onChange={(e) => onChange({ ...scene, name: e.target.value })}
          placeholder="e.g. HBK Exhibition Guide"
        />
      </Field>

      <Field
        label="Knowledge / system prompt"
        hint="Describe who the character is, what they know, and how they should speak. Keep replies short — this is a voice conversation."
      >
        <Textarea
          rows={6}
          value={scene.systemPrompt}
          onChange={(e) => onChange({ ...scene, systemPrompt: e.target.value })}
          placeholder="You are Mira, a friendly guide at…"
        />
      </Field>

      <Field
        label="Idle message"
        hint="Shown (and optionally spoken) before the visitor says anything"
      >
        <Input
          value={scene.idleMessage}
          onChange={(e) => onChange({ ...scene, idleMessage: e.target.value })}
          placeholder="Hi! Ask me anything about the exhibition."
        />
      </Field>

      <Field
        label="Display orientation"
        hint="Portrait = vertical phone/tablet video. Landscape = horizontal PC/kiosk video. Controls both video aspect ratio and UI layout."
      >
        <div className="flex gap-3">
          {(["portrait", "landscape"] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => onChange({ ...scene, orientation: mode })}
              className={`flex-1 py-2 rounded-lg border text-sm capitalize transition-colors ${
                scene.orientation === mode
                  ? "bg-white text-black border-white"
                  : "bg-white/5 text-white/60 border-white/10 hover:border-white/30"
              }`}
            >
              {mode === "portrait" ? "📱 Portrait" : "🖥️ Landscape"}
            </button>
          ))}
        </div>
      </Field>

      <Field
        label="Show bot reply as text"
        hint="Toggle whether the bot's response is displayed as on-screen text while it speaks."
      >
        <button
          onClick={() =>
            onChange({ ...scene, showBotText: !scene.showBotText })
          }
          className={`w-fit flex items-center gap-3 px-4 py-2 rounded-lg border text-sm transition-colors ${
            scene.showBotText
              ? "bg-white text-black border-white"
              : "bg-white/5 text-white/50 border-white/10 hover:border-white/30"
          }`}
        >
          <span
            className={`w-8 h-4 rounded-full relative transition-colors ${scene.showBotText ? "bg-black/30" : "bg-white/10"}`}
          >
            <span
              className={`absolute top-0.5 w-3 h-3 rounded-full bg-current transition-all ${scene.showBotText ? "left-4" : "left-0.5"}`}
            />
          </span>
          {scene.showBotText ? "Text visible" : "Text hidden"}
        </button>
      </Field>
    </div>
  );
}

// ─── Step 2: Character ────────────────────────────────────────────────────────

function StepCharacter({
  scene,
  onChange,
}: {
  scene: Scene;
  onChange: (s: Scene) => void;
}) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-light text-white mb-1">Character</h2>
        <p className="text-sm text-white/40">
          Voice and video selection logic.
        </p>
      </div>

      <Field label="Character name">
        <Input
          value={scene.characterName}
          onChange={(e) =>
            onChange({ ...scene, characterName: e.target.value })
          }
          placeholder="Mira"
        />
      </Field>

      <Field
        label="Video selection prompt"
        hint="One bullet per video clip. The LLM reads your bot reply + these rules and returns a single number. Be specific — this directly controls which clip plays."
      >
        <Textarea
          rows={10}
          value={scene.selectionPrompt}
          onChange={(e) =>
            onChange({ ...scene, selectionPrompt: e.target.value })
          }
          placeholder={`Read the chatbot reply below, then pick the best video.\nReply with ONLY a single number.\n\n1 = explaining an artwork\n2 = giving directions\n3 = something playful\n4 = greeting or farewell\n5 = anything else`}
        />
      </Field>
    </div>
  );
}

// ─── Step 3: Videos + tester ──────────────────────────────────────────────────

function VideoUploadZone({
  clipIndex,
  onUploaded,
}: {
  clipIndex: number;
  onUploaded: (url: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = useCallback(
    async (file: File) => {
      if (!file.type.startsWith("video/")) {
        setError("Only video files allowed");
        return;
      }
      setUploading(true);
      setError(null);
      const fd = new FormData();
      fd.append("file", file);
      try {
        const res = await fetch("/api/upload", { method: "POST", body: fd });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Upload failed");
        onUploaded(data.url);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Upload failed");
      } finally {
        setUploading(false);
      }
    },
    [onUploaded],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) upload(file);
    },
    [upload],
  );

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
      onClick={() => inputRef.current?.click()}
      className={`cursor-pointer rounded-lg border-2 border-dashed p-4 text-center transition-colors
        ${dragOver ? "border-white/60 bg-white/10" : "border-white/20 hover:border-white/40 hover:bg-white/5"}`}
    >
      <input
        ref={inputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) upload(f);
        }}
      />
      {uploading ? (
        <p className="text-xs text-white/50 animate-pulse">Uploading…</p>
      ) : (
        <>
          <svg
            className="w-5 h-5 text-white/30 mx-auto mb-1"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
            />
          </svg>
          <p className="text-xs text-white/40">Drop video or click to browse</p>
        </>
      )}
      {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
    </div>
  );
}

function StepVideos({
  scene,
  onChange,
}: {
  scene: Scene;
  onChange: (s: Scene) => void;
}) {
  const [testReply, setTestReply] = useState("");
  const [testExpected, setTestExpected] = useState<string>("");
  const [results, setResults] = useState<TestResult[]>([]);
  const [testing, setTesting] = useState(false);

  const addVideo = useCallback(() => {
    const next = scene.videos.length + 1;
    onChange({
      ...scene,
      videos: [
        ...scene.videos,
        { index: next, url: "", label: `Clip ${next}` },
      ],
    });
  }, [scene, onChange]);

  const removeVideo = useCallback(
    (index: number) => {
      const filtered = scene.videos
        .filter((v) => v.index !== index)
        .map((v, i) => ({ ...v, index: i + 1 }));
      onChange({ ...scene, videos: filtered });
    },
    [scene, onChange],
  );

  const updateVideo = useCallback(
    (index: number, field: keyof VideoClip, value: string | number) => {
      onChange({
        ...scene,
        videos: scene.videos.map((v) =>
          v.index === index ? { ...v, [field]: value } : v,
        ),
      });
    },
    [scene, onChange],
  );

  const runTest = useCallback(async () => {
    if (!testReply.trim()) return;
    setTesting(true);
    const expected = testExpected ? parseInt(testExpected) : null;
    try {
      const res = await fetch("/api/select-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ botReply: testReply }),
      });
      const data = await res.json();
      const got = data.videoIndex as number;
      setResults((prev) => [
        {
          reply: testReply,
          expected,
          got,
          ok: expected !== null ? got === expected : null,
          loading: false,
        },
        ...prev.slice(0, 9),
      ]);
    } catch {
      setResults((prev) => [
        {
          reply: testReply,
          expected,
          got: null,
          ok: false,
          loading: false,
        },
        ...prev.slice(0, 9),
      ]);
    }
    setTesting(false);
  }, [testReply, testExpected]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-light text-white mb-1">Videos</h2>
        <p className="text-sm text-white/40">
          Upload clips and test that the selector picks the right one.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: clip list */}
        <div className="flex flex-col gap-3">
          <p className="text-xs font-medium text-white/60 uppercase tracking-wider">
            Clips
          </p>
          {scene.videos.map((v) => (
            <div
              key={v.index}
              className="bg-white/5 border border-white/10 rounded-lg p-3 flex gap-3 items-start"
            >
              <span className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-xs text-white/70 shrink-0 mt-1">
                {v.index}
              </span>
              <div className="flex flex-col gap-2 flex-1 min-w-0">
                <Input
                  value={v.label}
                  onChange={(e) =>
                    updateVideo(v.index, "label", e.target.value)
                  }
                  placeholder="Label (e.g. Explaining)"
                />
                {v.url ? (
                  <div className="relative group">
                    <video
                      src={v.url}
                      className="w-full h-24 object-cover rounded-md bg-black/40"
                      muted
                      onMouseEnter={(e) =>
                        (e.currentTarget as HTMLVideoElement).play()
                      }
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLVideoElement).pause();
                        (e.currentTarget as HTMLVideoElement).currentTime = 0;
                      }}
                    />
                    <button
                      onClick={() => updateVideo(v.index, "url", "")}
                      className="absolute top-1 right-1 bg-black/60 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity text-white/60 hover:text-red-400"
                      aria-label="Remove video"
                    >
                      <svg
                        className="w-3 h-3"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>
                ) : (
                  <VideoUploadZone
                    clipIndex={v.index}
                    onUploaded={(url) => updateVideo(v.index, "url", url)}
                  />
                )}
              </div>
              <button
                onClick={() => removeVideo(v.index)}
                className="text-white/30 hover:text-red-400 transition-colors mt-1 shrink-0"
                aria-label="Remove clip"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          ))}

          <button
            onClick={addVideo}
            className="border border-dashed border-white/20 rounded-lg p-3 text-sm text-white/40 hover:text-white/60 hover:border-white/30 transition-colors flex items-center justify-center gap-2"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 4.5v15m7.5-7.5h-15"
              />
            </svg>
            Add clip
          </button>
        </div>

        {/* Right: tester */}
        <div className="flex flex-col gap-3">
          <p className="text-xs font-medium text-white/60 uppercase tracking-wider">
            Selector tester
          </p>
          <p className="text-xs text-white/40">
            Type a sample bot reply → see which clip fires.
          </p>

          <Textarea
            rows={4}
            value={testReply}
            onChange={(e) => setTestReply(e.target.value)}
            placeholder="This artwork was created using recycled materials and sound sensors…"
          />

          <div className="flex gap-2 items-center">
            <Input
              value={testExpected}
              onChange={(e) => setTestExpected(e.target.value)}
              placeholder="Expected #"
              style={{ width: "100px" }}
              type="number"
              min={1}
              max={scene.videos.length}
            />
            <Btn
              variant="primary"
              onClick={runTest}
              disabled={testing || !testReply.trim()}
            >
              {testing ? "Testing…" : "Test"}
            </Btn>
          </div>

          {results.length > 0 && (
            <div className="flex flex-col gap-2 mt-1">
              <p className="text-xs text-white/40">Recent tests</p>
              {results.map((r, i) => (
                <div
                  key={i}
                  className="bg-white/5 border border-white/10 rounded-lg p-3 text-xs"
                >
                  <p className="text-white/60 mb-1 truncate">
                    &ldquo;{r.reply}&rdquo;
                  </p>
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        r.ok === true
                          ? "bg-green-500/20 text-green-300"
                          : r.ok === false
                            ? "bg-red-500/20 text-red-300"
                            : "bg-white/10 text-white/60"
                      }`}
                    >
                      Video {r.got ?? "?"}
                      {r.ok === true && " ✓"}
                      {r.ok === false && ` — expected ${r.expected}`}
                    </span>
                    {r.got !== null && (
                      <span className="text-white/30">
                        {scene.videos.find((v) => v.index === r.got)?.label ??
                          ""}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Step 4: Share ────────────────────────────────────────────────────────────

function StepShare({ scene }: { scene: Scene }) {
  const slug =
    scene.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "my-scene";
  const url = `https://agentstage.app/s/${slug}`;
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-light text-white mb-1">Share</h2>
        <p className="text-sm text-white/40">
          Your scene is ready to distribute.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* URL */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col gap-3">
          <p className="text-xs font-medium text-white/60 uppercase tracking-wider">
            Visitor URL
          </p>
          <div className="flex gap-2">
            <code className="flex-1 text-xs text-white/70 bg-black/20 rounded-lg px-3 py-2 truncate font-mono">
              {url}
            </code>
            <Btn variant="default" onClick={copy}>
              {copied ? (
                "Copied!"
              ) : (
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75"
                  />
                </svg>
              )}
            </Btn>
          </div>
          <p className="text-xs text-white/30">
            Deploy to Vercel first to make this URL live.
          </p>
        </div>

        {/* QR placeholder */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col gap-3 items-center justify-center">
          <div className="w-32 h-32 bg-white rounded-lg flex items-center justify-center">
            <svg viewBox="0 0 100 100" className="w-24 h-24">
              <rect
                x="5"
                y="5"
                width="38"
                height="38"
                rx="4"
                fill="none"
                stroke="black"
                strokeWidth="3"
              />
              <rect x="14" y="14" width="20" height="20" rx="2" fill="black" />
              <rect
                x="57"
                y="5"
                width="38"
                height="38"
                rx="4"
                fill="none"
                stroke="black"
                strokeWidth="3"
              />
              <rect x="66" y="14" width="20" height="20" rx="2" fill="black" />
              <rect
                x="5"
                y="57"
                width="38"
                height="38"
                rx="4"
                fill="none"
                stroke="black"
                strokeWidth="3"
              />
              <rect x="14" y="66" width="20" height="20" rx="2" fill="black" />
              <rect x="57" y="57" width="8" height="8" rx="1" fill="black" />
              <rect x="70" y="57" width="8" height="8" rx="1" fill="black" />
              <rect x="83" y="57" width="12" height="8" rx="1" fill="black" />
              <rect x="57" y="70" width="12" height="8" rx="1" fill="black" />
              <rect x="74" y="70" width="8" height="8" rx="1" fill="black" />
              <rect x="57" y="83" width="8" height="12" rx="1" fill="black" />
              <rect x="70" y="83" width="25" height="8" rx="1" fill="black" />
              <rect x="87" y="83" width="8" height="12" rx="1" fill="black" />
            </svg>
          </div>
          <p className="text-xs text-white/40 text-center">
            QR code — print for events
          </p>
        </div>
      </div>

      {/* Embed */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col gap-2">
        <p className="text-xs font-medium text-white/60 uppercase tracking-wider">
          Embed
        </p>
        <code className="text-xs text-white/50 font-mono bg-black/20 rounded-lg px-3 py-2 block">
          {`<iframe src="${url}" width="420" height="720" allow="microphone" frameborder="0"></iframe>`}
        </code>
      </div>

      {/* Scene summary */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col gap-3">
        <p className="text-xs font-medium text-white/60 uppercase tracking-wider">
          Scene summary
        </p>
        <div className="grid grid-cols-2 gap-2 text-sm">
          {[
            ["Character", scene.characterName],
            ["Videos", `${scene.videos.length} clips`],
            ["Status", "prototype (local)"],
            ["Slug", slug],
          ].map(([k, v]) => (
            <div key={k} className="flex flex-col gap-0.5">
              <span className="text-xs text-white/40">{k}</span>
              <span className="text-white/80">{v}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-3">
        <a
          href="/"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-white text-black hover:bg-white/90 transition-colors"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 010 1.972l-11.54 6.347a1.125 1.125 0 01-1.667-.986V5.653z"
            />
          </svg>
          Open consumer view
        </a>
      </div>
    </div>
  );
}

// ─── Main creator page ────────────────────────────────────────────────────────

const STORAGE_KEY = "agentStageScene";

export default function CreatorPage() {
  const [step, setStep] = useState<Step>(1);
  const [scene, setScene] = useState<Scene>(() => {
    if (typeof window === "undefined") return defaultScene;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? { ...defaultScene, ...JSON.parse(stored) } : defaultScene;
    } catch {
      return defaultScene;
    }
  });
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const save = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch("/api/scenes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(scene),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      const updated = { ...scene, slug: data.slug };
      setScene(updated);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const steps: Step[] = [1, 2, 3, 4];

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white flex flex-col">
      {/* Top bar */}
      <header className="border-b border-white/10 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <span className="text-sm font-medium tracking-tight">
            Agent<span className="text-white/40">Stage</span>
            <span className="ml-2 text-xs text-white/30 font-normal">
              creator
            </span>
          </span>

          <nav className="flex items-center gap-6">
            {steps.map((n) => (
              <StepDot
                key={n}
                n={n}
                current={step}
                onClick={() => setStep(n)}
              />
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {saved && (
            <span className="text-xs text-green-400 flex items-center gap-1">
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4.5 12.75l6 6 9-13.5"
                />
              </svg>
              Saved
            </span>
          )}
          <Btn variant="default" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Btn>
          {saveError && (
            <span className="text-xs text-red-400">{saveError}</span>
          )}
          <a
            href="/"
            className="text-xs text-white/40 hover:text-white/70 transition-colors"
          >
            Preview →
          </a>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-6 py-10">
        {step === 1 && <StepScene scene={scene} onChange={setScene} />}
        {step === 2 && <StepCharacter scene={scene} onChange={setScene} />}
        {step === 3 && <StepVideos scene={scene} onChange={setScene} />}
        {step === 4 && <StepShare scene={scene} />}
      </main>

      {/* Bottom nav */}
      <footer className="border-t border-white/10 px-6 py-4 flex justify-between">
        <Btn
          variant="ghost"
          onClick={() => setStep((s) => Math.max(1, s - 1) as Step)}
          disabled={step === 1}
        >
          ← Back
        </Btn>
        <Btn
          variant="primary"
          onClick={() => (step < 4 ? setStep((s) => (s + 1) as Step) : save())}
        >
          {step < 4 ? "Next →" : "Finish"}
        </Btn>
      </footer>
    </div>
  );
}
