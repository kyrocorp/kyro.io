const canvas = document.getElementById("gameCanvas");
if (!canvas) throw new Error("gameCanvas introuvable");

const ctx = canvas.getContext("2d");
const W = canvas.width;
const H = canvas.height;

const $ = id => document.getElementById(id);

const blueScoreEl = $("blueScore");
const orangeScoreEl = $("orangeScore");
const timerEl = $("timer");
const goalMessage = $("goalMessage");
const goalText = $("goalText");
const goalScorer = $("goalScorer");
const countdownEl = $("countdown");
const pauseMenu = $("pauseMenu");
const resultScreen = $("resultScreen");
const winnerDisplay = $("winnerDisplay");
const finalBlueScore = $("finalBlueScore");
const finalOrangeScore = $("finalOrangeScore");
const playAgainButton = $("playAgainButton");
const mainMenuButton = $("mainMenuButton");
const mainMenu = $("mainMenu");
const howToPlayMenu = $("howToPlayMenu");
const matchIntro = $("matchIntro");
const pointsPanel = $("pointsPanel");
const playerPointsEl = $("playerPoints");
const pointsNotification = $("pointsNotification");
const boostFill = $("boostFill");
const boostNumber = $("boostNumber");
const speedNumber = $("speedNumber");

const settingsMenu = $("settingsMenu");
const concedeConfirm = $("concedeConfirm");

/* =========================================================
   CONTROLES PC
========================================================= */

const defaults = {
  forward: "z",
  reverse: "s",
  left: "q",
  right: "d",
  boost: "space"
};

let controls = { ...defaults };

try {
  const saved = JSON.parse(
    localStorage.getItem("turboball-controls") || "null"
  );

  if (
    saved &&
    Object.keys(defaults).every(k => typeof saved[k] === "string")
  ) {
    controls = { ...defaults, ...saved };
  }
} catch {}

const keyButtons = {
  forward: $("forwardKeyButton"),
  reverse: $("reverseKeyButton"),
  left: $("leftKeyButton"),
  right: $("rightKeyButton"),
  boost: $("boostKeyButton")
};

const howButtons = {
  forward: $("howZKey"),
  reverse: $("howSKey"),
  left: $("howQKey"),
  right: $("howDKey"),
  boost: $("howSpaceKey")
};

let waitingForAction = null;
let settingsReturn = "main";

const keys = Object.create(null);

/* =========================================================
   SYSTÈME PC / MOBILE
========================================================= */

let deviceMode = null;

const mobileInput = {
  forward: false,
  reverse: false,
  left: false,
  right: false,
  boost: false
};

let mobileJoystick = null;
let mobileJoystickPointer = null;

function isMobileMode() {
  return deviceMode === "mobile";
}

function setDeviceMode(mode) {
  deviceMode = mode === "mobile" ? "mobile" : "pc";

  try {
    localStorage.setItem("turboball-device-mode", deviceMode);
  } catch {}

  if (deviceMode === "mobile") {
    createMobileControls();
  } else {
    removeMobileControls();
  }

  updateDeviceLabels();
}

function updateDeviceLabels() {
  const modeEl = document.getElementById("deviceModeLabel");

  if (modeEl) {
    modeEl.textContent =
      deviceMode === "mobile"
        ? "📱 MODE MOBILE"
        : "🖥️ MODE PC";
  }
}

function clearMobileInput() {
  mobileInput.forward = false;
  mobileInput.reverse = false;
  mobileInput.left = false;
  mobileInput.right = false;
  mobileInput.boost = false;

  if (mobileJoystick) {
    mobileJoystick.reset();
  }
}

/* =========================================================
   MENU DE CHOIX DE L'APPAREIL
========================================================= */

function createDeviceChoice() {
  if (document.getElementById("deviceChoice")) return;

  if (mainMenu) {
    mainMenu.classList.add("hidden");
  }

  const wrap = document.createElement("div");

  wrap.id = "deviceChoice";

  wrap.innerHTML = `
    <div class="tb-device-box">

      <div class="tb-device-title">
        TURBOBALL.IO
      </div>

      <div class="tb-device-sub">
        SUR QUEL APPAREIL JOUEZ-VOUS ?
      </div>

      <div class="tb-device-buttons">

        <button id="choosePC" class="tb-device-btn">
          🖥️
          <span>PC</span>
          <small>Z / S / Q / D + ESPACE</small>
        </button>

        <button id="chooseMobile" class="tb-device-btn">
          📱
          <span>MOBILE</span>
          <small>JOYSTICK + BOOST</small>
        </button>

      </div>

    </div>
  `;

  document.body.appendChild(wrap);

  const style = document.createElement("style");

  style.id = "tb-device-style";

  style.textContent = `
    #deviceChoice {
      position: fixed;
      inset: 0;
      z-index: 99999;
      display: flex;
      align-items: center;
      justify-content: center;
      background:
        radial-gradient(
          circle at center,
          rgba(10,35,60,.97),
          rgba(2,7,14,.99)
        );
      font-family: Arial, sans-serif;
      color: #fff;
      padding: 20px;
      box-sizing: border-box;
    }

    .tb-device-box {
      width: min(680px,94vw);
      padding: 36px 28px;
      border: 1px solid rgba(80,210,255,.45);
      border-radius: 24px;
      background: rgba(4,15,27,.96);
      box-shadow:
        0 0 45px rgba(0,180,255,.18),
        inset 0 0 30px rgba(0,180,255,.04);
      text-align: center;
    }

    .tb-device-title {
      font-size: clamp(28px,7vw,54px);
      font-weight: 900;
      letter-spacing: 5px;
      text-shadow: 0 0 20px #19cfff;
    }

    .tb-device-sub {
      margin: 10px 0 28px;
      font-size: clamp(14px,3vw,20px);
      letter-spacing: 2px;
      color: #a9c6d9;
    }

    .tb-device-buttons {
      display: flex;
      gap: 18px;
      justify-content: center;
      flex-wrap: wrap;
    }

    .tb-device-btn {
      width: min(270px,80vw);
      min-height: 150px;
      border: 1px solid rgba(80,210,255,.55);
      border-radius: 18px;
      background: linear-gradient(145deg,#0b2437,#07131f);
      color: #fff;
      cursor: pointer;
      font-size: 42px;
      transition: .18s;
      touch-action: manipulation;
    }

    .tb-device-btn span {
      display: block;
      font-size: 22px;
      font-weight: 900;
      letter-spacing: 2px;
      margin-top: 7px;
    }

    .tb-device-btn small {
      display: block;
      font-size: 11px;
      color: #8eaabd;
      margin-top: 9px;
      letter-spacing: 1px;
    }

    .tb-device-btn:hover {
      transform: translateY(-3px);
      box-shadow: 0 0 28px rgba(40,210,255,.25);
      border-color: #54dcff;
    }

    .tb-device-btn:active {
      transform: scale(.97);
    }

    @media(max-width:600px) {
      .tb-device-box {
        padding: 28px 16px;
      }

      .tb-device-buttons {
        gap: 12px;
      }

      .tb-device-btn {
        min-height: 125px;
        font-size: 34px;
      }
    }
  `;

  document.head.appendChild(style);

  document.getElementById("choosePC").addEventListener("click", () => {
    setDeviceMode("pc");

    wrap.remove();
    style.remove();

    if (mainMenu) {
      mainMenu.classList.remove("hidden");
    }
  });

  document.getElementById("chooseMobile").addEventListener("click", () => {
    setDeviceMode("mobile");

    wrap.remove();
    style.remove();

    if (mainMenu) {
      mainMenu.classList.remove("hidden");
    }
  });
}

