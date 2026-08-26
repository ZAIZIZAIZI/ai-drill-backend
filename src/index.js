import "dotenv/config";
import express from "express";
import cors from "cors";
import { callFast, callSlow, callSlowStream, FAST_MODEL, SLOW_MODEL } from "./llm/client.js";
import { annotate } from "./workflow/annotate.js";
import { researchPrompt, questionPrompt, finalizePrompt, verifyPrompt } from "./llm/prompts.js";
import { formatInput, extractJson } from "./workflow/utils.js";

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;

app.get("/api/health", (req, res) => {
  res.json({ ok: true, fast: FAST_MODEL, slow: SLOW_MODEL });
});

// ① 动态注释（快模型）
app.post("/api/annotate", async (req, res) => {
  try {
    const { industry, question } = req.body || {};
    const examples = await annotate({ industry, question });
    res.json({ examples });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// SSE 工具：建立流式响应，返回 send 函数
function sse(res) {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  return (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);
}

// 跑一个慢模型工位：流式推送思考 + 返回解析结果
async function runStage(send, { stage, label, promptText, parse }) {
  send({ type: "stage", stage, label });
  let content = "";
  for await (const chunk of callSlowStream([{ role: "user", content: promptText }])) {
    if (chunk.type === "reasoning") send({ type: "reasoning", text: chunk.text });
    if (chunk.type === "content") content += chunk.text;
  }
  const result = parse(content);
  send({ type: "stage_done", stage, result });
  return result;
}

// 回合1（流式）：研判 → 追问
app.post("/api/drill/start", async (req, res) => {
  const send = sse(res);
  try {
    const input = req.body?.input || req.body || {};
    const inputText = formatInput(input);

    const research = await runStage(send, {
      stage: "research",
      label: "研判企业与行业，寻找机会方向",
      promptText: researchPrompt({ inputText }),
      parse: (content) => {
        const d = extractJson(content);
        return { gaps: d.缺口 || [], directions: d.候选方向 || [] };
      },
    });

    const questions = await runStage(send, {
      stage: "question",
      label: "生成追问问题",
      promptText: questionPrompt({ inputText, research }),
      parse: (content) => {
        const d = extractJson(content);
        return (d.追问 || []).slice(0, 5).map((q) => ({ strategy: q.策略 || "下钻", question: q.问题 || String(q) }));
      },
    });

    send({ type: "done", research, questions });
  } catch (e) {
    send({ type: "error", message: e.message });
  }
  res.end();
});

// 回合2（流式）：定稿 → 校验
app.post("/api/drill/finalize", async (req, res) => {
  const send = sse(res);
  try {
    const { input, research: researchResult, answers } = req.body || {};
    const inputText = formatInput(input);

    const finalizeResult = await runStage(send, {
      stage: "finalize",
      label: "生成 AI 机会假设",
      promptText: finalizePrompt({ inputText, answers, research: researchResult }),
      parse: (content) => {
        const d = extractJson(content);
        const list = (d.假设 || []).slice(0, 5).map((h) => ({
          category: h.分类 || "未分类",
          statement: h.陈述 || "",
          verify: Array.isArray(h.先验证) ? h.先验证 : [],
          tech: Array.isArray(h.技术路径) ? h.技术路径 : [],
        }));
        const g = d.维度图 || {};
        return {
          hypotheses: list,
          dimensionGraph: {
            business: Array.isArray(g.业务维度) ? g.业务维度 : [],
            abilities: Array.isArray(g.AI能力) ? g.AI能力 : [],
            links: Array.isArray(g.关联)
              ? g.关联.map((l) => ({ business: l.业务 || "", ability: l.AI || "", strength: l.强度 || "中" }))
              : [],
          },
        };
      },
    });

    const hypotheses = finalizeResult.hypotheses;
    const dimensionGraph = finalizeResult.dimensionGraph;

    const risks = await runStage(send, {
      stage: "verify",
      label: "质检假设的风险与红线",
      promptText: verifyPrompt({ inputText, hypotheses }),
      parse: (content) => {
        const d = extractJson(content);
        return (d.风险 || []).map((r) => ({ hypothesis: r.假设 || "", type: r.类型 || "采纳", risk: r.风险 || "" }));
      },
    });

    send({ type: "done", hypotheses, risks, dimensionGraph });
  } catch (e) {
    send({ type: "error", message: e.message });
  }
  res.end();
});

// 调试接口
app.post("/api/test/fast", async (req, res) => {
  try {
    const { text } = req.body || {};
    const msg = await callFast([{ role: "user", content: text || "你好" }]);
    res.json({ model: FAST_MODEL, content: msg.content, reasoning: msg.reasoning });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/test/slow", async (req, res) => {
  try {
    const { text } = req.body || {};
    const msg = await callSlow([{ role: "user", content: text || "你好" }]);
    res.json({ model: SLOW_MODEL, content: msg.content, reasoning: msg.reasoning });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, () => {
  console.log(`后端已启动: http://localhost:${PORT}`);
});
