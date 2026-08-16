import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';
import { resolve } from './settings.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, '..');
export const DATA_DIR = path.join(ROOT, 'data');

export const config = {
  port: Number(process.env.PORT || 7788),
  tushare: {
    token: resolve('tushareToken'),
    apiUrl: 'https://api.tushare.pro',
  },
  wudao: {
    url: resolve('wudaoUrl'),
    token: resolve('wudaoToken'),
  },
  tdxhub: {
    url: resolve('tdxhubUrl'),
  },
  wendaBase: 'https://www.tdx.com.cn/wenda/api/tools',
  paths: {
    db: path.join(DATA_DIR, 'desk.db'),
    cache: path.join(DATA_DIR, 'cache'),
  },
};
