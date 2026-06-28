const sessions = {
  5: {
    title: "Introduction to Deep Learning in Food Research",
    times: [
      1.5, 2, 1.5, 2, 2, 3, 3, 2, 3, 2, 2, 2, 2, 3, 3, 3.5, 3, 3,
      2, 2, 2, 2, 2.5, 2.5, 2.5, 2, 2.5, 2, 2, 3.5, 2.5, 3.5, 2.5, 3.5, 2
    ].map((minutes) => minutes * 60)
  },
  6: {
    title: "Deep Learning Hands-on",
    times: [1, ...Array(37).fill(2), 3, 5, 2].map((minutes) => minutes * 60)
  }
};

function requestedSession() {
  const fromUrl = new URLSearchParams(window.location.search).get("session");
  if (sessions[fromUrl]) return Number(fromUrl);
  const saved = localStorage.getItem("cue-card-session");
  return sessions[saved] ? Number(saved) : 5;
}

const initialSession = requestedSession();
const initialIndex = Number.parseInt(
  localStorage.getItem(`cue-card-index-${initialSession}`) || "0",
  10
);

const state = {
  sessionId: initialSession,
  index: Math.min(Math.max(initialIndex, 0), sessions[initialSession].times.length - 1),
  remaining: 0,
  running: false,
  lastTick: null,
  animationFrame: null
};

const elements = {
  root: document.documentElement,
  sessionNumber: document.querySelector("#sessionNumber"),
  sessionSelect: document.querySelector("#sessionSelect"),
  downloadLink: document.querySelector("#downloadLink"),
  planLabel: document.querySelector("#planLabel"),
  cardImage: document.querySelector("#cardImage"),
  cardStage: document.querySelector("#cardStage"),
  slideCounter: document.querySelector("#slideCounter"),
  timeDisplay: document.querySelector("#timeDisplay"),
  timerState: document.querySelector("#timerState"),
  timerProgress: document.querySelector("#timerProgress"),
  timeUp: document.querySelector("#timeUp"),
  previousButton: document.querySelector("#previousButton"),
  nextButton: document.querySelector("#nextButton"),
  playButton: document.querySelector("#playButton"),
  playLabel: document.querySelector("#playLabel"),
  playIcon: document.querySelector("#playIcon"),
  resetButton: document.querySelector("#resetButton"),
  autoAdvance: document.querySelector("#autoAdvance"),
  fullscreenButton: document.querySelector("#fullscreenButton")
};

