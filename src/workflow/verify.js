import { callSlow } from "../llm/client.js";
import { verifyPrompt } from "../llm/prompts.js";
import { extractJson } from "./utils.js";

// ⑤ 校验工位（慢模型，挑刺）：角色线 + 合规线风险标注
export async function verify({ inputText, hypotheses }) {
  const prompt = verifyPrompt({ inputText, hypotheses });
  const { content } = await callSlow([{ role: "user", content: prompt }], 0.2);
  const data = extractJson(content);
  const list = Array.isArray(data.风险) ? data.风险 : [];
  return list.map((r) => ({
    hypothesis: r.假设 || "",
    type: r.类型 || "采纳",
    risk: r.风险 || "",
  }));
}
