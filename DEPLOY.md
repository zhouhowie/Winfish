# 知行 Winfish · 腾讯云部署指南

盘中操作 + 盘后复盘交互看板。前后端一体：Node.js (Express) + React + SQLite 持久化。

## 一、本地开发（当前已在跑）

```bash
# 后端（端口 7788）
cd F:\Hanako Workplace\trading-desk
npm start            # node server/index.js

# 前端（构建产物由后端直接托管）
cd frontend
npm install
npm run build        # 构建到 frontend/dist
```

访问 http://localhost:7788

## 二、部署到腾讯云（轻量应用服务器 2核2G 够用）

### 1. 服务器准备
- 系统选 **Ubuntu 22.04 LTS**（或 24.04）
- 控制台 → 防火墙/安全组：放行 **80 / 443** 端口

### 2. 安装 Node.js（需要 22.5+，推荐 24，内置 SQLite 免编译）
```bash
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt-get install -y nodejs git nginx
node -v   # 应为 v24.x
```

### 3. 上传代码（推荐打包 zip 单文件上传）
本机 `F:\Hanako Workplace\trading-desk\deploy\fishwin-desk.zip`（已排除 node_modules/dist/.env）：
- 方式A：腾讯云控制台 → 轻量服务器 → 文件（上传到 /root 或 /home/ubuntu）
- 方式B：scp（本机 PowerShell）
  ```powershell
  scp "F:\Hanako Workplace\trading-desk\deploy\fishwin-desk.zip" ubuntu@<服务器IP>:/tmp/
  ```

服务器解压：
```bash
sudo apt-get install -y unzip
sudo mkdir -p /opt/trading-desk
sudo unzip /tmp/fishwin-desk.zip -d /opt/trading-desk
sudo chown -R $USER /opt/trading-desk
```

### 4. 安装依赖 + 构建前端
```bash
cd /opt/trading-desk
npm install --omit=dev
cd frontend && npm install && npm run build && cd ..
```

### 5. 配置密钥（从本地 .env 复制）
```bash
nano /opt/trading-desk/.env
```
填入（与本地 `F:\Hanako Workplace\trading-desk\.env` 相同）：
```
TUSHARE_TOKEN=你的_tushare_token
WUDAO_MCP_URL=https://stock.quicktiny.cn/api/mcp
WUDAO_TOKEN=你的_wudao_token
PORT=7788
```

### 6. PM2 守护进程
```bash
sudo npm install -g pm2
cd /opt/trading-desk
pm2 start server/index.js --name winfish
pm2 save
pm2 startup            # 按输出提示执行那行 sudo 命令（开机自启）
```

### 7. Nginx 反代（域名访问）
把 `server_name` 换成你的域名：
```bash
sudo tee /etc/nginx/sites-available/winfish > /dev/null <<'EOF'
server {
    listen 80;
    server_name 你的域名.com;

    location / {
        proxy_pass http://127.0.0.1:7788;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_http_version 1.1;
        proxy_read_timeout 60s;
    }
}
EOF
sudo ln -s /etc/nginx/sites-available/winfish /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

之后浏览器访问 `http://你的域名` 即可。

### 8. HTTPS（强烈建议，一次配置长期生效）
1. 腾讯云控制台 → SSL 证书 → 免费申请（域名型 DV，自动签发）
2. 下载 Nginx 版证书 → 上传到服务器 `/etc/nginx/ssl/`
3. Nginx 配置 443：
```nginx
server {
    listen 443 ssl;
    server_name 你的域名.com;
    ssl_certificate     /etc/nginx/ssl/你的域名_bundle.crt;
    ssl_certificate_key /etc/nginx/ssl/你的域名.key;

    location / {
        proxy_pass http://127.0.0.1:7788;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
server {
    listen 80;
    server_name 你的域名.com;
    return 301 https://$host$request_uri;
}
```

## 三、日常同步（改完代码一键上云）

首次部署完成后，以后每次本地改完代码，一条命令即可同步到云端。

### 1. 一次性配置：SSH 免密登录（只需一次）

本地 PowerShell 执行：
```powershell
# 生成密钥（如果 ~/.ssh 还没有 id_rsa）
ssh-keygen -t rsa -b 4096

# 把公钥复制到服务器（会提示输一次服务器密码）
ssh-copy-id ubuntu@你的服务器IP
```
如果 `ssh-copy-id` 不可用，手动方式：本地执行 `type $env:USERPROFILE\.ssh\id_rsa.pub` 复制输出，然后 SSH 登录服务器执行 `nano ~/.ssh/authorized_keys` 粘贴保存。

验证：`ssh ubuntu@你的服务器IP` 能直接登录（不输密码）即成功。

### 2. 填写服务器信息
编辑 `deploy/cloud-config.json`：
```json
{
  "host": "你的服务器IP或域名",
  "user": "ubuntu",
  "remoteDir": "/opt/trading-desk",
  "sshPort": 22
}
```

### 3. 一键同步
```powershell
cd "F:\Hanako Workplace\trading-desk"
npm run deploy:cloud
```
脚本自动：本地构建前端 → 打包（含预案/持仓等数据库）→ 上传 → 远程解压 → 装依赖 → 重启 → 健康检查。

常用选项：
```powershell
npm run deploy:cloud -- --no-build      # 没改前端代码时跳过构建
npm run deploy:cloud -- --no-db         # 不想覆盖云端数据库时
npm run deploy:cloud -- --skip-install  # 依赖没变时跳过远程 npm install
```

之后在 Hanako 对话里说「同步到云端」，公明也会直接执行这条同步。

## 四、云端运行说明

云端与本地共用同一套代码与数据库结构。本地 SQLite（data/desk.db）中的盘前预案/持仓/复盘归档等自定义数据，部署时会随包一起带上；之后云端与本地各自维护，如需同步可再做一个推送脚本。

## 五、定时任务（后端内置）
- 盘中 9:15-11:35 / 12:55-15:05：核心数据每小时整点刷新到缓存
- 9:10 盘前预热、15:10 盘后自动拉收盘数据 + 历史连板缓存预热
- 前端自动轮询更新，无需手动刷新

## 六、常用运维命令
```bash
pm2 logs winfish     # 看日志
pm2 restart winfish  # 重启
pm2 status           # 状态
pm2 monit            # 资源监控
```
