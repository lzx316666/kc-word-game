// ================= 공통 / 通用 =================
const $ = (sel) => document.querySelector(sel);

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// localStorage 가 막혀 있어도 게임은 동작 / 即使 localStorage 不可用，游戏也能运行
const store = {
  get(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  },
  set(key, val) {
    try { localStorage.setItem(key, val); } catch (e) { /* ignore */ }
  },
};

function showModal(title, body) {
  $("#modal-title").textContent = title;
  $("#modal-body").innerHTML = body;
  $("#modal").classList.remove("hidden");
}
$("#modal-close").addEventListener("click", () => $("#modal").classList.add("hidden"));

// 탭 전환 / 切换标签
document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
    document.querySelectorAll(".view").forEach((v) => v.classList.remove("active"));
    tab.classList.add("active");
    $("#view-" + tab.dataset.view).classList.add("active");
  });
});

// ================= 카드 짝 맞추기 / 翻牌配对 =================
const match = { first: null, lock: false, moves: 0, pairs: 0, total: 0, time: 0, timer: null, started: false };

function bestKey(level) { return "kc-best-" + level; }

function updateBest() {
  const level = $("#match-level").value;
  const best = store.get(bestKey(level));
  $("#match-best").textContent = best ? best + "s" : "-";
}

function startMatch() {
  const level = Number($("#match-level").value);
  const picked = shuffle(WORDS).slice(0, level);
  const cards = [];
  picked.forEach((w, id) => {
    cards.push({ id, text: w.ko, lang: "ko" });
    cards.push({ id, text: w.zh, lang: "zh" });
  });

  clearInterval(match.timer);
  Object.assign(match, { first: null, lock: false, moves: 0, pairs: 0, total: level, time: 0, timer: null, started: false });
  $("#match-time").textContent = "0";
  $("#match-moves").textContent = "0";
  $("#match-pairs").textContent = "0";
  $("#match-total").textContent = level;
  updateBest();

  const board = $("#board");
  board.innerHTML = "";
  board.style.setProperty("--cols", level >= 10 ? 5 : 4);

  shuffle(cards).forEach((c) => {
    const el = document.createElement("button");
    el.className = "card";
    el.dataset.id = c.id;
    el.setAttribute("aria-label", "카드 / 卡片");
    el.innerHTML = `
      <span class="card-inner">
        <span class="face back">?</span>
        <span class="face front ${c.lang}">
          <small>${c.lang === "ko" ? "한국어 / 韩语" : "중국어 / 中文"}</small>
          ${c.text}
        </span>
      </span>`;
    el.addEventListener("click", () => flip(el));
    board.appendChild(el);
  });
}

function flip(el) {
  if (match.lock || el.classList.contains("flipped") || el.classList.contains("done")) return;

  if (!match.started) {
    match.started = true;
    match.timer = setInterval(() => {
      match.time++;
      $("#match-time").textContent = match.time;
    }, 1000);
  }

  el.classList.add("flipped");
  if (!match.first) { match.first = el; return; }

  match.moves++;
  $("#match-moves").textContent = match.moves;
  const a = match.first, b = el;
  match.first = null;

  if (a.dataset.id === b.dataset.id) {
    a.classList.add("done");
    b.classList.add("done");
    match.pairs++;
    $("#match-pairs").textContent = match.pairs;
    if (match.pairs === match.total) finishMatch();
  } else {
    match.lock = true;
    a.classList.add("wrong");
    b.classList.add("wrong");
    setTimeout(() => {
      a.classList.remove("flipped", "wrong");
      b.classList.remove("flipped", "wrong");
      match.lock = false;
    }, 800);
  }
}

function finishMatch() {
  clearInterval(match.timer);
  const level = $("#match-level").value;
  const prev = Number(store.get(bestKey(level)));
  let record = "";
  if (!prev || match.time < prev) {
    store.set(bestKey(level), match.time);
    record = "<br>🎉 새 최고 기록! / 新纪录！";
  }
  updateBest();
  showModal(
    "성공! / 成功！",
    `모든 카드를 맞췄어요. / 你配对了所有卡片。<br>
     ⏱ ${match.time}초 / 秒 · 🔁 ${match.moves}번 시도 / 次尝试${record}`
  );
}

$("#match-start").addEventListener("click", startMatch);
$("#match-level").addEventListener("change", startMatch);

// ================= 단어 퀴즈 / 单词测验 =================
const QUIZ_LEN = 10;
const quiz = { list: [], idx: 0, score: 0, dir: "ko2zh", answered: false, wrong: [] };

