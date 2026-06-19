"use strict";

const VIDEO_DIR = "assets/videos/";
const PREVIEW_VIDEO_DIR = "assets/preview-videos/";
const LATE_HOI_RATE = 0.1;
const MAX_DRAW_COUNT = 3;
const REWARD_STREAK = 5;
const MISSING_CLIP_MS = 700;

const CLIPS = {
  idle: "idle.mp4",
  janken: "janken.mp4",
  hoi: "hoi.mp4",
  aiko: "aiko.mp4",
  aikoHoi: "aiko_hoi.mp4",
  aikoComment: "aiko_comment.mp4",
  lateHoi: "late_hoi.mp4",
  opponentRock: "gu-.MP4",
  opponentScissors: "choki.MP4",
  opponentPaper: "pa-.MP4",
  win: "win.mp4",
  lose: "lose.mp4",
  draw: "draw.mp4",
  cheat: "cheat.mp4",
  reward: "gohoubi.MP4",
};

const PREVIEW_CLIPS = Array.from({ length: 10 }, (_, index) => {
  const number = String(index + 1).padStart(2, "0");
  return { file: `pre_${number}.mp4`, label: `pre_${number}.mp4` };
});

const HANDS = ["rock", "scissors", "paper"];
const HAND_LABELS = {
  rock: "\u30b0\u30fc",
  scissors: "\u30c1\u30e7\u30ad",
  paper: "\u30d1\u30fc",
};
const WINNING_HAND = {
  rock: "paper",
  scissors: "rock",
  paper: "scissors",
};
const LOSING_HAND = {
  rock: "scissors",
  scissors: "paper",
  paper: "rock",
};

const cameraVideo = document.getElementById("cameraVideo");
const actorVideo = document.getElementById("actorVideo");
const actorCanvas = document.getElementById("actorCanvas");
const ctx = actorCanvas.getContext("2d", { willReadFrequently: true });
const startOverlay = document.getElementById("startOverlay");
const statusPanel = document.querySelector(".status-panel");
const statusToggleButton = document.getElementById("statusToggleButton");
const startButton = document.getElementById("startButton");
const roundButton = document.getElementById("roundButton");
const topButton = document.getElementById("topButton");
const skipButton = document.getElementById("skipButton");
const resultBadge = document.getElementById("resultBadge");
const previewModeButton = document.getElementById("previewModeButton");
const previewPanel = document.getElementById("previewPanel");
const previewToggleButton = document.getElementById("previewToggleButton");
const previewControls = document.getElementById("previewControls");
const previewSelect = document.getElementById("previewSelect");
const previewStartSelect = document.getElementById("previewStartSelect");
const previewEndSelect = document.getElementById("previewEndSelect");
const currentTimeSlider = document.getElementById("currentTimeSlider");
const segmentStartSlider = document.getElementById("segmentStartSlider");
const segmentEndSlider = document.getElementById("segmentEndSlider");
const actorScaleSlider = document.getElementById("actorScaleSlider");
const currentTimeText = document.getElementById("currentTimeText");
const segmentStartText = document.getElementById("segmentStartText");
const segmentEndText = document.getElementById("segmentEndText");
const actorScaleText = document.getElementById("actorScaleText");
const previewPlayButton = document.getElementById("previewPlayButton");
const previewRangeButton = document.getElementById("previewRangeButton");
const segmentPlayButton = document.getElementById("segmentPlayButton");
const segmentLoopButton = document.getElementById("segmentLoopButton");
const previewStopButton = document.getElementById("previewStopButton");
const previewSlowButton = document.getElementById("previewSlowButton");
const previewFastButton = document.getElementById("previewFastButton");
const previewTopButton = document.getElementById("previewTopButton");
const startHint = document.getElementById("startHint");
const stateText = document.getElementById("stateText");
const handsText = document.getElementById("handsText");
const streakText = document.getElementById("streakText");
const missingText = document.getElementById("missingText");
const handButtons = Array.from(document.querySelectorAll(".hand-button"));
const opponentButtons = Array.from(document.querySelectorAll(".opponent-button"));

const OPPONENT_LABELS = {
  default: "\u76f8\u624b A",
  speed: "\u76f8\u624b B",
  boss: "\u76f8\u624b C",
};
const OPPONENT_UNLOCK_KEY = "jankenUnlockedOpponents";
const opponentUnlocked = loadUnlockedOpponents();

let started = false;
let busy = true;
let acceptingHand = false;
let awaitingAikoHand = false;
let playerStreak = 0;
let drawCount = 0;
let lastPlayerHand = null;
let lastOpponentHand = null;
let clipToken = 0;
let renderStarted = false;
let cameraStarted = false;
let previewMode = false;
let previewSequenceToken = 0;
let segmentLoopEnabled = false;
let segmentPlaybackActive = false;
let syncingTimeline = false;
let actorScale = 1;
let actorOffsetX = 0;
let actorOffsetY = 0;
let gestureStartDistance = 0;
let gestureStartScale = 1;
let dragStartX = 0;
let dragStartY = 0;
let dragStartOffsetX = 0;
let dragStartOffsetY = 0;
let currentSkip = null;
let selectedOpponent = "default";
const missingFiles = new Set();

