/**
 * VideoClip — represents one video file the character can play
 *
 * index: the number Mistral returns to select this clip (1, 2, 3...)
 * url:   path to the MP4 file, either local (/videos/clip.mp4) or remote (https://...)
 * label: human-readable name shown in the creator dashboard
 */
export interface VideoClip {
  index: number;
  url: string;
  label: string;
}

/**
 * Scene — the complete configuration for one AgentStage experience
 *
 * name:            internal label for the creator, not shown to visitors
 * characterName:   displayed on screen above the mic button
 * systemPrompt:    sent to Mistral as the "system" message — defines the character's
 *                  personality, knowledge, and speaking style
 * idleMessage:     text shown (and optionally spoken) before the visitor says anything
 * selectionPrompt: rules the LLM uses to pick which video clip matches a given reply
 * videos:          list of VideoClip objects — one entry per MP4 file
 */
export interface Scene {
  name: string;
  characterName: string;
  systemPrompt: string;
  idleMessage: string;
  selectionPrompt: string;
  videos: VideoClip[];
}

// ─── Prototype scene ──────────────────────────────────────────────────────────
// This is the hardcoded scene used during the prototype phase.
// In production, this object would be fetched from Supabase by scene slug,
// allowing any creator to publish their own scene at a unique URL.

export const scene: Scene = {
  // Internal name — used as the slug base when generating share URLs
  name: "HBK Exhibition Guide",

  // Shown on the consumer screen above the mic button
  characterName: "Mira",

  // Displayed before the visitor speaks for the first time
  idleMessage: "Hi! Ask me anything about the exhibition.",

  // Sent to Mistral as the first message (role: "system")
  // This shapes every reply — keep it focused and concise
  systemPrompt: `You are Mira, a friendly and knowledgeable guide at HBK Saar, the art and design college in Saarbrücken, Germany.
You help visitors understand the artworks, find their way around, and learn about the students and faculty.
Keep every reply to two or three short sentences — this is a voice conversation.
Be warm, curious, and enthusiastic about art.`,

  // Sent to the selector LLM along with the bot's reply
  // Must return ONLY a single digit — no other text
  // One bullet per video clip — be specific to avoid mis-fires
  selectionPrompt: `Read the chatbot reply below, then pick the best video from this list.
Reply with ONLY a single number — nothing else.

1 = explaining an artwork, material, or artistic concept
2 = giving directions or practical information
3 = something playful, funny, or light-hearted
4 = greeting, farewell, or welcoming a visitor
5 = anything else / general talking`,

  // Each entry maps a clip index to an MP4 file
  // Files live in /public/videos/ — served statically by Next.js
  // The index must match the numbers used in selectionPrompt above
  videos: [
    { index: 1, url: "/videos/explaining.mp4", label: "Explaining" }, // artwork/concept explanations
    { index: 2, url: "/videos/directing.mp4",  label: "Directing" },  // pointing, giving directions
    { index: 3, url: "/videos/playful.mp4",    label: "Playful" },    // laughing, light-hearted
    { index: 4, url: "/videos/greeting.mp4",   label: "Greeting" },   // waving, welcoming
    { index: 5, url: "/videos/neutral.mp4",    label: "Neutral" },    // default fallback
  ],
};
