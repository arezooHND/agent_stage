# AgentStage

Voice-driven character interactions for exhibitions, events, and campaigns.

A visitor speaks → Mistral AI replies → a video clip plays in sync with the spoken response.

Built with **Next.js 14**, **Mistral AI**, and the browser's **Web Speech API**.

---

## Prototype scope

This repo is the **consumer prototype** — one hardcoded scene, no database, no creator UI yet.
It validates the core voice loop and answers four questions:

- How fast is STT → LLM first token? (target: under 2 s)
- Does the video selector pick the right clip reliably?
- Push-to-talk vs VAD — which feels natural on a phone?
- Does the idle screen pull someone in within 3 seconds?

---

## Quick start

### 1. Clone and install

```bash
git clone https://github.com/YOUR_USERNAME/agentstage.git
cd agentstage
npm install
```

### 2. Add your Mistral API key

```bash
cp .env.example .env.local
# edit .env.local → paste your key from https://console.mistral.ai/
```

### 3. Add video clips (optional)

Place short MP4 files (under 15 s) in `/public/videos/`:

```
public/videos/explaining.mp4
public/videos/directing.mp4
public/videos/playful.mp4
public/videos/greeting.mp4
public/videos/neutral.mp4
```

The app runs without them — just shows a black background.

### 4. Run

```bash
npm run dev
# open http://localhost:3000 in Chrome
```

> Speech recognition requires Chrome on desktop or Android.

---

## How it works

```
visitor speaks
     |
SpeechRecognition (browser)
     |
POST /api/chat ──────────────► Mistral AI (streaming SSE)
     |                               |
     |              ┌────────────────┘
     |              |  streams reply text
     |     ┌────────┴────────────┐
     |     ▼                     ▼
     | SpeechSynthesis    POST /api/select-video
     | (speaks reply)     (Mistral picks 1 digit)
     |                           |
     |                     plays video clip
     ▼
  back to idle
```

The chat stream and video selector run **in parallel** — reply is spoken and matching clip plays together.

---

## Customise the scene

Edit `lib/scene.ts` to change the character, knowledge, and video rules.

---

## Deploy to Vercel

1. Push to GitHub
2. Import repo at [vercel.com/new](https://vercel.com/new)
3. Add `MISTRAL_API_KEY` in Settings → Environment Variables
4. Deploy — HTTPS auto-provisioned

---

## Stack

| | |
|---|---|
| Framework | Next.js 14 (App Router) |
| LLM | Mistral AI `mistral-small-latest` |
| Voice in | Web Speech API `SpeechRecognition` |
| Voice out | Web Speech API `SpeechSynthesis` |
| Hosting | Vercel |

---

HBK Saar — Experimental Media Lab — AgentStage, May 2025
