/*
 * Bộ máy trắc nghiệm dùng chung cho Holland, MI, MBTI, DISC, Motivators.
 * Mỗi bài test là 1 file JSON trong /data. Kết quả lưu vào localStorage
 * theo khóa `dhnn_result_<testId>` để trang profile.html tổng hợp lại.
 */

const RESULT_PREFIX = "dhnn_result_";

async function loadQuiz(testId) {
  const res = await fetch(`data/${testId}.json`);
  if (!res.ok) throw new Error(`Không tải được dữ liệu bài test "${testId}"`);
  return res.json();
}

function renderQuiz(quiz, container) {
  const header = document.createElement("div");
  header.className = "quiz-header";
  header.innerHTML = `
    <h2>${quiz.title}</h2>
    <p class="quiz-subtitle">${quiz.subtitle}</p>
    <p class="quiz-instructions">${quiz.instructions}</p>
    <p class="quiz-tip">👆 Chọn đáp án xong, trang sẽ tự chuyển tới câu tiếp theo. Thanh ở cuối màn hình cho biết bạn đã làm được bao nhiêu câu.</p>
  `;
  container.appendChild(header);

  const form = document.createElement("form");
  form.id = "quiz-form";
  form.className = "quiz-form";
  // Tự kiểm tra câu còn trống để đưa học sinh tới đúng câu đó, thay cho bong bóng lỗi nhỏ của trình duyệt.
  form.noValidate = true;

  if (quiz.scaleType === "likert5") {
    quiz.questions.forEach((q, i) => form.appendChild(renderLikertQuestion(q, i, quiz.scaleLabels)));
  } else if (quiz.scaleType === "binary_choice") {
    quiz.questions.forEach((q, i) => form.appendChild(renderBinaryQuestion(q, i)));
  }

  // Thanh tiến độ và nút nộp bài luôn nằm ở cuối màn hình trong lúc làm bài.
  const submitWrap = document.createElement("div");
  submitWrap.className = "quiz-submit-wrap";
  submitWrap.innerHTML = `
    <div class="quiz-progress-info">
      <p id="quiz-remaining" class="quiz-remaining" aria-live="polite"></p>
      <div class="quiz-progress"><div class="quiz-progress-bar" id="quiz-progress-bar"></div></div>
    </div>
    <button type="submit" class="btn btn-primary" id="quiz-submit-btn">Xem kết quả</button>
  `;
  form.appendChild(submitWrap);

  container.appendChild(form);

  // Chỉ tự chuyển câu khi chạm/bấm chuột; người dùng bàn phím dùng phím mũi tên sẽ không bị cuộn đi mất.
  let pointerAnswer = false;
  form.addEventListener("pointerdown", () => { pointerAnswer = true; });
  form.addEventListener("keydown", () => { pointerAnswer = false; });

  form.addEventListener("change", (event) => {
    const question = event.target.closest(".quiz-question");
    const firstAnswer = question && !question.classList.contains("is-answered");
    updateProgress(quiz, form);
    if (firstAnswer && pointerAnswer) goToNextQuestion(form, question);
  });

  // Chạy trước trình xử lý nộp bài của trang: còn câu trống thì dừng lại và đưa tới câu đó.
  form.addEventListener("submit", (event) => {
    const questions = Array.from(form.querySelectorAll(".quiz-question"));
    const missing = questions.filter((q) => !q.classList.contains("is-answered"));
    if (!missing.length) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const first = missing[0];
    first.classList.remove("is-missing");
    void first.offsetWidth; // chạy lại hiệu ứng nhấp nháy nếu bấm nhiều lần
    first.classList.add("is-missing");
    const remaining = document.getElementById("quiz-remaining");
    if (remaining) remaining.textContent = `Còn ${missing.length} câu chưa trả lời. Đã đưa bạn tới câu ${questions.indexOf(first) + 1}.`;
    scrollToQuestion(first);
    first.querySelector("input")?.focus({ preventScroll: true });
  });

  updateProgress(quiz, form);

  return form;
}

