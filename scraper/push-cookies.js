// push-cookies.js - 把本地 .profile 的抖音登录态(cookie)加密写入 GitHub Secret DOUYIN_COOKIES
// 用法:
//   node push-cookies.js <github_token> [owner/repo]
// 说明:
//   云端 CI 用该登录态抓取 (见 scrape-auto.js), 登录态过期后在本地重跑本命令即可续期
const path = require('path');
const sodium = require('libsodium-wrappers');
const { chromium } = require('playwright-core');

const PROFILE_DIR = path.join(__dirname, '.profile');
const REPO = process.argv[3] || 'chengc77/bianzhengfa';
const TOKEN = process.argv[2];

async function api(url, options) {
  const res = await fetch(url, options);
  return res;
}

(async () => {
  if (!TOKEN) {
    console.error('用法: node push-cookies.js <github_token> [owner/repo]');
    process.exit(1);
  }

  // 1. 从本地持久化配置提取 douyin cookies
  const browser = await chromium.launchPersistentContext(PROFILE_DIR, {
    channel: 'msedge',
    headless: true
  });
  const all = await browser.cookies('https://www.douyin.com');
  await browser.close();
  const cookies = all.filter(c => (c.domain || '').includes('douyin'));
  const hasLogin = cookies.some(c => c.name === 'sessionid' && c.value);
  if (!hasLogin) {
    console.error('本地无抖音登录态, 先运行: node scrape-auto.js login');
    process.exit(1);
  }
  const payload = Buffer.from(JSON.stringify(cookies), 'utf8').toString('base64');
  console.log(`已提取 ${cookies.length} 条 cookie, 含登录态 sessionid`);

  // 2. 取仓库公钥并 sealed-box 加密
  await sodium.ready;
  const h = { Authorization: 'token ' + TOKEN, Accept: 'application/vnd.github+json' };
  const res = await api(`https://api.github.com/repos/${REPO}/actions/secrets/public-key`, { headers: h });
  if (!res.ok) {
    console.error('获取公钥失败: HTTP ' + res.status + ' ' + (await res.text()).slice(0, 200));
    process.exit(1);
  }
  const { key, key_id } = await res.json();
  const enc = sodium.crypto_box_seal(Buffer.from(payload, 'utf8'), Buffer.from(key, 'base64'));

  // 3. 更新 secret
  const put = await api(`https://api.github.com/repos/${REPO}/actions/secrets/DOUYIN_COOKIES`, {
    method: 'PUT',
    headers: { ...h, 'Content-Type': 'application/json' },
    body: JSON.stringify({ encrypted_value: Buffer.from(enc).toString('base64'), key_id })
  });
  console.log(put.ok
    ? `DOUYIN_COOKIES 已写入 ${REPO} 的 GitHub Secrets`
    : '写入失败: HTTP ' + put.status + ' ' + (await put.text()).slice(0, 200));
  process.exitCode = put.ok ? 0 : 1;
})().catch(e => {
  console.error('异常: ' + (e && e.stack ? e.stack.split('\n')[0] : e));
  process.exit(1);
});
