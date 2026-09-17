// quiz.js - 触发场景自测

(function () {
  "use strict";
  const P = window.MOXING_PROMPTS;

  // 把三类题目拍平并打上正确分类标签
  function buildQuestions() {
    const all = [];
    P.should_trigger.forEach(q => all.push({ ...q, category: "should_trigger", label: "该触发" }));
    P.should_not_trigger.forEach(q => all.push({ ...q, category: "should_not_trigger", label: "不该触发" }));
    P.edge_case.forEach(q => all.push({ ...q, category: "edge_case", label: "边界 / 警示" }));
    return all;
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // 题目选择：随机抽 6 题，确保三类都有覆盖
  function pickQuiz() {
    const all = buildQuestions();
    const st = shuffle(all.filter(q => q.category === "should_trigger")).slice(0, 3);
    const sn = shuffle(all.filter(q => q.category === "should_not_trigger")).slice(0, 1);
    const ec = shuffle(all.filter(q => q.category === "edge_case")).slice(0, 2);
    return shuffle([...st, ...sn, ...ec]);
  }

  const state = {
    questions: [],
    idx: 0,
    correct: 0,
    answered: false
  };

  function esc(s) {
    return String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  }

  function renderQuestion() {
    state.answered = false;
    const q = state.questions[state.idx];
    const card = document.getElementById("quiz-card");
    if (!q) return;

    // should_trigger 与 edge_case 都"应该触发本 skill"
    const correctChoice = (q.category === "should_trigger" || q.category === "edge_case") ? "yes" : "no";

    card.innerHTML = `
      <div class="quiz-header">
        <h3>触发场景自测</h3>
        <span class="quiz-counter">第 ${state.idx + 1} / ${state.questions.length} 题</span>
      </div>
      <div class="prompt">${esc(q.prompt)}</div>
      <div style="font-size:13px;color:#7a7a7a;margin-bottom:8px;font-family:var(--font-sans)">这条 prompt 该不该触发 <code>moxing-dialectical-trading</code> skill？</div>
      <div class="choices">
        <button class="choice-btn" data-choice="yes">该触发</button>
        <button class="choice-btn" data-choice="no">不该触发</button>
      </div>
      <div class="feedback" id="quiz-feedback"></div>
      <button class="next-btn" id="quiz-next">${state.idx + 1 < state.questions.length ? "下一题" : "查看结果"}</button>
    `;

    const choices = card.querySelectorAll(".choice-btn");
    choices.forEach(b => {
      b.addEventListener("click", () => {
        if (state.answered) return;
        state.answered = true;
        const userChoice = b.dataset.choice;
        const isCorrect = userChoice === correctChoice;
        if (isCorrect) state.correct++;
        const fb = document.getElementById("quiz-feedback");
        const categoryLabel = q.category === "should_trigger" ? "正确分类：该触发" : (q.category === "should_not_trigger" ? "正确分类：不该触发" : "正确分类：边界/警示（按该触发处理，但要走边界流程）");
        const verdictText = isCorrect ? "✓ 判断正确" : "× 判断错误";
        fb.innerHTML = `
          <div class="verdict">${verdictText}</div>
          <div style="margin:6px 0;color:#4a4a4a">${esc(categoryLabel)}</div>
          <div><strong>说明：</strong>${esc(q.reason)}</div>
        `;
        fb.className = "feedback show " + (isCorrect ? "correct" : "wrong");
        document.getElementById("quiz-next").classList.add("show");
        choices.forEach(bb => { bb.style.opacity = 0.6; bb.disabled = true; });
        b.style.opacity = 1;
        b.style.borderColor = isCorrect ? "#2a7a2a" : "#a83232";
      });
    });

    document.getElementById("quiz-next").addEventListener("click", () => {
      state.idx++;
      if (state.idx >= state.questions.length) {
        renderScore();
      } else {
        renderQuestion();
      }
    });
  }

  function renderScore() {
    const card = document.getElementById("quiz-card");
    const score = state.correct;
    const total = state.questions.length;
    const pct = total ? Math.round(score / total * 100) : 0;
    let verdict = "";
    if (pct >= 85) verdict = "对框架的触发边界掌握得相当扎实。";
    else if (pct >= 60) verdict = "基本到位，建议回顾错题对应的边界。";
    else verdict = "建议重新精读 B 部分（边界）与 A2（触发场景）。";
    card.innerHTML = `
      <div class="score-screen">
        <h3 style="color:#a83232;margin:0 0 10px">自测完成</h3>
        <div class="score">${score} / ${total}</div>
        <div style="color:#4a4a4a;font-size:14px">正确率 ${pct}%</div>
        <div class="hint">${esc(verdict)}<br><br>提示：本 skill 输出框架，不输出指令；不构成投资建议。</div>
        <button class="next-btn show" id="quiz-restart" style="margin-top:18px">再来一轮</button>
      </div>
    `;
    document.getElementById("quiz-restart").addEventListener("click", startQuiz);
  }

  function startQuiz() {
    state.questions = pickQuiz();
    state.idx = 0;
    state.correct = 0;
    state.answered = false;
    renderQuestion();
  }

  function openModal() {
    const modal = document.getElementById("quiz-modal");
    modal.classList.add("open");
    startQuiz();
  }

  function closeModal() {
    document.getElementById("quiz-modal").classList.remove("open");
  }

  function init() {
    const fab = document.getElementById("quiz-fab");
    if (fab) fab.addEventListener("click", openModal);
    const closeBtn = document.getElementById("quiz-close");
    if (closeBtn) closeBtn.addEventListener("click", closeModal);
    const modal = document.getElementById("quiz-modal");
    if (modal) {
      modal.addEventListener("click", (e) => {
        if (e.target === modal) closeModal();
      });
    }
    // ESC 关闭
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && modal.classList.contains("open")) closeModal();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
