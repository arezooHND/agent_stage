"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { scene as defaultScene, type Scene } from "@/lib/scene";

type Message = { role: "user" | "assistant"; content: string };
type Phase = "idle" | "listening" | "thinking" | "speaking";
type Model = "mistral-large-latest" | "open-mistral-nemo";

// Strips a complete or in-progress [[OFFER:n]] marker so it's never shown or spoken.
const stripOfferMarker = (text: string) =>
  text.replace(/\[\[OFFER:?\d*\]?\]?\s*$/i, "");

const AFFIRMATIVE_RE = /^\s*(yes|yeah|yep|sure|please|ok(ay)?|go ahead|do it|absolutely|of course)\b/i;

export default function StagePage() {
  const [scene, setScene] = useState<Scene>(defaultScene);
  const [phase, setPhase] = useState<Phase>("idle");
  const [transcript, setTranscript] = useState("");
  const [reply, setReply] = useState("");
  const [videoIndex, setVideoIndex] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const model: Model = "mistral-large-latest";
  const [conversationStarted, setConversationStarted] = useState(false);
  const [videoMuted, setVideoMuted] = useState(true);
  const [voiceMuted, setVoiceMuted] = useState(false);
  const voiceMutedRef = useRef(false);
  const currentAudio = useRef<{ ctx: AudioContext; source: AudioBufferSourceNode; gain: GainNode } | null>(null);
  const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Index of a clip Mira just offered to play — set when her reply ends with
  // [[OFFER:n]], consumed on the visitor's very next turn if they say yes.
  const pendingOfferRef = useRef<number | null>(null);

  const [orientation, setOrientation] = useState<"portrait" | "landscape">("landscape");

  useEffect(() => {
    const update = () =>
      setOrientation(
        scene.orientation === "auto"
          ? window.innerHeight > window.innerWidth ? "portrait" : "landscape"
          : scene.orientation,
      );
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [scene.orientation]);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  // Synchronous guard — React's `phase` state doesn't update until rec.onstart fires,
  // leaving a gap where a fast double-tap can start two recognition sessions at once.
  const listeningActiveRef = useRef(false);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const t = useRef<Record<string, number>>({});

  useEffect(() => {
    fetch("/api/scenes/latest")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data) setScene({ ...defaultScene, ...data }); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    setVideoIndex(scene.idleVideoIndex ?? scene.videos.length);
  }, [scene.idleVideoIndex, scene.videos.length]);

  useEffect(() => {
    synthRef.current = window.speechSynthesis;
    const logVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      console.log("Available voices:", voices.map((v) => `${v.name} (${v.lang})`));
    };
    logVoices();
    window.speechSynthesis.onvoiceschanged = logVoices;
  }, []);

  const speak = useCallback(async (text: string) => {
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
      const gain = audioCtx.createGain();
      gain.gain.value = voiceMutedRef.current ? 0 : 1;
      source.connect(gain);
      gain.connect(audioCtx.destination);
      currentAudio.current = { ctx: audioCtx, source, gain };
      const returnToIdle = () => {
        currentAudio.current = null;
        setPhase("idle");
        setVideoIndex(scene.idleVideoIndex ?? scene.videos.length);
      };
      source.onended = returnToIdle;
      source.start();
    } catch {
      const synth = synthRef.current ?? window.speechSynthesis;
      if (!synth) { setPhase("idle"); return; }
      const utt = new SpeechSynthesisUtterance(text);
      utt.rate = 0.88; utt.lang = "en-US";
      utt.onend = () => { setPhase("idle"); setVideoIndex(scene.idleVideoIndex ?? scene.videos.length); };
      utt.onerror = () => { setPhase("idle"); };
      synth.speak(utt);
    }
  }, [scene.idleVideoIndex, scene.videos.length]);

  const ttsFetch = useCallback((text: string) =>
    fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    }).then((r) => { if (!r.ok) throw new Error("TTS failed"); return r.arrayBuffer(); }), []);

  // play pre-fetched audio chunks back-to-back; falls back to speak() on error
  const speakChunks = useCallback(async (chunkPromises: Promise<ArrayBuffer>[], fullText: string) => {
    let audioCtx: AudioContext | null = null;
    try {
      audioCtx = new AudioContext();
      for (const p of chunkPromises) {
        const audioBuffer = await audioCtx.decodeAudioData(await p);
        await new Promise<void>((resolve) => {
          const source = audioCtx!.createBufferSource();
          source.buffer = audioBuffer;
          const gain = audioCtx!.createGain();
          gain.gain.value = voiceMutedRef.current ? 0 : 1;
          source.connect(gain);
          gain.connect(audioCtx!.destination);
          currentAudio.current = { ctx: audioCtx!, source, gain };
          source.onended = () => resolve();
          source.start();
        });
      }
      currentAudio.current = null;
      audioCtx.close();
      setPhase("idle");
      setVideoIndex(scene.idleVideoIndex ?? scene.videos.length);
    } catch {
      audioCtx?.close();
      speak(fullText);
    }
  }, [scene.idleVideoIndex, scene.videos.length, speak]);

  const triggerLeaving = useCallback(() => {
    const leavingClip = scene.videos.find((v) => v.trigger === "leaving");
    if (leavingClip) setVideoIndex(leavingClip.index);
    setTimeout(() => {
      setVideoIndex(scene.idleVideoIndex ?? 1);
      setConversationStarted(false);
      setMessages([]);
      setReply("");
      setPhase("idle");
      pendingOfferRef.current = null;
    }, 4000);
  }, [scene.videos, scene.idleVideoIndex]);

  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    inactivityTimer.current = setTimeout(() => triggerLeaving(), 60000);
  }, [triggerLeaving]);

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
      return scene.idleVideoIndex;
    }
  }, [scene.idleVideoIndex]);

  const sendMessage = useCallback(async (userText: string) => {
    setPhase("thinking"); setReply("");
    t.current = {};
    t.current.thinkStart = performance.now();

    // If Mira just offered a specific clip and the visitor said yes, play that
    // exact clip instead of running the reply back through topic-based selection.
    const offeredIndex = pendingOfferRef.current;
    const isConfirmingOffer = offeredIndex !== null && AFFIRMATIVE_RE.test(userText);
    pendingOfferRef.current = null; // an offer only holds for the very next turn

    const newMessages: Message[] = [...messages, { role: "user", content: userText }];
    setMessages(newMessages);

    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: newMessages, model }),
    });
    if (!res.body) { setPhase("idle"); return; }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let fullReply = ""; let firstChunk = true;
    let videoSelectPromise: Promise<number> = Promise.resolve(scene.idleVideoIndex);
    // start converting the first sentence to speech while the rest still streams
    let firstSentence = "";
    let firstTtsPromise: Promise<ArrayBuffer> | null = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      for (const line of chunk.split("\n").filter((l) => l.startsWith("data: "))) {
        const json = line.slice(6).trim();
        if (json === "[DONE]") continue;
        try {
          const delta = JSON.parse(json).choices?.[0]?.delta?.content ?? "";
          if (delta) {
            if (firstChunk) {
              t.current.firstToken = performance.now();
              firstChunk = false;
              videoSelectPromise = isConfirmingOffer && offeredIndex !== null
                ? Promise.resolve(offeredIndex)
                : selectVideo(fullReply + delta);
            }
            fullReply += delta;
            setReply(stripOfferMarker(fullReply));
            if (!firstTtsPromise) {
              const m = fullReply.match(/^[\s\S]*?[.!?](?=\s|$)/);
              if (m) {
                firstSentence = m[0];
                firstTtsPromise = ttsFetch(firstSentence);
              }
            }
          }
        } catch { /* skip malformed lines */ }
      }
    }

    // Extract any offer marker before speaking/displaying, but keep the raw
    // reply (marker included) in conversation history so Mira remembers she asked.
    const offerMatch = fullReply.match(/\[\[OFFER:(\d+)\]\]/);
    if (offerMatch) pendingOfferRef.current = parseInt(offerMatch[1], 10);
    const cleanReply = fullReply.replace(/\[\[OFFER:\d+\]\]/, "").trim();

    setMessages((prev) => [...prev, { role: "assistant", content: fullReply }]);
    setPhase("speaking");
    setReply(cleanReply);
    const rest = firstTtsPromise ? cleanReply.slice(firstSentence.length).trim() : "";
    if (firstTtsPromise) {
      const chunks = [firstTtsPromise];
      if (rest) chunks.push(ttsFetch(rest));
      speakChunks(chunks, cleanReply);
    } else {
      speak(cleanReply);
    }

    videoSelectPromise.then((idx) => {
      const clip = scene.videos.find((v) => v.index === idx);
      if (clip?.includesSpeech) {
        const wordCount = fullReply.split(/\s+/).length;
        setTimeout(() => setVideoIndex(idx), wordCount * 450 + 500);
      } else {
        setVideoIndex(idx);
      }
    });
  }, [messages, model, selectVideo, speak, speakChunks, ttsFetch, scene.idleVideoIndex, scene.videos]);

  const finalizeRecording = useCallback((finalTranscript: string) => {
    if (!finalTranscript.trim()) { setPhase("idle"); return; }
    if (/\b(bye|goodbye|see you|farewell|ciao)\b/i.test(finalTranscript)) {
      triggerLeaving(); return;
    }
    if (/^(hi+|hello|hey|howdy|greetings|hi there|hello there|hey there|good morning|good afternoon|good evening)[\s!.]*$/i.test(finalTranscript.trim())) {
      setPhase("speaking");
      setReply("Hi there! I'm Mira, your guide at HBK Saar. Feel free to ask me anything about the school or its programs!");
      speak("Hi there! I'm Mira, your guide at HBK Saar. Feel free to ask me anything about the school or its programs!");
      return;
    }
    resetInactivityTimer();
    const normalized = finalTranscript.trim()
      // normalize HBK variations
      .replace(/\b(hbc|hbg|hbo|hbk|h\.b\.k\.?|h b k|each be kay|aitch be kay|age b k|h be k|ha be ka|ha b k|ha be k|habeka|habek|habitazar|habita\s*zar|habitat\s*zar|habitasar|abitazar|hepatazar|habeka\s*zar|hbke|hbca|hbga|hebek|hibek|the school|this school|the university|this university|the college|this place)(\s+saar)?\b/gi, "HBK Saar")
      // normalize Saarbrücken variations
      .replace(/\b(zaar\s*br[uü]?c?k?e?n?|zaar\s*bguken|zaar\s*brook|saar\s*br[uü]?c?k?e?n?|sar\s*brook|zarbrook|saarbrucken|saarbrücken)\b/gi, "Saarbrücken")
      // normalize standalone Saar variations
      .replace(/\b(zaar|czar|tsar|sahar|za ar)\b/gi, "Saar");
    sendMessage(normalized);
  }, [sendMessage, resetInactivityTimer, triggerLeaving]);

  const startListening = useCallback(() => {
    if (listeningActiveRef.current) return;
    listeningActiveRef.current = true;

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
      (window as typeof window & { webkitSpeechRecognition?: typeof SpeechRecognition }).webkitSpeechRecognition ??
      (typeof SpeechRecognition !== "undefined" ? SpeechRecognition : null);
    if (!SR) { listeningActiveRef.current = false; alert("Use Chrome for speech recognition."); return; }

    const rec = new SR();
    rec.lang = "en-US";
    rec.interimResults = true;
    rec.continuous = true;
    rec.maxAlternatives = 1;

    let silenceTimer: ReturnType<typeof setTimeout> | null = null;
    let collected = "";
    let lastInterim = "";
    let sent = false;

    const sendOnce = (text: string) => {
      if (sent || !text.trim()) return;
      sent = true;
      if (silenceTimer) clearTimeout(silenceTimer);
      rec.abort();
      t.current.listenEnd = performance.now();
      finalizeRecording(text);
    };

    rec.onstart = () => { setPhase("listening"); setTranscript(""); t.current.listenStart = performance.now(); };

    rec.onresult = (e: SpeechRecognitionEvent) => {
      let interim = "";
      collected = "";
      for (let i = 0; i < e.results.length; i++) {
        if (e.results[i].isFinal) collected += e.results[i][0].transcript + " ";
        else interim += e.results[i][0].transcript;
      }
      lastInterim = interim;
      setTranscript((collected + interim).trim());
      if (silenceTimer) clearTimeout(silenceTimer);
      silenceTimer = setTimeout(() => sendOnce(collected + interim), 4000);
    };

    rec.onend = () => {
      listeningActiveRef.current = false;
      if (silenceTimer) clearTimeout(silenceTimer);
      // use interim too — single words often never become "final" before onend fires
      const best = (collected + lastInterim).trim();
      if (!sent && best) sendOnce(best);
      else if (!sent) setPhase("idle");
    };

    rec.onerror = (e: Event & { error?: string }) => {
      if (silenceTimer) clearTimeout(silenceTimer);
      if (e.error !== "aborted") setPhase("idle");
    };

    recognitionRef.current = rec;
    rec.start();
  }, [sendMessage, conversationStarted, scene.videos, scene.idleVideoIndex, resetInactivityTimer, triggerLeaving, finalizeRecording]);

  const stopListening = useCallback(() => {
    const rec = recognitionRef.current;
    if (!rec) return;
    rec.abort();
    t.current.listenEnd = performance.now();
  }, []);

  const videoMutedRef = useRef(true);
  videoMutedRef.current = videoMuted;

  useEffect(() => {
    if (videoIndex === null) return;
    const clip = scene.videos.find((v) => v.index === videoIndex);
    const el = videoRef.current;
    if (el && clip?.url) {
      el.src = clip.url;
      el.muted = videoMutedRef.current;
      el.play().catch(() => {});
    }
  }, [videoIndex, scene.videos]);

  // mute/unmute the running player without reloading it
  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = videoMuted;
  }, [videoMuted]);

  const toggleVoiceMute = useCallback(() => {
    const next = !voiceMutedRef.current;
    voiceMutedRef.current = next;
    setVoiceMuted(next);
    // silence/restore the running audio without stopping it —
    // unmuting resumes mid-sentence
    if (currentAudio.current) {
      currentAudio.current.gain.gain.value = next ? 0 : 1;
    }
    if (next) window.speechSynthesis?.cancel();
  }, []);

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
    <main className="relative w-full h-screen overflow-hidden bg-black flex items-center justify-center">
      <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover opacity-80"
        autoPlay loop muted={videoMuted} playsInline
        style={{ pointerEvents: "none" }} />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />

      {/* Mute controls — top right */}
      <div className="absolute top-4 right-4 z-20 flex gap-2">
        <button
          onClick={() => setVideoMuted((m) => !m)}
          aria-label={videoMuted ? "Unmute video" : "Mute video"}
          title={videoMuted ? "Unmute video" : "Mute video"}
          className="w-11 h-11 rounded-full bg-black/40 border border-white/20 flex items-center justify-center text-white/70 hover:text-white hover:border-white/50 transition-all"
        >
          {/* film icon with slash if muted */}
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h1.5C5.496 19.5 6 18.996 6 18.375m-3.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-1.5A1.125 1.125 0 0118 18.375M20.625 4.5H3.375m17.25 0c.621 0 1.125.504 1.125 1.125M20.625 4.5h-1.5C18.504 4.5 18 5.004 18 5.625m3.75 0v1.5c0 .621-.504 1.125-1.125 1.125M3.375 4.5c-.621 0-1.125.504-1.125 1.125M3.375 4.5h1.5C5.496 4.5 6 5.004 6 5.625m-3.75 0v1.5c0 .621.504 1.125 1.125 1.125m0 0h1.5m-1.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m1.5-3.75C5.496 8.25 6 7.746 6 7.125v-1.5M4.875 8.25C5.496 8.25 6 8.754 6 9.375v1.5m0-5.25v5.25m0-5.25C6 5.004 6.504 4.5 7.125 4.5h9.75c.621 0 1.125.504 1.125 1.125m1.125 2.625h1.5m-1.5 0A1.125 1.125 0 0118 7.125v-1.5m1.125 2.625c-.621 0-1.125.504-1.125 1.125v1.5m2.625-2.625c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125M18 5.625v5.25M7.125 12h9.75m-9.75 0A1.125 1.125 0 016 10.875M7.125 12C6.504 12 6 12.504 6 13.125m0-2.25C6 11.496 5.496 12 4.875 12M18 10.875c0 .621-.504 1.125-1.125 1.125M18 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125m-12 5.25v-5.25m0 5.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125m-12 0v-1.5c0-.621-.504-1.125-1.125-1.125M18 18.375v-5.25m0 5.25v-1.5c0-.621.504-1.125 1.125-1.125M18 13.125v1.5c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125m0 0h1.5m-1.5 0c-.621 0-1.125.504-1.125 1.125"/>
            {videoMuted && <line x1="3" y1="21" x2="21" y2="3" stroke="currentColor" strokeWidth={2} />}
          </svg>
        </button>
      </div>

      {/* Character name — top center */}
      <div className="absolute top-8 left-0 right-0 z-10 flex flex-col items-center">
        <p className="text-white/50 text-sm tracking-widest uppercase">{scene.name}</p>
        <h1 className="text-white text-5xl font-light tracking-wide">{scene.characterName}</h1>
      </div>

      {/* Mic button + reply — bottom center */}
      <div className="absolute bottom-10 left-0 right-0 z-10 flex flex-col items-center gap-3">
        {transcript && (
          <p className="text-white/40 text-sm italic mb-1">&ldquo;{transcript}&rdquo;</p>
        )}
        <button
          onClick={() => {
            if (phase === "idle") startListening();
            else if (phase === "listening") stopListening();
          }}
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
        {/* Reply / idle message — below mic */}
        <div className="px-8 max-w-xl text-center mt-1">
          {scene.showBotText && (
            <p className="text-white text-lg leading-relaxed drop-shadow">
              {phase === "idle" && !reply ? scene.idleMessage : reply || "…"}
            </p>
          )}
          {!scene.showBotText && phase === "idle" && (
            <p className="text-white text-lg leading-relaxed drop-shadow">{scene.idleMessage}</p>
          )}
        </div>
      </div>

      {process.env.NODE_ENV === "development" && loopMs !== null && (
        <div className="absolute top-20 right-4 z-20 bg-black/70 text-white/80 text-xs p-3 rounded-lg font-mono space-y-1">
          <p className="font-bold text-white mb-1">Latency — {model === "mistral-large-latest" ? "Large" : "Nemo"}</p>
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
