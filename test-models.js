const question = process.argv[2] || "What kind of art can I find at HBK Saar?";
const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY || require("fs").readFileSync(".env.local", "utf8").match(/MISTRAL_API_KEY=(.+)/)?.[1]?.trim();

const models = ["mistral-large-latest", "open-mistral-nemo"];

async function askModel(model, question) {
  const start = Date.now();
  const res = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${MISTRAL_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 80,
      messages: [
        { role: "system", content: "You are Mira, a friendly guide for Media Informatics students at HBK Saar in Saarbrücken. Keep every reply to ONE or TWO short sentences maximum. Never use lists or bullet points." },
        { role: "user", content: question },
      ],
    }),
  });
  const data = await res.json();
  const elapsed = Date.now() - start;
  return { answer: data.choices?.[0]?.message?.content ?? "No response", ms: elapsed };
}

(async () => {
  console.log(`\nQuestion: "${question}"\n${"─".repeat(60)}`);
  for (const model of models) {
    process.stdout.write(`\n⏳ Asking ${model}...`);
    const { answer, ms } = await askModel(model, question);
    console.log(`\r\n=== ${model} (${ms}ms) ===\n${answer}\n`);
  }
})();