function scrollToQuestion(question) {
  const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  question.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
}

function goToNextQuestion(form, current) {
  const questions = Array.from(form.querySelectorAll(".quiz-question"));
  const index = questions.indexOf(current);
  const unanswered = (q) => !q.classList.contains("is-answered");
  const next = questions.slice(index + 1).find(unanswered) || questions.slice(0, index).find(unanswered);
  if (next) window.setTimeout(() => scrollToQuestion(next), 250);
}

function renderLikertQuestion(q, index, scaleLabels) {
  const wrap = document.createElement("div");
  wrap.className = "quiz-question";
  wrap.dataset.questionId = q.id;
  const options = scaleLabels
    .map(
      (label, i) => `
      <label class="likert-option">
        <input type="radio" name="${q.id}" value="${i + 1}" required />
        <span class="likert-dot" aria-hidden="true"></span>
        <span class="likert-label">${label}</span>
      </label>`
    )
    .join("");
  wrap.innerHTML = `
    <p class="question-text"><span class="question-index">${index + 1}.</span> ${q.text}</p>
    <div class="likert-scale">${options}</div>
  `;
  return wrap;
}

function renderBinaryQuestion(q, index) {
  const wrap = document.createElement("div");
  wrap.className = "quiz-question";
  wrap.dataset.questionId = q.id;
  wrap.innerHTML = `
    <p class="question-text"><span class="question-index">${index + 1}.</span></p>
    <div class="binary-choice">
      <label class="binary-option">
        <input type="radio" name="${q.id}" value="${q.optionA.letter}" required />
        <span>${q.optionA.text}</span>
      </label>
      <label class="binary-option">
        <input type="radio" name="${q.id}" value="${q.optionB.letter}" required />
        <span>${q.optionB.text}</span>
      </label>
    </div>
  `;
  return wrap;
}

function updateProgress(quiz, form) {
  const total = quiz.questions.length;
  let answered = 0;
  quiz.questions.forEach((q) => {
    const isAnswered = Boolean(form.elements[q.id] && form.elements[q.id].value);
    if (isAnswered) answered += 1;
    const wrap = form.querySelector(`[data-question-id="${q.id}"]`);
    if (!wrap) return;
    wrap.classList.toggle("is-answered", isAnswered);
    if (isAnswered) wrap.classList.remove("is-missing");
  });
  const bar = document.getElementById("quiz-progress-bar");
  const remaining = document.getElementById("quiz-remaining");
  const submit = document.getElementById("quiz-submit-btn");
  if (bar) bar.style.width = `${Math.round((answered / total) * 100)}%`;
  if (remaining) {
    remaining.textContent =
      answered === total ? "Đã trả lời đủ! Bấm “Xem kết quả”." : `Đã trả lời ${answered}/${total} câu`;
  }
  if (submit) submit.classList.toggle("is-ready", answered === total);
}

function collectAnswers(quiz, form) {
  const answers = {};
  quiz.questions.forEach((q) => {
    const field = form.elements[q.id];
    answers[q.id] = field ? field.value : null;
  });
  return answers;
}

function scoreLikert(quiz, answers) {
  const totals = {};
  const counts = {};
  quiz.dimensions.forEach((d) => {
    totals[d.code] = 0;
    counts[d.code] = 0;
  });
  quiz.questions.forEach((q) => {
    const val = Number(answers[q.id]);
    if (!val) return;
    totals[q.dimension] += val;
    counts[q.dimension] += 1;
  });
  const scores = quiz.dimensions.map((d) => {
    const avg = counts[d.code] ? totals[d.code] / counts[d.code] : 0;
    const percent = Math.round(((avg - 1) / 4) * 100); // scale 1-5 -> 0-100%
    return { code: d.code, name: d.name, percent: Math.max(0, percent) };
  });
  scores.sort((a, b) => b.percent - a.percent);
  return { type: "likert5", dimensions: scores };
}