function currentSession() {
  return sessions[state.sessionId];
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function formatTime(seconds) {
  const safeSeconds = Math.max(0, Math.ceil(seconds));
  return `${pad(Math.floor(safeSeconds / 60))}:${pad(safeSeconds % 60)}`;
}

function totalForCurrentSlide() {
  return currentSession().times[state.index];
}

function updateTimerUI() {
  const ratio = Math.max(0, state.remaining / totalForCurrentSlide());
  elements.root.style.setProperty("--progress", `${ratio * 100}%`);
  elements.timeDisplay.textContent = formatTime(state.remaining);
  elements.timerProgress.classList.toggle("warning", ratio <= 0.25 && ratio > 0.1);
  elements.timerProgress.classList.toggle("critical", ratio <= 0.1);
  elements.timeUp.classList.toggle("visible", state.remaining <= 0);

  if (state.remaining <= 0) {
    elements.timerState.textContent = "Time";
  } else if (state.running) {
    elements.timerState.textContent = "Speaking";
  } else if (state.remaining < totalForCurrentSlide()) {
    elements.timerState.textContent = "Paused";
  } else {
    elements.timerState.textContent = "Ready";
  }
}

function updatePlayButton() {
  elements.playButton.setAttribute("aria-pressed", String(state.running));
  elements.playIcon.textContent = state.running ? "Ⅱ" : "▶";
  elements.playLabel.textContent = state.running ? "Pause" : "Start timer";
}

function resetTimer(keepRunning = false) {
  state.remaining = totalForCurrentSlide();
  state.lastTick = performance.now();
  state.running = keepRunning;
  updateTimerUI();
  updatePlayButton();
  if (state.running) scheduleTick();
}

function scheduleTick() {
  cancelAnimationFrame(state.animationFrame);
  state.animationFrame = requestAnimationFrame(tick);
}

function tick(now) {
  if (!state.running) return;
  const elapsed = Math.max(0, (now - state.lastTick) / 1000);
  state.lastTick = now;
  state.remaining = Math.max(0, state.remaining - elapsed);
  updateTimerUI();

  if (state.remaining <= 0) {
    state.running = false;
    updatePlayButton();
    if (navigator.vibrate) navigator.vibrate([120, 80, 120]);
    if (elements.autoAdvance.checked && state.index < currentSession().times.length - 1) {
      window.setTimeout(() => goToSlide(state.index + 1, 1, true), 900);
    }
    return;
  }
  scheduleTick();
}

function toggleTimer() {
  if (state.remaining <= 0) {
    resetTimer(true);
    return;
  }
  state.running = !state.running;
  state.lastTick = performance.now();
  updateTimerUI();
  updatePlayButton();
  if (state.running) scheduleTick();
}

function updateSessionUI() {
  const session = currentSession();
  elements.sessionNumber.textContent = pad(state.sessionId);
  elements.sessionSelect.value = String(state.sessionId);
  elements.downloadLink.href = `assets/session-${state.sessionId}/Speaker%20Cue%20Cards.pdf`;
  elements.downloadLink.setAttribute(
    "download",
    `Session ${state.sessionId} - Speaker Cue Cards.pdf`
  );
  elements.planLabel.textContent = "85-minute plan · 5-minute buffer";
  localStorage.setItem("cue-card-session", String(state.sessionId));

  const url = new URL(window.location.href);
  url.searchParams.set("session", state.sessionId);
  window.history.replaceState({}, "", url);
  document.documentElement.dataset.session = state.sessionId;
}

function updateSlideUI() {
  const session = currentSession();
  const number = state.index + 1;
  elements.cardImage.src = `assets/session-${state.sessionId}/cards/${pad(number)}.webp`;
  elements.cardImage.alt = `Session ${state.sessionId} speaker cue card for slide ${number}`;
  elements.slideCounter.textContent = `Session ${state.sessionId} · Slide ${pad(number)} / ${session.times.length}`;
  elements.previousButton.disabled = state.index === 0;
  elements.nextButton.disabled = state.index === session.times.length - 1;
  localStorage.setItem(`cue-card-index-${state.sessionId}`, String(state.index));
  document.title = `Session ${state.sessionId} · Slide ${number} · Food Research Cue Cards`;

  const nextNumber = number + 1;
  if (nextNumber <= session.times.length) {
    const preload = new Image();
    preload.src = `assets/session-${state.sessionId}/cards/${pad(nextNumber)}.webp`;
  }
}

function switchSession(sessionId) {
  const nextId = Number(sessionId);
  if (!sessions[nextId] || nextId === state.sessionId) return;
  state.running = false;
  cancelAnimationFrame(state.animationFrame);
  state.sessionId = nextId;
  const savedIndex = Number.parseInt(
    localStorage.getItem(`cue-card-index-${nextId}`) || "0",
    10
  );
  state.index = Math.min(Math.max(savedIndex, 0), currentSession().times.length - 1);
  updateSessionUI();
  updateSlideUI();
  resetTimer(false);
}

function goToSlide(index, direction, keepRunning = state.running) {
  if (index < 0 || index >= currentSession().times.length || index === state.index) return;
  const leaveClass = direction > 0 ? "is-leaving-left" : "is-leaving-right";
  const enterClass = direction > 0 ? "is-entering-left" : "is-entering-right";
  elements.cardStage.classList.add(leaveClass);

  window.setTimeout(() => {
    elements.cardStage.classList.remove(leaveClass);
    state.index = index;
    updateSlideUI();
    resetTimer(keepRunning);
    elements.cardStage.classList.add(enterClass);
    window.setTimeout(() => elements.cardStage.classList.remove(enterClass), 250);
  }, 165);
}

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen?.();
  } else {
    document.exitFullscreen?.();
  }
}

elements.sessionSelect.addEventListener("change", (event) => switchSession(event.target.value));
elements.previousButton.addEventListener("click", () => goToSlide(state.index - 1, -1));
elements.nextButton.addEventListener("click", () => goToSlide(state.index + 1, 1));
elements.playButton.addEventListener("click", toggleTimer);
elements.resetButton.addEventListener("click", () => resetTimer(false));
elements.fullscreenButton.addEventListener("click", toggleFullscreen);

document.addEventListener("keydown", (event) => {
  if (event.target.matches("input, select")) return;
  if (event.key === "ArrowLeft") {
    event.preventDefault();
    goToSlide(state.index - 1, -1);
  }
  if (event.key === "ArrowRight") {
    event.preventDefault();
    goToSlide(state.index + 1, 1);
  }
  if (event.code === "Space") {
    event.preventDefault();
    toggleTimer();
  }
  if (event.key.toLowerCase() === "r") resetTimer(false);
  if (event.key.toLowerCase() === "f") toggleFullscreen();
});

let touchStartX = null;
elements.cardStage.addEventListener("touchstart", (event) => {
  touchStartX = event.changedTouches[0].clientX;
}, { passive: true });
elements.cardStage.addEventListener("touchend", (event) => {
  if (touchStartX === null) return;
  const distance = event.changedTouches[0].clientX - touchStartX;
  if (Math.abs(distance) > 55) {
    goToSlide(state.index + (distance < 0 ? 1 : -1), distance < 0 ? 1 : -1);
  }
  touchStartX = null;
}, { passive: true });

updateSessionUI();
state.remaining = totalForCurrentSlide();
updateSlideUI();
updateTimerUI();
updatePlayButton();
