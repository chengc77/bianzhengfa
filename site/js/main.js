// main.js - 渲染主内容、左栏导航、右栏金句、滚动同步高亮

(function () {
  "use strict";
  const C = window.MOXING_CONTENT;
  const CHAP_MARKS = ["R", "I", "A1", "A2", "E", "B"];

  function el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }

  function esc(s) {
    return String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  }

  // ====== 顶部 Header ======
  function renderHeader() {
    const h = document.getElementById("site-header");
    const m = C.meta;
    const tags = m.tags.map(t => `<span class="tag">${esc(t)}</span>`).join("");
    h.innerHTML = `
      <div class="stamp">辩证法<br>交易</div>
      <h1>${esc(m.title)}</h1>
      <div class="subtitle">${esc(m.subtitle)}</div>
      <div class="meta">
        <div><span class="label">来源：</span>${esc(m.source)}</div>
        <div style="margin-top:4px"><span class="label">范围：</span>${esc(m.source_scope)}</div>
      </div>
      <div class="tags">${tags}</div>
    `;
  }

  // ====== 左栏 导航 ======
  function renderSidebar() {
    const nav = document.getElementById("sidebar-nav");
    let html = `<div class="nav-title">章节导航</div>`;
    const sections = [
      { id: "r", label: "R · 原话与观点" },
      { id: "i", label: "I · 方法论骨架", subs: ["道 · 世界观", "法 · 战略框架", "心 · 执行状态"] },
      { id: "a1", label: "A1 · 内容案例" },
      { id: "a2", label: "A2 · 触发场景" },
      { id: "e", label: "E · 可执行步骤" },
      { id: "b", label: "B · 边界" },
      { id: "archive", label: "视频存档" },
      { id: "related", label: "相关 skills" }
    ];
    sections.forEach((s, idx) => {
      html += `<a href="#${s.id}" data-target="${s.id}">${CHAP_MARKS[idx] || "·"} ${esc(s.label.replace(/^[A-Z]\d?\s·\s/, ""))}</a>`;
      if (s.subs) {
        s.subs.forEach((sub, i) => {
          html += `<a href="#${s.id}" class="sub" data-target="${s.id}">— ${esc(sub)}</a>`;
        });
      }
    });
    nav.innerHTML = html;
  }

  // ====== 主内容渲染 ======
  function renderMain() {
    const root = document.getElementById("main-content");
    root.innerHTML = "";
    root.appendChild(renderR());
    root.appendChild(renderI());
    root.appendChild(renderA1());
    root.appendChild(renderA2());
    root.appendChild(renderE());
    root.appendChild(renderB());
    root.appendChild(renderArchive());
    root.appendChild(renderRelated());
  }

  // ---- R ----
  function renderR() {
    const r = C.r;
    const sec = el("section", "chapter");
    sec.id = r.anchor;
    sec.appendChild(el("h2", null, `<span class="chap-mark">R</span> ${esc(r.title.replace(/^R - /, ""))}`));
    sec.appendChild(el("p", "intro", esc(r.intro)));
    const ul = el("ul", "quote-list");
    r.quotes.forEach((q, i) => {
      const li = el("li", null, `<div class="text">「${esc(q.text)}」</div>${q.note ? `<span class="note">— ${esc(q.note)}</span>` : ""}`);
      li.dataset.idx = i;
      ul.appendChild(li);
    });
    sec.appendChild(ul);

    // 现代表述
    if (r.modern_notes && r.modern_notes.length) {
      const div = el("div", "modern-notes");
      div.appendChild(el("h4", null, "2026 年视频中的现代表述"));
      r.modern_notes.forEach(n => {
        div.appendChild(el("div", "note-item", `<span class="date">${esc(n.date)}</span>${esc(n.text)}`));
      });
      sec.appendChild(div);
    }
    return sec;
  }

  // ---- I ----
  function renderI() {
    const i = C.i;
    const sec = el("section", "chapter");
    sec.id = i.anchor;
    sec.appendChild(el("h2", null, `<span class="chap-mark">I</span> ${esc(i.title.replace(/^I - /, ""))}`));
    sec.appendChild(el("p", "intro", esc(i.intro)));
    i.layers.forEach(layer => {
      const div = el("div", "layer");
      div.appendChild(el("div", "layer-head", `<span class="ch">${esc(layer.name)}</span><span class="sub">${esc(layer.subtitle)}</span>`));
      layer.items.forEach(item => {
        div.appendChild(el("div", "item", `<div class="title">${esc(item.title)}</div><div class="body">${esc(item.body)}</div>`));
      });
      sec.appendChild(div);
    });
    return sec;
  }

  // ---- A1 ----
  function renderA1() {
    const a1 = C.a1;
    const sec = el("section", "chapter");
    sec.id = a1.anchor;
    sec.appendChild(el("h2", null, `<span class="chap-mark">A1</span> ${esc(a1.title.replace(/^A1 - /, ""))}`));
    sec.appendChild(el("p", "intro", esc(a1.intro)));
    a1.cases.forEach(c => {
      const div = el("div", "case");
      div.appendChild(el("h3", null, esc(c.title)));
      div.appendChild(el("div", "date", esc(c.date)));
      div.appendChild(el("div", "field", `<span class="label">问题</span>${esc(c.problem)}`));
      div.appendChild(el("div", "field", `<span class="label">方法</span>${esc(c.method)}`));
      div.appendChild(el("div", "conclusion", `<strong>结论：</strong>${esc(c.conclusion)}`));
      sec.appendChild(div);
    });
    return sec;
  }

  // ---- A2 ----
  function renderA2() {
    const a2 = C.a2;
    const sec = el("section", "chapter");
    sec.id = a2.anchor;
    sec.appendChild(el("h2", null, `<span class="chap-mark">A2</span> ${esc(a2.title.replace(/^A2 - /, ""))}`));
    sec.appendChild(el("p", "intro", ""));

    sec.appendChild(el("h3", null, esc(a2.scenarios_title)));
    const ul1 = el("ul", "scenario-list");
    a2.scenarios.forEach(s => ul1.appendChild(el("li", null, esc(s))));
    sec.appendChild(ul1);

    sec.appendChild(el("h3", null, esc(a2.signals_title)));
    const signals = a2.signals.map(s => esc(s)).join("\n");
    sec.appendChild(el("div", "signal-list", signals));

    sec.appendChild(el("h3", null, esc(a2.distinctions_title)));
    a2.distinctions.forEach(d => {
      sec.appendChild(el("div", "distinction", `<span class="skill-name">${esc(d.skill)}</span>${esc(d.body)}`));
    });
    return sec;
  }

  // ---- E ----
  function renderE() {
    const e = C.e;
    const sec = el("section", "chapter");
    sec.id = e.anchor;
    sec.appendChild(el("h2", null, `<span class="chap-mark">E</span> ${esc(e.title.replace(/^E - /, ""))}`));
    sec.appendChild(el("p", "intro", esc(e.intro)));

    // 进度条
    const progress = el("div", "checklist-progress");
    progress.id = "checklist-progress";
    progress.innerHTML = `
      <span id="checklist-count">已完成 0 / ${e.steps.length}</span>
      <div class="bar"><div class="fill" id="checklist-fill" style="width:0%"></div></div>
      <button class="reset-btn" id="checklist-reset">重置</button>
    `;
    sec.appendChild(progress);

    const ul = el("ul", "checklist");
    ul.id = "checklist";
    e.steps.forEach((s, i) => {
      const li = el("li");
      li.innerHTML = `
        <input type="checkbox" data-idx="${i}" id="step-${i}">
        <div class="step-body">
          <span class="title">${i + 1}. ${esc(s.title)}</span>
          <span class="criterion">完成标准：${esc(s.criterion)}</span>
        </div>
      `;
      ul.appendChild(li);
    });
    sec.appendChild(ul);
    return sec;
  }

  // ---- B ----
  function renderB() {
    const b = C.b;
    const sec = el("section", "chapter");
    sec.id = b.anchor;
    sec.appendChild(el("h2", null, `<span class="chap-mark">B</span> ${esc(b.title.replace(/^B - /, ""))}`));
    sec.appendChild(el("p", "intro", esc(b.intro)));

    sec.appendChild(el("h3", null, esc(b.not_for_title)));
    const ul1 = el("ul");
    b.not_for.forEach(s => ul1.appendChild(el("li", null, esc(s))));
    sec.appendChild(ul1);

    sec.appendChild(el("h3", null, esc(b.failure_title)));
    const ul2 = el("ul");
    b.failures.forEach(s => ul2.appendChild(el("li", null, esc(s))));
    sec.appendChild(ul2);

    sec.appendChild(el("div", "boundary-block source", `<strong>${esc(b.source_boundary_title)}</strong><br>${esc(b.source_boundary)}`));
    return sec;
  }

  // ---- 相关 skills ----
  function renderRelated() {
    const sec = el("section", "chapter");
    sec.id = "related";
    sec.appendChild(el("h2", null, `<span class="chap-mark">·</span> 相关 skills`));
    const div = el("div", "related-skills");
    C.meta.related_skills.forEach(s => {
      div.appendChild(el("span", "pill", esc(s)));
    });
    sec.appendChild(div);
    return sec;
  }

  // ---- 视频存档 ----
  function getAllVideos() {
    const vids = window.MOXING_VIDEOS || [];
    const seen = {};
    const out = [];
    vids.forEach(v => {
      if (v && v.id && !seen[v.id]) { seen[v.id] = 1; out.push(v); }
    });
    out.sort((a, b) => String(b.publishTime || "").localeCompare(String(a.publishTime || "")));
    return out;
  }

  function renderArchive() {
    const sec = el("section", "chapter archive");
    sec.id = "archive";
    const vids = getAllVideos();
    const totalComments = vids.reduce((s, v) => s + (v.comments ? v.comments.length : 0), 0);

    sec.appendChild(el("h2", null, `<span class="chap-mark">档</span> 视频存档 <span class="archive-count">${vids.length} 条视频 · ${totalComments} 条评论</span>`));
    sec.appendChild(el("p", "intro", "已抓取的视频与评论区互动，按发布时间倒序。支持编号(如 #1001)、文案、口播转录、评论全文搜索；作者回复与博主赞过以朱红标出，已删除视频灰显留档。"));

    const searchWrap = el("div", "archive-search");
    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = "搜编号 #1001、文案、口播转录或评论…";
    searchWrap.appendChild(input);
    sec.appendChild(searchWrap);

    const list = el("div", "archive-list");
    sec.appendChild(list);

    function renderList() {
      const kw = input.value.trim().toLowerCase();
      const CODES = window.MOXING_CODES || {};
      const STATUS = window.MOXING_STATUS || {};
      const shown = kw
        ? vids.filter(v => {
            const sid = String(v.id);
            const code = CODES[sid] ? "#" + CODES[sid] : "";
            return (code + " " + String(v.desc || "") + " " + String(v.transcript || "")).toLowerCase().includes(kw) ||
              (v.comments || []).some(c =>
                (String(c.user || "") + String(c.content || "") +
                  (c.replies || []).map(r => String(r.user || "") + String(r.content || "")).join(" "))
                  .toLowerCase().includes(kw));
          })
        : vids;
      list.innerHTML = "";
      if (!shown.length) {
        list.appendChild(el("div", "archive-empty", "没有匹配的视频"));
        return;
      }
      shown.forEach(v => {
        const sid = String(v.id);
        const cm = v.comments || [];
        const st = STATUS[sid] || {};
        const code = CODES[sid];
        // 作者回复/博主点赞计数: isAuthor 精确, 兼容旧数据用户名匹配
        const isAuth = c => c.isAuthor || /模型先生/.test(String(c.user));
        let authorReplies = 0, authorDiggs = 0;
        cm.forEach(c => {
          if (isAuth(c)) authorReplies++;
          if (c.authorDigged) authorDiggs++;
          (c.replies || []).forEach(r => {
            if (isAuth(r)) authorReplies++;
            if (r.authorDigged) authorDiggs++;
          });
        });
        const chapters = v.chapters || [];
        const transcript = v.transcript || "";

        const card = el("div", "video-card" + (st.deleted ? " is-deleted" : st.suspect ? " is-suspect" : ""));
        const head = el("div", "video-head");
        head.innerHTML = `
          <div class="video-desc">
            ${code ? `<span class="v-code">#${code}</span>` : ""}
            ${st.deleted ? `<span class="v-badge-deleted" title="${esc(st.at || "")}">已删除</span>` : st.suspect ? '<span class="v-badge-suspect" title="检测到视频不存在，待二次确认">疑似下架</span>' : ""}
            ${esc(v.desc || "（无文案）")}
          </div>
          <div class="video-meta">
            <span class="v-time">${esc(v.publishTime || "")}</span>
            ${chapters.length ? `<span class="v-chip">AI章节 ${chapters.length}</span>` : ""}
            ${transcript ? `<span class="v-chip v-chip-tr">口播转录 ${transcript.length} 字</span>` : ""}
            <a class="v-link" href="${esc(v.url)}" target="_blank" rel="noopener">原视频 ↗</a>
            <span class="v-toggle">${cm.length} 条评论${authorReplies ? " · 作者回复 " + authorReplies : ""}${authorDiggs ? " · 博主赞 " + authorDiggs : ""} <i>▾</i></span>
          </div>
        `;
        card.appendChild(head);

        // AI 章节
        if (chapters.length) {
          const ch = el("div", "video-chapters");
          ch.innerHTML = `<div class="vc-title">AI 章节</div>` +
            chapters.map((c, i) => `<div class="vc-item"><span class="vc-no">${i + 1}</span>${esc(c.title || "")}</div>`).join("");
          card.appendChild(ch);
        }

        // 口播转录稿(默认折叠)
        if (transcript) {
          const tr = el("div", "video-transcript");
          tr.innerHTML = `<div class="vt-toggle">口播转录全文 ${transcript.length} 字 <i>▾</i></div><div class="vt-body">${esc(transcript)}</div>`;
          tr.querySelector(".vt-toggle").addEventListener("click", () => tr.classList.toggle("open"));
          card.appendChild(tr);
        }

        const cbox = el("div", "video-comments");
        if (cm.length) {
          cm.forEach(c => {
            const a = isAuth(c);
            const row = el("div", "comment" + (a ? " author" : ""));
            const replies = c.replies || [];
            const subCount = c.subReplies || replies.length;
            row.innerHTML = `
              <div class="c-head">
                <span class="c-user">${esc(c.user || "匿名")}</span>
                ${a ? '<span class="c-badge">作者</span>' : ""}
                ${c.authorDigged ? '<span class="c-badge c-badge-digg">博主赞过</span>' : ""}
                <span class="c-meta">${esc(c.time || "")}${c.location ? " · " + esc(c.location) : ""}${subCount ? " · " + subCount + " 条回复" : ""}</span>
              </div>
              <div class="c-content">${esc(c.content || "（无文字）")}</div>
            `;
            // 渲染子回复(嵌套)
            if (replies.length) {
              const rbox = el("div", "c-replies");
              replies.forEach(r => {
                const ra = isAuth(r);
                const rr = el("div", "c-reply" + (ra ? " author" : ""));
                rr.innerHTML = `
                  <span class="c-user">${esc(r.user || "匿名")}</span>
                  ${ra ? '<span class="c-badge">作者</span>' : ""}
                  ${r.authorDigged ? '<span class="c-badge c-badge-digg">博主赞过</span>' : ""}
                  <span class="c-meta">${esc(r.time || "")}${r.location ? " · " + esc(r.location) : ""}</span>
                  <div class="c-content">${esc(r.content || "（无文字）")}</div>
                `;
                rbox.appendChild(rr);
              });
              row.appendChild(rbox);
            }
            cbox.appendChild(row);
          });
        } else {
          cbox.appendChild(el("div", "c-none", "（该视频暂无评论）"));
        }
        card.appendChild(cbox);
        head.addEventListener("click", (e) => {
          if (e.target.closest("a")) return;
          card.classList.toggle("open");
        });
        list.appendChild(card);
      });
    }
    input.addEventListener("input", renderList);
    renderList();
    return sec;
  }

  // ====== 右栏金句 ======
  function renderQuoteRail() {
    const rail = document.getElementById("quote-rail");
    let html = `<div class="rail-title">原话金句</div>`;
    C.r.quotes.forEach((q, i) => {
      html += `<div class="rail-quote" data-idx="${i}" data-target-quote="${i}">「${esc(q.text)}」</div>`;
    });
    rail.innerHTML = html;
  }

  // ====== 滚动同步 ======
  function setupScrollSync() {
    // 左栏导航高亮
    const navLinks = document.querySelectorAll("nav.sidebar a[data-target]");
    const sections = ["r", "i", "a1", "a2", "e", "b", "archive", "related"]
      .map(id => document.getElementById(id))
      .filter(Boolean);

    const navObserver = new IntersectionObserver((entries) => {
      entries.forEach(en => {
        if (en.isIntersecting) {
          const id = en.target.id;
          navLinks.forEach(a => {
            a.classList.toggle("active", a.dataset.target === id);
          });
        }
      });
    }, { rootMargin: "-20% 0px -70% 0px", threshold: 0 });
    sections.forEach(s => navObserver.observe(s));

    // 右栏金句高亮 - 当主区对应金句进入视口
    const quoteItems = document.querySelectorAll(".quote-list li");
    const railQuotes = document.querySelectorAll(".rail-quote");

    // 默认高亮第一条
    if (railQuotes[0]) railQuotes[0].classList.add("active");

    const quoteObserver = new IntersectionObserver((entries) => {
      entries.forEach(en => {
        if (en.isIntersecting) {
          const idx = en.target.dataset.idx;
          railQuotes.forEach(r => r.classList.toggle("active", r.dataset.idx === idx));
        }
      });
    }, { rootMargin: "-30% 0px -60% 0px", threshold: 0 });
    quoteItems.forEach(q => quoteObserver.observe(q));

    // 点击右栏金句滚动到对应位置
    railQuotes.forEach(r => {
      r.addEventListener("click", () => {
        const idx = r.dataset.idx;
        const target = document.querySelector(`.quote-list li[data-idx="${idx}"]`);
        if (target) target.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    });

    // 左栏导航点击 - 平滑滚动
    navLinks.forEach(a => {
      a.addEventListener("click", (e) => {
        e.preventDefault();
        const id = a.dataset.target;
        const target = document.getElementById(id);
        if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
  }

  // ====== 初始化 ======
  function init() {
    renderHeader();
    renderSidebar();
    renderMain();
    renderQuoteRail();
    setupScrollSync();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
