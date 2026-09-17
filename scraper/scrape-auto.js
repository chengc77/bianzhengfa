// scrape-auto.js - 辩证法交易 站点自动抓取
// 用法:
//   node scrape-auto.js login   首次运行:打开 Edge 窗口登录抖音, 登录态存入 .profile (仅本地)
//   node scrape-auto.js         定时运行:抓取最新视频(文案+评论+作者回复)追加进网站数据
// 环境:
//   本地 Windows: playwright-core + Edge + .profile 登录态
//   GitHub Actions (CI): 完整版 playwright 自带 chromium + 未登录抓公开内容
const fs = require('fs');
const path = require('path');

const IS_CI = !!(process.env.GITHUB_ACTIONS || process.env.CI);
const { chromium } = require(IS_CI ? 'playwright' : 'playwright-core');

const ROOT = path.resolve(__dirname, '..');
const SITE_DATA = path.join(ROOT, 'site', 'data');
const URLS_FILE = path.join(SITE_DATA, 'video-urls.json');
const AUTO_JSON = path.join(SITE_DATA, 'videos-auto.json');
const AUTO_JS = path.join(SITE_DATA, 'videos-auto.js');
const PROFILE_DIR = path.join(__dirname, '.profile');
const LOG_FILE = path.join(__dirname, 'scrape.log');

const USER_URL = 'https://www.douyin.com/user/MS4wLjABAAAAK713M9d8PGNb_WiMYf7yKhOI5y60H4uELJK2guDjJT0';
const SCROLL_ROUNDS = 4;      // 主页滚动轮数(加载最新视频)
const MAX_NEW_PER_RUN = 30;   // 单次最多抓取新视频数
const COMMENT_SCROLLS = 3;    // 评论区滚动次数(多加载一些评论)

const sleep = ms => new Promise(r => setTimeout(r, ms));

function log(msg) {
  const line = `[${new Date().toLocaleString('zh-CN')}] ${msg}`;
  console.log(line);
  fs.appendFileSync(LOG_FILE, line + '\n');
}

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return fallback; }
}

// 与网站同一套评论解析逻辑
function parseComment(t) {
  const di = t.indexOf('...');
  const user = di >= 0 ? t.slice(0, di) : '';
  const rest = di >= 0 ? t.slice(di + 3) : t;
  const re = /(\d+(?:秒|分钟|小时|天|周|月|年)前)·([\u4e00-\u9fa5]+|海外|未知)/;
  const m = rest.match(re);
  const mIdx = rest.search(re);
  const time = m ? m[1] : '';
  const location = m ? m[2] : '';
  const content = mIdx >= 0 ? rest.slice(0, mIdx).trim() : rest;
  const afterMatch = mIdx >= 0 ? rest.slice(mIdx + (m ? m[0].length : 0)).trim() : '';
  const subIdx = afterMatch.lastIndexOf('展开');
  let subReplies = 0;
  if (subIdx >= 0) {
    const sm = afterMatch.slice(subIdx + 2).trim().match(/(\d+)/);
    if (sm) subReplies = parseInt(sm[1], 10);
  }
  return { user, content, time, location, shares: 0, subReplies };
}

async function isLoggedIn(browser) {
  const cookies = await browser.cookies('https://www.douyin.com');
  return cookies.some(c => c.name === 'sessionid' && c.value);
}