populatePreviewSelect();
refreshOpponentLocks();
statusToggleButton.addEventListener("click", toggleStatusPanel);
startButton.addEventListener("click", startApp);
topButton.addEventListener("click", returnToTopFromGame);
previewModeButton.addEventListener("click", enterPreviewMode);
previewToggleButton.addEventListener("click", togglePreviewControls);
previewPlayButton.addEventListener("click", playSelectedPreview);
previewRangeButton.addEventListener("click", playPreviewRange);
segmentPlayButton.addEventListener("click", playPreviewSegment);
segmentLoopButton.addEventListener("click", togglePreviewSegmentLoop);
previewStopButton.addEventListener("click", stopPreviewVideo);
previewSlowButton.addEventListener("click", () => {
  actorVideo.playbackRate = 0.5;
  updateState("\u30b9\u30ed\u30fc\u518d\u751f");
});
previewFastButton.addEventListener("click", () => {
  actorVideo.playbackRate = 2;
  updateState("\u500d\u901f\u518d\u751f");
});
previewTopButton.addEventListener("click", returnToTopFromPreview);
previewSelect.addEventListener("change", loadSelectedPreviewMetadata);
currentTimeSlider.addEventListener("input", () => {
  if (syncingTimeline) return;
  actorVideo.currentTime = Number(currentTimeSlider.value);
  updateTimelineLabels();
});
segmentStartSlider.addEventListener("input", () => {
  if (Number(segmentStartSlider.value) > Number(segmentEndSlider.value)) {
    segmentEndSlider.value = segmentStartSlider.value;
  }
  actorVideo.currentTime = Number(segmentStartSlider.value);
  updateTimelineLabels();
});
segmentEndSlider.addEventListener("input", () => {
  if (Number(segmentEndSlider.value) < Number(segmentStartSlider.value)) {
    segmentStartSlider.value = segmentEndSlider.value;
  }
  updateTimelineLabels();
});
actorScaleSlider.addEventListener("input", () => {
  actorScale = Number(actorScaleSlider.value) || 1;
  actorScaleText.textContent = `${Math.round(actorScale * 100)}%`;
});
actorCanvas.addEventListener("touchstart", handleActorTouchStart, { passive: false });
actorCanvas.addEventListener("touchmove", handleActorTouchMove, { passive: false });
actorCanvas.addEventListener("touchend", handleActorTouchEnd, { passive: false });
actorCanvas.addEventListener("touchcancel", handleActorTouchEnd, { passive: false });
actorVideo.addEventListener("loadedmetadata", syncTimelineToVideo);
actorVideo.addEventListener("timeupdate", handlePreviewTimeUpdate);
skipButton.addEventListener("click", () => {
  if (currentSkip) {
    currentSkip();
  }
});
roundButton.addEventListener("click", () => {
  if (!busy) {
    beginRound(awaitingAikoHand);
  }
});
handButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const hand = button.dataset.hand;
    if (acceptingHand && hand) {
      chooseHand(hand, awaitingAikoHand);
    }
  });
});
opponentButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const opponent = button.dataset.opponent || "default";
    if (!opponentUnlocked[opponent]) return;
    selectedOpponent = opponent;
    opponentButtons.forEach((item) => {
      item.classList.toggle("is-selected", item === button);
    });
    updateHands();
  });
});
window.addEventListener("resize", resizeCanvas);
window.addEventListener("orientationchange", resizeCanvas);

async function startApp() {
  if (started) return;
  started = true;
  startButton.disabled = true;
  startHint.textContent = "\u8d77\u52d5\u4e2d...";
  updateState("\u4eba\u7269\u52d5\u753b\u3092\u8d77\u52d5\u4e2d...");
  resizeCanvas();
  startRenderLoop();
  await playClip("idle", { loop: true });
  updateState("\u30ab\u30e1\u30e9\u3092\u8d77\u52d5\u4e2d...");

  try {
    await startCamera();
  } catch (error) {
    updateState("\u30ab\u30e1\u30e9\u3092\u8d77\u52d5\u3067\u304d\u307e\u305b\u3093\u3067\u3057\u305f\u3002HTTPS\u3068\u30ab\u30e1\u30e9\u8a31\u53ef\u3092\u78ba\u8a8d\u3057\u3066\u304f\u3060\u3055\u3044\u3002");
    startHint.textContent = error.message || "\u30ab\u30e1\u30e9\u8d77\u52d5\u30a8\u30e9\u30fc";
    startButton.disabled = false;
    started = false;
    return;
  }

  startOverlay.classList.add("is-hidden");
  topButton.hidden = false;
  setReady("\u3058\u3083\u3093\u3051\u3093\u3092\u59cb\u3081\u307e\u3057\u3087\u3046");
}

