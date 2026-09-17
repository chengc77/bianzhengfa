// checklist.js - 执行清单勾选 + localStorage 持久化

(function () {
  "use strict";
  const STORAGE_KEY = "moxing-checklist-v1";

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  function saveState(state) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      // 容量异常时静默失败
    }
  }

  function updateProgress() {
    const checks = document.querySelectorAll("#checklist input[type=checkbox]");
    const total = checks.length;
    let done = 0;
    checks.forEach(c => { if (c.checked) done++; });
    const countEl = document.getElementById("checklist-count");
    const fillEl = document.getElementById("checklist-fill");
    if (countEl) countEl.textContent = `已完成 ${done} / ${total}`;
    if (fillEl) fillEl.style.width = `${total ? (done / total * 100) : 0}%`;
  }

  function applyStateToUI(state) {
    const checks = document.querySelectorAll("#checklist input[type=checkbox]");
    checks.forEach((c, i) => {
      c.checked = !!state[i];
      const li = c.closest("li");
      if (li) li.classList.toggle("checked", c.checked);
    });
    updateProgress();
  }

  function init() {
    const ul = document.getElementById("checklist");
    if (!ul) {
      // main.js 还没渲染完，等待
      setTimeout(init, 50);
      return;
    }

    const state = loadState();
    applyStateToUI(state);

    ul.addEventListener("change", (e) => {
      if (e.target.matches("input[type=checkbox]")) {
        const idx = parseInt(e.target.dataset.idx, 10);
        const s = loadState();
        s[idx] = e.target.checked;
        saveState(s);
        const li = e.target.closest("li");
        if (li) li.classList.toggle("checked", e.target.checked);
        updateProgress();
      }
    });

    const resetBtn = document.getElementById("checklist-reset");
    if (resetBtn) {
      resetBtn.addEventListener("click", () => {
        if (!confirm("确定要清空所有勾选记录吗？")) return;
        saveState({});
        applyStateToUI({});
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
