// Smoke-test the real system prompt against OpenRouter. Run: node scripts/test-openrouter.mjs [question]
import fs from "node:fs";

const src = fs.readFileSync("src/app/lib/openrouterChat.ts", "utf8");
const knowledge = src.match(/const KNOWLEDGE = `(.*?)`;/s)[1];
const systemPrompt = src
  .match(/const SYSTEM_PROMPT = `(.*?)`;/s)[1]
  .replace("${KNOWLEDGE}", knowledge);

console.log("system prompt length:", systemPrompt.length, "| has Scale plan:", systemPrompt.includes("Scale"));

const question = process.argv[2] ?? "How much is a tech pack and what do I get with the Scale AI chat plan?";

const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${process.env.VITE_OPENROUTER_API_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model: "nvidia/nemotron-3.5-lightning:free",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: question },
    ],
  }),
});

if (!res.ok) {
  console.error("HTTP", res.status, (await res.text()).slice(0, 300));
  process.exit(1);
}

const data = await res.json();
console.log("REPLY:", data.choices?.[0]?.message?.content ?? "(empty)");