/* =========================================================
   JOYSTICK MOBILE
========================================================= */

function createMobileControls() {
  removeMobileControls();

  const layer = document.createElement("div");

  layer.id = "mobileControls";

  layer.innerHTML = `
    <div
      id="mobilePauseButton"
      class="tb-touch-btn tb-pause-touch"
    >
      Ⅱ
    </div>

    <div
      id="mobileBoostButton"
      class="tb-touch-btn tb-boost-touch"
    >
      BOOST
    </div>

    <div
      id="mobileJoystick"
      class="tb-joystick"
    >
      <div
        id="mobileJoystickKnob"
        class="tb-joystick-knob"
      ></div>
    </div>
  `;

  document.body.appendChild(layer);

  const style = document.createElement("style");

  style.id = "tb-mobile-style";

  style.textContent = `
    #mobileControls {
      position: fixed;
      inset: 0;
      z-index: 5000;
      pointer-events: none;
      touch-action: none;
      display: block;
    }

    .tb-touch-btn,
    .tb-joystick {
      position: absolute;
      pointer-events: auto;
      user-select: none;
      -webkit-user-select: none;
      touch-action: none;
    }

    .tb-pause-touch {
      right: 22px;
      top: 20px;
      width: 54px;
      height: 54px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(4,17,29,.8);
      border: 2px solid rgba(120,220,255,.7);
      color: #fff;
      font-weight: 900;
      font-size: 21px;
      box-shadow: 0 0 18px rgba(40,200,255,.2);
    }

    .tb-boost-touch {
      right: 190px;
      bottom: 48px;
      width: 94px;
      height: 94px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(255,125,20,.2);
      border: 3px solid rgba(255,150,50,.9);
      color: #fff;
      font-weight: 900;
      font-size: 13px;
      letter-spacing: 1px;
      box-shadow: 0 0 24px rgba(255,100,20,.25);
    }

    .tb-boost-touch.active {
      transform: scale(.94);
      background: rgba(255,130,20,.45);
    }

    .tb-joystick {
      right: 24px;
      bottom: 28px;
      width: 145px;
      height: 145px;
      border-radius: 50%;
      background: rgba(30,80,110,.28);
      border: 2px solid rgba(120,220,255,.55);
      box-shadow:
        inset 0 0 24px rgba(30,200,255,.1),
        0 0 25px rgba(20,180,255,.12);
    }

    .tb-joystick-knob {
      position: absolute;
      left: 50%;
      top: 50%;
      width: 62px;
      height: 62px;
      margin: -31px;
      border-radius: 50%;
      background: rgba(80,210,255,.65);
      border: 2px solid rgba(255,255,255,.8);
      box-shadow: 0 0 22px rgba(30,200,255,.45);
      transform: translate(0,0);
    }

    @media(max-width:700px) and (orientation:portrait) {
      #mobileControls:after {
        content: 'Tournez votre téléphone en paysage ↻';
        position: fixed;
        top: 8px;
        left: 50%;
        transform: translateX(-50%);
        font: 700 11px Arial;
        color: #9fc4d7;
        background: rgba(0,0,0,.35);
        padding: 6px 10px;
        border-radius: 10px;
        pointer-events: none;
      }
    }
  `;

  document.head.appendChild(style);

  const joy = document.getElementById("mobileJoystick");
  const knob = document.getElementById("mobileJoystickKnob");

  const max = 52;

  const updateJoystick = (clientX, clientY) => {
    const rect = joy.getBoundingClientRect();

    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    let dx = clientX - centerX;
    let dy = clientY - centerY;

    const length = Math.hypot(dx, dy);

    if (length > max) {
      dx = dx / length * max;
      dy = dy / length * max;
    }

    knob.style.transform =
      `translate(${dx}px,${dy}px)`;

    const nx = dx / max;
    const ny = dy / max;

    mobileInput.left = nx < -0.22;
    mobileInput.right = nx > 0.22;

    mobileInput.forward = ny < -0.22;
    mobileInput.reverse = ny > 0.22;
  };

  mobileJoystick = {
    reset() {
      knob.style.transform = "translate(0,0)";
    }
  };

  joy.addEventListener("pointerdown", e => {
    e.preventDefault();

    mobileJoystickPointer = e.pointerId;

    joy.setPointerCapture(e.pointerId);

    updateJoystick(e.clientX, e.clientY);
  });

  joy.addEventListener("pointermove", e => {
    if (e.pointerId !== mobileJoystickPointer) return;

    updateJoystick(e.clientX, e.clientY);
  });

  const releaseJoystick = () => {
    mobileJoystickPointer = null;

    mobileInput.forward = false;
    mobileInput.reverse = false;
    mobileInput.left = false;
    mobileInput.right = false;

    mobileJoystick.reset();
  };

  joy.addEventListener(
    "pointerup",
    releaseJoystick
  );

  joy.addEventListener(
    "pointercancel",
    releaseJoystick
  );

  /* BOOST */

  const boost = document.getElementById(
    "mobileBoostButton"
  );

  const boostOn = e => {
    e.preventDefault();

    mobileInput.boost = true;

    boost.classList.add("active");
  };

  const boostOff = e => {
    e.preventDefault();

    mobileInput.boost = false;

    boost.classList.remove("active");
  };

  boost.addEventListener(
    "pointerdown",
    boostOn
  );

  boost.addEventListener(
    "pointerup",
    boostOff
  );

  boost.addEventListener(
    "pointercancel",
    boostOff
  );

  boost.addEventListener(
    "pointerleave",
    boostOff
  );

  /* PAUSE */

  document
    .getElementById("mobilePauseButton")
    .addEventListener("pointerdown", e => {
      e.preventDefault();

      if (gameRunning && !goalActive) {
        togglePause();
      }
    });
}

