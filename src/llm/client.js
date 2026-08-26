// DeepSeek 客户端封装：支持快模型（flash）和慢模型（pro）
// 快模型：动态注释（联想型任务）；慢模型：研判/追问/定稿/校验（推理型任务）

export const FAST_MODEL = "deepseek-v4-flash";
export const SLOW_MODEL = "deepseek-v4-pro";

async function callModel({ model, messages, temperature }) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  const baseUrl = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com";

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, messages, temperature }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`DeepSeek API 错误 (${res.status}): ${err}`);
  }

  const data = await res.json();
  const message = data.choices[0].message;
  return {
    content: message.content,
    reasoning: message.reasoning_content || "",
  };
}

// 快模型调用（动态注释等联想型任务）
export async function callFast(messages, temperature = 0.7) {
  return callModel({ model: FAST_MODEL, messages, temperature });
}

// 慢模型调用（研判/追问/定稿/校验等推理型任务）
export async function callSlow(messages, temperature = 0.3) {
  return callModel({ model: SLOW_MODEL, messages, temperature });
}

// 慢模型流式调用：逐段 yield 推理过程和正文，最终返回完整结果
export async function* callSlowStream(messages, temperature = 0.3) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  const baseUrl = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com";

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model: SLOW_MODEL, messages, temperature, stream: true }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`DeepSeek API 错误 (${res.status}): ${err}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";
  let reasoning = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop();
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const data = trimmed.slice(5).trim();
      if (data === "[DONE]") continue;
      try {
        const json = JSON.parse(data);
        const delta = json.choices?.[0]?.delta || {};
        if (delta.reasoning_content) {
          reasoning += delta.reasoning_content;
          yield { type: "reasoning", text: delta.reasoning_content };
        }
        if (delta.content) {
          content += delta.content;
          yield { type: "content", text: delta.content };
        }
      } catch {
        // 忽略不完整行
      }
    }
  }
  return { content, reasoning };
}
