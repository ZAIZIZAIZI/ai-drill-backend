// 完整主链路测试脚本（牙科案例）
const base = "http://localhost:3001";

const input = {
  industry: "口腔医疗（民营门诊）",
  scale: "15人",
  business: "专为儿童牙齿矫正项目为主的口腔诊所",
  need: "客户的转化率不高，客户流失率太高了",
  earn: "儿童儿牙矫正（主打项目）",
  efficiency: "谈客户的时间，维护客户太占用时间和人力了",
  data: ["客户资料", "销售记录", "客服记录"],
  system: ["第三方病历管理工具"],
};

async function main() {
  // 回合1：研判 + 追问
  const r1 = await fetch(`${base}/api/drill/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ input }),
  }).then((r) => r.json());

  console.log("=== 回合1：研判 + 追问 ===");
  console.log("候选方向:", r1.research?.directions);
  console.log("追问:");
  (r1.questions || []).forEach((q) => console.log(`  [${q.strategy}] ${q.question}`));

  // 模拟老板回答
  const answers = [
    "1. 记录分散在表格里，查客户为什么没来要翻好几个表",
    "2. 通常来回3-4轮，最耗时是方案讲解家长听不懂，和回家商量后没下文",
    "3. 主要是咨询师维护，一个客户月花1-2小时",
    "4. 最想抓住首诊后没成交的，花了广告费",
    "5. 先让家长更容易听懂方案",
  ].join("\n");

  // 回合2：定稿 + 校验
  const r2 = await fetch(`${base}/api/drill/finalize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ input, research: r1.research, answers }),
  }).then((r) => r.json());

  console.log("\n=== 回合2：定稿 + 校验 ===");
  console.log("假设:");
  (r2.hypotheses || []).forEach((h, i) => {
    console.log(`\n假设${i + 1} [${h.category}]: ${h.statement}`);
    console.log(`  先验证: ${(h.verify || []).join(" | ")}`);
    console.log(`  技术路径: ${(h.tech || []).join("、")}`);
  });
  console.log("\n风险标注:");
  (r2.risks || []).forEach((r) => console.log(`  [${r.type}] ${r.hypothesis}: ${r.risk}`));
}

main().catch((e) => {
  console.error("测试失败:", e.message);
  process.exit(1);
});
