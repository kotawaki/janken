"use strict";

const VIDEO_DIR = "assets/videos/";
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
const startButton = document.getElementById("startButton");
const roundButton = document.getElementById("roundButton");
const skipButton = document.getElementById("skipButton");
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
let currentSkip = null;
let selectedOpponent = "default";
const missingFiles = new Set();

startButton.addEventListener("click", startApp);
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
    selectedOpponent = button.dataset.opponent || "default";
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
  setReady("\u3058\u3083\u3093\u3051\u3093\u3092\u59cb\u3081\u307e\u3057\u3087\u3046");
}

async function startCamera() {
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
  const scale = Math.min(canvasW / videoW, canvasH / videoH);
  const drawW = Math.round(videoW * scale);
  const drawH = Math.round(videoH * scale);
  const drawX = Math.round((canvasW - drawW) / 2);
  const drawY = Math.round(canvasH - drawH);

  ctx.drawImage(actorVideo, drawX, drawY, drawW, drawH);

  const frame = ctx.getImageData(drawX, drawY, drawW, drawH);
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
  ctx.putImageData(frame, drawX, drawY);
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
  playerStreak = 0;
  updateStreak();
  await playClip(Math.random() < 0.5 ? "cheat" : "win");
  drawCount = 0;
  await returnToIdle("\u624b\u3092\u9078\u3093\u3067\u304f\u3060\u3055\u3044");
}

async function handlePlayerWin() {
  playerStreak += 1;
  updateStreak();

  if (playerStreak >= REWARD_STREAK) {
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
  updateState(message);
  setButtonsEnabled(false);
}

async function returnToRoundStart(message) {
  lastPlayerHand = null;
  lastOpponentHand = null;
  updateHands();
  clearSelectedHand();
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
