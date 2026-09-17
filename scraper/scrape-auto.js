// scrape-auto.js - 辩证法交易 站点自动抓取
// 用法:
//   node scrape-auto.js login   首次运行:打开 Edge 窗口登录抖音, 登录态存入 .profile (仅本地)
//   node scrape-auto.js         定时运行:抓取最新视频(文案+评论+作者回复)追加进网站数据
// 环境:
//   本地 Windows: playwright-core + Edge + .profile 登录态
//   GitHub Actions (CI): 完整版 playwright 自带 chromium + 未登录抓公开内容
const fs = require('fs');
const path = require('path');

const IS_CI = !!process.env.GITHUB_ACTIONS;  // 只认 GitHub Actions, 避免沙箱 CI 变量误判
const { chromium } = require(IS_CI ? 'playwright' : 'playwright-core');

const ROOT = path.resolve(__dirname, '..');
const SITE_DATA = path.join(ROOT, 'site', 'data');
const URLS_FILE = path.join(SITE_DATA, 'video-urls.json');
const AUTO_JSON = path.join(SITE_DATA, 'videos-auto.json');
const AUTO_JS = path.join(SITE_DATA, 'videos-auto.js');
const STATUS_JSON = path.join(SITE_DATA, 'video-status.json');
const STATUS_JS = path.join(SITE_DATA, 'video-status.js');
const CODES_JSON = path.join(SITE_DATA, 'video-codes.json');
const CODES_JS = path.join(SITE_DATA, 'video-codes.js');
const TRANS_QUEUE = path.join(SITE_DATA, 'transcript-queue.json');
const PROFILE_DIR = path.join(__dirname, '.profile');
const LOG_FILE = path.join(__dirname, 'scrape.log');

const USER_URL = 'https://www.douyin.com/user/MS4wLjABAAAAK713M9d8PGNb_WiMYf7yKhOI5y60H4uELJK2guDjJT0';
const SEC_UID = 'MS4wLjABAAAAK713M9d8PGNb_WiMYf7yKhOI5y60H4uELJK2guDjJT0';
const SHARE_URL = 'https://www.iesdouyin.com/share/user/' + SEC_UID;
const MOBILE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const SCROLL_ROUNDS = 4;      // 主页滚动轮数(加载最新视频)
const MAX_NEW_PER_RUN = 30;   // 单次最多抓取新视频数
const COMMENT_SCROLLS = 3;    // 评论区滚动次数(多加载一些评论)
const DELETE_CHECK_N = 12;    // 每轮轮换检测多少条存量视频(删除检测+转录直链刷新)
const CODE_START = 1001;      // 视频短编号起始值

const sleep = ms => new Promise(r => setTimeout(r, ms));

function log(msg) {
  const line = `[${new Date().toLocaleString('zh-CN')}] ${msg}`;
  console.log(line);
  fs.appendFileSync(LOG_FILE, line + '\n');
}

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return fallback; }
}

// 与网站同一套评论解析逻辑(旧格式兼容, 用于旧数据)
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
  return { user, content, time, location, shares: 0, subReplies: 0 };
}

// Unix 时间戳 -> 相对时间(与抖音显示一致)
function formatTime(ts) {
  if (!ts) return '';
  const diff = Date.now() / 1000 - ts;
  if (diff < 60) return Math.max(1, Math.floor(diff)) + '秒前';
  if (diff < 3600) return Math.floor(diff / 60) + '分钟前';
  if (diff < 86400) return Math.floor(diff / 3600) + '小时前';
  if (diff < 604800) return Math.floor(diff / 86400) + '天前';
  if (diff < 2592000) return Math.floor(diff / 604800) + '周前';
  if (diff < 31536000) return Math.floor(diff / 2592000) + '月前';
  return Math.floor(diff / 31536000) + '年前';
}

// 从 API JSON 提取一条评论(主评论或子回复通用)
function extractComment(c) {
  const isAuthor = c.user && c.user.sec_uid === SEC_UID;
  return {
    user: c.user ? c.user.nickname : '',
    content: c.text || '',
    time: formatTime(c.create_time),
    location: c.ip_label || '',
    likes: c.digg_count || 0,
    isAuthor,
    authorDigged: !!c.is_author_digged,  // 博主点赞过这条评论
    replies: []
  };
}

