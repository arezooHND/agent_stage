# AgentStage

AgentStage is an AI-powered platform for creating interactive voice-driven digital characters for exhibitions, museums, events, campaigns, and public installations.

Visitors can speak naturally with a character, receive AI-generated responses in real time, and watch synchronized video performances that bring the interaction to life.

Built with Next.js, Mistral AI, Supabase, and the Web Speech API.

---

## Features

### Visitor Experience

- Voice-based conversations with AI characters
- Real-time speech-to-text transcription
- Streaming AI responses powered by Mistral AI
- Text-to-speech playback in the browser
- Dynamic video selection based on character responses
- Mobile-friendly push-to-talk interface
- Idle mode designed to attract visitor engagement

### Creator Dashboard

- Create and manage multiple characters
- Define character personalities and system prompts
- Upload and organize video clips
- Configure scene-specific knowledge and behavior
- Manage exhibition experiences without modifying code

### Database & Content Management

- Supabase-backed data storage
- Scene and character persistence
- Video metadata management
- Centralized configuration for deployments
- Scalable architecture supporting multiple projects and installations

---

## Architecture

```text
Visitor
   │
   ▼
Speech Recognition
   │
   ▼
Next.js Application
   │
   ├── Chat API ─────────► Mistral AI
   │                         │
   │                         ▼
   │                 Streaming Response
   │
   ├── Video Selection API
   │
   └── Supabase Database
           │
           ├── Scenes
           ├── Characters
           └── Video Assets
```

The chat response generation and video selection processes run in parallel, allowing spoken dialogue and visual performance to remain synchronized.

---

## Tech Stack

| Category           | Technology           |
| ------------------ | -------------------- |
| Framework          | Next.js (App Router) |
| Language           | TypeScript           |
| AI Model           | Mistral AI           |
| Database           | Supabase             |
| Authentication     | Supabase Auth        |
| Speech Recognition | Web Speech API       |
| Speech Synthesis   | Web Speech API       |
| Styling            | Tailwind CSS         |
| Deployment         | Vercel               |

---

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/YOUR_USERNAME/agentstage.git
cd agentstage
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a `.env.local` file:

```env
MISTRAL_API_KEY=your_mistral_api_key

NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### 4. Run the development server

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

---

## Project Structure

```text
app/
├── api/
├── creator/
├── dashboard/
└── page.tsx

components/
├── creator/
├── character/
└── ui/

lib/
├── supabase/
├── ai/
└── utilities/

public/
└── videos/
```

---

Developed at HBK Saar - Summer Semester 2026.
