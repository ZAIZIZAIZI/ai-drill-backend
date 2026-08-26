// 从模型输出中容错提取 JSON（处理 markdown 代码块、前后杂字等情况）
export function extractJson(text) {
  let t = String(text).trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    t = t.slice(start, end + 1);
  }
  try {
    return JSON.parse(t);
  } catch (e) {
    throw new Error(`JSON 解析失败: ${e.message}\n原始输出前 500 字:\n${String(text).slice(0, 500)}`);
  }
}

// 把输入对象格式化成可读文本（供各工位 prompt 使用）
export function formatInput(input) {
  const lines = [];
  const add = (label, value) => {
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      lines.push(`${label}：${value}`);
    }
  };
  add("行业", input.industry);
  add("企业规模", input.scale);
  add("主营业务", input.business);
  add("最想解决的事", input.need);
  add("靠什么赚钱", input.earn);
  add("开销最大想省", input.cost);
  add("最慢最拖后腿", input.efficiency);
  add("最担心失控", input.risk);
  add("最乱最靠人的环节", input.breakpoint);
  add("数据留存", Array.isArray(input.data) ? input.data.join("、") : input.data);
  add("系统工具", Array.isArray(input.system) ? input.system.join("、") : input.system);
  return lines.join("\n") || "（信息较少，仅行业等基础信息）";
}
