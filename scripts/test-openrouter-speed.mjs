// Benchmark: reply length + latency with the tuned prompt.
import fs from "node:fs";

const src = fs.readFileSync("src/app/lib/openrouterChat.ts", "utf8");
const knowledge = src.match(/const KNOWLEDGE = `(.*?)`;/s)[1];
const systemPrompt = src
  .match(/const SYSTEM_PROMPT = `(.*?)`;/s)[1]
  .replace("${KNOWLEDGE}", knowledge);

const questions = [
  "How much does a tech pack cost?",
  "What fabrics can I use for a hoodie?",
  "How do I download my tech pack?",
  "What is packaging-only mode?",
];

let totalMs = 0;
let totalWords = 0;

for (const q of questions) {
  const t0 = Date.now();
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.VITE_OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "nvidia/nemotron-3-super-120b-a12b:free",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: q },
      ],
    }),
  });
  if (!res.ok) {
    console.log(`HTTP ${res.status} for "${q}"`);
    continue;
  }
  const data = await res.json();
  const ms = Date.now() - t0;
  const text = data.choices?.[0]?.message?.content?.trim() ?? "";
  const words = text.split(/\s+/).filter(Boolean).length;
  totalMs += ms;
  totalWords += words;
  console.log(`[${(ms / 1000).toFixed(1)}s | ${words}w] ${q}\n  → ${text.slice(0, 140)}\n`);
}

console.log(`AVG: ${(totalMs / questions.length / 1000).toFixed(1)}s, ${(totalWords / questions.length).toFixed(0)} words`);
