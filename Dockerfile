# 使用輕量級 Node.js 基底映像
FROM node:20-alpine

# 建立工作目錄
WORKDIR /app

# 複製 package.json 與 lock 檔（讓快取生效）
COPY package*.json ./

# 安裝生產用依賴
RUN npm install --only=production

# 複製專案其餘程式
COPY . .

# 指定容器內部埠口（與 server.js 一致）
EXPOSE 8080

# 啟動伺服器
CMD ["node", "server.js"]
