import { callSlow } from "../llm/client.js";
import { finalizePrompt } from "../llm/prompts.js";
import { extractJson } from "./utils.js";

// ④ 定稿工位（慢模型）：产出 3-5 条可证伪假设 + 维度关联图
export async function finalize({ inputText, answers, research }) {
  const prompt = finalizePrompt({ inputText, answers, research });
  const { content } = await callSlow([{ role: "user", content: prompt }], 0.3);
  const data = extractJson(content);
  const list = Array.isArray(data.假设) ? data.假设 : [];
  const hypotheses = list.slice(0, 5).map((h) => ({
    category: h.分类 || "未分类",
    statement: h.陈述 || "",
    verify: Array.isArray(h.先验证) ? h.先验证 : [],
    tech: Array.isArray(h.技术路径) ? h.技术路径 : [],
  }));

  // 维度关联图（星座图素材）
  const graph = data.维度图 || {};
  const dimensionGraph = {
    business: Array.isArray(graph.业务维度) ? graph.业务维度 : [],
    abilities: Array.isArray(graph.AI能力) ? graph.AI能力 : [],
    links: Array.isArray(graph.关联)
      ? graph.关联.map((l) => ({ business: l.业务 || "", ability: l.AI || "", strength: l.强度 || "中" }))
      : [],
  };

  return { hypotheses, dimensionGraph };
}
