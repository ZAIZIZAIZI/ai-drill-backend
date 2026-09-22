// 飞书多维表格同步：把钻探结果写入「钻探器数据」表
// 环境变量：FEISHU_APP_ID / FEISHU_APP_SECRET / FEISHU_BASE_TOKEN / FEISHU_TABLE_ID
// 失败时静默降级（返回 null），不影响钻探主流程。

const FEISHU_APP_ID = process.env.FEISHU_APP_ID;
const FEISHU_APP_SECRET = process.env.FEISHU_APP_SECRET;
const FEISHU_BASE_TOKEN = process.env.FEISHU_BASE_TOKEN;
const FEISHU_TABLE_ID = process.env.FEISHU_TABLE_ID;

let cachedToken = null;
let tokenExpireAt = 0;

// 获取 tenant_access_token（缓存约 2 小时，提前 1 分钟刷新）
async function getTenantAccessToken() {
  const now = Date.now();
  if (cachedToken && now < tokenExpireAt - 60_000) return cachedToken;

  const res = await fetch("https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ app_id: FEISHU_APP_ID, app_secret: FEISHU_APP_SECRET }),
  });
  const data = await res.json();
  if (data.code !== 0) throw new Error(`飞书 token 获取失败: ${data.msg}`);
  cachedToken = data.tenant_access_token;
  tokenExpireAt = now + data.expire * 1000;
  return cachedToken;
}

// 把钻探结果压平成飞书字段
function flattenResult({ input = {}, research = null, answers = "", hypotheses = [], risks = [], dimensionGraph = null }) {
  const biz = String(input.business || "").trim();
  const scale = String(input.scale || "").trim();

  // 企业概况：主营业务 + 规模
  const profile = [biz, scale].filter(Boolean).join("｜");

  // AI 主要结论：第一条假设的陈述
  const mainConclusion = (hypotheses[0]?.statement || "").trim();

  // 机会分类：去重合并
  const categories = [...new Set(hypotheses.map((h) => h.category).filter(Boolean))].join("、");

  // 风险提示
  const riskText = (risks || [])
    .map((r) => `[${r.type || "采纳"}] ${r.hypothesis || ""}：${r.risk || ""}`)
    .join("\n");

  // 完整结果兜底（JSON）
  const fullResult = JSON.stringify({ input, research, answers, hypotheses, risks, dimensionGraph });

  return {
    企业概况: profile,
    行业: String(input.industry || "").trim(),
    核心问题: String(input.need || "").trim(),
    追问与回答: String(answers || "").trim(),
    "AI 主要结论": mainConclusion,
    机会分类: categories,
    假设总数: hypotheses.length,
    风险提示: riskText,
    钻探时间: Date.now(), // 毫秒时间戳，飞书 datetime 字段
    完整结果: fullResult,
  };
}

// 写入一条记录到飞书多维表格；成功返回 record_id，失败返回 null
export async function syncToFeishu(payload) {
  if (!FEISHU_APP_ID || !FEISHU_APP_SECRET || !FEISHU_BASE_TOKEN || !FEISHU_TABLE_ID) {
    console.warn("[飞书同步] 未配置飞书环境变量，跳过同步");
    return null;
  }
  try {
    const token = await getTenantAccessToken();
    const fields = flattenResult(payload);
    const res = await fetch(
      `https://open.feishu.cn/open-apis/bitable/v1/apps/${FEISHU_BASE_TOKEN}/tables/${FEISHU_TABLE_ID}/records`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ fields }),
      }
    );
    const data = await res.json();
    if (data.code !== 0) throw new Error(`飞书写入失败: ${data.msg}`);
    console.log(`[飞书同步] 已写入记录 ${data.data?.record?.record_id}`);
    return data.data?.record?.record_id || null;
  } catch (e) {
    console.error("[飞书同步失败]", e.message);
    return null;
  }
}