function startQuiz() {
  quiz.dir = $("#quiz-dir").value;
  quiz.list = shuffle(WORDS).slice(0, QUIZ_LEN);
  quiz.idx = 0;
  quiz.score = 0;
  quiz.wrong = [];
  renderQuestion();
}

function renderQuestion() {
  const box = $("#quiz-box");
  const w = quiz.list[quiz.idx];
  const ko2zh = quiz.dir === "ko2zh";
  const q = ko2zh ? w.ko : w.zh;
  const correct = ko2zh ? w.zh : w.ko;
  const others = shuffle(WORDS.filter((x) => x !== w)).slice(0, 3).map((x) => (ko2zh ? x.zh : x.ko));
  const options = shuffle([correct, ...others]);
  quiz.answered = false;

  box.innerHTML = `
    <div class="progress"><div style="width:${(quiz.idx / QUIZ_LEN) * 100}%"></div></div>
    <p class="q-meta">문제 / 题目 ${quiz.idx + 1} / ${QUIZ_LEN} · 점수 / 得分 ${quiz.score}</p>
    <p class="q-ask">${ko2zh ? "이 단어의 중국어 뜻은? / 这个词的中文意思是？" : "이 단어의 한국어 뜻은? / 这个词的韩语意思是？"}</p>
    <p class="q-word">${q}</p>
    <div class="options">
      ${options.map((o) => `<button class="btn option">${o}</button>`).join("")}
    </div>
    <p id="feedback" class="feedback"></p>
    <button id="next" class="btn primary hidden">${quiz.idx + 1 === QUIZ_LEN ? "결과 보기 / 查看结果" : "다음 문제 / 下一题"}</button>
  `;

  box.querySelectorAll(".option").forEach((btn) => {
    btn.addEventListener("click", () => answer(btn, correct, w));
  });
  $("#next").addEventListener("click", () => {
    quiz.idx++;
    if (quiz.idx < QUIZ_LEN) renderQuestion();
    else finishQuiz();
  });
}

function answer(btn, correct, w) {
  if (quiz.answered) return;
  quiz.answered = true;
  const fb = $("#feedback");
  document.querySelectorAll(".option").forEach((b) => {
    b.disabled = true;
    if (b.textContent === correct) b.classList.add("right");
  });
  if (btn.textContent === correct) {
    quiz.score++;
    fb.className = "feedback ok";
    fb.textContent = `정답! / 正确！ (${w.ko} = ${w.zh}, ${w.py})`;
  } else {
    btn.classList.add("bad");
    quiz.wrong.push(w);
    fb.className = "feedback ng";
    fb.textContent = `오답입니다. 정답: ${correct} / 回答错误，正确答案：${correct}`;
  }
  $("#next").classList.remove("hidden");
}

function finishQuiz() {
  const pct = Math.round((quiz.score / QUIZ_LEN) * 100);
  let msg;
  if (pct === 100) msg = "완벽해요! / 太完美了！";
  else if (pct >= 70) msg = "잘했어요! / 做得好！";
  else msg = "조금 더 연습해요! / 再多练习一下吧！";

  const wrongHtml = quiz.wrong.length
    ? `<h3>틀린 단어 / 答错的单词</h3><ul class="wrong-list">${quiz.wrong
        .map((w) => `<li>${w.ko} — ${w.zh} (${w.py})</li>`)
        .join("")}</ul>`
    : "";

  $("#quiz-box").innerHTML = `
    <p class="q-word">${quiz.score} / ${QUIZ_LEN}</p>
    <p class="q-ask">${msg}</p>
    ${wrongHtml}
    <button id="retry" class="btn primary">다시 하기 / 再来一次</button>
  `;
  $("#retry").addEventListener("click", startQuiz);
}

$("#quiz-start").addEventListener("click", startQuiz);

// ================= 단어장 / 单词表 =================
function renderList(keyword = "") {
  const k = keyword.trim().toLowerCase();
  const rows = WORDS.filter(
    (w) => !k || w.ko.includes(k) || w.zh.includes(k) || w.py.toLowerCase().includes(k)
  );
  $("#word-tbody").innerHTML = rows
    .map((w, i) => `<tr><td>${i + 1}</td><td>${w.ko}</td><td>${w.zh}</td><td>${w.py}</td></tr>`)
    .join("");
  $("#no-result").classList.toggle("hidden", rows.length > 0);
}
$("#search").addEventListener("input", (e) => renderList(e.target.value));

// 초기화 / 初始化
renderList();
startMatch();