function removeMobileControls() {
  document.getElementById("mobileControls")?.remove();
  document.getElementById("tb-mobile-style")?.remove();

  mobileJoystick = null;

  clearMobileInput();
}

function setupDeviceChoice() {
  createDeviceChoice();
}

/* =========================================================
   TOUCH / CLAVIER
========================================================= */

function keyName(key) {
  if (key === " ") return "SPACE";
  if (key === "space") return "SPACE";
  if (key.length === 1) return key.toUpperCase();

  return key.toUpperCase();
}

function saveControls() {
  try {
    localStorage.setItem(
      "turboball-controls",
      JSON.stringify(controls)
    );
  } catch {}
}

function updateControlUI() {
  for (const action of Object.keys(keyButtons)) {
    if (keyButtons[action]) {
      keyButtons[action].textContent =
        keyName(controls[action]);
    }

    if (howButtons[action]) {
      howButtons[action].textContent =
        keyName(controls[action]);
    }
  }
}

function normalizedKey(e) {
  if (e.code === "Space") return "space";

  return e.key.toLowerCase();
}

function controlPressed(action) {
  if (isMobileMode()) {
    return !!mobileInput[action];
  }

  return !!keys[controls[action]];
}

function clearKeys() {
  for (const k in keys) {
    keys[k] = false;
  }

  clearMobileInput();
}

document.addEventListener("keydown", e => {
  if (waitingForAction) {
    e.preventDefault();

    if (e.key === "Escape") {
      waitingForAction.textContent =
        keyName(
          controls[
            waitingForAction.dataset.action
          ]
        );

      waitingForAction = null;

      return;
    }

    const action =
      waitingForAction.dataset.action;

    const newKey = normalizedKey(e);

    if (
      ["p", "escape"].includes(newKey) ||
      newKey === ""
    ) {
      return;
    }

    const other = Object.keys(controls).find(
      a =>
        a !== action &&
        controls[a] === newKey
    );

    if (other) {
      return;
    }

    controls[action] = newKey;

    saveControls();
    updateControlUI();

    waitingForAction = null;

    return;
  }

  const k = normalizedKey(e);

  if (k === "space") {
    e.preventDefault();
  }

  if (
    gameRunning &&
    !goalActive &&
    k === "p"
  ) {
    togglePause();
    return;
  }

  keys[k] = true;
});

document.addEventListener("keyup", e => {
  keys[normalizedKey(e)] = false;
});

window.addEventListener("blur", clearKeys);

/* =========================================================
   RÉGLAGES
========================================================= */

for (const action of Object.keys(keyButtons)) {
  keyButtons[action]?.addEventListener(
    "click",
    () => {
      if (waitingForAction) return;

      waitingForAction = keyButtons[action];

      waitingForAction.dataset.action = action;

      waitingForAction.textContent =
        "PRESS A KEY";
    }
  );
}

$("resetControlsButton")?.addEventListener(
  "click",
  () => {
    controls = { ...defaults };

    saveControls();
    updateControlUI();
  }
);

$("settingsButton")?.addEventListener(
  "click",
  () => openSettings("main")
);

$("pauseSettingsButton")?.addEventListener(
  "click",
  () => openSettings("pause")
);

function openSettings(from) {
  settingsReturn = from;

  mainMenu?.classList.add("hidden");
  howToPlayMenu?.classList.add("hidden");
  pauseMenu?.classList.add("hidden");

  settingsMenu?.classList.remove("hidden");

  updateControlUI();
}

$("settingsBackButton")?.addEventListener(
  "click",
  () => {
    settingsMenu?.classList.add("hidden");

    if (
      settingsReturn === "pause" &&
      gameRunning
    ) {
      pauseMenu?.classList.remove("hidden");
    } else {
      mainMenu?.classList.remove("hidden");
    }
  }
);

$("howToPlayButton")?.addEventListener(
  "click",
  () => {
    mainMenu?.classList.add("hidden");
    howToPlayMenu?.classList.remove("hidden");

    updateControlUI();
  }
);

$("backButton")?.addEventListener(
  "click",
  () => {
    howToPlayMenu?.classList.add("hidden");
    mainMenu?.classList.remove("hidden");
  }
);

/* =========================================================
   VARIABLES DU MATCH
========================================================= */

let blueScore = 0;
let orangeScore = 0;

let playerPoints = 0;

let gameTime = 120;

let gameRunning = false;
let paused = false;
let goalActive = false;

let goalTimer = null;
let countdownTimer = null;
let countdownFinish = null;
let introTimer = null;

let lastTime = performance.now();

let pointsTimer = null;

let saveCooldown = 0;
let saveDangerHandled = false;

/* =========================================================
   POINTS
========================================================= */

function setText(el, value) {
  if (el) {
    el.textContent = value;
  }
}

function updatePoints() {
  setText(playerPointsEl, playerPoints);
}

function awardPoints(amount, reason) {
  playerPoints += amount;

  updatePoints();

  if (pointsNotification) {
    clearTimeout(pointsTimer);

    pointsNotification.textContent =
      `+${amount} ${reason}`;

    pointsNotification.classList.remove(
      "show"
    );

    void pointsNotification.offsetWidth;

    pointsNotification.classList.add("show");

    pointsTimer = setTimeout(() => {
      pointsNotification.classList.remove(
        "show"
      );
    }, 1100);
  }

  pointsPanel?.classList.remove("earned");

  if (pointsPanel) {
    void pointsPanel.offsetWidth;

    pointsPanel.classList.add("earned");
  }
}

function resetPoints() {
  playerPoints = 0;

  saveCooldown = 0;
  saveDangerHandled = false;

  updatePoints();

  pointsNotification?.classList.remove(
    "show"
  );
}

/* =========================================================
   TERRAIN
========================================================= */

const field = {
  left: 90,
  right: W - 90,
  top: 45,
  bottom: H - 45
};

const goal = {
  top: 230,
  bottom: 470,
  depth: 70
};

/* Zone invisible pour les sauvegardes */

const saveZone = {
  x: field.left + 10,
  y: goal.top + 12,
  width: 145,
  height: goal.bottom - goal.top - 24
};

/* =========================================================
   BOOST PADS
========================================================= */

const boostPads = [
  {
    x: field.left + 85,
    y: field.top + 85,
    color: "#20cfff",
    cooldown: 0,
    pulse: 0,
    flash: 0
  },

  {
    x: field.right - 85,
    y: field.top + 85,
    color: "#ff8a18",
    cooldown: 0,
    pulse: 1,
    flash: 0
  },

  {
    x: field.left + 85,
    y: field.bottom - 85,
    color: "#20cfff",
    cooldown: 0,
    pulse: 2,
    flash: 0
  },

  {
    x: field.right - 85,
    y: field.bottom - 85,
    color: "#ff8a18",
    cooldown: 0,
    pulse: 3,
    flash: 0
  },

  {
    x: W / 2,
    y: field.top + 55,
    color: "#65e8ff",
    cooldown: 0,
    pulse: 4,
    flash: 0
  },

  {
    x: W / 2,
    y: field.bottom - 55,
    color: "#baff35",
    cooldown: 0,
    pulse: 5,
    flash: 0
  }
];

