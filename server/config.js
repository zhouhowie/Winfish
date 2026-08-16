import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, '..');
export const DATA_DIR = path.join(ROOT, 'data');

export const config = {
  port: Number(process.env.PORT || 7788),
  tushare: {
    token: process.env.TUSHARE_TOKEN || '',
    apiUrl: 'https://api.tushare.pro',
  },
  wudao: {
    url: process.env.WUDAO_MCP_URL || '',
    token: process.env.WUDAO_TOKEN || '',
  },
  tdxhub: {
    url: process.env.TDXHUB_URL || 'http://tdxhub.icfqs.com:7615/TQLEX',
  },
  wendaBase: 'https://www.tdx.com.cn/wenda/api/tools',
  paths: {
    db: path.join(DATA_DIR, 'desk.db'),
    cache: path.join(DATA_DIR, 'cache'),
  },
};
