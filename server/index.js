/**
 * trading-desk 服务入口
 * Express + 静态托管前端（web/dist）+ REST API
 */
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { config, ROOT } from './config.js';
import apiRouter from './routes/api.js';
import { startScheduler } from './scheduler.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (req, res) => res.json({ ok: true, ts: Date.now() }));
app.use('/api', apiRouter);

// 静态托管前端构建产物（优先 React 版 frontend/dist，回退 Vue 版 web/dist）
const frontDist = path.join(ROOT, 'frontend', 'dist');
const webDist = path.join(ROOT, 'web', 'dist');
const serveDist = fs.existsSync(frontDist) ? frontDist : webDist;
if (serveDist) {
  app.use(express.static(serveDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(serveDist, 'index.html'));
  });
  console.log('[web] 托管前端产物:', serveDist);
} else {
  app.get('/', (req, res) => {
    res.type('html').send(`<h1>trading-desk</h1><p>API 正常。前端尚未构建，先访问 <a href="/api/health">/api/health</a> 或 <a href="/api/market/summary">/api/market/summary</a>。</p>`);
  });
}

startScheduler();

app.listen(config.port, () => {
  console.log(`trading-desk 已启动 → http://localhost:${config.port}`);
});