const boostParticles = [];
const goalParticles = [];

let goalFlash = 0;

/* =========================================================
   VOITURE
========================================================= */

class Car {
  constructor(x, y, color, bot = false) {
    this.startX = x;
    this.startY = y;

    this.color = color;
    this.isBot = bot;

    this.radius = 25;

    this.x = x;
    this.y = y;

    this.angle = bot ? Math.PI : 0;

    this.speed = 0;

    this.maxSpeed = 7.2;
    this.boostMax = 11.7;

    this.boost = 100;

    this.boosting = false;

    this.ballContact = false;

    this.aiTarget = null;
    this.aiThink = 0;
  }

  reset() {
    this.x = this.startX;
    this.y = this.startY;

    this.angle = this.isBot
      ? Math.PI
      : 0;

    this.speed = 0;

    this.boost = 100;

    this.boosting = false;

    this.ballContact = false;

    this.aiTarget = null;
    this.aiThink = 0;
  }

  update() {
    if (this.isBot) {
      this.updateAI();
    } else {
      this.updatePlayer();
    }

    this.x +=
      Math.cos(this.angle) *
      this.speed;

    this.y +=
      Math.sin(this.angle) *
      this.speed;

    this.speed *= 0.985;

    if (Math.abs(this.speed) < 0.02) {
      this.speed = 0;
    }

    this.keepInside();

    this.boost = Math.min(
      100,
      this.boost + 0.025
    );
  }

  updatePlayer() {
    this.boosting = false;

    if (controlPressed("forward")) {
      this.speed += 0.18;
    }

    if (controlPressed("reverse")) {
      if (this.speed > 0) {
        this.speed -= 0.25;
      } else {
        this.speed -= 0.12;
      }
    }

    const turn =
      0.055 *
      Math.min(
        Math.abs(this.speed) / 2 + 0.3,
        1
      );

    if (controlPressed("left")) {
      this.angle -=
        turn *
        (this.speed >= 0 ? 1 : -1);
    }

    if (controlPressed("right")) {
      this.angle +=
        turn *
        (this.speed >= 0 ? 1 : -1);
    }

    if (
      controlPressed("boost") &&
      this.boost > 0 &&
      this.speed > 0
    ) {
      this.speed += 0.28;

      this.boost -= 0.7;

      this.boosting = true;
    }

    this.speed = Math.max(
      -3.2,
      Math.min(
        this.speed,
        this.boosting
          ? this.boostMax
          : this.maxSpeed
      )
    );
  }

  /* =======================================================
     IA
  ======================================================= */

  updateAI() {
    const dxBall =
      ball.x - this.x;

    const dyBall =
      ball.y - this.y;

    const distBall =
      Math.hypot(dxBall, dyBall);

    let tx = ball.x;
    let ty = ball.y;

    /* Défense */

    if (
      ball.x >
        field.right - 270 &&
      ball.vx > 0
    ) {
      tx =
        Math.min(
          field.right - 55,
          ball.x + 55
        );

      ty =
        H / 2 +
        (ball.y - H / 2) *
          0.7;
    }

    /* Attaque */

    else if (
      ball.x < W * 0.42
    ) {
      tx = ball.x + 45;
      ty = ball.y;
    }

    /* Recherche de boost */

    this.aiThink -= 1 / 60;

    const dangerous =
      ball.x >
        field.right - 270 &&
      ball.vx > 0;

    if (
      this.boost < 25 &&
      distBall > 180 &&
      !dangerous
    ) {
      if (
        !this.aiTarget ||
        this.aiThink <= 0 ||
        this.aiTarget.cooldown > 0
      ) {
        let best = null;
        let bestD = Infinity;

        for (const pad of boostPads) {
          if (pad.cooldown > 0) {
            continue;
          }

          const d =
            Math.hypot(
              pad.x - this.x,
              pad.y - this.y
            );

          if (d < bestD) {
            bestD = d;
            best = pad;
          }
        }

        this.aiTarget = best;
        this.aiThink = 0.5;
      }

      if (this.aiTarget) {
        tx = this.aiTarget.x;
        ty = this.aiTarget.y;
      }
    }

    else if (
      this.boost > 45 ||
      dangerous
    ) {
      this.aiTarget = null;
    }

    /* Rotation IA */

    const targetAngle =
      Math.atan2(
        ty - this.y,
        tx - this.x
      );

    let diff =
      targetAngle - this.angle;

    while (diff > Math.PI) {
      diff -= Math.PI * 2;
    }

    while (diff < -Math.PI) {
      diff += Math.PI * 2;
    }

    const turn = 0.062;

    if (diff > 0.06) {
      this.angle += turn;
    }

    else if (diff < -0.06) {
      this.angle -= turn;
    }

    const aligned =
      Math.abs(diff) < 0.32;

    const attack =
      ball.x < W * 0.55 &&
      this.x > ball.x;

    this.boosting =
      this.boost > 4 &&
      aligned &&
      (
        distBall > 260 ||
        attack ||
        !!this.aiTarget
      );

    this.speed +=
      this.boosting
        ? 0.24
        : 0.145;

    if (this.boosting) {
      this.boost -= 0.55;
    }

    this.speed =
      Math.min(
        this.speed,
        this.boosting
          ? 9.6
          : 6.7
      );

    /* Prendre un pad */

    if (this.aiTarget) {
      const d =
        Math.hypot(
          this.aiTarget.x - this.x,
          this.aiTarget.y - this.y
        );

      if (
        d <
          this.radius + 22 &&
        this.aiTarget.cooldown <= 0
      ) {
        this.boost =
          Math.min(
            100,
            this.boost + 25
          );

        this.aiTarget.cooldown = 5;
        this.aiTarget.flash = 1;

        spawnPadParticles(
          this.aiTarget
        );

        this.aiTarget = null;
      }
    }
  }

  keepInside() {
    const r = this.radius;

    if (this.x < field.left + r) {
      this.x = field.left + r;
      this.speed *= -0.3;
    }

    if (this.x > field.right - r) {
      this.x = field.right - r;
      this.speed *= -0.3;
    }

    if (this.y < field.top + r) {
      this.y = field.top + r;
      this.speed *= -0.3;
    }

    if (this.y > field.bottom - r) {
      this.y = field.bottom - r;
      this.speed *= -0.3;
    }
  }

