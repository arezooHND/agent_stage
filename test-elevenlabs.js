const fs = require("fs");
const path = require("path");

const ELEVENLABS_API_KEY = process.argv[2];
const TEXT = process.argv[3] || "Welcome to HBK Saar! I'm Mira, your exhibition guide today. Feel free to ask me anything about the artworks or the artists.";

// "Sarah" — available on free plan
const VOICE_ID = "EXAVITQu4vr4xnSDxMaL";

if (!ELEVENLABS_API_KEY) {
  console.log("Usage: node test-elevenlabs.js YOUR_API_KEY \"optional text\"");
  process.exit(1);
}

(async () => {
  console.log("Generating audio with ElevenLabs...");
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`, {
    method: "POST",
    headers: {
      "xi-api-key": ELEVENLABS_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text: TEXT,
      model_id: "eleven_turbo_v2",
      voice_settings: { stability: 0.5, similarity_boost: 0.75 },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("Error:", err);
    process.exit(1);
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  const outPath = path.join(__dirname, "test-output.mp3");
  fs.writeFileSync(outPath, buffer);
  console.log(`✅ Saved to: ${outPath}`);
  console.log("Opening...");

  const { execSync } = require("child_process");
  execSync(`open "${outPath}"`);
})();
