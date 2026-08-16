/**
 * 一键同步到腾讯云：本地构建 → 打包 → 上传 → 远程解压 → 重启 → 健康检查
 *
 * 用法（在项目根目录）：
 *   node deploy/cloud-sync.mjs                 # 完整同步（构建前端 + 打包 + 上传 + 远程重启）
 *   node deploy/cloud-sync.mjs --no-build      # 跳过本地前端构建（没改前端时）
 *   node deploy/cloud-sync.mjs --no-db         # 不同步本地数据库（云端数据独立）
 *   node deploy/cloud-sync.mjs --skip-install  # 远程跳过 npm install（依赖没变时）
 *
 * 前置条件（一次性）：
 *   1. 先按 DEPLOY.md 完成首次部署
 *   2. 配置 SSH 免密：本地生成密钥并把公钥加到服务器（见 DEPLOY.md「日常同步」）
 *   3. 填写 deploy/cloud-config.json 的 host / user
 */
import { execSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const configPath = path.join(root, 'deploy', 'cloud-config.json');
const zipPath = path.join(root, 'deploy', 'winfish.zip');

const args = process.argv.slice(2);
const opt = (flag) => args.includes(flag);
const noBuild = opt('--no-build');
const noDb = opt('--no-db');
const skipInstall = opt('--skip-install');

function sh(cmd, opts = {}) {
  console.log('>', cmd);
  execSync(cmd, { stdio: 'inherit', cwd: root, ...opts });
}
function shq(cmd, opts = {}) {
  const r = spawnSync(cmd, { shell: true, cwd: root, encoding: 'utf8', ...opts });
  if (r.status !== 0) throw new Error(`命令失败: ${cmd}\n${r.stderr || ''}`);
  return r.stdout.trim();
}

// ── 0. 读取云端配置 ──
if (!fs.existsSync(configPath)) {
  console.error('❌ 缺少 deploy/cloud-config.json，请先填写服务器信息');
  process.exit(1);
}
const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
if (!cfg.host || cfg.host.startsWith('你的')) {
  console.error('❌ cloud-config.json 里的 host 还没填，改成你的服务器 IP 或域名');
  process.exit(1);
}
const ssh = `${cfg.user}@${cfg.host}`;
const sshOpt = cfg.sshPort && cfg.sshPort !== 22 ? `-p ${cfg.sshPort}` : '';
console.log(`☁️ 同步目标: ${ssh} → ${cfg.remoteDir}`);

// ── 1. 本地构建前端 ──
if (!noBuild) {
  console.log('\n🔨 [1/5] 本地构建前端…');
  sh('cd frontend && npm run build');
} else {
  console.log('\n🔨 [1/5] 跳过前端构建（--no-build）');
}

// ── 2. 打包（含本地数据库；停服务避免 SQLite 锁） ──
console.log('\n📦 [2/5] 打包部署包…');
try { shq('pm2 stop winfish'); console.log('  本地服务已暂停（打包数据库）'); } catch { /* 本地未跑 pm2 也继续 */ }
try {
  const excludes = [
    '--exclude=node_modules', '--exclude=frontend/node_modules', '--exclude=frontend/dist',
    '--exclude=web', '--exclude=.env', '--exclude=deploy',
    '--exclude=data/dbg_*', '--exclude=data/debug_*', '--exclude=data/test_*',
    '--exclude=data/peek_*', '--exclude=data/seed_*', '--exclude=data/clear_*', '--exclude=data/warm_*',
  ];
  if (noDb) excludes.push('--exclude=data');
  if (fs.existsSync(zipPath)) fs.rmSync(zipPath);
  shq(`tar -a -cf "${zipPath}" ${excludes.join(' ')} .`);
  const size = (fs.statSync(zipPath).size / 1024 / 1024).toFixed(2);
  console.log(`  打包完成: winfish.zip ${size} MB`);
} finally {
  try { shq('pm2 restart winfish --update-env'); console.log('  本地服务已恢复'); } catch { /* ignore */ }
}

// ── 3. 上传到服务器 ──
console.log('\n⬆️  [3/5] 上传到服务器…');
shq(`scp ${sshOpt} "${zipPath}" ${ssh}:`); // 默认传到家目录

// ── 4. 远程解压 + 装依赖 + 重启 ──
console.log('\n🚀 [4/5] 远程部署中…');
let remoteCmd = `rm -rf ${cfg.remoteDir}/frontend/dist && unzip -o ~/winfish.zip -d ${cfg.remoteDir}`;
if (!skipInstall) {
  remoteCmd += ` && cd ${cfg.remoteDir} && npm install --omit=dev --silent`;
}
remoteCmd += ` && cd ${cfg.remoteDir}/frontend && npm install --silent`;
remoteCmd += ` && cd ${cfg.remoteDir} && (pm2 restart winfish --update-env || pm2 start server/index.js --name winfish)`;
console.log(`  远程: ${remoteCmd.slice(0, 120)}…`);
const out = shq(`ssh ${sshOpt} ${ssh} "${remoteCmd.replace(/"/g, '\\"')}"`, { timeout: 600000 });
console.log(out);

// ── 5. 健康检查 ──
console.log('\n✅ [5/5] 云端健康检查…');
const hc = shq(`ssh ${sshOpt} ${ssh} "sleep 4 && curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:7788/api/health || echo FAIL"`, { timeout: 60000 });
if (hc.includes('200')) {
  console.log(`✅ 同步成功！云端已更新并运行`);
  console.log(`  访问: http://${cfg.host}（或你的域名）`);
} else {
  console.error(`⚠️  健康检查未通过（HTTP ${hc}），请 SSH 查看: pm2 logs winfish`);
  process.exitCode = 1;
}
