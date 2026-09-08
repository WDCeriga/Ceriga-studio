// Smoke-test: system prompt + builder context block grounding.
// Usage: node scripts/test-openrouter-context.mjs
import fs from "node:fs";

const src = fs.readFileSync("src/app/lib/openrouterChat.ts", "utf8");
const knowledge = src.match(/const KNOWLEDGE = `(.*?)`;/s)[1];
const systemPrompt = src
  .match(/const SYSTEM_PROMPT = `(.*?)`;/s)[1]
  .replace("${KNOWLEDGE}", knowledge);

const contextBlock = `## The user's current project (most recently edited)
- Project name: Autumn Capsule FW26
- Garment: Hoodie
- Progress: 55% — currently on "Fabric & Colour"
- Fit: Oversized
- Fabric: French Terry
- Fabric weight: 380 gsm
- Colour(s): #2E2E32 (Pantone 19-4205)
- Neck/collar: Hood
- Sleeves: Raglan · Long
- Prints/artwork: 2 placed elements

When the user says "my project", "this garment", or asks a question that could
apply to what they are building, use the details above. Do not repeat the
summary back unless asked — just use it naturally in your answers.`;

const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${process.env.VITE_OPENROUTER_API_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model: "nvidia/nemotron-3.5-lightning:free",
    messages: [
      { role: "system", content: `${systemPrompt}\n\n${contextBlock}` },
      { role: "user", content: "Is the fabric I picked suitable for what I'm making? And what neck options do I have?" },
    ],
  }),
});

if (!res.ok) {
  console.error("HTTP", res.status, (await res.text()).slice(0, 200));
  process.exit(1);
}
const data = await res.json();
console.log("REPLY:", data.choices?.[0]?.message?.content ?? "(empty)");