// 从 aweme/detail JSON 提取: 删除状态/最低码率直链/AI 章节
function extractDetail(d) {
  if (!d) return null;
  const st = d.status || {};
  const v = d.video || {};
  // 选最低码率档位(转录只需要音轨, 省带宽)
  let playUrl = '';
  const gears = (v.bit_rate || []).filter(g => g.play_addr && g.play_addr.url_list && g.play_addr.url_list[0]);
  if (gears.length) {
    gears.sort((a, b) => (a.bit_rate || 0) - (b.bit_rate || 0));
    playUrl = gears[0].play_addr.url_list[0];
  } else if (v.play_addr && v.play_addr.url_list && v.play_addr.url_list[0]) {
    playUrl = v.play_addr.url_list[0];
  }
  // AI 章节: chapter_list[0].chapters = [{content, start_time, end_time}]
  let chapters = [];
  try {
    const raw = (d.chapter_list && d.chapter_list[0] && d.chapter_list[0].chapters) || [];
    chapters = raw.map(ch => ({
      title: ch.content || ch.title || '',
      start: ch.start_time || 0
    })).filter(ch => ch.title);
  } catch (e) { /* 忽略 */ }
  return {
    deleted: !!(st.is_delete || st.is_prohibited),
    prohibited: !!st.is_prohibited,
    subtitled: !!d.is_subtitled,
    playUrl,
    chapters
  };
}

// 扫描站点所有视频数据文件, 按 id 升序(≈发布时间序)分配稳定短编号
// 输出 video-codes.json {map:{id:code}} + video-codes.js (前端)
function rebuildVideoCodes() {
  const prev = readJson(CODES_JSON, { map: {} });
  const idSet = new Set();
  // 自动抓取存档
  for (const v of readJson(AUTO_JSON, [])) { if (v.id) idSet.add(String(v.id)); }
  // 首批手动数据(videos.js + videos-batch*.js), 解析其中的数组字面量
  // 兼容严格 JSON(键带引号) 与 JS 对象字面量(键无引号, 仅解析本站自有可信数据)
  const parseArray = (s) => { try { return JSON.parse(s); } catch (e) { return new Function('return ' + s)(); } };
  for (const name of fs.readdirSync(SITE_DATA)) {
    if (!/^videos(-batch\d+)?\.js$/.test(name)) continue;
    try {
      const txt = fs.readFileSync(path.join(SITE_DATA, name), 'utf8');
      const m = txt.match(/(\[[\s\S]*\])\s*\)?\s*;?\s*$/);
      if (m) for (const v of parseArray(m[1])) { if (v.id) idSet.add(String(v.id)); }
    } catch (e) { /* 单个文件解析失败不影响 */ }
  }
  // 已分配编号优先保留(稳定), 新 id 按序追加
  const map = {};
  const used = new Set();
  for (const [id, code] of Object.entries(prev.map || {})) {
    if (idSet.has(id)) { map[id] = code; used.add(code); }
  }
  let next = CODE_START;
  [...idSet].sort().forEach(id => {
    if (map[id]) return;
    while (used.has(next)) next++;
    map[id] = next; used.add(next); next++;
  });
  fs.writeFileSync(CODES_JSON, JSON.stringify({ map }, null, 1), 'utf8');
  fs.writeFileSync(CODES_JS, '// video-codes.js - 视频短编号映射(自动生成, 勿手改)\nwindow.MOXING_CODES = ' + JSON.stringify(map) + ';\n', 'utf8');
  return map;
}

// 删除状态写入 json + js
function writeVideoStatus(statusMap) {
  fs.writeFileSync(STATUS_JSON, JSON.stringify(statusMap, null, 1), 'utf8');
  fs.writeFileSync(STATUS_JS, '// video-status.js - 视频删除/封禁状态(自动生成, 勿手改)\nwindow.MOXING_STATUS = ' + JSON.stringify(statusMap) + ';\n', 'utf8');
}