  draw() {
    ctx.save();

    ctx.translate(
      this.x,
      this.y
    );

    ctx.rotate(this.angle);

    if (this.boosting) {
      ctx.fillStyle =
        "rgba(80,220,255,.7)";

      ctx.beginPath();

      ctx.moveTo(-35, -11);

      ctx.lineTo(
        -65 - Math.random() * 18,
        0
      );

      ctx.lineTo(-35, 11);

      ctx.fill();
    }

    ctx.shadowColor = this.color;
    ctx.shadowBlur = 18;

    ctx.fillStyle = this.color;

    roundRect(
      -28,
      -17,
      56,
      34,
      10
    );

    ctx.fill();

    ctx.shadowBlur = 0;

    ctx.fillStyle = "#08101a";

    roundRect(
      -5,
      -12,
      24,
      24,
      7
    );

    ctx.fill();

    ctx.fillStyle = "#fff";

    ctx.fillRect(
      20,
      -9,
      5,
      7
    );

    ctx.fillRect(
      20,
      2,
      5,
      7
    );

    ctx.fillStyle = "#05070b";

    ctx.fillRect(
      -18,
      -22,
      12,
      7
    );

    ctx.fillRect(
      8,
      -22,
      12,
      7
    );

    ctx.fillRect(
      -18,
      15,
      12,
      7
    );

    ctx.fillRect(
      8,
      15,
      12,
      7
    );

    ctx.restore();
  }
}

/* =========================================================
   BALLON
========================================================= */

class Ball {
  constructor() {
    this.radius = 18;

    this.reset();
  }

  reset() {
    this.x = W / 2;
    this.y = H / 2;

    this.vx = 0;
    this.vy = 0;
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;

    this.vx *= 0.992;
    this.vy *= 0.992;

    const s =
      Math.hypot(
        this.vx,
        this.vy
      );

    if (s > 9) {
      this.vx =
        this.vx / s * 9;

      this.vy =
        this.vy / s * 9;
    }

    this.checkGoal();

    if (!goalActive) {
      this.walls();
    }
  }

  checkGoal() {
    const inOpening =
      this.y + this.radius >
        goal.top &&
      this.y - this.radius <
        goal.bottom;

    if (!inOpening) return;

    if (
      this.x - this.radius <=
      field.left - 2
    ) {
      scoreGoal("orange");
    }

    else if (
      this.x + this.radius >=
      field.right + 2
    ) {
      scoreGoal("blue");
    }
  }

  walls() {
    if (
      this.y - this.radius <
      field.top
    ) {
      this.y =
        field.top + this.radius;

      this.vy *= -0.82;
    }

    if (
      this.y + this.radius >
      field.bottom
    ) {
      this.y =
        field.bottom - this.radius;

      this.vy *= -0.82;
    }

    const inOpening =
      this.y + this.radius >
        goal.top &&
      this.y - this.radius <
        goal.bottom;

    if (
      this.x - this.radius <
        field.left &&
      !inOpening
    ) {
      this.x =
        field.left +
        this.radius;

      this.vx *= -0.82;
    }

    if (
      this.x + this.radius >
        field.right &&
      !inOpening
    ) {
      this.x =
        field.right -
        this.radius;

      this.vx *= -0.82;
    }

    /* Fond des cages */

    if (
      inOpening &&
      this.x <
        field.left -
        goal.depth +
        this.radius
    ) {
      this.x =
        field.left -
        goal.depth +
        this.radius;

      this.vx *= -0.82;
    }

    if (
      inOpening &&
      this.x >
        field.right +
        goal.depth -
        this.radius
    ) {
      this.x =
        field.right +
        goal.depth -
        this.radius;

      this.vx *= -0.82;
    }
  }

  draw() {
    ctx.save();

    ctx.shadowColor = "#fff";
    ctx.shadowBlur = 18;

    const g =
      ctx.createRadialGradient(
        this.x - 6,
        this.y - 7,
        2,
        this.x,
        this.y,
        this.radius
      );

    g.addColorStop(
      0,
      "#fff"
    );

    g.addColorStop(
      0.55,
      "#dce7f0"
    );

    g.addColorStop(
      1,
      "#7d91a3"
    );

    ctx.fillStyle = g;

    ctx.beginPath();

    ctx.arc(
      this.x,
      this.y,
      this.radius,
      0,
      Math.PI * 2
    );

    ctx.fill();

    ctx.restore();
  }
}

/* =========================================================
   OBJETS
========================================================= */

const player =
  new Car(
    350,
    H / 2,
    "#20cfff"
  );

const bot =
  new Car(
    W - 350,
    H / 2,
    "#ff8a18",
    true
  );

const ball = new Ball();

/* =========================================================
   SAUVEGARDE
========================================================= */

function playerInSaveZone() {
  return (
    player.x >= saveZone.x &&
    player.x <=
      saveZone.x +
      saveZone.width &&
    player.y >= saveZone.y &&
    player.y <=
      saveZone.y +
      saveZone.height
  );
}

function ballDangerous() {
  const inLane =
    ball.y + ball.radius >
      goal.top &&
    ball.y - ball.radius <
      goal.bottom;

  const close =
    ball.x <
    field.left + 250;

  return (
    inLane &&
    close &&
    (
      ball.vx < -0.1 ||
      ball.x <
        field.left + 105
    )
  );
}

/* =========================================================
   COLLISION VOITURE / BALLON
========================================================= */

function carBallCollision(car) {
  const dx =
    ball.x - car.x;

  const dy =
    ball.y - car.y;

  const d =
    Math.hypot(dx, dy);

  const minD =
    car.radius +
    ball.radius;

  if (d >= minD) {
    car.ballContact = false;
    return;
  }

  const dangerousBefore =
    car === player &&
    ballDangerous();

  const newContact =
    !car.ballContact;

  car.ballContact = true;

  if (
    car === player &&
    newContact
  ) {
    awardPoints(
      2,
      "BALL TOUCH"
    );
  }

  const safeD =
    d || 0.001;

  const nx =
    dx / safeD;

  const ny =
    dy / safeD;

  const overlap =
    minD - d;

  ball.x +=
    nx * overlap;

  ball.y +=
    ny * overlap;

  const force =
    Math.min(
      Math.abs(car.speed) * 1.15 +
        1.2,
      7
    );

  ball.vx +=
    nx * force;

  ball.vy +=
    ny * force;

  ball.vx +=
    Math.cos(car.angle) *
    Math.abs(car.speed) *
    0.25;

  ball.vy +=
    Math.sin(car.angle) *
    Math.abs(car.speed) *
    0.25;

  car.speed *= 0.82;

  /* SAVE */

  if (
    car === player &&
    newContact &&
    dangerousBefore &&
    playerInSaveZone() &&
    saveCooldown <= 0 &&
    !saveDangerHandled
  ) {
    saveCooldown = 4;

    saveDangerHandled = true;

    ball.vx =
      Math.max(
        1.8,
        Math.abs(ball.vx) * 0.65
      );

    ball.vy *= 0.65;

    awardPoints(
      50,
      "SAVE"
    );
  }
}

