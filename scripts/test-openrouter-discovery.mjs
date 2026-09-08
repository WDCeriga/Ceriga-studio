// Smoke-test: runtime model discovery → resolved chain for text and vision.
import fs from "node:fs";

const key = process.env.VITE_OPENROUTER_API_KEY;

const res = await fetch("https://openrouter.ai/api/v1/models", {
  headers: { Authorization: `Bearer ${key}` },
});
const { data } = await res.json();

const EXCLUDE = /rerank|embed|safety|tts|transcribe|whisper|moderation|inkling/i;
const PREFERRED = [
  "nvidia/nemotron-3.5-lightning:free",
  "nvidia/nemotron-3-super-120b-a12b:free",
  "poolside/laguna-s-2.1:free",
  "google/gemma-4-31b-it:free",
  "liquid/lfm-2.5-2.6b:free",
];

function usable(m, needsVision) {
  if (!m.id.endsWith(":free")) return false;
  if (EXCLUDE.test(m.id)) return false;
  const inputs = m.architecture?.input_modalities ?? ["text"];
  const outputs = m.architecture?.output_modalities ?? ["text"];
  if (!inputs.includes("text") || !outputs.includes("text")) return false;
  if (needsVision && !inputs.includes("image")) return false;
  return true;
}

function resolve(needsVision) {
  const cat = data.filter((m) => usable(m, needsVision));
  const ids = new Set(cat.map((m) => m.id));
  const ordered = [];
  const push = (id) => { if (ids.has(id) && !ordered.includes(id)) ordered.push(id); };
  for (const id of PREFERRED) push(id);
  if (needsVision) {
    for (const m of cat.filter((m) => m.architecture?.input_modalities?.includes("image"))) push(m.id);
  }
  for (const m of [...cat].filter((m) => !ordered.includes(m.id)).sort((a, b) => (b.created ?? 0) - (a.created ?? 0))) push(m.id);
  return ordered;
}

const text = resolve(false);
const vision = resolve(true);
console.log(`TEXT chain (${text.length}):`, text.slice(0, 8).join(" → "));
console.log(`VISION chain (${vision.length}):`, vision.slice(0, 8).join(" → "));

// Sanity: try the first text model end-to-end
const first = text[0];
const chat = await fetch("https://openrouter.ai/api/v1/chat/completions", {
  method: "POST",
  headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
  body: JSON.stringify({ model: first, messages: [{ role: "user", content: "Reply with the single word: ok" }] }),
});
console.log(`First model ${first} → HTTP ${chat.status}`);
