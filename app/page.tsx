"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { scene as defaultScene, type Scene } from "@/lib/scene";

type Message = { role: "user" | "assistant"; content: string };
type Phase = "idle" | "listening" | "thinking" | "speaking";

export default function StagePage() {
  const [scene, setScene] = useState<Scene>(defaultScene);
  const [phase, setPhase] = useState<Phase>("idle");
  const [transcript, setTranscript] = useState("");
  const [reply, setReply] = useState("");
  const [videoIndex, setVideoIndex] = useState<number | null>(null); // null until scene loads
  const [messages, setMessages] = useState<Message[]>([]);

  // Resolved orientation — "auto" detects from device/window at runtime
  const getOrientation = () => {
    if (scene.orientation !== "auto") return scene.orientation;
    // Portrait if: mobile device AND window is taller than wide
    return window.innerHeight > window.innerWidth ? "portrait" : "landscape";
  };
  const [orientation, setOrientation] = useState<"portrait" | "landscape">("landscape");

  // Re-evaluate on mount and on window resize (handles phone rotation)
  useEffect(() => {
    const update = () => setOrientation(
      scene.orientation === "auto"
        ? (window.innerHeight > window.innerWidth ? "portrait" : "landscape")
        : scene.orientation
    );
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [scene.orientation]);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const t = useRef<Record<string, number>>({});

  // Fetch latest scene from DB once on load — no localStorage needed
  useEffect(() => {
    fetch("/api/scenes/latest")
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setScene({ ...defaultScene, ...data }); })
      .catch(() => {});
  }, []);

  // When scene loads (or changes), switch to the configured idle video
  useEffect(() => {
    setVideoIndex(scene.idleVideoIndex ?? scene.videos.length);
  }, [scene.idleVideoIndex, scene.videos.length]);

  useEffect(() => {
    synthRef.current = window.speechSynthesis;
    window.speechSynthesis.getVoices();
    window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
  }, []);

  const speak = useCallback((text: string) => {
    const synth = synthRef.current ?? window.speechSynthesis;
    if (!synth) { setPhase("idle"); return; }
    synth.cancel();
    setTimeout(() => {
      const utt = new SpeechSynthesisUtterance(text);
      utt.rate = 1.0; utt.pitch = 1.1; utt.lang = "en-US";
      const voices = synth.getVoices();
      const preferred =
        voices.find(v => v.lang.startsWith("en") && v.localService) ??
        voices.find(v => v.lang.startsWith("en")) ??
        voices[0];
      if (preferred) utt.voice = preferred;

      // Safety fallback: if onend never fires (Chrome bug), force idle after estimated duration
      // ~80ms per word is a rough estimate for normal speech rate
      const wordCount = text.split(/\s+/).length;
      const estimatedMs = Math.max(wordCount * 450, 2000);
      const safetyTimer = setTimeout(() => setPhase("idle"), estimatedMs + 1000);

      const returnToIdle = () => {
        clearTimeout(safetyTimer);
        setPhase("idle");
        setVideoIndex(scene.idleVideoIndex ?? scene.videos.length);
      };
      utt.onend = returnToIdle;
      utt.onerror = returnToIdle;
      synth.speak(utt);
    }, 50);
  }, []);

  const selectVideo = useCallback(async (botReply: string): Promise<number> => {
    try {
      const res = await fetch("/api/select-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ botReply }),
      });
      const data = await res.json();
      t.current.selectorEnd = performance.now();
      return data.videoIndex as number;
    } catch {
      return scene.videos.length; // fallback to last (neutral) clip
    }
  }, [scene.videos.length]);

  const sendMessage = useCallback(async (userText: string) => {
    setPhase("thinking"); setReply("");
    t.current = {}; // reset all timings for this new interaction
    t.current.thinkStart = performance.now();
    const newMessages: Message[] = [...messages, { role: "user", content: userText }];
    setMessages(newMessages);

    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: newMessages }),
    });
    if (!res.body) { setPhase("idle"); return; }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let fullReply = ""; let firstChunk = true;
    let videoSelectPromise: Promise<number> = Promise.resolve(scene.videos.length);

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      for (const line of chunk.split("\n").filter(l => l.startsWith("data: "))) {
        const json = line.slice(6).trim();
        if (json === "[DONE]") continue;
        try {
          const delta = JSON.parse(json).choices?.[0]?.delta?.content ?? "";
          if (delta) {
            if (firstChunk) {
              t.current.firstToken = performance.now();
              firstChunk = false;
              // Start video selection immediately on first token — runs in parallel with rest of stream
              videoSelectPromise = selectVideo(fullReply + delta);
            }
            fullReply += delta;
            setReply(fullReply);
          }
        } catch { /* skip malformed lines */ }
      }
    }

    setMessages(prev => [...prev, { role: "assistant", content: fullReply }]);
    setPhase("speaking");

    // Wait for video selection to complete (it was fired in parallel during streaming)
    // then set the video index and start speech in the same tick — fully synchronised
    const idx = await videoSelectPromise;
    setVideoIndex(idx);
    speak(fullReply);
  }, [messages, selectVideo, speak]);

  const startListening = useCallback(() => {
    const SR =
      (window as typeof window & { webkitSpeechRecognition?: typeof SpeechRecognition }).webkitSpeechRecognition ??
      (typeof SpeechRecognition !== "undefined" ? SpeechRecognition : null);
    if (!SR) { alert("Use Chrome for speech recognition."); return; }

    // Fresh recognition instance every turn — avoids stale transcript accumulation
    const rec = new SR();
    rec.lang = "en-US";
    rec.interimResults = true;
    rec.continuous = false; // stop after a natural pause — we handle continuation via silence timer
    rec.maxAlternatives = 1;

    let silenceTimer: ReturnType<typeof setTimeout> | null = null;
    let collected = ""; // accumulates transcript across multiple result events this turn
    let sent = false;   // ensure we only send once per turn

    const sendOnce = (text: string) => {
      if (sent || !text.trim()) return;
      sent = true;
      if (silenceTimer) clearTimeout(silenceTimer);
      rec.abort(); // stop cleanly without triggering onend logic again
      t.current.listenEnd = performance.now();
      sendMessage(text.trim());
    };

    rec.onstart = () => { setPhase("listening"); setTranscript(""); t.current.listenStart = performance.now(); };

    rec.onresult = (e: SpeechRecognitionEvent) => {
      let interim = "";
      collected = "";
      for (let i = 0; i < e.results.length; i++) {
        if (e.results[i].isFinal) {
          collected += e.results[i][0].transcript + " ";
        } else {
          interim += e.results[i][0].transcript;
        }
      }
      setTranscript((collected + interim).trim());

      // Reset silence timer — send 1.2s after user stops talking
      if (silenceTimer) clearTimeout(silenceTimer);
      silenceTimer = setTimeout(() => sendOnce(collected + interim), 1200);
    };

    // When recognition ends naturally (browser detected long silence), send what we have
    rec.onend = () => {
      if (silenceTimer) clearTimeout(silenceTimer);
      if (!sent && collected.trim()) sendOnce(collected);
      else if (!sent) setPhase("idle"); // nothing was said
    };

    rec.onerror = (e: Event & { error?: string }) => {
      if (silenceTimer) clearTimeout(silenceTimer);
      if (e.error !== "aborted") setPhase("idle");
    };

    recognitionRef.current = rec;
    rec.start();
  }, [sendMessage]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  useEffect(() => {
    if (videoIndex === null) return;
    const clip = scene.videos.find(v => v.index === videoIndex);
    if (videoRef.current && clip?.url) {
      videoRef.current.src = clip.url;
      videoRef.current.play().catch(() => {});
    }
  }, [videoIndex, scene.videos]);

  const phaseLabel: Record<Phase, string> = {
    idle: "Tap to speak", listening: "Listening…", thinking: "Thinking…", speaking: "Speaking…",
  };
  const phaseRing: Record<Phase, string> = {
    idle: "bg-white/10 hover:bg-white/20 border-white/30",
    listening: "bg-red-500/70 border-red-400 animate-pulse",
    thinking: "bg-yellow-400/50 border-yellow-300 animate-pulse",
    speaking: "bg-green-400/50 border-green-300",
  };

  const loopMs = t.current.firstToken && t.current.listenEnd
    ? Math.round(t.current.firstToken - t.current.listenEnd) : null;

  return (
    <main className={`relative w-full h-screen overflow-hidden bg-black flex items-center ${
      orientation === "landscape" ? "flex-row justify-end" : "flex-col justify-end"
    }`}>
      <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover opacity-80"
        autoPlay loop muted playsInline />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />

      <div className={`relative z-10 flex flex-col items-center ${
        orientation === "landscape"
          ? "h-full justify-end pb-10 pr-10 pl-6 w-72 bg-gradient-to-l from-black/60 to-transparent"
          : "w-full"
      }`}>
        <div className={`text-center ${orientation === "landscape" ? "mb-4" : "mb-1"}`}>
          <p className="text-white/50 text-xs tracking-widest uppercase">{scene.name}</p>
          <h1 className="text-white text-3xl font-light tracking-wide">{scene.characterName}</h1>
        </div>

        {scene.showBotText && (
          <div className={`w-full ${orientation === "landscape" ? "mb-4" : "max-w-sm px-6 mb-5"} min-h-[72px] flex items-center justify-center`}>
            <p className="text-white text-center text-lg leading-relaxed drop-shadow">
              {phase === "idle" && !reply ? scene.idleMessage : reply || "…"}
            </p>
          </div>
        )}

        {!scene.showBotText && phase === "idle" && (
          <div className={`w-full ${orientation === "landscape" ? "mb-4" : "max-w-sm px-6 mb-5"} min-h-[72px] flex items-center justify-center`}>
            <p className="text-white text-center text-lg leading-relaxed drop-shadow">{scene.idleMessage}</p>
          </div>
        )}

        {transcript && (
          <p className="text-white/40 text-sm italic mb-2">&ldquo;{transcript}&rdquo;</p>
        )}

        <div className={`flex flex-col items-center gap-2 ${orientation === "landscape" ? "" : "mb-14"}`}>
          <button
            onPointerDown={phase === "idle" ? startListening : undefined}
            onPointerUp={phase === "listening" ? stopListening : undefined}
            onPointerLeave={phase === "listening" ? stopListening : undefined}
            disabled={phase === "thinking" || phase === "speaking"}
            aria-label={phaseLabel[phase]}
            className={`w-20 h-20 rounded-full border-2 flex items-center justify-center
              transition-all duration-200 select-none
              disabled:opacity-40 disabled:cursor-not-allowed ${phaseRing[phase]}`}
          >
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 016 0v8.25a3 3 0 01-3 3z" />
            </svg>
          </button>
          <p className="text-white/50 text-xs">{phaseLabel[phase]}</p>
        </div>
      </div>

      {process.env.NODE_ENV === "development" && loopMs !== null && (
        <div className="absolute top-4 right-4 z-20 bg-black/70 text-white/80 text-xs p-3 rounded-lg font-mono space-y-1">
          <p className="font-bold text-white mb-1">Latency</p>
          <p>STT → first token: <span className="text-yellow-300">{loopMs}ms</span></p>
          {t.current.selectorEnd && t.current.thinkStart && (
            <p>Selector: <span className="text-green-300">{Math.round(t.current.selectorEnd - t.current.thinkStart)}ms</span></p>
          )}
          <p className="text-white/40">Video: {videoIndex}</p>
        </div>
      )}
    </main>
  );
}