async function startCamera() {
  if (cameraStarted && cameraVideo.srcObject) {
    return;
  }

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error("\u3053\u306e\u30d6\u30e9\u30a6\u30b6\u306f\u30ab\u30e1\u30e9API\u306b\u5bfe\u5fdc\u3057\u3066\u3044\u307e\u305b\u3093\u3002");
  }

  const constraints = {
    audio: false,
    video: {
      facingMode: { ideal: "environment" },
      width: { ideal: 1280 },
      height: { ideal: 720 },
    },
  };
  const stream = await navigator.mediaDevices.getUserMedia(constraints);
  cameraVideo.srcObject = stream;
  await cameraVideo.play();
  cameraStarted = true;
}

function startRenderLoop() {
  if (renderStarted) return;
  renderStarted = true;
  requestAnimationFrame(renderActor);
}

function renderActor() {
  if (actorCanvas.width && actorCanvas.height) {
    ctx.clearRect(0, 0, actorCanvas.width, actorCanvas.height);
  }

  if (actorVideo.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && actorVideo.videoWidth > 0) {
    drawKeyedVideo();
  }

  requestAnimationFrame(renderActor);
}

function drawKeyedVideo() {
  const canvasW = actorCanvas.width;
  const canvasH = actorCanvas.height;
  const videoW = actorVideo.videoWidth;
  const videoH = actorVideo.videoHeight;
  const scale = Math.min(canvasW / videoW, canvasH / videoH) * actorScale;
  const drawW = Math.round(videoW * scale);
  const drawH = Math.round(videoH * scale);
  const ratioX = canvasW / window.innerWidth;
  const ratioY = canvasH / window.innerHeight;
  const drawX = Math.round((canvasW - drawW) / 2 + actorOffsetX * ratioX);
  const drawY = Math.round(canvasH - drawH + actorOffsetY * ratioY);

  ctx.drawImage(actorVideo, drawX, drawY, drawW, drawH);

  const frame = ctx.getImageData(0, 0, canvasW, canvasH);
  const pixels = frame.data;
  for (let index = 0; index < pixels.length; index += 4) {
    const red = pixels[index];
    const green = pixels[index + 1];
    const blue = pixels[index + 2];
    const greenDominance = green - Math.max(red, blue);
    if (green > 80 && greenDominance > 28) {
      pixels[index + 3] = 0;
    } else if (green > 70 && greenDominance > 14) {
      pixels[index + 3] = Math.max(0, pixels[index + 3] - 130);
    }
  }
  ctx.putImageData(frame, 0, 0);
}

function resizeCanvas() {
  const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
  const width = Math.round(window.innerWidth * ratio);
  const height = Math.round(window.innerHeight * ratio);
  if (actorCanvas.width !== width || actorCanvas.height !== height) {
    actorCanvas.width = width;
    actorCanvas.height = height;
  }
}

async function beginRound(isAikoRound) {
  busy = true;
  acceptingHand = false;
  awaitingAikoHand = false;
  roundButton.disabled = true;
  roundButton.hidden = true;
  setButtonsEnabled(false);
  setHandButtonsVisible(false);
  clearSelectedHand();
  hideResultBadge();
  lastPlayerHand = null;
  lastOpponentHand = null;
  updateHands();
  updateState(isAikoRound ? "\u3042\u3044\u3053\u3067..." : "\u3058\u3083\u301c\u3093\u3051\u301c\u3093...");

  if (isAikoRound) {
    await playClip("aiko");
  } else {
    drawCount = 0;
    await playClip("janken");
  }

  acceptingHand = true;
  busy = false;
  awaitingAikoHand = isAikoRound;
  updateState("\u624b\u3092\u9078\u3093\u3067\u304f\u3060\u3055\u3044");
  setHandButtonsVisible(true);
  setButtonsEnabled(true);
}

async function chooseHand(playerHand, isAikoRound) {
  busy = true;
  acceptingHand = false;
  setButtonsEnabled(false);
  selectHandButton(playerHand);
  lastPlayerHand = playerHand;
  lastOpponentHand = null;
  updateHands();
  updateState("\u307b\u3044\uff01");

  await playClip(isAikoRound ? "aikoHoi" : "hoi");

  const lateHoi = Math.random() < LATE_HOI_RATE;
  if (lateHoi) {
    await handleLateHoi(playerHand);
    return;
  }

  const opponentHand = randomHand();
  lastOpponentHand = opponentHand;
  updateHands();
  updateState(`\u76f8\u624b: ${HAND_LABELS[opponentHand]}`);
  await playOpponentHand(opponentHand);
  hideSelectedHand();

  const result = judge(playerHand, opponentHand);
  if (result === "draw") {
    await handleDraw();
  } else if (result === "win") {
    await handlePlayerWin();
  } else {
    await handlePlayerLose();
  }
}

