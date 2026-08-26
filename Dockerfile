# 企业 AI 钻探工具 - 后端（Express + DeepSeek 慢模型 SSE 流式）
FROM node:20-alpine

WORKDIR /app

# 先拷贝依赖清单，利用 Docker 层缓存
COPY package.json package-lock.json ./
RUN npm install --omit=dev --registry=https://registry.npmmirror.com

# 拷贝源码
COPY src ./src

EXPOSE 3001
ENV PORT=3001

# 启动后端（dotenv 会自动读环境变量，key 由 Sealos 注入）
CMD ["node", "src/index.js"]
