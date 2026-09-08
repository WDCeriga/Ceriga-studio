// Vision smoke test: sends a text+image turn like the panel does.
// Usage: node scripts/test-openrouter-vision.mjs
import fs from "node:fs";

const key = process.env.VITE_OPENROUTER_API_KEY;

// 64x64 solid red PNG with a white diagonal stripe — enough for a color check.
const pngBase64 =
  "iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAAKklEQVR4nO3BMQEAAADCoPVPbQlPoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAANAXQcAAGJQG0YAAAAAElFTkSuQmCC";
const dataUrl = `data:image/png;base64,${pngBase64}`;

const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
    stream: true,
    messages: [
      {
        role: "user",
        content: [
          { type: "image_url", image_url: { url: dataUrl } },
          { type: "text", text: "What color is this image? One short sentence." },
        ],
      },
    ],
  }),
});

console.log("HTTP", res.status);
if (!res.ok) {
  console.error((await res.text()).slice(0, 300));
  process.exit(1);
}

const reader = res.body.getReader();
const decoder = new TextDecoder();
let full = "";
for (;;) {
  const { done, value } = await reader.read();
  if (done) break;
  const text = decoder.decode(value, { stream: true });
  for (const line of text.split("\n")) {
    const l = line.trim();
    if (!l.startsWith("data:") || l === "data: [DONE]") continue;
    try {
      const delta = JSON.parse(l.slice(5)).choices?.[0]?.delta?.content;
      if (delta) full += delta;
    } catch {}
  }
}
console.log("REPLY:", full.trim() || "(empty)");
