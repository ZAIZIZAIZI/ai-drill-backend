import { callSlow } from "../llm/client.js";
import { questionPrompt } from "../llm/prompts.js";
import { extractJson } from "./utils.js";

// ③ 追问工位（慢模型）：三策略追问（核实/下钻/发散），上限 5 个
export async function generateQuestions({ inputText, research }) {
  const prompt = questionPrompt({ inputText, research });
  const { content } = await callSlow([{ role: "user", content: prompt }], 0.4);
  const data = extractJson(content);
  const list = Array.isArray(data.追问) ? data.追问 : [];
  // 规范字段，上限 5 个
  return list.slice(0, 5).map((q) => ({
    strategy: q.策略 || "下钻",
    question: q.问题 || String(q),
  }));
}
