const ELEVENLABS_API_KEY = process.argv[2];

(async () => {
  const res = await fetch("https://api.elevenlabs.io/v1/voices", {
    headers: { "xi-api-key": ELEVENLABS_API_KEY },
  });
  const { voices } = await res.json();
  console.log("\nVoices available on your account:\n");
  voices.forEach(v => console.log(`  ${v.name.padEnd(20)} → ID: ${v.voice_id}`));
})();
