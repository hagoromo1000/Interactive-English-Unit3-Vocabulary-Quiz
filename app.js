// ===== ユーティリティ =====
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function shuffleLetters(part) {
  const letters = part.toUpperCase().split("");
  let shuffled;
  do { shuffled = shuffle(letters); }
  while (shuffled.join("") === letters.join("") && letters.length > 1);
  return shuffled.join("");
}

// old-fashioned / well-known / crazy about のような複数部分の単語かどうか
function getWordParts(word) {
  if (word.includes("-")) return word.split("-");
  if (word.includes(" ")) return word.split(" ");
  return null; // 単一語
}

function shuffleWord(word) {
  const parts = getWordParts(word);
  if (parts) {
    // 複合語：各部分を別々にシャッフルして並べて表示
    return parts.map(shuffleLetters).join("  /  ");
  }
  return shuffleLetters(word);
}

// 正解判定：複合語はカンマ区切り、カンマ前後の空白は許容、大文字小文字無視
function isAnswerCorrect(input, word) {
  const parts = getWordParts(word);
  const normalize = s => s.trim().toLowerCase();
  if (parts) {
    const expected = parts.map(p => normalize(p)).join(",");
    const given = input.split(",").map(normalize).join(",");
    return given === expected;
  }
  return normalize(input) === normalize(word);
}

// 解答欄に表示するプレースホルダー
function inputPlaceholder(word) {
  const parts = getWordParts(word);
  if (parts) {
    return `${parts.map(() => "つづり").join(",")} の形でカンマ区切りで入力`;
  }
  return "スペルを入力してください";
}

function relatedListHTML(related) {
  if (!related || related.length === 0) return "";
  return `<ul class="related-list">${related.map(r => `<li>${r}</li>`).join("")}</ul>`;
}

// ===== アプリ状態 =====
const App = {
  mode: null,
  questions: [],
  current: 0,
  score: 0,
  wrongWords: [],
  startTime: null,
  timerInterval: null,
  elapsed: 0,
  patternFilter: null,
  answered: false
};

// ===== 問題生成 =====
function generateQuestion(wordObj, pattern) {
  switch (pattern) {
    case 1: return generateP1(wordObj);
    case 2: return generateP2(wordObj);
    case 3: return generateP3(wordObj);
    case 4: return generateP4(wordObj);
  }
}

function generateP1(w) {
  const parts = getWordParts(w.word);
  const compoundNote = parts ? `<div class="compound-note">※ ${parts.length}つの部分に分かれています。カンマ（,）で区切って入力してください。</div>` : "";
  return {
    word: w.word, pattern: 1, data: w,
    prompt: `
      <div class="instruction">次の意味を表す英単語になるように、アルファベットを並べ替えて入力してください。</div>
      <div class="def-text">${w.definition}</div>
      <div class="def-text-ja">${w.definitionJa}</div>
      <div class="shuffled">${shuffleWord(w.word)}</div>
      ${compoundNote}
    `,
    answer: w.word
  };
}


function generateP2(w) {
  const parts = getWordParts(w.word);
  const compoundNote = parts ? `<div class="compound-note">※ この単語は${parts.length}つの部分（${parts.join(" + ")}）からできています。カンマ（,）で区切って入力してください。</div>` : "";
  return {
    word: w.word, pattern: 2, data: w,
    prompt: `
      <div class="instruction">空欄に当てはまる英単語を入力してください。</div>
      <div class="p2-sentence">${w.p2sentence.replace("________", '<span class="blank">________</span>')}</div>
      <div class="p2-sentence-ja">${w.p2sentenceJa}</div>
      ${compoundNote}
    `,
    answer: w.word
  };
}

function generateP3(w) {
  const parts = getWordParts(w.word);
  const compoundNote = parts
    ? `<div class="compound-note">※ この単語は${parts.length}つの部分に分かれて表示されています。カンマ（,）で区切ってそれぞれのつづりを入力してください（例：${parts.map(() => "xxxxx").join(",")}）。</div>`
    : "";
  return {
    word: w.word, pattern: 3, data: w,
    prompt: `
      <div class="instruction">2つの英文を読み、下の英文の空欄（頭文字のみ表示）に当てはまる英単語のつづりを最後まで入力してください。</div>
      <div class="p3-hint">${w.p3blank}</div>
      <div class="p3-hint-ja">${w.p3blankJa}</div>
      <div class="p3-blank">${w.p3hint}</div>
      <div class="p3-blank-ja">${w.p3hintJa}</div>
      ${compoundNote}
    `,
    answer: w.word
  };
}

