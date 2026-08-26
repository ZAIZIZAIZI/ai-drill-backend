import { callFast } from "../llm/client.js";
import { annotatePrompt } from "../llm/prompts.js";

// ① 动态注释工位（快模型）：根据行业为问题生成简短举例
export async function annotate({ industry, question }) {
  const prompt = annotatePrompt({ industry, question });
  const { content } = await callFast([{ role: "user", content: prompt }], 0.9);
  // 清洗：去掉换行、序号、多余空白
  const cleaned = content
    .replace(/\d+[.、)]/g, "")
    .replace(/[\n\r]+/g, "、")
    .replace(/[，,]+/g, "、")
    .replace(/[。.]/g, "、")
    .split("、")
    .map((s) => s.trim())
    .filter((s) => s.length >= 2 && s.length <= 20)
    .slice(0, 5);
  return cleaned.length ? cleaned : [content.trim()];
}