async function handleDraw() {
  drawCount += 1;
  showResultBadge("draw");
  updateState(`\u3042\u3044\u3053\uff01 (${drawCount}/${MAX_DRAW_COUNT})`);
  if (drawCount >= MAX_DRAW_COUNT) {
    await playClip("draw");
    await playClip("aikoComment");
    drawCount = 0;
    await returnToIdle("\u624b\u3092\u9078\u3093\u3067\u304f\u3060\u3055\u3044");
    return;
  }

  awaitingAikoHand = true;
  busy = false;
  await returnToRoundStart("\u3042\u3044\u3053\u3067\u3057\u305f\u3002\u3082\u3046\u4e00\u5ea6\uff01");
}

async function handleLateHoi(playerHand) {
  updateState("\u5f8c\u51fa\u3057\u3084\u3093\uff01");
  await playClip("lateHoi");
  lastOpponentHand = WINNING_HAND[playerHand];
  updateHands();
  await playOpponentHand(lastOpponentHand);
  hideSelectedHand();
  showResultBadge("lose");
  playerStreak = 0;
  updateStreak();
  await playClip(Math.random() < 0.5 ? "cheat" : "win");
  drawCount = 0;
  await returnToIdle("\u624b\u3092\u9078\u3093\u3067\u304f\u3060\u3055\u3044");
}

async function handlePlayerWin() {
  playerStreak += 1;
  updateStreak();
  showResultBadge("win");

  if (playerStreak >= REWARD_STREAK) {
    if (selectedOpponent === "default") {
      unlockOpponent("speed");
    }
    updateState("5\u9023\u52dd\u9054\u6210\uff01\u3054\u8912\u7f8e\uff01");
    await playClip("reward");
    playerStreak = 0;
    updateStreak();
    drawCount = 0;
    await returnToIdle("\u624b\u3092\u9078\u3093\u3067\u304f\u3060\u3055\u3044");
    return;
  }

  updateState("\u3042\u306a\u305f\u306e\u52dd\u3061\uff01");
  await playClip("lose");
  drawCount = 0;
  await returnToIdle("\u624b\u3092\u9078\u3093\u3067\u304f\u3060\u3055\u3044");
}

async function handlePlayerLose() {
  playerStreak = 0;
  updateStreak();
  showResultBadge("lose");
  updateState("\u3042\u306a\u305f\u306e\u8ca0\u3051\uff01");
  await playClip("win");
  drawCount = 0;
  await returnToIdle("\u624b\u3092\u9078\u3093\u3067\u304f\u3060\u3055\u3044");
}

async function returnToIdle(message) {
  lastPlayerHand = null;
  lastOpponentHand = null;
  updateHands();
  await playClip("idle", { loop: true });
  setReady(message);
}

function setReady(message) {
  busy = false;
  acceptingHand = false;
  awaitingAikoHand = false;
  roundButton.hidden = false;
  roundButton.disabled = false;
  setRoundButtonMode(false);
  setHandButtonsVisible(false);
  clearSelectedHand();
  hideResultBadge();
  updateState(message);
  setButtonsEnabled(false);
}

async function returnToRoundStart(message) {
  lastPlayerHand = null;
  lastOpponentHand = null;
  updateHands();
  clearSelectedHand();
  hideResultBadge();
  await playClip("idle", { loop: true });
  busy = false;
  acceptingHand = false;
  awaitingAikoHand = true;
  roundButton.hidden = false;
  roundButton.disabled = false;
  setRoundButtonMode(true);
  setHandButtonsVisible(false);
  setButtonsEnabled(false);
  updateState(message);
}

async function playClip(name, options = {}) {
  if (previewMode) return;
  const token = ++clipToken;
  const fileName = CLIPS[name];
  const source = VIDEO_DIR + fileName;
  actorVideo.loop = Boolean(options.loop);
  actorVideo.muted = false;
  actorVideo.src = source;
  actorVideo.load();

  try {
    await waitForVideoReady(actorVideo);
    if (token !== clipToken) return;
    actorVideo.currentTime = 0;
    await actorVideo.play();
    if (!options.loop) {
      showSkipButton(true);
      await waitForVideoEnd(actorVideo, token);
    }
  } catch (error) {
    markMissing(fileName);
    actorVideo.pause();
    if (!options.loop) {
      await sleep(MISSING_CLIP_MS);
    }
  } finally {
    if (!options.loop) {
      showSkipButton(false);
    }
  }
}

