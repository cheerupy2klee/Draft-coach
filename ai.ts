import type { Feedback } from "./assignment";
import { RESPONSE_SCHEMA } from "./prompt";

// 어떤 AI를 쓸지: Vercel에 넣은 키를 보고 자동으로 고릅니다.
// 순서: ANTHROPIC_API_KEY(Claude) → OPENAI_API_KEY(ChatGPT) → GEMINI_API_KEY(Gemini)
// 여러 개를 넣었다면 AI_PROVIDER=claude / openai / gemini 로 직접 고를 수 있어요.
type Provider = "claude" | "openai" | "gemini";
export function pickProvider(): { name: Provider; key: string } {
  const keys: Record<Provider, string | undefined> = {
    claude: process.env.ANTHROPIC_API_KEY,
    openai: process.env.OPENAI_API_KEY,
    gemini: process.env.GEMINI_API_KEY,
  };
  const forced = process.env.AI_PROVIDER?.toLowerCase() as Provider | undefined;
  if (forced && keys[forced]) return { name: forced, key: keys[forced]! };
  for (const name of ["claude", "openai", "gemini"] as Provider[]) {
    if (keys[name]) return { name, key: keys[name]! };
  }
  throw new Error("NO_KEY");
}

export async function callAI(system: string, user: string): Promise<Feedback | "DEMO"> {
  const p = pickProvider();
  if (p.key === "demo") return "DEMO";
  if (p.name === "claude") return callClaude(p.key, system, user);
  if (p.name === "openai") return callOpenAI(p.key, system, user);
  return callGemini(p.key, system, user);
}

// ───────── Claude (Anthropic) ─────────
// "give_feedback" 도구를 반드시 쓰게 해서 정해진 JSON 형식으로만 답하게 합니다.
async function callClaude(key: string, system: string, user: string): Promise<Feedback> {
  const model = process.env.ANTHROPIC_MODEL || "claude-haiku-5-5";
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 2000,
      system,
      messages: [{ role: "user", content: user }],
      tools: [
        {
          name: "give_feedback",
          description: "학생 초안에 대한 촉진적 피드백을 정해진 형식으로 전달합니다.",
          input_schema: toOpenAISchema(RESPONSE_SCHEMA),
        },
      ],
      tool_choice: { type: "tool", name: "give_feedback" },
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    console.error("Claude error", res.status, body);
    if (body.includes("credit balance")) throw new Error("NO_CREDIT");
    throw new Error(res.status === 429 || res.status === 529 ? "BUSY" : "AI_ERROR");
  }
  const data = await res.json();
  const block = data?.content?.find((b: { type: string }) => b.type === "tool_use");
  if (!block?.input) throw new Error("AI_ERROR");
  return block.input as Feedback;
}

// ───────── ChatGPT (OpenAI) ─────────
async function callOpenAI(key: string, system: string, user: string): Promise<Feedback> {
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: "feedback", strict: true, schema: toOpenAISchema(RESPONSE_SCHEMA) },
      },
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    console.error("OpenAI error", res.status, body);
    if (res.status === 429 && body.includes("insufficient_quota")) throw new Error("NO_CREDIT");
    throw new Error(res.status === 429 ? "BUSY" : "AI_ERROR");
  }
  const data = await res.json();
  const text: string | undefined = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error("AI_ERROR");
  return JSON.parse(text) as Feedback;
}

// Gemini식 스키마(대문자 type) → OpenAI strict 스키마(소문자, 모든 필드 필수, 추가 필드 금지)
type S = { type: string; properties?: Record<string, S>; items?: S; required?: string[] };
export function toOpenAISchema(s: S): Record<string, unknown> {
  const type = s.type.toLowerCase();
  if (type === "object") {
    const props = Object.fromEntries(Object.entries(s.properties ?? {}).map(([k, v]) => [k, toOpenAISchema(v)]));
    return { type, properties: props, required: Object.keys(props), additionalProperties: false };
  }
  if (type === "array") return { type, items: toOpenAISchema(s.items as S) };
  return { type };
}

// ───────── Gemini ─────────
async function callGemini(key: string, system: string, user: string): Promise<Feedback> {
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: user }] }],
        generationConfig: {
          temperature: 0.4,
          responseMimeType: "application/json",
          responseSchema: RESPONSE_SCHEMA,
        },
      }),
    }
  );
  if (!res.ok) {
    console.error("Gemini error", res.status, await res.text());
    throw new Error(res.status === 429 ? "BUSY" : "AI_ERROR");
  }
  const data = await res.json();
  const text: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("AI_ERROR");
  return JSON.parse(text) as Feedback;
}
