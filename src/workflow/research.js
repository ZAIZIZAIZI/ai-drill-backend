import { callSlow } from "../llm/client.js";
import { researchPrompt } from "../llm/prompts.js";
import { extractJson } from "./utils.js";

// ② 研判工位（慢模型）：判定缺口 + 初判候选方向
export async function research({ inputText }) {
  const prompt = researchPrompt({ inputText });
  const { content } = await callSlow([{ role: "user", content: prompt }], 0.3);
  const data = extractJson(content);
  return {
    gaps: Array.isArray(data.缺口) ? data.缺口 : [],
    directions: Array.isArray(data.候选方向) ? data.候选方向 : [],
  };
}