function generateP4(w) {
  const parts = getWordParts(w.word);
  const compoundNote = parts ? `<div class="compound-note">※ この単語は${parts.length}つの部分（${parts.join(" + ")}）からできています。カンマ（,）で区切って入力してください。</div>` : "";
  return {
    word: w.word, pattern: 4, data: w,
    prompt: `
      <div class="instruction">意味に当てはまる英単語を入力してください。</div>
      <div class="def-text">${w.p4definition}</div>
      <div class="def-text-ja">${w.p4definitionJa}</div>
      ${compoundNote}
    `,
    answer: w.word
  };
}

// ===== 模擬小テスト用：各パターン5問ずつ =====
function buildMockQuestions() {
  const words = shuffle(WORDS);
  const questions = [];
  for (let p = 1; p <= 4; p++) {
    const slice = words.slice((p - 1) * 5, p * 5);
    slice.forEach(w => questions.push(generateQuestion(w, p)));
  }
  return shuffle(questions);
}

// ===== パターン別練習用 =====
function buildPatternQuestions(pattern) {
  return shuffle(WORDS).map(w => generateQuestion(w, pattern));
}

// ===== 苦手単語モード =====
function buildWeakQuestions() {
  const wrong = Storage.getWrongWords();
  const entries = Object.entries(wrong).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return [];
  const topWords = entries.slice(0, 10).map(([word]) => word);
  const wordObjs = topWords.map(w => WORDS.find(x => x.word === w)).filter(Boolean);
  return shuffle(wordObjs).map(w => generateQuestion(w, Math.ceil(Math.random() * 4)));
}

// ===== タイムアタック =====
function buildTimeAttackQuestions() {
  return buildMockQuestions();
}

// ===== 画面遷移 =====
function showScreen(id) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  document.getElementById(id).classList.add("active");
}

// ===== タイマー =====
function startTimer(displayId) {
  App.startTime = Date.now();
  App.elapsed = 0;
  App.timerInterval = setInterval(() => {
    App.elapsed = Math.floor((Date.now() - App.startTime) / 1000);
    const el = document.getElementById(displayId);
    if (el) el.textContent = Storage.formatTime(App.elapsed);
  }, 1000);
}

function stopTimer() {
  clearInterval(App.timerInterval);
  App.timerInterval = null;
}

// ===== 問題表示 =====
function showQuestion() {
  const q = App.questions[App.current];
  const total = App.questions.length;
  App.answered = false;

  document.getElementById("q-progress").textContent = `${App.current + 1} / ${total}`;
  document.getElementById("q-progress-bar").style.width = `${((App.current + 1) / total) * 100}%`;
  document.getElementById("q-pattern").textContent = `Pattern ${q.pattern}`;
  document.getElementById("q-body").innerHTML = q.prompt;
  const inputEl = document.getElementById("q-input");
  inputEl.value = "";
  inputEl.disabled = false;
  inputEl.placeholder = inputPlaceholder(q.answer);
  inputEl.focus();

  document.getElementById("q-feedback-area").style.display = "none";
  document.getElementById("q-submit").style.display = "inline-block";
}

// ===== 解答解説パネル =====
function buildExplanation(q, isCorrect, userInput) {
  const w = q.data;
  const resultEl = document.getElementById("q-feedback-result");
  resultEl.textContent = isCorrect ? "✓ 正解です！" : `✗ 不正解（あなたの解答：${userInput || "（未入力）"}）`;
  resultEl.className = "feedback-result " + (isCorrect ? "correct" : "wrong");

  const parts = getWordParts(w.word);
  const correctDisplay = parts ? parts.join(" , ") : w.word;

  document.getElementById("q-feedback-detail").innerHTML = `
    <div class="explain-answer">正解：<strong>${correctDisplay}</strong>${parts ? ` （${w.word}）` : ""}</div>
    <div class="explain-row">
      <span class="explain-label">定義</span>
      <span>${w.definition}<br><span class="ja">${w.definitionJa}</span></span>
    </div>
    <div class="explain-row">
      <span class="explain-label">使い方</span>
      <span>${w.usageNote}</span>
    </div>
    <div class="explain-row">
      <span class="explain-label">関連語</span>
      ${relatedListHTML(w.related)}
    </div>
  `;
}