async function enterPreviewMode() {
  previewMode = true;
  started = false;
  busy = true;
  acceptingHand = false;
  awaitingAikoHand = false;
  clipToken += 1;
  currentSkip = null;
  showSkipButton(false);
  hideSelectedHand();
  hideResultBadge();
  topButton.hidden = true;
  setHandButtonsVisible(false);
  roundButton.hidden = true;
  previewPanel.hidden = false;
  previewControls.hidden = true;
  previewToggleButton.classList.remove("is-open");
  previewToggleButton.textContent = "\u64cd\u4f5c";
  actorCanvas.classList.add("is-interactive");
  startOverlay.classList.add("is-hidden");
  resizeCanvas();
  startRenderLoop();
  updateState("\u52d5\u753b\u3092\u9078\u3093\u3067\u518d\u751f\u3057\u3066\u304f\u3060\u3055\u3044");
  handsText.textContent = "\u3058\u3083\u3093\u3051\u3093\u306a\u3057\u7248";
  resetTimelineControls();

  try {
    await startCamera();
  } catch (error) {
    updateState("\u30ab\u30e1\u30e9\u3092\u8d77\u52d5\u3067\u304d\u307e\u305b\u3093\u3067\u3057\u305f\u3002HTTPS\u3068\u30ab\u30e1\u30e9\u8a31\u53ef\u3092\u78ba\u8a8d\u3057\u3066\u304f\u3060\u3055\u3044\u3002");
  }
}

async function playSelectedPreview() {
  if (!previewMode) return;
  previewSequenceToken += 1;
  segmentLoopEnabled = false;
  segmentPlaybackActive = false;
  updateSegmentLoopButton();
  const fileName = previewSelect.value;
  await playPreviewFile(fileName, previewSequenceToken);
}

async function playPreviewRange() {
  if (!previewMode) return;
  segmentLoopEnabled = false;
  segmentPlaybackActive = false;
  updateSegmentLoopButton();
  const startIndex = Number(previewStartSelect.value);
  const endIndex = Number(previewEndSelect.value);
  const from = Math.min(startIndex, endIndex);
  const to = Math.max(startIndex, endIndex);
  const token = previewSequenceToken + 1;
  previewSequenceToken = token;

  for (let index = from; index <= to; index += 1) {
    if (previewSequenceToken !== token) return;
    await playPreviewFile(PREVIEW_CLIPS[index].file, token, { waitUntilEnd: true });
  }

  if (previewSequenceToken === token) {
    updateState("\u9023\u7d9a\u518d\u751f\u304c\u5b8c\u4e86\u3057\u307e\u3057\u305f");
  }
}

async function playPreviewFile(fileName, token, options = {}) {
  actorVideo.loop = false;
  actorVideo.playbackRate = 1;
  actorVideo.muted = false;
  actorVideo.src = PREVIEW_VIDEO_DIR + fileName;
  actorVideo.load();
  updateState(`${fileName} \u3092\u518d\u751f\u4e2d`);

  try {
    await waitForVideoReady(actorVideo);
    actorVideo.currentTime = 0;
    await actorVideo.play();
    if (options.waitUntilEnd) {
      await waitForPreviewEnd(actorVideo, token);
    }
  } catch (error) {
    markMissing(`${PREVIEW_VIDEO_DIR}${fileName}`);
    if (options.waitUntilEnd) {
      await sleep(MISSING_CLIP_MS);
    }
  }
}

async function loadSelectedPreviewMetadata() {
  if (!previewMode) return;
  previewSequenceToken += 1;
  segmentLoopEnabled = false;
  segmentPlaybackActive = false;
  updateSegmentLoopButton();
  const fileName = previewSelect.value;
  actorVideo.pause();
  actorVideo.playbackRate = 1;
  actorVideo.src = PREVIEW_VIDEO_DIR + fileName;
  actorVideo.load();
  updateState(`${fileName} \u3092\u8aad\u307f\u8fbc\u307f\u4e2d`);

  try {
    await waitForVideoReady(actorVideo);
    actorVideo.currentTime = 0;
    updateState(`${fileName} \u306e\u533a\u9593\u3092\u9078\u3093\u3067\u304f\u3060\u3055\u3044`);
  } catch (error) {
    markMissing(`${PREVIEW_VIDEO_DIR}${fileName}`);
  }
}

async function playPreviewSegment() {
  if (!previewMode) return;
  segmentLoopEnabled = false;
  updateSegmentLoopButton();
  await playSegmentOnce();
}

async function togglePreviewSegmentLoop() {
  if (!previewMode) return;
  segmentLoopEnabled = !segmentLoopEnabled;
  updateSegmentLoopButton();

  if (segmentLoopEnabled) {
    await playSegmentOnce();
  } else {
    segmentPlaybackActive = false;
  }
}