/* =========================================================
   COLLISION VOITURE / VOITURE
========================================================= */

function carCarCollision(a, b) {
  const dx =
    b.x - a.x;

  const dy =
    b.y - a.y;

  const d =
    Math.hypot(dx, dy);

  const minD =
    a.radius +
    b.radius;

  if (
    d <= 0 ||
    d >= minD
  ) {
    return;
  }

  const nx =
    dx / d;

  const ny =
    dy / d;

  const overlap =
    minD - d;

  a.x -=
    nx * overlap / 2;

  a.y -=
    ny * overlap / 2;

  b.x +=
    nx * overlap / 2;

  b.y +=
    ny * overlap / 2;

  const av =
    a.speed;

  a.speed =
    b.speed * 0.55;

  b.speed =
    av * 0.55;

  a.keepInside();
  b.keepInside();
}

/* =========================================================
   PARTICULES BOOST
========================================================= */

function spawnPadParticles(pad) {
  for (let i = 0; i < 10; i++) {
    const a =
      Math.PI * 2 * i / 10;

    const s =
      1.2 +
      Math.random() * 1.4;

    boostParticles.push({
      x: pad.x,
      y: pad.y,

      vx:
        Math.cos(a) * s,

      vy:
        Math.sin(a) * s,

      life: 0.55,

      size:
        2 +
        Math.random() * 2,

      color: pad.color
    });
  }
}

/* =========================================================
   PARTICULES BUT
========================================================= */

function spawnGoalParticles(team) {
  const color =
    team === "blue"
      ? "#43d9ff"
      : "#ff9d2e";

  for (let i = 0; i < 32; i++) {
    const a =
      Math.random() *
      Math.PI *
      2;

    const s =
      1.5 +
      Math.random() * 3.5;

    goalParticles.push({
      x: W / 2,
      y: H / 2,

      vx:
        Math.cos(a) * s,

      vy:
        Math.sin(a) * s,

      life: 1.1,

      size:
        2 +
        Math.random() * 4,

      color
    });
  }
}

/* =========================================================
   EFFETS
========================================================= */

function updateEffects(dt) {
  const sec =
    Math.min(
      dt / 1000,
      0.1
    );

  goalFlash =
    Math.max(
      0,
      goalFlash -
        sec * 2.2
    );

  for (
    const list of [
      boostParticles,
      goalParticles
    ]
  ) {
    for (const p of list) {
      p.x += p.vx;
      p.y += p.vy;

      p.vx *= 0.97;
      p.vy *= 0.97;

      p.life -= sec;
    }

    for (
      let i = list.length - 1;
      i >= 0;
      i--
    ) {
      if (
        list[i].life <= 0
      ) {
        list.splice(i, 1);
      }
    }
  }

  saveCooldown =
    Math.max(
      0,
      saveCooldown - sec
    );

  if (!ballDangerous()) {
    saveDangerHandled = false;
  }
}

/* =========================================================
   BOOST PADS
========================================================= */

function updateBoostPads(dt) {
  const sec =
    Math.min(
      dt / 1000,
      0.1
    );

  for (const p of boostPads) {
    p.cooldown =
      Math.max(
        0,
        p.cooldown - sec
      );

    p.pulse +=
      sec * 2.4;

    p.flash =
      Math.max(
        0,
        p.flash - sec * 2.5
      );
  }

  if (
    !gameRunning ||
    paused ||
    goalActive
  ) {
    return;
  }

  for (const p of boostPads) {
    if (p.cooldown > 0) {
      continue;
    }

    if (
      Math.hypot(
        player.x - p.x,
        player.y - p.y
      ) <
      player.radius + 22
    ) {
      player.boost =
        Math.min(
          100,
          player.boost + 25
        );

      p.cooldown = 5;
      p.flash = 1;

      spawnPadParticles(p);
    }
  }
}

/* =========================================================
   BUT
========================================================= */

function scoreGoal(team) {
  if (
    goalActive ||
    !gameRunning
  ) {
    return;
  }

  goalActive = true;

  clearKeys();

  goalFlash = 1;

  spawnGoalParticles(team);

  if (team === "blue") {
    blueScore++;

    setText(
      blueScoreEl,
      blueScore
    );

    awardPoints(
      150,
      "GOAL"
    );

    setText(
      goalText,
      "GOAL!"
    );

    setText(
      goalScorer,
      "BLUE UNIT SCORES"
    );

    if (goalText) {
      goalText.style.color =
        "#43d9ff";

      goalText.style.textShadow =
        "0 0 25px #00aaff,0 0 80px #0077ff";
    }
  }

  else {
    orangeScore++;

    setText(
      orangeScoreEl,
      orangeScore
    );

    setText(
      goalText,
      "GOAL!"
    );

    setText(
      goalScorer,
      "ORANGE CREW SCORES"
    );

    if (goalText) {
      goalText.style.color =
        "#ff9d2e";

      goalText.style.textShadow =
        "0 0 25px #ff6600,0 0 80px #ff3300";
    }
  }

  goalMessage?.classList.remove(
    "hidden"
  );

  goalTimer =
    setTimeout(() => {
      goalMessage?.classList.add(
        "hidden"
      );

      resetPositions();

      startCountdown();
    }, 1800);
}

/* =========================================================
   RESET
========================================================= */

function resetPositions() {
  player.reset();
  bot.reset();
  ball.reset();

  saveDangerHandled = false;
}

/* =========================================================
   COUNTDOWN
========================================================= */

function startCountdown() {
  clearInterval(countdownTimer);
  clearTimeout(countdownFinish);

  goalActive = true;

  let count = 3;

  setText(
    countdownEl,
    count
  );

  countdownEl?.classList.remove(
    "hidden"
  );

  countdownTimer =
    setInterval(() => {
      count--;

      if (count > 0) {
        setText(
          countdownEl,
          count
        );
      }

      else {
        clearInterval(
          countdownTimer
        );

        countdownTimer = null;

        setText(
          countdownEl,
          "GO!"
        );

        countdownFinish =
          setTimeout(() => {
            countdownEl?.classList.add(
              "hidden"
            );

            goalActive = false;
          }, 700);
      }
    }, 1000);
}

/* =========================================================
   TIMER
========================================================= */

function updateTimer(dt) {
  if (
    !gameRunning ||
    paused ||
    goalActive
  ) {
    return;
  }

  gameTime -=
    dt / 1000;

  if (gameTime <= 0) {
    gameTime = 0;

    updateTimerDisplay();

    endMatch(false);

    return;
  }

  updateTimerDisplay();
}