// ===== 回答チェック =====
function checkAnswer() {
  if (App.answered) return;
  const q = App.questions[App.current];
  const inputEl = document.getElementById("q-input");
  const rawInput = inputEl.value.trim();
  const isCorrect = isAnswerCorrect(rawInput, q.answer);

  App.answered = true;
  inputEl.disabled = true;
  document.getElementById("q-submit").style.display = "none";

  if (isCorrect) {
    App.score++;
  } else {
    if (!App.wrongWords.includes(q.word)) App.wrongWords.push(q.word);
  }

  buildExplanation(q, isCorrect, rawInput);
  document.getElementById("q-feedback-area").style.display = "block";
}

function nextQuestion() {
  App.current++;
  if (App.current >= App.questions.length) {
    finishQuiz(false);
  } else {
    showQuestion();
  }
}

// ===== 結果表示 =====
function finishQuiz(aborted) {
  stopTimer();
  const totalAnswered = aborted ? App.current : App.questions.length;
  Storage.saveResult(App.mode, App.score, App.questions.length, App.elapsed, App.wrongWords, aborted, totalAnswered);

  const pct = App.questions.length > 0 ? Math.round((App.score / (aborted ? Math.max(totalAnswered,1) : App.questions.length)) * 100) : 0;

  document.getElementById("result-title").textContent = aborted ? "テスト中断（記録済み）" : "テスト完了";
  document.getElementById("result-score").textContent = aborted
    ? `${App.score} / ${totalAnswered}（中断・全${App.questions.length}問中）`
    : `${App.score} / ${App.questions.length}`;
  document.getElementById("result-percent").textContent = `${pct}%`;
  document.getElementById("result-time").textContent = Storage.formatTime(App.elapsed);

  const wrongEl = document.getElementById("result-wrong");
  if (App.wrongWords.length === 0) {
    wrongEl.innerHTML = totalAnswered > 0 ? "<span class='perfect'>Perfect! 全問正解！</span>" : "";
  } else {
    wrongEl.innerHTML = "<div class='wrong-label'>間違えた単語</div>" +
      App.wrongWords.map(w => `<span class="wrong-chip">${w}</span>`).join("");
  }

  const bestWrap = document.getElementById("result-best-wrap");
  if (App.mode === "timeattack" && !aborted) {
    const best = Storage.getBestTime();
    document.getElementById("result-best").textContent = best !== null ? Storage.formatTime(best) : "—";
    bestWrap.style.display = "inline";
  } else {
    bestWrap.style.display = "none";
  }

  showScreen("screen-result");
}

// ===== 単語帳モード =====
let flashIndex = 0;

function showFlashCard() {
  const w = WORDS[flashIndex];
  document.getElementById("flash-counter").textContent = `${flashIndex + 1} / ${WORDS.length}`;
  document.getElementById("flash-front-word").textContent = w.word;
  document.getElementById("flash-front-pos").textContent = w.pos;
  document.getElementById("flash-back-en").textContent = w.definition;
  document.getElementById("flash-back-ja").textContent = w.definitionJa;
  document.getElementById("flash-card").classList.remove("flipped");
}