async function playSegmentOnce() {
  const start = getSegmentStart();
  const end = getSegmentEnd();
  if (end <= start) {
    updateState("\u7d42\u4e86\u3092\u958b\u59cb\u3088\u308a\u5f8c\u306b\u3057\u3066\u304f\u3060\u3055\u3044");
    return;
  }

  previewSequenceToken += 1;
  segmentPlaybackActive = true;
  actorVideo.currentTime = start;
  actorVideo.playbackRate = 1;
  updateTimelineLabels();
  updateState(`\u533a\u9593 ${formatSeconds(start)} - ${formatSeconds(end)}`);

  try {
    await actorVideo.play();
  } catch (error) {
    markMissing(`${PREVIEW_VIDEO_DIR}${previewSelect.value}`);
  }
}

function stopPreviewVideo() {
  previewSequenceToken += 1;
  segmentLoopEnabled = false;
  segmentPlaybackActive = false;
  updateSegmentLoopButton();
  actorVideo.pause();
  actorVideo.currentTime = 0;
  actorVideo.playbackRate = 1;
  updateState("\u505c\u6b62\u4e2d");
}

function returnToTopFromPreview() {
  previewSequenceToken += 1;
  segmentLoopEnabled = false;
  segmentPlaybackActive = false;
  updateSegmentLoopButton();
  previewMode = false;
  actorVideo.pause();
  actorVideo.playbackRate = 1;
  actorVideo.removeAttribute("src");
  actorVideo.load();
  previewPanel.hidden = true;
  previewControls.hidden = true;
  previewToggleButton.classList.remove("is-open");
  previewToggleButton.textContent = "\u64cd\u4f5c";
  actorCanvas.classList.remove("is-interactive");
  startOverlay.classList.remove("is-hidden");
  topButton.hidden = true;
  hideResultBadge();
  roundButton.hidden = false;
  roundButton.disabled = true;
  setRoundButtonMode(false);
  updateState("\u30b9\u30bf\u30fc\u30c8\u3057\u3066\u304f\u3060\u3055\u3044");
  updateHands();
}

function returnToTopFromGame() {
  if (currentSkip) {
    currentSkip();
  }
  clipToken += 1;
  previewMode = false;
  started = false;
  busy = true;
  acceptingHand = false;
  awaitingAikoHand = false;
  drawCount = 0;
  lastPlayerHand = null;
  lastOpponentHand = null;
  actorVideo.pause();
  actorVideo.playbackRate = 1;
  showSkipButton(false);
  hideSelectedHand();
  hideResultBadge();
  setHandButtonsVisible(false);
  roundButton.hidden = false;
  roundButton.disabled = true;
  setRoundButtonMode(false);
  topButton.hidden = true;
  startButton.disabled = false;
  startHint.textContent = "\u80cc\u9762\u30ab\u30e1\u30e9\u3068\u4eba\u7269\u52d5\u753b\u3092\u958b\u59cb\u3057\u307e\u3059";
  startOverlay.classList.remove("is-hidden");
  updateState("\u30b9\u30bf\u30fc\u30c8\u3057\u3066\u304f\u3060\u3055\u3044");
  updateHands();
}

function waitForVideoReady(video) {
  return new Promise((resolve, reject) => {
    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      resolve();
      return;
    }

    const cleanup = () => {
      video.removeEventListener("loadeddata", onReady);
      video.removeEventListener("canplay", onReady);
      video.removeEventListener("error", onError);
    };
    const onReady = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error(`Missing video: ${video.currentSrc || video.src}`));
    };

    video.addEventListener("loadeddata", onReady, { once: true });
    video.addEventListener("canplay", onReady, { once: true });
    video.addEventListener("error", onError, { once: true });
  });
}

function waitForVideoEnd(video, token) {
  return new Promise((resolve) => {
    if (video.ended || token !== clipToken) {
      resolve();
      return;
    }
    let resolved = false;
    const finish = () => {
      if (resolved) return;
      resolved = true;
      video.removeEventListener("ended", onEnded);
      currentSkip = null;
      resolve();
    };
    const onEnded = () => {
      finish();
    };
    currentSkip = () => {
      video.pause();
      finish();
    };
    video.addEventListener("ended", onEnded, { once: true });
  });
}

function waitForPreviewEnd(video, token) {
  return new Promise((resolve) => {
    if (video.ended || previewSequenceToken !== token) {
      resolve();
      return;
    }

    let resolved = false;
    const finish = () => {
      if (resolved) return;
      resolved = true;
      video.removeEventListener("ended", onEnded);
      window.clearInterval(timer);
      resolve();
    };
    const onEnded = () => {
      finish();
    };
    const timer = window.setInterval(() => {
      if (previewSequenceToken !== token) {
        finish();
      }
    }, 100);
    video.addEventListener("ended", onEnded, { once: true });
  });
}