function updateTimerDisplay() {
  const m =
    Math.floor(
      gameTime / 60
    );

  const s =
    Math.floor(
      gameTime % 60
    );

  setText(
    timerEl,
    `${m}:${String(s).padStart(2,"0")}`
  );
}

/* =========================================================
   FIN DU MATCH
========================================================= */

function endMatch(conceded = false) {
  if (
    !gameRunning &&
    !conceded
  ) {
    return;
  }

  gameRunning = false;

  paused = false;

  goalActive = true;

  clearKeys();

  clearInterval(
    countdownTimer
  );

  clearTimeout(
    countdownFinish
  );

  clearTimeout(
    goalTimer
  );

  clearTimeout(
    introTimer
  );

  pauseMenu?.classList.add(
    "hidden"
  );

  matchIntro?.classList.add(
    "hidden"
  );

  concedeConfirm?.classList.add(
    "hidden"
  );

  settingsMenu?.classList.add(
    "hidden"
  );

  goalMessage?.classList.add(
    "hidden"
  );

  if (conceded) {
    setText(
      winnerDisplay,
      "ORANGE WINS"
    );

    if (winnerDisplay) {
      winnerDisplay.style.color =
        "#ff8a20";
    }
  }

  else if (
    blueScore > orangeScore
  ) {
    setText(
      winnerDisplay,
      "BLUE WINS"
    );

    if (winnerDisplay) {
      winnerDisplay.style.color =
        "#43cfff";
    }
  }

  else if (
    orangeScore > blueScore
  ) {
    setText(
      winnerDisplay,
      "ORANGE WINS"
    );

    if (winnerDisplay) {
      winnerDisplay.style.color =
        "#ff8a20";
    }
  }

  else {
    setText(
      winnerDisplay,
      "DRAW"
    );

    if (winnerDisplay) {
      winnerDisplay.style.color =
        "#fff";
    }
  }

  setText(
    finalBlueScore,
    blueScore
  );

  setText(
    finalOrangeScore,
    orangeScore
  );

  resultScreen?.classList.remove(
    "hidden"
  );
}

/* =========================================================
   DÉBUT DU MATCH
========================================================= */

function startMatch() {
  clearInterval(
    countdownTimer
  );

  clearTimeout(
    countdownFinish
  );

  clearTimeout(
    goalTimer
  );

  clearTimeout(
    introTimer
  );

  clearKeys();

  resetPoints();

  boostParticles.length = 0;
  goalParticles.length = 0;

  goalFlash = 0;

  for (const p of boostPads) {
    p.cooldown = 0;
    p.flash = 0;
  }

  blueScore = 0;
  orangeScore = 0;

  gameTime = 120;

  paused = false;

  gameRunning = true;

  goalActive = true;

  setText(
    blueScoreEl,
    0
  );

  setText(
    orangeScoreEl,
    0
  );

  updateTimerDisplay();

  resetPositions();

  mainMenu?.classList.add(
    "hidden"
  );

  howToPlayMenu?.classList.add(
    "hidden"
  );

  settingsMenu?.classList.add(
    "hidden"
  );

  resultScreen?.classList.add(
    "hidden"
  );

  pauseMenu?.classList.add(
    "hidden"
  );

  concedeConfirm?.classList.add(
    "hidden"
  );

  matchIntro?.classList.remove(
    "hidden"
  );

  introTimer =
    setTimeout(() => {
      if (!gameRunning) {
        return;
      }

      matchIntro?.classList.add(
        "hidden"
      );

      startCountdown();
    }, 900);
}

/* =========================================================
   MENU PRINCIPAL
========================================================= */

function showMainMenu() {
  clearInterval(
    countdownTimer
  );

  clearTimeout(
    countdownFinish
  );

  clearTimeout(
    goalTimer
  );

  clearTimeout(
    introTimer
  );

  clearKeys();

  gameRunning = false;

  paused = false;

  goalActive = false;

  resetPoints();

  matchIntro?.classList.add(
    "hidden"
  );

  howToPlayMenu?.classList.add(
    "hidden"
  );

  settingsMenu?.classList.add(
    "hidden"
  );

  resultScreen?.classList.add(
    "hidden"
  );

  pauseMenu?.classList.add(
    "hidden"
  );

  concedeConfirm?.classList.add(
    "hidden"
  );

  countdownEl?.classList.add(
    "hidden"
  );

  goalMessage?.classList.add(
    "hidden"
  );

  mainMenu?.classList.remove(
    "hidden"
  );
}

/* =========================================================
   PAUSE
========================================================= */

function togglePause() {
  if (
    !gameRunning ||
    goalActive
  ) {
    return;
  }

  paused = !paused;

  clearKeys();

  pauseMenu?.classList.toggle(
    "hidden",
    !paused
  );
}

$("resumeButton")?.addEventListener(
  "click",
  () => {
    if (!gameRunning) {
      return;
    }

    paused = false;

    clearKeys();

    pauseMenu?.classList.add(
      "hidden"
    );
  }
);

/* =========================================================
   ABANDONNER
========================================================= */

$("concedeButton")?.addEventListener(
  "click",
  () => {
    if (!gameRunning) {
      return;
    }

    concedeConfirm?.classList.remove(
      "hidden"
    );
  }
);

$("cancelConcedeButton")?.addEventListener(
  "click",
  () => {
    concedeConfirm?.classList.add(
      "hidden"
    );
  }
);

$("confirmConcedeButton")?.addEventListener(
  "click",
  () => {
    concedeConfirm?.classList.add(
      "hidden"
    );

    endMatch(true);
  }
);

$("pauseMainMenuButton")?.addEventListener(
  "click",
  showMainMenu
);

/* =========================================================
   BOUTONS MENU
========================================================= */

$("playButton")?.addEventListener(
  "click",
  startMatch
);

playAgainButton?.addEventListener(
  "click",
  startMatch
);

mainMenuButton?.addEventListener(
  "click",
  showMainMenu
);

$("restartButton")?.addEventListener(
  "click",
  startMatch
);

/* =========================================================
   DESSIN DU TERRAIN
========================================================= */