// ===== 学習記録画面 =====
function renderHistory() {
  const history = Storage.getHistory();
  const el = document.getElementById("history-list");
  const modeLabels = {
    mock: "模擬小テスト",
    pattern: "パターン練習",
    weak: "苦手単語",
    timeattack: "タイムアタック"
  };

  if (history.length === 0) {
    el.innerHTML = "<div class='no-history'>まだ記録がありません</div>";
  } else {
    el.innerHTML = history.map(h => `
      <div class="history-item">
        <div class="history-date">${h.date}${h.aborted ? '<span class="aborted-tag">中断</span>' : ''}</div>
        <div class="history-mode">${modeLabels[h.mode] || h.mode}</div>
        <div class="history-score">${h.score}/${h.totalAnswered ?? h.total} <span class="history-pct">${h.percent}%</span></div>
        <div class="history-time">${Storage.formatTime(h.timeSeconds)}</div>
      </div>
    `).join("");
  }

  // 苦手単語ランキング
  const wrong = Storage.getWrongWords();
  const entries = Object.entries(wrong).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const weakEl = document.getElementById("weak-section");
  if (entries.length === 0) {
    weakEl.innerHTML = "";
  } else {
    weakEl.innerHTML = `
      <div class="weak-title">よく間違える単語</div>
      <div class="weak-chips">
        ${entries.map(([w, c]) => `<span class="weak-chip">${w} <span class="weak-count">×${c}</span></span>`).join("")}
      </div>
    `;
  }
}

// ===== モード開始 =====
function startMode(mode) {
  App.mode = mode;
  App.current = 0;
  App.score = 0;
  App.wrongWords = [];
  App.elapsed = 0;

  if (mode === "flashcard") {
    flashIndex = 0;
    showScreen("screen-flash");
    showFlashCard();
    return;
  }

  if (mode === "mock") App.questions = buildMockQuestions();
  else if (mode === "pattern") App.questions = buildPatternQuestions(App.patternFilter || 1);
  else if (mode === "weak") {
    App.questions = buildWeakQuestions();
    if (App.questions.length === 0) {
      alert("まだ苦手単語の記録がありません。他のモードで練習してください。");
      return;
    }
  }
  else if (mode === "timeattack") App.questions = buildTimeAttackQuestions();

  showScreen("screen-quiz");
  startTimer("q-timer");
  showQuestion();
}

// ===== 中断処理 =====
function openAbortModal() {
  document.getElementById("modal-abort").style.display = "flex";
}
function closeAbortModal() {
  document.getElementById("modal-abort").style.display = "none";
}
function confirmAbort() {
  closeAbortModal();
  finishQuiz(true);
}

// ===== イベント設定 =====
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("btn-mock").onclick = () => startMode("mock");
  document.getElementById("btn-flash").onclick = () => startMode("flashcard");
  document.getElementById("btn-timeattack").onclick = () => startMode("timeattack");
  document.getElementById("btn-weak").onclick = () => startMode("weak");
  document.getElementById("btn-history").onclick = () => {
    renderHistory();
    showScreen("screen-history");
  };

  document.querySelectorAll(".btn-pattern").forEach(btn => {
    btn.onclick = () => {
      App.patternFilter = parseInt(btn.dataset.pattern);
      startMode("pattern");
    };
  });

  document.getElementById("q-submit").onclick = checkAnswer;
  document.getElementById("q-input").addEventListener("keydown", e => {
    if (e.key === "Enter") checkAnswer();
  });
  document.getElementById("btn-next").onclick = nextQuestion;

  // 中断ボタン
  document.getElementById("btn-abort").onclick = openAbortModal;
  document.getElementById("modal-cancel-abort").onclick = closeAbortModal;
  document.getElementById("modal-confirm-abort").onclick = confirmAbort;

  // 単語帳操作
  document.getElementById("flash-card").onclick = () => {
    document.getElementById("flash-card").classList.toggle("flipped");
  };
  document.getElementById("flash-prev").onclick = () => {
    flashIndex = (flashIndex - 1 + WORDS.length) % WORDS.length;
    showFlashCard();
  };
  document.getElementById("flash-next").onclick = () => {
    flashIndex = (flashIndex + 1) % WORDS.length;
    showFlashCard();
  };

  document.querySelectorAll(".btn-home").forEach(btn => {
    btn.onclick = () => {
      stopTimer();
      showScreen("screen-home");
    };
  });

  document.getElementById("btn-retry").onclick = () => startMode(App.mode);
  document.getElementById("btn-result-home").onclick = () => showScreen("screen-home");

  document.getElementById("btn-clear-history").onclick = () => {
    if (confirm("学習記録をすべて削除しますか？")) {
      Storage.clearAll();
      renderHistory();
    }
  };
});