// CI 无 Edge/无登录态: 用 playwright 自带 chromium + 全新上下文
// 统一暴露 pages/newPage/cookies/close, 与 launchPersistentContext 用法一致
async function openScrapeBrowser() {
  if (IS_CI) {
    const b = await chromium.launch({
      headless: true,
      args: ['--disable-blink-features=AutomationControlled', '--no-sandbox']
    });
    const ctx = await b.newContext({
      viewport: { width: 1400, height: 900 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      locale: 'zh-CN'
    });
    return {
      pages: () => ctx.pages(),
      newPage: () => ctx.newPage(),
      cookies: url => ctx.cookies(url),
      close: () => b.close()
    };
  }
  return chromium.launchPersistentContext(PROFILE_DIR, {
    channel: 'msedge',
    headless: true,
    viewport: { width: 1400, height: 900 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    args: ['--disable-blink-features=AutomationControlled']
  });
}

// 未登录时抖音常弹登录框, 尽力关闭以免影响页面交互
async function dismissLoginPopup(page) {
  for (const sel of ['.dy-account-close', '[data-e2e="login-close"]']) {
    try {
      const el = await page.$(sel);
      if (el) {
        await el.click({ timeout: 2000 });
        await sleep(800);
        log('已关闭登录弹窗');
        return;
      }
    } catch (e) { /* 忽略, 换下一个选择器 */ }
  }
}

// ---------- 登录模式 ----------
async function loginMode() {
  if (IS_CI) {
    log('CI 云端环境无桌面浏览器, 不支持登录模式 (云端以未登录状态抓公开内容)。');
    process.exitCode = 1;
    return;
  }
  const browser = await chromium.launchPersistentContext(PROFILE_DIR, {
    channel: 'msedge',
    headless: false,
    viewport: { width: 1400, height: 900 },
    args: ['--disable-blink-features=AutomationControlled']
  });
  const page = browser.pages()[0] || await browser.newPage();
  await page.goto('https://www.douyin.com/', { waitUntil: 'domcontentloaded' });
  log('登录窗口已打开, 请在浏览器里登录抖音 (扫码/验证码), 登录成功后自动继续...');
  for (let i = 0; i < 100; i++) { // 最多等 5 分钟
    await sleep(3000);
    if (await isLoggedIn(browser)) {
      log('已检测到登录成功, 登录态已保存到本地, 5 秒后关闭窗口。');
      await sleep(5000);
      await browser.close();
      return;
    }
  }
  log('等待登录超时(5分钟), 退出。可重新运行 node scrape-auto.js login');
  await browser.close();
  process.exitCode = 1;
}

// ---------- 抓取模式 ----------
async function scrapeMode() {
  const known = new Set(readJson(URLS_FILE, []).map(u => (u.match(/(\d{15,})/) || [])[0]).filter(Boolean));
  const autoStore = readJson(AUTO_JSON, []);
  autoStore.forEach(v => known.add(v.id));

  const browser = await openScrapeBrowser();
  const page = browser.pages()[0] || await browser.newPage();

  try {
    // 1. 打开主页, 滚动加载最新视频列表
    await page.goto(USER_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await sleep(4000);

    const logged = await isLoggedIn(browser);
    log(`主页已打开, 登录态: ${logged ? '有' : '无(未登录也能看公开视频)'}`);
    if (!logged) await dismissLoginPopup(page);

    let ids = [];
    for (let r = 0; r < SCROLL_ROUNDS; r++) {
      ids = await page.evaluate(() => {
        const out = [];
        // 只取"作品"列表容器里的链接, 避免混入推荐流里别人的视频
        document.querySelectorAll('[data-e2e="user-post-list"] a[href*="/video/"]').forEach(a => {
          const m = a.getAttribute('href').match(/\/video\/(\d+)/);
          if (m) out.push(m[1]);
        });
        return out;
      });
      const before = ids.length;
      await page.evaluate(() => window.scrollBy(0, 2400));
      await sleep(2500);
      log(`滚动第 ${r + 1} 轮: 作品列表发现 ${ids.length} 个视频`);
      if (r > 0 && ids.length === before) break;
    }
    ids = [...new Set(ids)];
    if (!ids.length) {
      // 兜底: 未登录/风控时 DOM 结构可能不同, 全页面找视频链接 (后续有作者校验兜底防误抓)
      ids = await page.evaluate(() => {
        const out = [];
        document.querySelectorAll('a[href*="/video/"]').forEach(a => {
          const m = a.getAttribute('href').match(/\/video\/(\d+)/);
          if (m) out.push(m[1]);
        });
        return out;
      });
      ids = [...new Set(ids)];
      if (!ids.length) {
        const diag = await page.evaluate(() => ({
          url: location.href,
          title: document.title,
          videoLinks: document.querySelectorAll('a[href*="/video/"]').length,
          e2eNodes: document.querySelectorAll('[data-e2e]').length,
          body: document.body ? document.body.innerText.replace(/\s+/g, ' ').slice(0, 260) : ''
        }));
        log(`诊断: url=${diag.url} | title=${diag.title} | videoLinks=${diag.videoLinks} | e2eNodes=${diag.e2eNodes}`);
        log(`诊断 body: ${diag.body}`);
      }
    }
    const newIds = ids.filter(id => !known.has(id)).slice(0, MAX_NEW_PER_RUN);
    log(`共 ${ids.length} 个链接, 其中新视频 ${newIds.length} 个: ${newIds.join(', ') || '(无)'}`);

    if (!newIds.length) {
      log('没有新视频, 任务结束。');
      return;
    }

    // 2. 逐个访问新视频, 抓文案+发布时间+评论
    const results = [];
    for (const id of newIds) {
      const url = 'https://www.douyin.com/video/' + id;
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await sleep(3500);
        await dismissLoginPopup(page);

        // 滚动评论区加载更多
        for (let c = 0; c < COMMENT_SCROLLS; c++) {
          await page.evaluate(() => {
            const list = document.querySelector('[data-e2e=comment-list]');
            if (list) list.scrollBy(0, 1600);
            else window.scrollBy(0, 1200);
          });
          await sleep(1500);
        }

        const data = await page.evaluate(() => {
          const SEC = 'MS4wLjABAAAAK713M9d8PGNb_WiMYf7yKhOI5y60H4uELJK2guDjJT0';
          const descEl = document.querySelector('div.desc');
          const pubEl = document.querySelector('[data-e2e=detail-video-publish-time]');
          const items = document.querySelectorAll('[data-e2e=comment-item]');
          const comments = [];
          for (const it of items) comments.push(it.textContent.replace(/\s+/g, ' ').trim());
          // 校验视频作者: 页面非评论区处存在指向博主主页的链接才算博主的视频
          let isAuthor = false;
          document.querySelectorAll('a[href*="' + SEC + '"]').forEach(a => {
            if (!a.closest('[data-e2e=comment-list]')) isAuthor = true;
          });
          return {
            isAuthor,
            desc: descEl ? descEl.textContent.trim() : '',
            pubTime: pubEl ? pubEl.textContent.trim() : '',
            comments
          };
        });

        if (!data.isAuthor) {
          log(`跳过 ${id}: 不是博主的作品(推荐流混入)`);
          continue;
        }

        results.push({
          id,
          url,
          desc: data.desc,
          publishTime: data.pubTime.replace('发布时间：', ''),
          comments: data.comments.map(parseComment)
        });
        log(`已抓取 ${id}: 评论 ${data.comments.length} 条`);
      } catch (e) {
        log(`抓取失败 ${id}: ${e.message.slice(0, 120)}`);
      }
    }

    if (!results.length) {
      log('本次没有成功抓取任何视频, 不写入数据。');
      return;
    }

    // 3. 写入数据: auto json 按时间倒序合并, 再生成 js
    const merged = [...results, ...autoStore];
    const seen = new Set();
    const uniq = merged.filter(v => (v.id && !seen.has(v.id)) ? (seen.add(v.id), true) : false);
    uniq.sort((a, b) => String(b.publishTime || '').localeCompare(String(a.publishTime || '')));

    fs.writeFileSync(AUTO_JSON, JSON.stringify(uniq, null, 1), 'utf8');
    const js = '// videos-auto.js - 自动抓取的新视频(由 scraper/scrape-auto.js 生成, 勿手改)\n'
      + 'window.MOXING_VIDEOS = window.MOXING_VIDEOS.concat(' + JSON.stringify(uniq) + ');\n';
    fs.writeFileSync(AUTO_JS, js, 'utf8');

    // 4. 更新 video-urls.json (新 id 插到最前, 保持去重)
    const raw = readJson(URLS_FILE, []);
    const rawIds = new Set(raw.map(u => (u.match(/(\d{15,})/) || [])[0]).filter(Boolean));
    const addUrls = results.map(r => '/video/' + r.id).filter(u => !rawIds.has(u.match(/\d+/)[0]));
    fs.writeFileSync(URLS_FILE, JSON.stringify([...addUrls, ...raw], null, 2), 'utf8');

    log(`完成: 新增 ${results.length} 条视频, 存档共 ${uniq.length} 条。`);
  } finally {
    await browser.close();
  }
}

(async () => {
  try {
    if (process.argv.includes('login')) await loginMode();
    else await scrapeMode();
  } catch (e) {
    log('任务异常: ' + (e && e.stack ? e.stack.split('\n')[0] : e));
    process.exitCode = 1;
  }
})();