// 从拦截到的 API 数据构建结构化评论树(主评论 + 嵌套子回复)
function buildCommentTree(mainList, replyList) {
  const replyMap = new Map(); // root_comment_id -> replies[]
  for (const r of replyList) {
    const root = r.root_comment_id || r.reply_id;
    if (!replyMap.has(root)) replyMap.set(root, []);
    replyMap.get(root).push(r);
  }
  return mainList.map(c => {
    const cm = extractComment(c);
    const replies = (replyMap.get(c.cid) || []).map(extractComment);
    cm.replies = replies;
    cm.subReplies = replies.length;
    return cm;
  });
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
      locale: 'zh-CN',
      timezoneId: 'Asia/Shanghai',
      extraHTTPHeaders: { 'Accept-Language': 'zh-CN,zh;q=0.9' }
    });
    // 注入登录态 (GitHub Secret DOUYIN_COOKIES, 由本地 scraper/push-cookies.js 生成更新)
    if (process.env.DOUYIN_COOKIES) {
      try {
        const cookies = JSON.parse(Buffer.from(process.env.DOUYIN_COOKIES, 'base64').toString('utf8'));
        await ctx.addCookies(cookies);
        log(`已注入登录态 cookie ${cookies.length} 条`);
      } catch (e) {
        log('注入 cookie 失败: ' + (e && e.message ? e.message.slice(0, 100) : e));
      }
    }
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
    await sleep(IS_CI ? 8000 : 4000);

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
      if (r > 0 && ids.length === before && ids.length > 0) break;
    }
    ids = [...new Set(ids)];
    if (!ids.length) {
      // 诊断: 登录/风控异常时页面形态不明, dump 关键信息定位
      const diag = await page.evaluate(() => ({
        url: location.href,
        title: document.title,
        videoLinks: document.querySelectorAll('a[href*="/video/"]').length,
        e2eNodes: document.querySelectorAll('[data-e2e]').length,
        postList: !!document.querySelector('[data-e2e="user-post-list"]'),
        body: document.body ? document.body.innerText.replace(/\s+/g, ' ').slice(0, 300) : ''
      }));
      log(`诊断: url=${diag.url} | title=${diag.title} | videoLinks=${diag.videoLinks} | e2eNodes=${diag.e2eNodes} | postList=${diag.postList}`);
      log(`诊断 body: ${diag.body}`);
      // 兜底1: 移动分享页 + 拦截 reflow API(无签名 GET 接口)拿作品列表, 临时切手机 UA
      try {
        const cdp = await page.context().newCDPSession(page);
        await cdp.send('Emulation.setUserAgentOverride', { userAgent: MOBILE_UA });
        const posts = [];
        const onResponse = async resp => {
          try {
            if (!resp.url().includes('/web/api/v2/aweme/post/')) return;
            const j = await resp.json();
            for (const a of (j.aweme_list || j.post_list || [])) {
              const id = a.aweme_id || a.awemeId || a.aweme_id_str;
              if (id) posts.push(String(id));
            }
          } catch (e) { /* 忽略非 JSON 响应 */ }
        };
        page.on('response', onResponse);
        await page.goto(SHARE_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await sleep(8000);
        for (let i = 0; i < 3; i++) {
          await page.evaluate(() => window.scrollBy(0, 2000));
          await sleep(2000);
        }
        page.off('response', onResponse);
        await cdp.send('Emulation.clearUserAgentOverride').catch(() => {});
        ids = [...new Set(posts)];
        log(`分享页 reflow API: 发现 ${ids.length} 个作品 id`);
      } catch (e) {
        log('分享页失败: ' + (e && e.message ? e.message.slice(0, 100) : e));
      }
    }
    if (!ids.length) {
      // 兜底2: 页面任意位置找视频链接 (后续有作者校验兜底防误抓)
      ids = await page.evaluate(() => {
        const out = [];
        document.querySelectorAll('a[href*="/video/"]').forEach(a => {
          const m = a.getAttribute('href').match(/\/video\/(\d+)/);
          if (m) out.push(m[1]);
        });
        return out;
      });
      ids = [...new Set(ids)];
    }
    const newIds = ids.filter(id => !known.has(id)).slice(0, MAX_NEW_PER_RUN);
    log(`共 ${ids.length} 个链接, 其中新视频 ${newIds.length} 个: ${newIds.join(', ') || '(无)'}`);

    const statusMap = readJson(STATUS_JSON, {});
    const transQueue = []; // 本轮拿到新鲜直链、待转录的视频
    const results = [];

    if (newIds.length) {
    // 2. 逐个访问新视频, 抓文案+发布时间+评论(通过 API 拦截)
    for (const id of newIds) {
      const url = 'https://www.douyin.com/video/' + id;
      try {
        // 拦截评论 API + 视频详情 API
        const mainComments = [];
        const replyComments = [];
        let detailInfo = null;
        const onResp = async resp => {
          const u = resp.url();
          try {
            if (u.includes('/comment/list')) {
              const j = await resp.json();
              if (!j.comments) return;
              if (u.includes('/reply/')) {
                replyComments.push(...j.comments);
                log(`  子回复 API: ${j.comments.length} 条, has_more=${j.has_more}`);
              } else {
                mainComments.push(...j.comments);
              }
            } else if (u.includes('/aweme/v1/web/aweme/detail')) {
              const j = await resp.json();
              if (j.aweme_detail) detailInfo = extractDetail(j.aweme_detail);
            }
          } catch (e) { /* 非 JSON 响应, 忽略 */ }
        };
        page.on('response', onResp);

        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await sleep(IS_CI ? 5000 : 3500);
        await dismissLoginPopup(page);

        // 滚动评论区加载更多主评论
        for (let c = 0; c < COMMENT_SCROLLS; c++) {
          await page.evaluate(() => {
            const list = document.querySelector('[data-e2e=comment-list]');
            if (list) list.scrollBy(0, 1600);
            else window.scrollBy(0, 1200);
          });
          await sleep(1500);
        }

        // 展开有子回复的评论, 触发子回复 API (作者回复常在此)
        const expandBtns = await page.locator('[data-e2e=comment-item] button').all();
        let expanded = 0;
        for (const btn of expandBtns) {
          const txt = (await btn.textContent().catch(() => '')).trim();
          if (txt.includes('展开') && txt.includes('回复')) {
            await btn.click({ timeout: 5000 }).catch(() => {});
            await sleep(2500);
            expanded++;
            if (expanded >= 10) break; // 限制展开数避免太慢
          }
        }
        if (expanded) log(`  展开了 ${expanded} 条评论的子回复`);

        page.off('response', onResp);

        const data = await page.evaluate((secUid) => {
          const descEl = document.querySelector('div.desc');
          const pubEl = document.querySelector('[data-e2e=detail-video-publish-time]');
          let isAuthor = false;
          document.querySelectorAll('a[href*="' + secUid + '"]').forEach(a => {
            if (!a.closest('[data-e2e=comment-list]')) isAuthor = true;
          });
          return {
            isAuthor,
            desc: descEl ? descEl.textContent.trim() : '',
            pubTime: pubEl ? pubEl.textContent.trim() : ''
          };
        }, SEC_UID);

        if (!data.isAuthor) {
          log(`跳过 ${id}: 不是博主的作品(推荐流混入)`);
          continue;
        }

        // 从 API 数据构建结构化评论树(含作者回复 isAuthor 标记)
        let comments;
        if (mainComments.length > 0) {
          comments = buildCommentTree(mainComments, replyComments);
          const authorReplies = comments.reduce((s, c) => s + (c.replies || []).filter(r => r.isAuthor).length, 0);
          log(`已抓取 ${id}: 主评论 ${mainComments.length} 条, 子回复 ${replyComments.length} 条, 作者回复 ${authorReplies} 条`);
        } else {
          // API 拦截失败时退回 DOM 解析
          const rawTexts = await page.evaluate(() => {
            const items = document.querySelectorAll('[data-e2e=comment-item]');
            return [...items].map(it => it.textContent.replace(/\s+/g, ' ').trim());
          });
          comments = rawTexts.map(parseComment);
          log(`已抓取 ${id}: DOM 解析 ${comments.length} 条评论(API 拦截失败)`);
        }

        // 记录删除/封禁状态(只有拿到明确 detail 才写, 风控失败不误判)
        if (detailInfo) {
          statusMap[id] = { deleted: detailInfo.deleted, prohibited: detailInfo.prohibited, at: new Date().toISOString().slice(0, 10) };
        }

        results.push({
          id, url,
          desc: data.desc,
          publishTime: data.pubTime.replace('发布时间：', ''),
          chapters: detailInfo ? detailInfo.chapters : [],
          comments
        });
        // 有新鲜直链 → 入转录队列(没有转录稿的才需要)
        if (detailInfo && detailInfo.playUrl) {
          transQueue.push({ id, url: detailInfo.playUrl, subtitled: detailInfo.subtitled });
        }
      } catch (e) {
        log(`抓取失败 ${id}: ${e.message.slice(0, 120)}`);
      }
    }
    } // end if (newIds.length)

    // 3. 写入数据: auto json 按时间倒序合并, 再生成 js
    if (results.length) {
      const merged = [...results, ...autoStore];
      const seen = new Set();
      const uniq = merged.filter(v => (v.id && !seen.has(v.id)) ? (seen.add(v.id), true) : false);
      uniq.sort((a, b) => String(b.publishTime || '').localeCompare(String(a.publishTime || '')));

      fs.writeFileSync(AUTO_JSON, JSON.stringify(uniq, null, 1), 'utf8');
      const js = '// videos-auto.js - 视频统一存档(由 scraper/scrape-auto.js 生成, 勿手改)\n'
        + 'window.MOXING_VIDEOS = (window.MOXING_VIDEOS || []).concat(' + JSON.stringify(uniq) + ');\n';
      fs.writeFileSync(AUTO_JS, js, 'utf8');

      // 更新 video-urls.json (新 id 插到最前, 保持去重)
      const raw = readJson(URLS_FILE, []);
      const rawIds = new Set(raw.map(u => (u.match(/(\d{15,})/) || [])[0]).filter(Boolean));
      const addUrls = results.map(r => '/video/' + r.id).filter(u => !rawIds.has(u.match(/\d+/)[0]));
      fs.writeFileSync(URLS_FILE, JSON.stringify([...addUrls, ...raw], null, 2), 'utf8');

      log(`完成: 新增 ${results.length} 条视频, 存档共 ${uniq.length} 条。`);
    } else {
      log('本轮无新视频入库。');
    }

    // 4. 删除追踪: 每轮选最久未检测的 N 条(删除的永久跳过), 顺带刷新转录直链
    const storeNow = readJson(AUTO_JSON, []);
    const candidates = storeNow
      .map(v => ({ v, t: (statusMap[String(v.id)] || {}).checkedAt || (statusMap[String(v.id)] || {}).at || '' }))
      .filter(o => o.v.id && !(statusMap[String(o.v.id)] || {}).deleted)
      .sort((a, b) => a.t.localeCompare(b.t))
      .slice(0, DELETE_CHECK_N)
      .map(o => o.v);
    if (candidates.length) {
      log(`删除检测: 抽查 ${candidates.length} 条存量视频...`);
      let deletedFound = 0;
      for (const v of candidates) {
        let detailInfo = null;
        const onResp2 = async resp => {
          if (!resp.url().includes('/aweme/v1/web/aweme/detail')) return;
          try {
            const j = await resp.json();
            if (j.aweme_detail) detailInfo = extractDetail(j.aweme_detail);
          } catch (e) {}
        };
        page.on('response', onResp2);
        try {
          await page.goto('https://www.douyin.com/video/' + v.id, { waitUntil: 'domcontentloaded', timeout: 45000 });
          await sleep(IS_CI ? 4000 : 2500);
        } catch (e) { /* 单条失败忽略 */ }
        page.off('response', onResp2);
        if (detailInfo) {
          const sid = String(v.id);
          const prev = statusMap[sid] || {};
          if (detailInfo.deleted && !prev.deleted) {
            statusMap[sid] = { deleted: true, prohibited: detailInfo.prohibited, at: new Date().toISOString().slice(0, 10) };
            deletedFound++;
            log(`  ⚠ 视频 ${sid} 已${detailInfo.prohibited ? '封禁' : '删除'}`);
          } else if (!detailInfo.deleted) {
            statusMap[sid] = Object.assign({}, prev, { deleted: false, checkedAt: new Date().toISOString().slice(0, 10) });
          }
          // 缺转录稿 + 拿到新鲜直链 → 补入转录队列
          if (detailInfo.playUrl && !v.transcript && !transQueue.some(q => q.id === v.id)) {
            transQueue.push({ id: v.id, url: detailInfo.playUrl, subtitled: detailInfo.subtitled });
          }
        }
      }
      log(`删除检测完成: 新发现删除/封禁 ${deletedFound} 条。`);
    }

    // 5. 写删除状态 + 重建短编号 + 转录队列
    writeVideoStatus(statusMap);
    const codeMap = rebuildVideoCodes();
    fs.writeFileSync(TRANS_QUEUE, JSON.stringify(transQueue, null, 1), 'utf8');
    log(`编号映射 ${Object.keys(codeMap).length} 条; 转录队列 ${transQueue.length} 条。`);
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
