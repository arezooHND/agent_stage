"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { scene } from "@/lib/scene";

type Message = { role: "user" | "assistant"; content: string };
type Phase = "idle" | "listening" | "thinking" | "speaking";

export default function StagePage() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [transcript, setTranscript] = useState("");
  const [reply, setReply] = useState("");
  const [videoIndex, setVideoIndex] = useState(5);
  const [messages, setMessages] = useState<Message[]>([]);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const t = useRef<Record<string, number>>({});

  useEffect(() => {
    synthRef.current = window.speechSynthesis;
    // Pre-load voices — browsers load them async, must trigger early
    window.speechSynthesis.getVoices();
    window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
  }, []);

  const speak = useCallback((text: string) => {
    const synth = synthRef.current ?? window.speechSynthesis;
    if (!synth) { setPhase("idle"); return; }

    synth.cancel();

    // 50ms delay lets cancel() fully clear before speaking (fixes Android/Chrome bug)
    setTimeout(() => {
      const utt = new SpeechSynthesisUtterance(text);
      utt.rate = 1.0;
      utt.pitch = 1.1;
      utt.lang = "en-US";

      // Pick best available English voice — prefer local (on-device) voices
      const voices = synth.getVoices();
      const preferred =
        voices.find(v => v.lang.startsWith("en") && v.localService) ??
        voices.find(v => v.lang.startsWith("en")) ??
        voices[0];
      if (preferred) utt.voice = preferred;

      // Always return to idle, even if TTS errors out
      utt.onend   = () => setPhase("idle");
      utt.onerror = () => setPhase("idle");

      synth.speak(utt);
    }, 50);
  }, []);

  const selectVideo = useCallback(async (botReply: string) => {
    const res = await fetch("/api/select-video", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ botReply }),
    });
    const data = await res.json();
    setVideoIndex(data.videoIndex);
    t.current.selectorEnd = performance.now();
  }, []);

  const sendMessage = useCallback(async (userText: string) => {
    setPhase("thinking");
    setReply("");
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
    let fullReply = "";
    let firstChunk = true;

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
            if (firstChunk) { t.current.firstToken = performance.now(); firstChunk = false; }
            fullReply += delta;
            setReply(fullReply);
          }
        } catch { /* skip malformed SSE lines */ }
      }
    }

    setMessages(prev => [...prev, { role: "assistant", content: fullReply }]);
    setPhase("speaking");
    selectVideo(fullReply);
    speak(fullReply);
  }, [messages, selectVideo, speak]);

  const startListening = useCallback(() => {
    const SR =
      (window as typeof window & { webkitSpeechRecognition?: typeof SpeechRecognition }).webkitSpeechRecognition ??
      (typeof SpeechRecognition !== "undefined" ? SpeechRecognition : null);
    if (!SR) { alert("Use Chrome for speech recognition."); return; }

    const rec = new SR();
    rec.lang = "en-US"; rec.interimResults = false; rec.maxAlternatives = 1;
    rec.onstart  = () => { setPhase("listening"); t.current.listenStart = performance.now(); };
    rec.onresult = (e: SpeechRecognitionEvent) => {
      const text = e.results[0][0].transcript;
      t.current.listenEnd = performance.now();
      setTranscript(text);
      sendMessage(text);
    };
    rec.onerror = () => setPhase("idle");
    recognitionRef.current = rec;
    rec.start();
  }, [sendMessage]);

  const stopListening = useCallback(() => { recognitionRef.current?.stop(); }, []);

  useEffect(() => {
    const clip = scene.videos.find(v => v.index === videoIndex);
    if (videoRef.current && clip) {
      videoRef.current.src = clip.url;
      videoRef.current.play().catch(() => {});
    }
  }, [videoIndex]);

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
    <main className="relative w-full h-screen overflow-hidden bg-black flex flex-col items-center justify-end">
      <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover opacity-80"
        autoPlay loop muted playsInline />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />

      <div className="relative z-10 text-center mb-1">
        <p className="text-white/50 text-xs tracking-widest uppercase">{scene.name}</p>
        <h1 className="text-white text-3xl font-light tracking-wide">{scene.characterName}</h1>
      </div>

      <div className="relative z-10 w-full max-w-sm px-6 mb-5 min-h-[72px] flex items-center justify-center">
        <p className="text-white text-center text-lg leading-relaxed drop-shadow">
          {phase === "idle" && !reply ? scene.idleMessage : reply || "…"}
        </p>
      </div>

      {transcript && (
        <p className="relative z-10 text-white/40 text-sm italic mb-2">&ldquo;{transcript}&rdquo;</p>
      )}

      <div className="relative z-10 mb-14 flex flex-col items-center gap-2">
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
