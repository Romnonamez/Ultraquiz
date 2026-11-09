const QUIZ_FILES = [
  "prelude.json",
  "limbo.json",
  "lust.json",
  "gluttony.json",
  "greed.json",
  "wrath.json",
  "heresy.json",
  "violence.json",
  "fraud.json",
  "secret-levels.json",
  "prime-sanctums.json",
  "encore-levels.json"
];
const QUESTION_COUNT = 10;
const RANKING_KEY = "ultrakill-quiz-ranking-v1";
const views = [...document.querySelectorAll(".view")];
const quizList = document.querySelector("#quiz-list");
const notice = document.querySelector("#notice");
const answerList = document.querySelector("#answer-list");
const confirmButton = document.querySelector("#confirm-button");
const progressTrack = document.querySelector(".progress-track");

let quizzes = [];
let currentQuiz = null;
let roundQuestions = [];
let questionIndex = 0;
let score = 0;
let selectedIndex = null;
let answered = false;
let noticeTimer;

function showNotice(message) {
  notice.textContent = message;
  notice.hidden = false;
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => { notice.hidden = true; }, 5500);
}

function showView(id) {
  for (const view of views) {
    view.classList.toggle("active", view.id === id);
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function shuffle(items) {
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function getAnswerLabel(index) {
  let label = "";
  for (let value = index + 1; value > 0; value = Math.floor((value - 1) / 26)) {
    label = String.fromCharCode(65 + ((value - 1) % 26)) + label;
  }
  return label;
}

function isValidQuiz(quiz) {
  return Boolean(
    quiz &&
    typeof quiz.id === "string" &&
    typeof quiz.title === "string" &&
    typeof quiz.category === "string" &&
    typeof quiz.description === "string" &&
    Array.isArray(quiz.questions) &&
    quiz.questions.length >= 30 &&
    quiz.questions.every((question) =>
      question &&
      typeof question.q === "string" &&
      question.q.trim().length > 0 &&
      typeof question.a === "string" &&
      question.a.trim().length > 0 &&
      Array.isArray(question.wrong) &&
      question.wrong.length >= 1 &&
      question.wrong.every((answer) => typeof answer === "string" && answer.trim().length > 0) &&
      new Set([question.a, ...question.wrong].map((answer) => answer.trim().toLowerCase())).size ===
        question.wrong.length + 1 &&
      typeof question.hint === "string" &&
      (question.image === undefined || typeof question.image === "string") &&
      (question.imageAlt === undefined || typeof question.imageAlt === "string") &&
      (question.imageCaption === undefined || typeof question.imageCaption === "string")
    )
  );
}

async function loadQuizzes() {
  const results = await Promise.allSettled(QUIZ_FILES.map(async (file) => {
    const response = await fetch(file);
    if (!response.ok) {
      throw new Error(`${file}: HTTP ${response.status}`);
    }
    const quiz = await response.json();
    if (!isValidQuiz(quiz)) {
      throw new Error(`${file}: estructura de preguntas inválida (se necesitan al menos 30).`);
    }
    return quiz;
  }));
  const errors = [];
  for (const result of results) {
    if (result.status === "fulfilled") {
      quizzes.push(result.value);
    } else {
      errors.push(result.reason instanceof Error ? result.reason.message : String(result.reason));
    }
  }
  renderQuizCards();
  if (errors.length) {
    showNotice(`No se pudieron cargar todos los archivos. Abre la página desde un servidor local (por ejemplo, Live Server) y revisa: ${errors.join(" | ")}`);
  }
}

function renderQuizCards() {
  quizList.replaceChildren();
  quizzes.forEach((quiz, index) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "quiz-card";
    card.dataset.index = String(index + 1).padStart(2, "0");

    const code = document.createElement("span");
    code.className = "card-code";
    code.textContent = quiz.category;
    const title = document.createElement("span");
    title.className = "card-title";
    title.textContent = quiz.title;
    const description = document.createElement("span");
    description.className = "card-description";
    description.textContent = quiz.description;
    const action = document.createElement("span");
    action.className = "card-action";
    action.textContent = "INICIAR QUIZ →";
    card.append(code, title, description, action);
    card.addEventListener("click", () => startQuiz(quiz));
    quizList.append(card);
  });
  if (!quizzes.length) {
    const message = document.createElement("p");
    message.className = "loading";
    message.textContent = "No hay archivos disponibles. Inicia esta web desde un servidor local para cargar los JSON.";
    quizList.append(message);
  }
}

function startQuiz(quiz) {
  currentQuiz = quiz;
  roundQuestions = shuffle(quiz.questions).slice(0, QUESTION_COUNT);
  questionIndex = 0;
  score = 0;
  document.querySelector("#quiz-title").textContent = quiz.title;
  document.querySelector("#quiz-category").textContent = quiz.category;
  document.querySelector("#score").textContent = "00";
  showView("quiz-view");
  renderQuestion();
}

function renderQuestion() {
  const question = roundQuestions[questionIndex];
  selectedIndex = null;
  answered = false;
  document.querySelector("#question-kicker").textContent = currentQuiz.category;
  document.querySelector("#question-number").textContent =
    `PREGUNTA ${String(questionIndex + 1).padStart(2, "0")} / ${QUESTION_COUNT}`;
  document.querySelector("#question-text").textContent = question.q;
  document.querySelector("#hint-text").textContent = question.hint;
  document.querySelector("#hint-text").hidden = true;
  document.querySelector("#hint-button").hidden = false;
  document.querySelector("#feedback").textContent = "";
  document.querySelector("#feedback").className = "feedback";
  confirmButton.disabled = true;
  confirmButton.innerHTML = 'CONFIRMAR RESPUESTA <span aria-hidden="true">→</span>';

  const imageWrap = document.querySelector("#question-image-wrap");
  const image = document.querySelector("#question-image");
  if (question.image) {
    image.src = question.image;
    image.alt = question.imageAlt || "";
    document.querySelector("#question-image-caption").textContent = question.imageCaption || "";
    imageWrap.hidden = false;
  } else {
    image.removeAttribute("src");
    image.alt = "";
    imageWrap.hidden = true;
  }

  const answers = shuffle([question.a, ...question.wrong]);
  answerList.replaceChildren();
  answers.forEach((answer, index) => {
    const option = document.createElement("button");
    option.type = "button";
    option.className = "answer-option";
    option.setAttribute("role", "radio");
    option.setAttribute("aria-checked", "false");
    const letter = document.createElement("span");
    letter.className = "answer-letter";
    letter.setAttribute("aria-hidden", "true");
    letter.textContent = getAnswerLabel(index);
    const label = document.createElement("span");
    label.textContent = answer;
    option.append(letter, label);
    option.dataset.correct = String(answer === question.a);
    option.addEventListener("click", () => selectAnswer(index));
    answerList.append(option);
  });

  const progress = (questionIndex / QUESTION_COUNT) * 100;
  document.querySelector("#progress-bar").style.width = `${progress}%`;
  progressTrack.setAttribute("aria-valuenow", String(questionIndex));
}

function selectAnswer(index) {
  if (answered) return;
  selectedIndex = index;
  [...answerList.children].forEach((option, optionIndex) => {
    const selected = index === optionIndex;
    option.classList.toggle("selected", selected);
    option.setAttribute("aria-checked", String(selected));
  });
  confirmButton.disabled = false;
}

function confirmAnswer() {
  if (answered) {
    questionIndex += 1;
    if (questionIndex >= roundQuestions.length) {
      showResults();
    } else {
      renderQuestion();
    }
    return;
  }
  if (selectedIndex === null) return;

  answered = true;
  const options = [...answerList.children];
  const wasCorrect = options[selectedIndex].dataset.correct === "true";
  options.forEach((option) => {
    option.disabled = true;
    if (option.dataset.correct === "true") option.classList.add("correct");
  });
  if (wasCorrect) {
    score += 1;
    document.querySelector("#feedback").textContent = "ACIERTO // SANGRE RECUPERADA";
    document.querySelector("#feedback").classList.add("success");
  } else {
    options[selectedIndex].classList.add("incorrect");
    document.querySelector("#feedback").textContent = "FALLO // LA RESPUESTA CORRECTA ESTÁ MARCADA EN VERDE";
    document.querySelector("#feedback").classList.add("failure");
  }
  document.querySelector("#score").textContent = String(score).padStart(2, "0");
  document.querySelector("#progress-bar").style.width =
    `${((questionIndex + 1) / QUESTION_COUNT) * 100}%`;
  progressTrack.setAttribute("aria-valuenow", String(questionIndex + 1));
  confirmButton.innerHTML = questionIndex === roundQuestions.length - 1
    ? 'VER RESULTADO <span aria-hidden="true">→</span>'
    : 'SIGUIENTE PREGUNTA <span aria-hidden="true">→</span>';
}

function showResults() {
  document.querySelector("#final-score").textContent = String(score);
  document.querySelector("#result-message").textContent =
    score === QUESTION_COUNT
      ? "PERFECTO. El Infierno ya conoce tu nombre."
      : score >= 7
        ? "Buen trabajo. La máquina sigue funcionando."
        : score >= 4
          ? "Todavía queda sangre por derramar. Vuelve a intentarlo."
          : "El Infierno no perdona. Estudia y vuelve a descender.";
  document.querySelector("#player-name").value = "";
  document.querySelector("#form-note").textContent =
    "Máximo 16 caracteres. El resultado se guarda en este dispositivo.";
  showView("result-view");
  document.querySelector("#player-name").focus();
}

function readRanking() {
  try {
    const stored = localStorage.getItem(RANKING_KEY);
    if (!stored) return [];
    const ranking = JSON.parse(stored);
    if (!Array.isArray(ranking) || !ranking.every((entry) =>
      entry &&
      typeof entry.name === "string" &&
      Number.isInteger(entry.score) &&
      entry.score >= 0 &&
      entry.score <= QUESTION_COUNT &&
      typeof entry.quiz === "string" &&
      Number.isFinite(entry.date)
    )) {
      throw new Error("El formato de la tabla guardada no es válido.");
    }
    return ranking;
  } catch (error) {
    showNotice(`No se pudo leer la tabla local: ${error.message}`);
    return [];
  }
}

function renderRanking() {
  const list = document.querySelector("#ranking-list");
  list.replaceChildren();
  const ranking = readRanking()
    .sort((a, b) => b.score - a.score || a.date - b.date)
    .slice(0, 10);
  if (!ranking.length) {
    const empty = document.createElement("li");
    empty.className = "empty-ranking";
    empty.textContent = "Aún no hay puntuaciones. Sé el primero en entrar en la tabla.";
    list.append(empty);
    return;
  }
  for (const entry of ranking) {
    const item = document.createElement("li");
    const name = document.createElement("span");
    name.className = "rank-name";
    name.textContent = entry.name;
    const detail = document.createElement("span");
    detail.className = "rank-detail";
    detail.textContent = `${entry.score}/${QUESTION_COUNT} · ${entry.quiz}`;
    item.append(name, detail);
    list.append(item);
  }
}

function saveScore(event) {
  event.preventDefault();
  const nameInput = document.querySelector("#player-name");
  const name = nameInput.value.trim().replace(/\s+/g, " ").slice(0, 16);
  if (!name) {
    nameInput.setCustomValidity("Escribe un nombre antes de registrar la puntuación.");
    nameInput.reportValidity();
    return;
  }
  nameInput.setCustomValidity("");
  try {
    const ranking = readRanking();
    ranking.push({
      name,
      score,
      quiz: currentQuiz.title,
      date: Date.now()
    });
    localStorage.setItem(RANKING_KEY, JSON.stringify(ranking));
    document.querySelector("#form-note").textContent = "Puntuación registrada. ¡Nos vemos en el Infierno!";
    renderRanking();
    showNotice("Puntuación guardada en la tabla de sangre.");
  } catch (error) {
    document.querySelector("#form-note").textContent = "No se pudo guardar la puntuación en este navegador.";
    showNotice(`Error al guardar la puntuación: ${error.message}`);
  }
}

document.querySelector("#hint-button").addEventListener("click", () => {
  document.querySelector("#hint-text").hidden = false;
  document.querySelector("#hint-button").hidden = true;
});
confirmButton.addEventListener("click", confirmAnswer);
document.querySelector("#score-form").addEventListener("submit", saveScore);
document.querySelector("#quit-button").addEventListener("click", () => showView("home-view"));
document.querySelector("#result-home-button").addEventListener("click", () => {
  showView("home-view");
  renderRanking();
});
document.querySelector("#home-link").addEventListener("click", (event) => {
  event.preventDefault();
  showView("home-view");
  renderRanking();
});

renderRanking();
loadQuizzes();
