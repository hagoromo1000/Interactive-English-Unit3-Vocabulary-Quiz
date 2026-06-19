const Storage = {
  KEY_HISTORY: "quizHistory",
  KEY_WRONG: "wrongWords",
  KEY_BEST: "bestTime",

  getHistory() {
    try {
      return JSON.parse(localStorage.getItem(this.KEY_HISTORY) || "[]");
    } catch { return []; }
  },

  saveResult(mode, score, total, timeSeconds, wrongWords, aborted = false, totalAnswered = null) {
    const answeredCount = totalAnswered !== null ? totalAnswered : total;
    const history = this.getHistory();
    history.unshift({
      date: new Date().toLocaleDateString("ja-JP"),
      mode,
      score,
      total,
      totalAnswered: answeredCount,
      percent: answeredCount > 0 ? Math.round((score / answeredCount) * 100) : 0,
      timeSeconds,
      wrongWords,
      aborted
    });
    // 最大50件保持
    if (history.length > 50) history.pop();
    localStorage.setItem(this.KEY_HISTORY, JSON.stringify(history));

    // タイムアタックのベスト記録更新（中断時は更新しない）
    if (mode === "timeattack" && !aborted) {
      const best = this.getBestTime();
      if (best === null || timeSeconds < best) {
        localStorage.setItem(this.KEY_BEST, timeSeconds);
      }
    }

    // 苦手単語更新
    this.updateWrongWords(wrongWords);
  },

  updateWrongWords(wrongWords) {
    const current = this.getWrongWords();
    wrongWords.forEach(w => {
      current[w] = (current[w] || 0) + 1;
    });
    // 正解した単語はカウントを1減らす（全問正解でない単語のみ）
    localStorage.setItem(this.KEY_WRONG, JSON.stringify(current));
  },

  getWrongWords() {
    try {
      return JSON.parse(localStorage.getItem(this.KEY_WRONG) || "{}");
    } catch { return {}; }
  },

  getBestTime() {
    const v = localStorage.getItem(this.KEY_BEST);
    return v !== null ? parseInt(v) : null;
  },

  clearAll() {
    localStorage.removeItem(this.KEY_HISTORY);
    localStorage.removeItem(this.KEY_WRONG);
    localStorage.removeItem(this.KEY_BEST);
  },

  formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return m > 0 ? `${m}分${s}秒` : `${s}秒`;
  }
};