function drawArena() {
  ctx.fillStyle = "#06131f";

  ctx.fillRect(
    0,
    0,
    W,
    H
  );

  ctx.strokeStyle =
    "rgba(80,180,255,.08)";

  ctx.lineWidth = 1;

  for (
    let x = 0;
    x < W;
    x += 60
  ) {
    ctx.beginPath();

    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);

    ctx.stroke();
  }

  for (
    let y = 0;
    y < H;
    y += 60
  ) {
    ctx.beginPath();

    ctx.moveTo(0, y);
    ctx.lineTo(W, y);

    ctx.stroke();
  }

  ctx.strokeStyle =
    "rgba(120,220,255,.35)";

  ctx.lineWidth = 3;

  ctx.strokeRect(
    field.left,
    field.top,
    field.right -
      field.left,
    field.bottom -
      field.top
  );

  ctx.beginPath();

  ctx.moveTo(
    W / 2,
    field.top
  );

  ctx.lineTo(
    W / 2,
    field.bottom
  );

  ctx.stroke();

  ctx.beginPath();

  ctx.arc(
    W / 2,
    H / 2,
    85,
    0,
    Math.PI * 2
  );

  ctx.stroke();

  ctx.fillStyle =
    "#72eaff";

  ctx.beginPath();

  ctx.arc(
    W / 2,
    H / 2,
    5,
    0,
    Math.PI * 2
  );

  ctx.fill();

  /* CAGE BLEUE */

  ctx.lineWidth = 5;

  ctx.shadowBlur = 18;

  ctx.strokeStyle =
    "#18cfff";

  ctx.shadowColor =
    "#00aaff";

  ctx.strokeRect(
    field.left -
      goal.depth,
    goal.top,
    goal.depth,
    goal.bottom -
      goal.top
  );

  /* CAGE ORANGE */

  ctx.strokeStyle =
    "#ff851b";

  ctx.shadowColor =
    "#ff5e00";

  ctx.strokeRect(
    field.right,
    goal.top,
    goal.depth,
    goal.bottom -
      goal.top
  );

  ctx.shadowBlur = 0;

  drawBoostPads();
}

/* =========================================================
   DESSIN DES BOOSTS
========================================================= */

function drawBoostPads() {
  for (const p of boostPads) {
    const available =
      p.cooldown <= 0;

    const pulse =
      1 +
      Math.sin(p.pulse) *
        0.08;

    ctx.save();

    ctx.translate(
      p.x,
      p.y
    );

    ctx.globalAlpha =
      available
        ? 1
        : 0.35;

    ctx.shadowColor =
      p.color;

    ctx.shadowBlur =
      available
        ? 22
        : 8;

    ctx.fillStyle =
      "rgba(8,18,30,.9)";

    ctx.beginPath();

    ctx.ellipse(
      0,
      0,
      28 * pulse,
      16 * pulse,
      0,
      0,
      Math.PI * 2
    );

    ctx.fill();

    ctx.fillStyle =
      p.color;

    ctx.beginPath();

    ctx.ellipse(
      0,
      0,
      19 * pulse,
      8 * pulse,
      0,
      0,
      Math.PI * 2
    );

    ctx.fill();

    ctx.strokeStyle =
      "#fff";

    ctx.lineWidth = 2;

    ctx.beginPath();

    ctx.arc(
      0,
      0,
      23 * pulse,
      0,
      Math.PI * 2
    );

    ctx.stroke();

    if (p.flash > 0) {
      ctx.globalAlpha =
        p.flash;

      ctx.strokeStyle =
        "#fff";

      ctx.lineWidth = 4;

      ctx.beginPath();

      ctx.arc(
        0,
        0,
        32 +
          (1 - p.flash) *
            18,
        0,
        Math.PI * 2
      );

      ctx.stroke();
    }

    ctx.restore();
  }

  drawParticles(
    boostParticles
  );
}

/* =========================================================
   PARTICULES
========================================================= */

function drawParticles(list) {
  for (const p of list) {
    ctx.save();

    ctx.globalAlpha =
      Math.max(
        0,
        Math.min(
          1,
          p.life
        )
      );

    ctx.fillStyle =
      p.color;

    ctx.shadowColor =
      p.color;

    ctx.shadowBlur = 12;

    ctx.beginPath();

    ctx.arc(
      p.x,
      p.y,
      p.size,
      0,
      Math.PI * 2
    );

    ctx.fill();

    ctx.restore();
  }
}

function drawGoalEffects() {
  drawParticles(
    goalParticles
  );

  if (goalFlash > 0) {
    ctx.save();

    ctx.globalAlpha =
      goalFlash * 0.12;

    ctx.fillStyle =
      "#fff";

    ctx.fillRect(
      0,
      0,
      W,
      H
    );

    ctx.restore();
  }
}

/* =========================================================
   HUD
========================================================= */

function updateHUD() {
  if (boostFill) {
    boostFill.style.width =
      `${player.boost}%`;
  }

  setText(
    boostNumber,
    Math.floor(player.boost)
  );

  const s =
    Math.abs(player.speed);

  const kmh =
    player.boosting
      ? Math.round(
          Math.min(
            83,
            s *
              (83 / 11.7)
          )
        )
      : Math.round(
          Math.min(
            51,
            s *
              (51 / 7.2)
          )
        );

  setText(
    speedNumber,
    kmh
  );
}

/* =========================================================
   ROUND RECT
========================================================= */

function roundRect(
  x,
  y,
  w,
  h,
  r
) {
  ctx.beginPath();

  ctx.moveTo(
    x + r,
    y
  );

  ctx.lineTo(
    x + w - r,
    y
  );

  ctx.quadraticCurveTo(
    x + w,
    y,
    x + w,
    y + r
  );

  ctx.lineTo(
    x + w,
    y + h - r
  );

  ctx.quadraticCurveTo(
    x + w,
    y + h,
    x + w - r,
    y + h
  );

  ctx.lineTo(
    x + r,
    y + h
  );

  ctx.quadraticCurveTo(
    x,
    y + h,
    x,
    y + h - r
  );

  ctx.lineTo(
    x,
    y + r
  );

  ctx.quadraticCurveTo(
    x,
    y,
    x + r,
    y
  );

  ctx.closePath();
}

/* =========================================================
   GAME LOOP
========================================================= */

function gameLoop(now) {
  const dt =
    Math.min(
      now - lastTime,
      100
    );

  lastTime = now;

  updateEffects(dt);

  updateBoostPads(dt);

  if (
    gameRunning &&
    !paused &&
    !goalActive
  ) {
    player.update();

    bot.update();

    ball.update();

    if (!goalActive) {
      carBallCollision(
        player
      );

      carBallCollision(
        bot
      );

      carCarCollision(
        player,
        bot
      );

      updateTimer(dt);
    }
  }

  drawArena();

  ball.draw();

  player.draw();

  bot.draw();

  drawGoalEffects();

  updateHUD();

  requestAnimationFrame(
    gameLoop
  );
}

/* =========================================================
   INITIALISATION
========================================================= */

setupDeviceChoice();

updateControlUI();

resetPoints();

updateTimerDisplay();

drawArena();

ball.draw();

player.draw();

bot.draw();

updateHUD();

requestAnimationFrame(
  gameLoop
);
