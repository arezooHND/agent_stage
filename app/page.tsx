"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { scene as defaultScene, type Scene } from "@/lib/scene";

type Message = { role: "user" | "assistant"; content: string };
type Phase = "idle" | "listening" | "thinking" | "speaking";
type Model = "mistral-large-latest" | "open-mistral-nemo";

export default function StagePage() {
  const [scene, setScene] = useState<Scene>(defaultScene);
  const [phase, setPhase] = useState<Phase>("idle");
  const [transcript, setTranscript] = useState("");
  const [reply, setReply] = useState("");
  const [videoIndex, setVideoIndex] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [model, setModel] = useState<Model>("mistral-large-latest");
  const [conversationStarted, setConversationStarted] = useState(false);
  const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Resolved orientation — "auto" detects from device/window at runtime
  const getOrientation = () => {
    if (scene.orientation !== "auto") return scene.orientation;
    // Portrait if: mobile device AND window is taller than wide
    return window.innerHeight > window.innerWidth ? "portrait" : "landscape";
  };
  const [orientation, setOrientation] = useState<"portrait" | "landscape">(
    "landscape",
  );

  // Re-evaluate on mount and on window resize (handles phone rotation)
  useEffect(() => {
    const update = () =>
      setOrientation(
        scene.orientation === "auto"
          ? window.innerHeight > window.innerWidth
            ? "portrait"
            : "landscape"
          : scene.orientation,
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
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setScene({ ...defaultScene, ...data });
      })
      .catch(() => {});
  }, []);

  // When scene loads (or changes), switch to the configured idle video
  useEffect(() => {
    setVideoIndex(scene.idleVideoIndex ?? scene.videos.length);
  }, [scene.idleVideoIndex, scene.videos.length]);

  useEffect(() => {
    synthRef.current = window.speechSynthesis;
    const logVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      console.log(
        "Available voices:",
        voices.map((v) => `${v.name} (${v.lang})`),
      );
    };
    logVoices();
    window.speechSynthesis.onvoiceschanged = logVoices;
  }, []);

  const speak = useCallback(
    async (text: string) => {
      try {
        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });

        if (!res.ok) throw new Error("TTS failed");

        const arrayBuffer = await res.arrayBuffer();
        const audioCtx = new AudioContext();
        const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
        const source = audioCtx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioCtx.destination);

        const returnToIdle = () => {
          setPhase("idle");
          setVideoIndex(scene.idleVideoIndex ?? scene.videos.length);
        };

        source.onended = returnToIdle;
        source.start();
      } catch {
        // Fallback to browser TTS if ElevenLabs fails
        const synth = synthRef.current ?? window.speechSynthesis;
        if (!synth) {
          setPhase("idle");
          return;
        }
        const utt = new SpeechSynthesisUtterance(text);
        utt.rate = 0.88;
        utt.lang = "en-US";
        utt.onend = () => {
          setPhase("idle");
          setVideoIndex(scene.idleVideoIndex ?? scene.videos.length);
        };
        utt.onerror = () => {
          setPhase("idle");
        };
        synth.speak(utt);
      }
    },
    [scene.idleVideoIndex, scene.videos.length],
  );

  const triggerLeaving = useCallback(() => {
    const leavingClip = scene.videos.find((v) => v.trigger === "leaving");
    if (leavingClip) setVideoIndex(leavingClip.index);
    setTimeout(() => {
      setVideoIndex(scene.idleVideoIndex ?? 1);
      setConversationStarted(false);
      setMessages([]);
      setReply("");
      setPhase("idle");
    }, 4000);
  }, [scene.videos, scene.idleVideoIndex]);

  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    inactivityTimer.current = setTimeout(() => triggerLeaving(), 60000);
  }, [triggerLeaving]);

  const selectVideo = useCallback(
    async (botReply: string): Promise<number> => {
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
    },
    [scene.videos.length],
  );

  const sendMessage = useCallback(
    async (userText: string) => {
      setPhase("thinking");
      setReply("");
      t.current = {}; // reset all timings for this new interaction
      t.current.thinkStart = performance.now();
      const newMessages: Message[] = [
        ...messages,
        { role: "user", content: userText },
      ];
      setMessages(newMessages);

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages, model }),
      });
      if (!res.body) {
        setPhase("idle");
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullReply = "";
      let firstChunk = true;
      let videoSelectPromise: Promise<number> = Promise.resolve(
        scene.videos.length,
      );

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk
          .split("\n")
          .filter((l) => l.startsWith("data: "))) {
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
          } catch {
            /* skip malformed lines */
          }
        }
      }

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: fullReply },
      ]);
      setPhase("speaking");

      // Start speaking immediately
      speak(fullReply);

      // Update video when selector finishes — if clip has includesSpeech, wait for speech to end first
      videoSelectPromise.then((idx) => {
        const clip = scene.videos.find((v) => v.index === idx);
        if (clip?.includesSpeech) {
          const wordCount = fullReply.split(/\s+/).length;
          setTimeout(() => setVideoIndex(idx), wordCount * 450 + 500);
        } else {
          setVideoIndex(idx);
        }
      });
    },
    [
      messages,
      model,
      selectVideo,
      speak,
      scene.idleVideoIndex,
      scene.videos.length,
    ],
  );

  const startListening = useCallback(() => {
    // Play entering animation on first interaction
    if (!conversationStarted) {
      setConversationStarted(true);
      const enteringClip = scene.videos.find((v) => v.trigger === "entering");
      if (enteringClip) {
        setVideoIndex(enteringClip.index);
        setTimeout(() => setVideoIndex(scene.idleVideoIndex ?? 1), 3000);
      }
      resetInactivityTimer();
    }
    const SR =
      (
        window as typeof window & {
          webkitSpeechRecognition?: typeof SpeechRecognition;
        }
      ).webkitSpeechRecognition ??
      (typeof SpeechRecognition !== "undefined" ? SpeechRecognition : null);
    if (!SR) {
      alert("Use Chrome for speech recognition.");
      return;
    }

    // Fresh recognition instance every turn
    const rec = new SR();
    rec.lang = "en-US";
    rec.interimResults = true;
    rec.continuous = true; // continuous mode — user decides when to stop via second click
    rec.maxAlternatives = 1;

    let collected = ""; // accumulates transcript

    rec.onstart = () => {
      setPhase("listening");
      setTranscript("");
      t.current.listenStart = performance.now();
    };

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
    };

    rec.onerror = (e: Event & { error?: string }) => {
      if (e.error !== "aborted") setPhase("idle");
    };

    recognitionRef.current = rec;
    rec.start();
  }, [
    sendMessage,
    conversationStarted,
    scene.videos,
    scene.idleVideoIndex,
    resetInactivityTimer,
    triggerLeaving,
  ]);

  const stopListening = useCallback(() => {
    const rec = recognitionRef.current;
    if (!rec) return;

    rec.abort();
    t.current.listenEnd = performance.now();
  }, []);

  // Separate function to finalize and send the recorded message
  const finalizeRecording = useCallback(
    (finalTranscript: string) => {
      if (!finalTranscript.trim()) {
        setPhase("idle");
        return;
      }

      // Detect farewell
      if (/\b(bye|goodbye|see you|farewell|ciao)\b/i.test(finalTranscript)) {
        triggerLeaving();
        return;
      }

      resetInactivityTimer();
      const normalized = finalTranscript
        .trim()
        .replace(
          /\b(hbc|hbg|hbo|h\.b\.k|h b k|each be kay|aitch be kay)\b/gi,
          "HBK Saar",
        )
        .replace(/\b(zaar|sar|czar|tsar)\b/gi, "Saar");
      sendMessage(normalized);
    },
    [sendMessage, resetInactivityTimer, triggerLeaving],
  );

  useEffect(() => {
    if (videoIndex === null) return;
    const clip = scene.videos.find((v) => v.index === videoIndex);
    if (videoRef.current && clip?.url) {
      videoRef.current.src = clip.url;
      videoRef.current.play().catch(() => {});
    }
  }, [videoIndex, scene.videos]);

  const phaseLabel: Record<Phase, string> = {
    idle: "Click to start",
    listening: "Click to stop",
    thinking: "Thinking…",
    speaking: "Speaking…",
  };
  const phaseRing: Record<Phase, string> = {
    idle: "bg-white/10 hover:bg-white/20 border-white/30",
    listening: "bg-red-500/70 border-red-400 animate-pulse",
    thinking: "bg-yellow-400/50 border-yellow-300 animate-pulse",
    speaking: "bg-green-400/50 border-green-300",
  };

  const loopMs =
    t.current.firstToken && t.current.listenEnd
      ? Math.round(t.current.firstToken - t.current.listenEnd)
      : null;

  return (
    <main
      className={`relative w-full h-screen overflow-hidden bg-black flex items-center ${
        orientation === "landscape"
          ? "flex-row justify-end"
          : "flex-col justify-end"
      }`}
    >
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover opacity-80"
        autoPlay
        loop
        muted
        playsInline
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />

      <div
        className={`relative z-10 flex flex-col items-center ${
          orientation === "landscape"
            ? "h-full justify-end pb-10 pr-10 pl-6 w-72 bg-gradient-to-l from-black/60 to-transparent"
            : "w-full"
        }`}
      >
        <div
          className={`text-center ${orientation === "landscape" ? "mb-4" : "mb-1"}`}
        >
          <p className="text-white/50 text-xs tracking-widest uppercase">
            {scene.name}
          </p>
          <h1 className="text-white text-3xl font-light tracking-wide">
            {scene.characterName}
          </h1>
        </div>

        {scene.showBotText && (
          <div
            className={`w-full ${orientation === "landscape" ? "mb-4" : "max-w-sm px-6 mb-5"} min-h-[72px] flex items-center justify-center`}
          >
            <p className="text-white text-center text-lg leading-relaxed drop-shadow">
              {phase === "idle" && !reply ? scene.idleMessage : reply || "…"}
            </p>
          </div>
        )}

        {!scene.showBotText && phase === "idle" && (
          <div
            className={`w-full ${orientation === "landscape" ? "mb-4" : "max-w-sm px-6 mb-5"} min-h-[72px] flex items-center justify-center`}
          >
            <p className="text-white text-center text-lg leading-relaxed drop-shadow">
              {scene.idleMessage}
            </p>
          </div>
        )}

        {transcript && (
          <p className="text-white/40 text-sm italic mb-2">
            &ldquo;{transcript}&rdquo;
          </p>
        )}

        <div
          className={`flex flex-col items-center gap-2 ${orientation === "landscape" ? "" : "mb-14"}`}
        >
          <button
            onClick={() => {
              if (phase === "idle") {
                startListening();
              } else if (phase === "listening") {
                stopListening();
                finalizeRecording(transcript);
              }
            }}
            disabled={phase === "thinking" || phase === "speaking"}
            aria-label={phaseLabel[phase]}
            className={`w-20 h-20 rounded-full border-2 flex items-center justify-center
              transition-all duration-200 select-none
              disabled:opacity-40 disabled:cursor-not-allowed ${phaseRing[phase]}`}
          >
            <svg
              className="w-8 h-8 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 016 0v8.25a3 3 0 01-3 3z"
              />
            </svg>
          </button>
          <p className="text-white/50 text-xs">{phaseLabel[phase]}</p>
        </div>
      </div>

      <div className="absolute top-4 left-4 z-20 flex gap-1">
        {(["mistral-large-latest", "open-mistral-nemo"] as Model[]).map((m) => (
          <button
            key={m}
            onClick={() => setModel(m)}
            className={`text-xs px-3 py-1 rounded-full border transition-all ${
              model === m
                ? "bg-white text-black border-white font-semibold"
                : "bg-black/40 text-white/60 border-white/20 hover:border-white/50"
            }`}
          >
            {m === "mistral-large-latest" ? "Large" : "Nemo"}
          </button>
        ))}
      </div>

      {process.env.NODE_ENV === "development" && loopMs !== null && (
        <div className="absolute top-4 right-4 z-20 bg-black/70 text-white/80 text-xs p-3 rounded-lg font-mono space-y-1">
          <p className="font-bold text-white mb-1">
            Latency — {model === "mistral-large-latest" ? "Large" : "Nemo"}
          </p>
          <p>
            STT → first token:{" "}
            <span className="text-yellow-300">{loopMs}ms</span>
          </p>
          {t.current.selectorEnd && t.current.thinkStart && (
            <p>
              Selector:{" "}
              <span className="text-green-300">
                {Math.round(t.current.selectorEnd - t.current.thinkStart)}ms
              </span>
            </p>
          )}
          <p className="text-white/40">Video: {videoIndex}</p>
        </div>
      )}
    </main>
  );
}