function syncTimelineToVideo() {
  if (!previewMode) return;
  const duration = Number.isFinite(actorVideo.duration) ? actorVideo.duration : 0;
  const max = duration.toFixed(1);
  [currentTimeSlider, segmentStartSlider, segmentEndSlider].forEach((slider) => {
    slider.max = max;
    slider.step = "0.1";
  });

  if (Number(segmentEndSlider.value) === 0 || Number(segmentEndSlider.value) > duration) {
    segmentEndSlider.value = max;
  }
  if (Number(segmentStartSlider.value) > duration) {
    segmentStartSlider.value = "0";
  }
  currentTimeSlider.value = "0";
  updateTimelineLabels();
}

function handlePreviewTimeUpdate() {
  if (!previewMode) return;
  const current = actorVideo.currentTime || 0;
  const end = getSegmentEnd();

  syncingTimeline = true;
  currentTimeSlider.value = String(Math.min(current, Number(currentTimeSlider.max) || current));
  syncingTimeline = false;
  currentTimeText.textContent = formatSeconds(current);

  if (!segmentPlaybackActive) return;

  if (segmentLoopEnabled && end > getSegmentStart() && current >= end) {
    actorVideo.currentTime = getSegmentStart();
    actorVideo.play();
  } else if (!segmentLoopEnabled && actorVideo.paused === false && end > getSegmentStart() && current >= end) {
    actorVideo.pause();
    actorVideo.currentTime = end;
    segmentPlaybackActive = false;
  }
}

function resetTimelineControls() {
  [currentTimeSlider, segmentStartSlider, segmentEndSlider].forEach((slider) => {
    slider.min = "0";
    slider.max = "0";
    slider.value = "0";
  });
  currentTimeText.textContent = "0.0s";
  segmentStartText.textContent = "0.0s";
  segmentEndText.textContent = "0.0s";
}

function updateTimelineLabels() {
  currentTimeText.textContent = formatSeconds(Number(currentTimeSlider.value));
  segmentStartText.textContent = formatSeconds(getSegmentStart());
  segmentEndText.textContent = formatSeconds(getSegmentEnd());
}

function getSegmentStart() {
  return Number(segmentStartSlider.value) || 0;
}

function getSegmentEnd() {
  return Number(segmentEndSlider.value) || 0;
}

function formatSeconds(value) {
  return `${(Number(value) || 0).toFixed(1)}s`;
}

function updateSegmentLoopButton() {
  segmentLoopButton.classList.toggle("is-active", segmentLoopEnabled);
  segmentLoopButton.textContent = segmentLoopEnabled ? "\u89e3\u9664" : "\u30eb\u30fc\u30d7";
}

function togglePreviewControls() {
  const nextHidden = !previewControls.hidden;
  previewControls.hidden = nextHidden;
  previewToggleButton.classList.toggle("is-open", !nextHidden);
  previewToggleButton.textContent = nextHidden ? "\u64cd\u4f5c" : "\u9589\u3058\u308b";
}

function toggleStatusPanel() {
  const hidden = !statusPanel.hidden;
  statusPanel.hidden = hidden;
  statusToggleButton.classList.toggle("is-hidden-state", hidden);
  statusToggleButton.textContent = hidden ? "show" : "info";
}

function handleActorTouchStart(event) {
  if (!previewMode) return;
  event.preventDefault();

  if (event.touches.length === 1) {
    const touch = event.touches[0];
    dragStartX = touch.clientX;
    dragStartY = touch.clientY;
    dragStartOffsetX = actorOffsetX;
    dragStartOffsetY = actorOffsetY;
  } else if (event.touches.length >= 2) {
    gestureStartDistance = getTouchDistance(event.touches[0], event.touches[1]);
    gestureStartScale = actorScale;
  }
}

function handleActorTouchMove(event) {
  if (!previewMode) return;
  event.preventDefault();

  if (event.touches.length === 1) {
    const touch = event.touches[0];
    actorOffsetX = dragStartOffsetX + touch.clientX - dragStartX;
    actorOffsetY = dragStartOffsetY + touch.clientY - dragStartY;
  } else if (event.touches.length >= 2 && gestureStartDistance > 0) {
    const distance = getTouchDistance(event.touches[0], event.touches[1]);
    actorScale = clamp(gestureStartScale * (distance / gestureStartDistance), 0.5, 1.8);
    actorScaleSlider.value = actorScale.toFixed(2);
    actorScaleText.textContent = `${Math.round(actorScale * 100)}%`;
  }
}

function handleActorTouchEnd(event) {
  if (!previewMode) return;
  if (event.touches.length === 0) {
    gestureStartDistance = 0;
  }
}