function scoreBinary(quiz, answers) {
  const counts = {};
  quiz.axes.forEach((axis) => {
    counts[axis.pair[0]] = 0;
    counts[axis.pair[1]] = 0;
  });
  quiz.questions.forEach((q) => {
    const val = answers[q.id];
    if (val) counts[val] = (counts[val] || 0) + 1;
  });
  const letters = quiz.axes.map((axis) => {
    const [a, b] = axis.pair;
    return counts[a] >= counts[b] ? a : b;
  });
  const code = letters.join("");
  const breakdown = quiz.axes.map((axis, i) => ({
    axis: axis.name,
    pair: axis.pair,
    counts: { [axis.pair[0]]: counts[axis.pair[0]], [axis.pair[1]]: counts[axis.pair[1]] },
    result: letters[i],
  }));
  return { type: "binary_choice", code, breakdown };
}

function renderResults(quiz, result, container) {
  container.innerHTML = "";
  const wrap = document.createElement("div");
  wrap.className = "results-panel";

  if (result.type === "likert5") {
    const bars = result.dimensions
      .map(
        (d) => `
        <div class="result-bar-row">
          <div class="result-bar-label">${d.name}</div>
          <div class="result-bar-track">
            <div class="result-bar-fill" style="width:${d.percent}%"></div>
          </div>
          <div class="result-bar-value">${d.percent}%</div>
        </div>`
      )
      .join("");
    const top = result.dimensions.slice(0, 3).map((d) => d.name).join(", ");
    wrap.innerHTML = `
      <h2>Kết quả: ${quiz.title}</h2>
      <p class="result-highlight">Xu hướng nổi bật của bạn: <strong>${top}</strong></p>
      <div class="result-bars">${bars}</div>
    `;
  } else if (result.type === "binary_choice") {
    const rows = result.breakdown
      .map(
        (b) => `
        <div class="result-bar-row">
          <div class="result-bar-label">${b.axis}</div>
          <div class="result-bar-value">${b.pair[0]}: ${b.counts[b.pair[0]]} &nbsp;/&nbsp; ${b.pair[1]}: ${b.counts[b.pair[1]]}</div>
        </div>`
      )
      .join("");
    wrap.innerHTML = `
      <h2>Kết quả: ${quiz.title}</h2>
      <p class="result-highlight">Mã tính cách của bạn: <strong>${result.code}</strong></p>
      <div class="result-bars">${rows}</div>
    `;
  }

  const actions = document.createElement("div");
  actions.className = "result-actions";
  actions.innerHTML = `
    <a class="btn btn-primary" href="profile.html">Xem hồ sơ tổng hợp</a>
    <a class="btn btn-secondary" href="assessments.html">Làm bài test khác</a>
  `;
  wrap.appendChild(actions);
  container.appendChild(wrap);
}

function saveResult(testId, result) {
  const payload = { testId, result, completedAt: new Date().toISOString() };
  try {
    localStorage.setItem(RESULT_PREFIX + testId, JSON.stringify(payload));
    return true;
  } catch {
    // Trình duyệt chặn bộ nhớ (chế độ riêng tư, hết dung lượng): vẫn hiện kết quả nhưng không lưu được.
    return false;
  }
}

function getResult(testId) {
  try {
    const raw = localStorage.getItem(RESULT_PREFIX + testId);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function getAllResults() {
  const ids = ["holland", "mi", "mbti", "disc", "motivators"];
  const results = {};
  ids.forEach((id) => {
    const r = getResult(id);
    if (r) results[id] = r;
  });
  return results;
}

function clearAllResults() {
  ["holland", "mi", "mbti", "disc", "motivators"].forEach((id) => localStorage.removeItem(RESULT_PREFIX + id));
}

// API công khai cho các trang HTML gọi qua thẻ <script> thường (không dùng module)
window.QuizEngine = {
  loadQuiz,
  renderQuiz,
  collectAnswers,
  scoreLikert,
  scoreBinary,
  renderResults,
  saveResult,
  getResult,
  getAllResults,
  clearAllResults,
};
