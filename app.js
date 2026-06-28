const slideTimes = [
  1.5, 2, 1.5, 2, 2, 3, 3, 2, 3, 2, 2, 2, 2, 3, 3, 3.5, 3, 3,
  2, 2, 2, 2, 2.5, 2.5, 2.5, 2, 2.5, 2, 2, 3.5, 2.5, 3.5, 2.5, 3.5, 2
].map((minutes) => minutes * 60);

const state = {
  index: Math.min(
    Math.max(Number.parseInt(localStorage.getItem("cue-card-index") || "0", 10), 0),
    slideTimes.length - 1
  ),
  remaining: 0,
  running: false,
  lastTick: null,
  animationFrame: null
};

const elements = {
  root: document.documentElement,
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

function pad(value) {
  return String(value).padStart(2, "0");
}

function formatTime(seconds) {
  const safeSeconds = Math.max(0, Math.ceil(seconds));
  return `${pad(Math.floor(safeSeconds / 60))}:${pad(safeSeconds % 60)}`;
}

function totalForCurrentSlide() {
  return slideTimes[state.index];
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
    if (elements.autoAdvance.checked && state.index < slideTimes.length - 1) {
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

function updateSlideUI() {
  const number = state.index + 1;
  elements.cardImage.src = `assets/cards/${pad(number)}.webp`;
  elements.cardImage.alt = `Speaker cue card for slide ${number}`;
  elements.slideCounter.textContent = `Slide ${pad(number)} / ${slideTimes.length}`;
  elements.previousButton.disabled = state.index === 0;
  elements.nextButton.disabled = state.index === slideTimes.length - 1;
  localStorage.setItem("cue-card-index", String(state.index));
  document.title = `Slide ${number} · Session 5 Cue Cards`;

  const nextNumber = number + 1;
  if (nextNumber <= slideTimes.length) {
    const preload = new Image();
    preload.src = `assets/cards/${pad(nextNumber)}.webp`;
  }
}

function goToSlide(index, direction, keepRunning = state.running) {
  if (index < 0 || index >= slideTimes.length || index === state.index) return;
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

elements.previousButton.addEventListener("click", () => goToSlide(state.index - 1, -1));
elements.nextButton.addEventListener("click", () => goToSlide(state.index + 1, 1));
elements.playButton.addEventListener("click", toggleTimer);
elements.resetButton.addEventListener("click", () => resetTimer(false));
elements.fullscreenButton.addEventListener("click", toggleFullscreen);

document.addEventListener("keydown", (event) => {
  if (event.target.matches("input")) return;
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

state.remaining = totalForCurrentSlide();
updateSlideUI();
updateTimerUI();
updatePlayButton();