function getTouchDistance(first, second) {
  return Math.hypot(first.clientX - second.clientX, first.clientY - second.clientY);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function loadUnlockedOpponents() {
  const base = { default: true, speed: false, boss: false };
  try {
    const saved = JSON.parse(window.localStorage.getItem(OPPONENT_UNLOCK_KEY) || "{}");
    return { ...base, ...saved, default: true };
  } catch (error) {
    return base;
  }
}

function saveUnlockedOpponents() {
  try {
    window.localStorage.setItem(OPPONENT_UNLOCK_KEY, JSON.stringify(opponentUnlocked));
  } catch (error) {
    // Ignore private browsing or storage denial.
  }
}

function unlockOpponent(opponent) {
  if (opponentUnlocked[opponent]) return;
  opponentUnlocked[opponent] = true;
  saveUnlockedOpponents();
  refreshOpponentLocks();
}

function refreshOpponentLocks() {
  opponentButtons.forEach((button) => {
    const opponent = button.dataset.opponent || "default";
    const unlocked = Boolean(opponentUnlocked[opponent]);
    const lockState = button.querySelector(".lock-state");
    button.disabled = !unlocked;
    button.classList.toggle("is-locked", !unlocked);
    if (lockState) {
      lockState.textContent = unlocked ? "Unlocked" : "Locked";
    }
    if (!unlocked && button.classList.contains("is-selected")) {
      button.classList.remove("is-selected");
    }
  });

  if (!opponentUnlocked[selectedOpponent]) {
    selectedOpponent = "default";
  }

  opponentButtons.forEach((button) => {
    button.classList.toggle("is-selected", (button.dataset.opponent || "default") === selectedOpponent);
  });
}

function randomHand() {
  return HANDS[Math.floor(Math.random() * HANDS.length)];
}

function judge(playerHand, opponentHand) {
  if (playerHand === opponentHand) return "draw";
  return LOSING_HAND[playerHand] === opponentHand ? "win" : "lose";
}

function updateState(message) {
  stateText.textContent = message;
}

function updateHands() {
  const player = lastPlayerHand ? HAND_LABELS[lastPlayerHand] : "-";
  const opponent = lastOpponentHand ? HAND_LABELS[lastOpponentHand] : "-";
  handsText.textContent = `\u3042\u306a\u305f: ${player} / ${OPPONENT_LABELS[selectedOpponent]}: ${opponent}`;
}

function updateStreak() {
  streakText.textContent = `\u9023\u52dd: ${playerStreak}`;
}

function showResultBadge(result) {
  const messages = {
    win: "You win\ud83c\udf89",
    lose: "You lose\ud83d\udca6",
    draw: "Draw\ud83e\udd1d",
  };
  resultBadge.textContent = messages[result] || "";
  resultBadge.hidden = !resultBadge.textContent;
}

function hideResultBadge() {
  resultBadge.hidden = true;
  resultBadge.textContent = "";
}

function setButtonsEnabled(enabled) {
  handButtons.forEach((button) => {
    button.disabled = !enabled;
  });
}

function setHandButtonsVisible(visible) {
  handButtons.forEach((button) => {
    button.hidden = !visible;
  });
}

function selectHandButton(hand) {
  handButtons.forEach((button) => {
    button.classList.toggle("is-selected", button.dataset.hand === hand);
    button.hidden = button.dataset.hand !== hand;
  });
}

function clearSelectedHand() {
  handButtons.forEach((button) => {
    button.classList.remove("is-selected");
  });
}

function hideSelectedHand() {
  clearSelectedHand();
  setHandButtonsVisible(false);
}

function showSkipButton(visible) {
  skipButton.hidden = !visible;
}

function setRoundButtonMode(isAikoRound) {
  roundButton.textContent = isAikoRound ? "\u3042\u3044\u3053\u3067\u301c" : "\u3058\u3083\u3093\u3051\u3093";
}

function populatePreviewSelect() {
  PREVIEW_CLIPS.forEach((clip, index) => {
    const option = document.createElement("option");
    option.value = clip.file;
    option.textContent = clip.label;
    previewSelect.appendChild(option);

    const startOption = document.createElement("option");
    startOption.value = String(index);
    startOption.textContent = clip.label;
    previewStartSelect.appendChild(startOption);

    const endOption = document.createElement("option");
    endOption.value = String(index);
    endOption.textContent = clip.label;
    previewEndSelect.appendChild(endOption);
  });
  previewEndSelect.value = String(PREVIEW_CLIPS.length - 1);
}

async function playOpponentHand(hand) {
  const clipByHand = {
    rock: "opponentRock",
    scissors: "opponentScissors",
    paper: "opponentPaper",
  };
  await playClip(clipByHand[hand]);
}

function markMissing(fileName) {
  missingFiles.add(fileName);
  missingText.hidden = false;
  missingText.textContent = `\u4e0d\u8db3\u52d5\u753b: ${Array.from(missingFiles).join(", ")}`;
}

function sleep(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}
