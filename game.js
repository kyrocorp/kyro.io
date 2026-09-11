const canvas = document.getElementById("gameCanvas");
if (!canvas) throw new Error("gameCanvas introuvable");

document.title = "Rocket League.io";

document.querySelectorAll("*").forEach(el => {
  if (el.childElementCount === 0 && el.textContent) {
    el.textContent = el.textContent.replace(
      /TURBOBALL\.IO/gi,
      "ROCKET LEAGUE.IO"
    );
  }
});

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
    Object.keys(defaults).every(
      key => typeof saved[key] === "string"
    )
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
   PC / MOBILE
========================================================= */

let deviceMode =
  localStorage.getItem("rocketleague-device-mode") || "pc";

let mobileBoostSide =
  localStorage.getItem("rocketleague-mobile-boost-side") || "left";

const mobileInput = {
  x: 0,
  y: 0,
  active: false,
  pointerId: null,
  startX: 0,
  startY: 0
};

let mobileBoostHeld = false;
let mobileBoostButton = null;
let mobilePauseButton = null;
let deviceChooser = null;

function isMobileMode() {
  return deviceMode === "mobile";
}

function isPCMode() {
  return deviceMode !== "mobile";
}

/* =========================================================
   VARIABLES DE PARTIE
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
   ONLINE
========================================================= */

const ONLINE_SERVER_URL =
  "wss://kyro-io.onrender.com";

let gameMode = "offline";

let socket = null;

let onlineSearching = false;
let onlineHost = false;
let onlinePlayerNumber = 0;
let onlineMatchId = null;

let remoteInput = {
  forward: false,
  reverse: false,
  left: false,
  right: false,
  boost: false
};

let lastNetworkSend = 0;
let lastHeartbeat = 0;

let lastNetGoalActive = false;

let reconnectTimer = null;
let searchOverlay = null;

/* =========================================================
   TOUCHES
========================================================= */

function keyName(key) {
  if (key === " ") return "SPACE";
  if (key === "space") return "SPACE";
  if (key.length === 1) return key.toUpperCase();

  return key.toUpperCase();
}

function saveControls() {
  localStorage.setItem(
    "turboball-controls",
    JSON.stringify(controls)
  );
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
  if (e.code === "Space") {
    return "space";
  }

  return e.key.toLowerCase();
}

/*
   C'EST CETTE FONCTION QUI ACTIVE RÉELLEMENT
   LES TOUCHES DE JEU.
*/

function controlPressed(action) {

  /* MOBILE */

  if (isMobileMode()) {

    if (action === "forward") {
      return mobileInput.y < -0.18;
    }

    if (action === "reverse") {
      return mobileInput.y > 0.18;
    }

    if (action === "left") {
      return mobileInput.x < -0.18;
    }

    if (action === "right") {
      return mobileInput.x > 0.18;
    }

    if (action === "boost") {
      return mobileBoostHeld;
    }
  }

  /* PC */

  return !!keys[controls[action]];
}

/* =========================================================
   VOITURE LOCALE
========================================================= */

function localCar() {

  if (
    gameMode === "multiplayer" &&
    onlinePlayerNumber === 2
  ) {
    return bot;
  }

  return player;
}

/* =========================================================
   NETTOYAGE TOUCHES
========================================================= */

function clearKeys() {

  for (const key in keys) {
    keys[key] = false;
  }

  mobileInput.x = 0;
  mobileInput.y = 0;
  mobileInput.active = false;
  mobileBoostHeld = false;
}

/* =========================================================
   CLAVIER PC
========================================================= */

document.addEventListener("keydown", e => {

  /*
     En MOBILE les touches PC ne contrôlent pas la voiture.
  */

  if (isMobileMode()) {
    return;
  }

  /*
     REMAPPING DES TOUCHES
  */

  if (waitingForAction) {

    e.preventDefault();

    if (e.key === "Escape") {

      const action =
        waitingForAction.dataset.action;

      waitingForAction.textContent =
        keyName(controls[action]);

      waitingForAction = null;

      return;
    }

    const action =
      waitingForAction.dataset.action;

    const newKey = normalizedKey(e);

    if (
      newKey === "" ||
      newKey === "p" ||
      newKey === "escape"
    ) {
      return;
    }

    const alreadyUsed =
      Object.keys(controls).find(
        other =>
          other !== action &&
          controls[other] === newKey
      );

    if (alreadyUsed) {
      return;
    }

    controls[action] = newKey;

    saveControls();
    updateControlUI();

    waitingForAction = null;

    return;
  }

  const k = normalizedKey(e);

  /*
     EMPÊCHE LA PAGE DE SCROLLER AVEC ESPACE
  */

  if (k === "space") {
    e.preventDefault();
  }

  /*
     P = PAUSE
  */

  if (
    gameRunning &&
    !goalActive &&
    k === "p"
  ) {
    togglePause();
    return;
  }

  /*
     ACTIVATION DE LA TOUCHE
  */

  keys[k] = true;
});

document.addEventListener("keyup", e => {

  if (isMobileMode()) {
    return;
  }

  const k = normalizedKey(e);

  keys[k] = false;
});

window.addEventListener("blur", clearKeys);

/* =========================================================
   BOUTONS REMAPPING
========================================================= */

for (const action of Object.keys(keyButtons)) {

  keyButtons[action]?.addEventListener(
    "click",
    () => {

      if (waitingForAction) {
        return;
      }

      waitingForAction =
        keyButtons[action];

      waitingForAction.dataset.action =
        action;

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

/* =========================================================
   SETTINGS
========================================================= */

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

  updateMobileSettings();

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
   STYLE + CONTRÔLES MOBILE
========================================================= */

function addMobileStyles() {

  if ($("mobileControlStyle")) {
    return;
  }

  const style =
    document.createElement("style");

  style.id = "mobileControlStyle";

  style.textContent = `

    #mobileTouchPad {
      position: fixed;
      inset: 0;
      z-index: 9000;
      background: transparent;
      touch-action: none;
      display: none;
    }

    #mobileBoostButton,
    #mobilePauseButton {
      position: fixed;
      z-index: 9100;
      color: white;
      font-weight: 900;
      user-select: none;
      -webkit-user-select: none;
      touch-action: none;
    }

    #mobileBoostButton {
      bottom: 28px;
      width: 112px;
      height: 112px;
      border-radius: 50%;
      background: rgba(30,210,255,.18);
      border: 2px solid rgba(100,235,255,.8);
      box-shadow:
        0 0 25px rgba(20,210,255,.45);
      font-size: 18px;
    }

    #mobilePauseButton {
      top: 18px;
      right: 18px;
      width: 58px;
      height: 58px;
      border-radius: 16px;
      background: rgba(5,15,25,.78);
      border: 1px solid rgba(255,255,255,.35);
      font-size: 18px;
    }

    #mobileDeviceChooser {
      position: fixed;
      inset: 0;
      z-index: 20000;
      background: rgba(2,7,14,.98);
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-family: Arial,sans-serif;
      text-align: center;
    }

    #mobileDeviceChooser .box {
      width: min(90vw,620px);
      padding: 34px;
      border: 1px solid rgba(100,220,255,.35);
      border-radius: 24px;
      background: rgba(7,18,30,.96);
      box-shadow: 0 0 50px rgba(0,180,255,.18);
    }

    #mobileDeviceChooser h1 {
      font-size: clamp(28px,6vw,52px);
      margin: 0 0 12px;
      font-weight: 1000;
      letter-spacing: 2px;
    }

    #mobileDeviceChooser p {
      opacity: .75;
      margin: 0 0 26px;
      font-size: 17px;
    }

    #mobileDeviceChooser .choices {
      display: flex;
      gap: 14px;
      justify-content: center;
      flex-wrap: wrap;
    }

    #mobileDeviceChooser button {
      min-width: 210px;
      padding: 17px 24px;
      border-radius: 14px;
      border: 1px solid rgba(255,255,255,.22);
      background: #102335;
      color: white;
      font-weight: 900;
      font-size: 18px;
      cursor: pointer;
    }

    #mobileSettingsPanel {
      margin: 12px 0;
      padding: 16px;
      border: 1px solid rgba(100,220,255,.3);
      border-radius: 14px;
      background: rgba(20,40,55,.55);
      color: white;
    }

    #mobileSettingsPanel button {
      padding: 10px 14px;
      border-radius: 9px;
      border: 1px solid rgba(255,255,255,.25);
      background: #132638;
      color: white;
      font-weight: 800;
      margin: 5px;
      cursor: pointer;
    }

    #mobileSettingsPanel .selected {
      outline: 2px solid #4de3ff;
    }
  `;

  document.head.appendChild(style);
}

/* =========================================================
   CRÉATION CONTRÔLES MOBILE
========================================================= */

function createMobileControls() {

  addMobileStyles();

  /* TOUCH PAD */

  if (!$("mobileTouchPad")) {

    const pad =
      document.createElement("div");

    pad.id = "mobileTouchPad";

    document.body.appendChild(pad);

    pad.addEventListener(
      "pointerdown",
      e => {

        if (e.target !== pad) {
          return;
        }

        mobileInput.active = true;
        mobileInput.pointerId = e.pointerId;

        mobileInput.startX = e.clientX;
        mobileInput.startY = e.clientY;

        mobileInput.x = 0;
        mobileInput.y = 0;

        pad.setPointerCapture?.(
          e.pointerId
        );
      }
    );

    pad.addEventListener(
      "pointermove",
      e => {

        if (
          !mobileInput.active ||
          e.pointerId !== mobileInput.pointerId
        ) {
          return;
        }

        const max = 95;

        mobileInput.x =
          Math.max(
            -1,
            Math.min(
              1,
              (e.clientX -
                mobileInput.startX) /
                max
            )
          );

        mobileInput.y =
          Math.max(
            -1,
            Math.min(
              1,
              (e.clientY -
                mobileInput.startY) /
                max
            )
          );
      }
    );

    const endTouch = () => {

      mobileInput.active = false;
      mobileInput.pointerId = null;

      mobileInput.x = 0;
      mobileInput.y = 0;
    };

    pad.addEventListener(
      "pointerup",
      endTouch
    );

    pad.addEventListener(
      "pointercancel",
      endTouch
    );
  }

  /* BOOST */

  if (!mobileBoostButton) {

    mobileBoostButton =
      document.createElement("button");

    mobileBoostButton.id =
      "mobileBoostButton";

    mobileBoostButton.textContent =
      "BOOST";

    document.body.appendChild(
      mobileBoostButton
    );

    const down = e => {

      e.preventDefault();

      mobileBoostHeld = true;

      mobileBoostButton.style.transform =
        "scale(.94)";
    };

    const up = e => {

      e.preventDefault();

      mobileBoostHeld = false;

      mobileBoostButton.style.transform =
        "";
    };

    mobileBoostButton.addEventListener(
      "pointerdown",
      down
    );

    mobileBoostButton.addEventListener(
      "pointerup",
      up
    );

    mobileBoostButton.addEventListener(
      "pointercancel",
      up
    );

    mobileBoostButton.addEventListener(
      "pointerleave",
      up
    );
  }

  /* PAUSE */

  if (!mobilePauseButton) {

    mobilePauseButton =
      document.createElement("button");

    mobilePauseButton.id =
      "mobilePauseButton";

    mobilePauseButton.textContent =
      "Ⅱ";

    document.body.appendChild(
      mobilePauseButton
    );

    mobilePauseButton.addEventListener(
      "click",
      () => togglePause()
    );
  }

  positionMobileBoost();

  updateMobileVisibility();
}

function positionMobileBoost() {

  if (!mobileBoostButton) {
    return;
  }

  if (mobileBoostSide === "left") {

    mobileBoostButton.style.left =
      "22px";

    mobileBoostButton.style.right =
      "auto";

  } else {

    mobileBoostButton.style.left =
      "auto";

    mobileBoostButton.style.right =
      "22px";
  }
}

function updateMobileVisibility() {

  const show =
    isMobileMode();

  const active =
    show &&
    gameRunning &&
    !paused;

  const pad =
    $("mobileTouchPad");

  if (pad) {
    pad.style.display =
      active ? "block" : "none";
  }

  if (mobileBoostButton) {
    mobileBoostButton.style.display =
      active ? "block" : "none";
  }

  if (mobilePauseButton) {
    mobilePauseButton.style.display =
      show && gameRunning
        ? "block"
        : "none";
  }
}

/* =========================================================
   CHOIX PC / MOBILE
========================================================= */

function showDeviceChooser() {

  addMobileStyles();

  if (deviceChooser) {
    deviceChooser.remove();
  }

  deviceChooser =
    document.createElement("div");

  deviceChooser.id =
    "mobileDeviceChooser";

  deviceChooser.innerHTML = `
    <div class="box">
      <h1>ROCKET LEAGUE.IO</h1>
      <p>CHOISIS TON APPAREIL POUR JOUER</p>

      <div class="choices">
        <button id="choosePC">
          🖥️ PC
        </button>

        <button id="chooseMobile">
          📱 MOBILE
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(
    deviceChooser
  );

  $("choosePC").onclick =
    () => selectDevice("pc");

  $("chooseMobile").onclick =
    () => selectDevice("mobile");
}

function selectDevice(mode) {

  deviceMode = mode;

  localStorage.setItem(
    "rocketleague-device-mode",
    mode
  );

  deviceChooser?.remove();

  deviceChooser = null;

  createMobileControls();

  updateMobileSettings();
  updateMobileVisibility();
}

/* =========================================================
   SETTINGS MOBILE
========================================================= */

function ensureMobileSettings() {

  if (
    !settingsMenu ||
    $("mobileSettingsPanel")
  ) {
    return;
  }

  const panel =
    document.createElement("div");

  panel.id =
    "mobileSettingsPanel";

  panel.innerHTML = `
    <div style="
      font-weight:900;
      font-size:18px;
      margin-bottom:8px;
    ">
      📱 CONTRÔLES MOBILE
    </div>

    <div>
      POSITION DU BOOST
    </div>

    <button id="boostLeftButton">
      BOOST À GAUCHE
    </button>

    <button id="boostRightButton">
      BOOST À DROITE
    </button>

    <button id="resetMobileButton">
      RÉINITIALISER MOBILE
    </button>
  `;

  settingsMenu.prepend(panel);

  $("boostLeftButton").onclick =
    () => {

      mobileBoostSide = "left";

      localStorage.setItem(
        "rocketleague-mobile-boost-side",
        "left"
      );

      positionMobileBoost();
      updateMobileSettings();
    };

  $("boostRightButton").onclick =
    () => {

      mobileBoostSide = "right";

      localStorage.setItem(
        "rocketleague-mobile-boost-side",
        "right"
      );

      positionMobileBoost();
      updateMobileSettings();
    };

  $("resetMobileButton").onclick =
    () => {

      mobileBoostSide = "left";

      localStorage.setItem(
        "rocketleague-mobile-boost-side",
        "left"
      );

      positionMobileBoost();
      updateMobileSettings();
    };
}

function updateMobileSettings() {

  ensureMobileSettings();

  const panel =
    $("mobileSettingsPanel");

  if (!panel) {
    return;
  }

  panel.style.display =
    isMobileMode()
      ? "block"
      : "none";

  $("boostLeftButton")
    ?.classList.toggle(
      "selected",
      mobileBoostSide === "left"
    );

  $("boostRightButton")
    ?.classList.toggle(
      "selected",
      mobileBoostSide === "right"
    );

  /*
     EN MOBILE :
     les boutons de remapping PC sont cachés.
  */

  for (
    const button of
    Object.values(keyButtons)
  ) {

    if (button) {
      button.style.display =
        isMobileMode()
          ? "none"
          : "";
    }
  }

  if ($("resetControlsButton")) {

    $("resetControlsButton").style.display =
      isMobileMode()
        ? "none"
        : "";
  }
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

const saveZone = {
  x: field.left + 10,
  y: goal.top + 12,
  width: 145,
  height:
    goal.bottom -
    goal.top -
    24
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
const demolitionParticles = [];

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

    this.angle =
      bot ? Math.PI : 0;

    this.speed = 0;

    this.maxSpeed = 7.2;

    this.boostMax = 11.7;

    this.boost = 100;

    this.boosting = false;

    this.ballContact = false;

    this.aiTarget = null;
    this.aiThink = 0;

    /* DÉMOLITION */

    this.demolished = false;
    this.demoTimer = 0;
    this.demoCooldown = 0;
  }

  reset() {

    this.x = this.startX;
    this.y = this.startY;

    this.angle =
      this.isBot
        ? Math.PI
        : 0;

    this.speed = 0;

    this.boost = 100;

    this.boosting = false;

    this.ballContact = false;

    this.aiTarget = null;

    this.demolished = false;
    this.demoTimer = 0;
    this.demoCooldown = 0;
  }

  update() {

    if (this.demoCooldown > 0) {

      this.demoCooldown =
        Math.max(
          0,
          this.demoCooldown -
            1 / 60
        );
    }

    /*
       VOITURE DÉTRUITE
    */

    if (this.demolished) {

      this.demoTimer -= 1 / 60;

      if (this.demoTimer <= 0) {
        this.reset();
      }

      return;
    }

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

    this.boost =
      Math.min(
        100,
        this.boost + 0.025
      );
  }

  /* =====================================================
     CONTRÔLES DU JOUEUR
  ===================================================== */

  updatePlayer() {

    this.boosting = false;

    /*
       Z = AVANCER
    */

    if (controlPressed("forward")) {
      this.speed += 0.18;
    }

    /*
       S = RECULER
    */

    if (controlPressed("reverse")) {

      if (this.speed > 0) {
        this.speed -= 0.25;
      } else {
        this.speed -= 0.12;
      }
    }

    /*
       Q = GAUCHE
       D = DROITE
    */

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

    /*
       ESPACE = BOOST
    */

    if (
      controlPressed("boost") &&
      this.boost > 0 &&
      this.speed > 0
    ) {

      this.speed += 0.28;

      this.boost -= 0.7;

      this.boosting = true;
    }

    this.speed =
      Math.max(
        -3.2,
        Math.min(
          this.speed,
          this.boosting
            ? this.boostMax
            : this.maxSpeed
        )
      );
  }

  /* =====================================================
     JOUEUR DISTANT
  ===================================================== */

  updateRemote(input) {

    if (this.demolished) {
      return;
    }

    this.boosting = false;

    if (input.forward) {
      this.speed += 0.18;
    }

    if (input.reverse) {

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

    if (input.left) {
      this.angle -=
        turn *
        (this.speed >= 0 ? 1 : -1);
    }

    if (input.right) {
      this.angle +=
        turn *
        (this.speed >= 0 ? 1 : -1);
    }

    if (
      input.boost &&
      this.boost > 0 &&
      this.speed > 0
    ) {

      this.speed += 0.28;

      this.boost -= 0.7;

      this.boosting = true;
    }

    this.speed =
      Math.max(
        -3.2,
        Math.min(
          this.speed,
          this.boosting
            ? this.boostMax
            : this.maxSpeed
        )
      );
  }

  /* =====================================================
     IA
  ===================================================== */

  updateAI() {

    const dxBall =
      ball.x - this.x;

    const dyBall =
      ball.y - this.y;

    const distBall =
      Math.hypot(
        dxBall,
        dyBall
      );

    let tx = ball.x;
    let ty = ball.y;

    /*
       DÉFENSE
    */

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
        (ball.y - H / 2) * 0.7;

    } else if (
      ball.x < W * 0.42
    ) {

      tx = ball.x + 45;
      ty = ball.y;
    }

    this.aiThink -= 1 / 60;

    const dangerous =
      ball.x >
        field.right - 270 &&
      ball.vx > 0;

    /*
       CHERCHE UN BOOST
    */

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

    } else if (
      this.boost > 45 ||
      dangerous
    ) {

      this.aiTarget = null;
    }

    const targetAngle =
      Math.atan2(
        ty - this.y,
        tx - this.x
      );

    let diff =
      targetAngle -
      this.angle;

    while (diff > Math.PI) {
      diff -= Math.PI * 2;
    }

    while (diff < -Math.PI) {
      diff += Math.PI * 2;
    }

    const turn = 0.062;

    if (diff > 0.06) {
      this.angle += turn;
    } else if (diff < -0.06) {
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

    /*
       IA BOOST MAX = 10.2
       donc peut aussi démolir.
    */

    this.speed =
      Math.min(
        this.speed,
        this.boosting
          ? 10.2
          : 6.7
      );

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

    if (
      this.x <
      field.left + r
    ) {

      this.x =
        field.left + r;

      this.speed *= -0.3;
    }

    if (
      this.x >
      field.right - r
    ) {

      this.x =
        field.right - r;

      this.speed *= -0.3;
    }

    if (
      this.y <
      field.top + r
    ) {

      this.y =
        field.top + r;

      this.speed *= -0.3;
    }

    if (
      this.y >
      field.bottom - r
    ) {

      this.y =
        field.bottom - r;

      this.speed *= -0.3;
    }
  }

  draw() {

    if (this.demolished) {
      return;
    }

    ctx.save();

    ctx.translate(
      this.x,
      this.y
    );

    ctx.rotate(
      this.angle
    );

    if (this.boosting) {

      ctx.fillStyle =
        "rgba(80,220,255,.7)";

      ctx.beginPath();

      ctx.moveTo(
        -35,
        -11
      );

      ctx.lineTo(
        -65 -
          Math.random() * 18,
        0
      );

      ctx.lineTo(
        -35,
        11
      );

      ctx.fill();
    }

    ctx.shadowColor =
      this.color;

    ctx.shadowBlur = 18;

    ctx.fillStyle =
      this.color;

    roundRect(
      -28,
      -17,
      56,
      34,
      10
    );

    ctx.fill();

    ctx.shadowBlur = 0;

    ctx.fillStyle =
      "#08101a";

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

    ctx.fillStyle =
      "#05070b";

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
   BALLE
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

    const speed =
      Math.hypot(
        this.vx,
        this.vy
      );

    /*
       MAX BALLE = 216 KM/H
       9 unités = 216 km/h
    */

    if (speed > 9) {

      this.vx =
        this.vx / speed * 9;

      this.vy =
        this.vy / speed * 9;
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

    if (!inOpening) {
      return;
    }

    if (
      this.x - this.radius <=
      field.left - 2
    ) {

      scoreGoal("orange");

    } else if (
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
        field.top +
        this.radius;

      this.vy *= -0.82;
    }

    if (
      this.y + this.radius >
      field.bottom
    ) {

      this.y =
        field.bottom -
        this.radius;

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

    const gradient =
      ctx.createRadialGradient(
        this.x - 6,
        this.y - 7,
        2,
        this.x,
        this.y,
        this.radius
      );

    gradient.addColorStop(
      0,
      "#fff"
    );

    gradient.addColorStop(
      .55,
      "#dce7f0"
    );

    gradient.addColorStop(
      1,
      "#7d91a3"
    );

    ctx.fillStyle =
      gradient;

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

const ball =
  new Ball();

/* =========================================================
   SAVE
========================================================= */

function carInSaveZone(car) {

  return (
    car.x >= saveZone.x &&
    car.x <=
      saveZone.x +
      saveZone.width &&
    car.y >= saveZone.y &&
    car.y <=
      saveZone.y +
      saveZone.height
  );
}

function playerInSaveZone() {

  const car =
    localCar();

  /*
     Zone bleue
  */

  if (
    car.color === "#20cfff"
  ) {

    return carInSaveZone(car);
  }

  /*
     Zone orange
  */

  return (
    car.x >=
      field.right - 155 &&
    car.x <=
      field.right - 10 &&
    car.y >= saveZone.y &&
    car.y <=
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

  const car =
    localCar();

  if (
    car.color === "#ff8a18"
  ) {

    return (
      inLane &&
      ball.x >
        field.right - 250 &&
      (
        ball.vx > 0.1 ||
        ball.x >
          field.right - 105
      )
    );
  }

  return (
    inLane &&
    ball.x <
      field.left + 250 &&
    (
      ball.vx < -0.1 ||
      ball.x <
        field.left + 105
    )
  );
}

/* =========================================================
   COLLISION BALLE
========================================================= */

function carBallCollision(car) {

  if (car.demolished) {
    return;
  }

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

  const isLocal =
    car === localCar();

  const dangerousBefore =
    isLocal &&
    ballDangerous();

  const newContact =
    !car.ballContact;

  car.ballContact = true;

  /*
     +2 PAR CONTACT
  */

  if (
    isLocal &&
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
      Math.abs(car.speed) * 1.15 + 1.2,
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

  /*
     SAVE
  */

  if (
    isLocal &&
    newContact &&
    dangerousBefore &&
    playerInSaveZone() &&
    saveCooldown <= 0
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
   DÉMOLITIONS
========================================================= */

function spawnDemolition(car) {

  for (let i = 0; i < 38; i++) {

    const angle =
      Math.random() *
      Math.PI *
      2;

    const speed =
      2 +
      Math.random() * 5;

    demolitionParticles.push({

      x: car.x,
      y: car.y,

      vx:
        Math.cos(angle) *
        speed,

      vy:
        Math.sin(angle) *
        speed,

      life:
        0.8 +
        Math.random() * 0.5,

      size:
        2 +
        Math.random() * 5,

      color:
        car.color
    });
  }
}

function demolishCar(
  attacker,
  victim
) {

  if (
    victim.demolished ||
    attacker.demolished
  ) {
    return;
  }

  if (
    attacker.demoCooldown > 0 ||
    victim.demoCooldown > 0
  ) {
    return;
  }

  /*
     70 KM/H MINIMUM
  */

  const attackerKmh =
    Math.abs(attacker.speed) *
    (83 / 11.7);

  if (attackerKmh < 70) {
    return;
  }

  /*
     SEUL L'ADVERSAIRE EST DÉMOLI
  */

  victim.demolished = true;

  victim.demoTimer = 1.15;

  victim.demoCooldown = 1.5;

  victim.speed = 0;

  victim.boosting = false;

  attacker.demoCooldown = 0.65;

  spawnDemolition(victim);
}

/* =========================================================
   COLLISION VOITURES
========================================================= */

function carCarCollision(a, b) {

  if (
    a.demolished ||
    b.demolished
  ) {
    return;
  }

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

  const av = a.speed;
  const bv = b.speed;

  /*
     DÉMOLITION
  */

  if (
    Math.abs(av) *
      (83 / 11.7) >= 70
  ) {
    demolishCar(a, b);
  }

  if (
    Math.abs(bv) *
      (83 / 11.7) >= 70
  ) {
    demolishCar(b, a);
  }

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

    const angle =
      Math.PI * 2 * i / 10;

    const speed =
      1.2 +
      Math.random() * 1.4;

    boostParticles.push({

      x: pad.x,
      y: pad.y,

      vx:
        Math.cos(angle) *
        speed,

      vy:
        Math.sin(angle) *
        speed,

      life: 0.55,

      size:
        2 +
        Math.random() * 2,

      color:
        pad.color
    });
  }
}

function spawnGoalParticles(team) {

  const color =
    team === "blue"
      ? "#43d9ff"
      : "#ff9d2e";

  for (let i = 0; i < 32; i++) {

    const angle =
      Math.random() *
      Math.PI *
      2;

    const speed =
      1.5 +
      Math.random() * 3.5;

    goalParticles.push({

      x: W / 2,
      y: H / 2,

      vx:
        Math.cos(angle) *
        speed,

      vy:
        Math.sin(angle) *
        speed,

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
      goalParticles,
      demolitionParticles
    ]
  ) {

    for (const particle of list) {

      particle.x +=
        particle.vx;

      particle.y +=
        particle.vy;

      particle.vx *= 0.97;
      particle.vy *= 0.97;

      particle.life -= sec;
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

  for (const pad of boostPads) {

    pad.cooldown =
      Math.max(
        0,
        pad.cooldown - sec
      );

    pad.pulse +=
      sec * 2.4;

    pad.flash =
      Math.max(
        0,
        pad.flash - sec * 2.5
      );
  }

  if (
    !gameRunning ||
    paused ||
    goalActive
  ) {
    return;
  }

  const cars =
    gameMode === "multiplayer"
      ? [player, bot]
      : [localCar()];

  for (const pad of boostPads) {

    if (pad.cooldown > 0) {
      continue;
    }

    for (const car of cars) {

      if (car.demolished) {
        continue;
      }

      if (
        Math.hypot(
          car.x - pad.x,
          car.y - pad.y
        ) <
        car.radius + 22
      ) {

        car.boost =
          Math.min(
            100,
            car.boost + 25
          );

        pad.cooldown = 5;
        pad.flash = 1;

        spawnPadParticles(pad);

        break;
      }
    }
  }
}

/* =========================================================
   POINTS
========================================================= */

function setText(el, value) {

  if (el) {
    el.textContent = value;
  }
}

function updatePoints() {

  setText(
    playerPointsEl,
    playerPoints
  );
}

function awardPoints(
  amount,
  reason
) {

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

    pointsNotification.classList.add(
      "show"
    );

    pointsTimer =
      setTimeout(
        () =>
          pointsNotification.classList.remove(
            "show"
          ),
        1100
      );
  }

  pointsPanel?.classList.remove(
    "earned"
  );

  if (pointsPanel) {

    void pointsPanel.offsetWidth;

    pointsPanel.classList.add(
      "earned"
    );
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

    if (
      gameMode === "offline" ||
      onlinePlayerNumber === 1
    ) {

      awardPoints(
        150,
        "GOAL"
      );
    }

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

  } else {

    orangeScore++;

    setText(
      orangeScoreEl,
      orangeScore
    );

    if (
      gameMode === "multiplayer" &&
      onlinePlayerNumber === 2
    ) {

      awardPoints(
        150,
        "GOAL"
      );
    }

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
    setTimeout(
      () => {

        goalMessage?.classList.add(
          "hidden"
        );

        resetPositions();

        startCountdown();
      },
      1800
    );
}

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

  clearInterval(
    countdownTimer
  );

  clearTimeout(
    countdownFinish
  );

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
    setInterval(
      () => {

        count--;

        if (count > 0) {

          setText(
            countdownEl,
            count
          );

        } else {

          clearInterval(
            countdownTimer
          );

          countdownTimer = null;

          setText(
            countdownEl,
            "GO!"
          );

          countdownFinish =
            setTimeout(
              () => {

                countdownEl?.classList.add(
                  "hidden"
                );

                goalActive = false;

                updateMobileVisibility();
              },
              700
            );
        }
      },
      1000
    );
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

  const minutes =
    Math.floor(
      gameTime / 60
    );

  const seconds =
    Math.floor(
      gameTime % 60
    );

  setText(
    timerEl,
    `${minutes}:${String(seconds).padStart(2,"0")}`
  );
}

/* =========================================================
   FIN DE MATCH
========================================================= */

function endMatch(conceded = false) {

  if (
    !gameRunning &&
    !conceded
  ) {
    return;
  }

  gameRunning = false;

  if (
    gameMode === "multiplayer" &&
    onlineHost &&
    socket &&
    socket.readyState === WebSocket.OPEN
  ) {

    sendNetworkState(true);
  }

  paused = false;
  goalActive = true;

  updateMobileVisibility();

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

    const winner =
      gameMode === "multiplayer" &&
      onlinePlayerNumber === 2
        ? "BLUE WINS"
        : "ORANGE WINS";

    setText(
      winnerDisplay,
      winner
    );

    if (winnerDisplay) {

      winnerDisplay.style.color =
        winner.startsWith("BLUE")
          ? "#43cfff"
          : "#ff8a20";
    }

  } else if (
    blueScore >
    orangeScore
  ) {

    setText(
      winnerDisplay,
      "BLUE WINS"
    );

    if (winnerDisplay) {
      winnerDisplay.style.color =
        "#43cfff";
    }

  } else if (
    orangeScore >
    blueScore
  ) {

    setText(
      winnerDisplay,
      "ORANGE WINS"
    );

    if (winnerDisplay) {
      winnerDisplay.style.color =
        "#ff8a20";
    }

  } else {

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
   DÉBUT MATCH
========================================================= */

function startMatch(mode = gameMode) {

  gameMode = mode;

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

  resetPoints();

  boostParticles.length = 0;
  goalParticles.length = 0;
  demolitionParticles.length = 0;

  goalFlash = 0;

  for (const pad of boostPads) {

    pad.cooldown = 0;
    pad.flash = 0;
  }

  blueScore = 0;
  orangeScore = 0;

  gameTime = 120;

  paused = false;

  gameRunning = true;

  goalActive = true;

  updateMobileVisibility();

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
    setTimeout(
      () => {

        if (!gameRunning) {
          return;
        }

        matchIntro?.classList.add(
          "hidden"
        );

        startCountdown();
      },
      900
    );
}

/* =========================================================
   MENU PRINCIPAL
========================================================= */

function showMainMenu() {

  stopOnline();

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

  updateMobileVisibility();
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

  updateMobileVisibility();
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

    updateMobileVisibility();
  }
);

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
   AFFICHAGE
========================================================= */

function drawArena() {

  ctx.fillStyle =
    "#06131f";

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

    ctx.moveTo(
      x,
      0
    );

    ctx.lineTo(
      x,
      H
    );

    ctx.stroke();
  }

  for (
    let y = 0;
    y < H;
    y += 60
  ) {

    ctx.beginPath();

    ctx.moveTo(
      0,
      y
    );

    ctx.lineTo(
      W,
      y
    );

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

  /*
     CAGES VISIBLES
     ZONE DE DÉTECTION INVISIBLE
  */

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

function drawBoostPads() {

  for (const pad of boostPads) {

    const available =
      pad.cooldown <= 0;

    const pulse =
      1 +
      Math.sin(
        pad.pulse
      ) *
      0.08;

    ctx.save();

    ctx.translate(
      pad.x,
      pad.y
    );

    ctx.globalAlpha =
      available
        ? 1
        : 0.35;

    ctx.shadowColor =
      pad.color;

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
      pad.color;

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

    if (pad.flash > 0) {

      ctx.globalAlpha =
        pad.flash;

      ctx.strokeStyle =
        "#fff";

      ctx.lineWidth = 4;

      ctx.beginPath();

      ctx.arc(
        0,
        0,
        32 +
          (1 - pad.flash) *
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

function drawParticles(list) {

  for (const particle of list) {

    ctx.save();

    ctx.globalAlpha =
      Math.max(
        0,
        Math.min(
          1,
          particle.life
        )
      );

    ctx.fillStyle =
      particle.color;

    ctx.shadowColor =
      particle.color;

    ctx.shadowBlur = 12;

    ctx.beginPath();

    ctx.arc(
      particle.x,
      particle.y,
      particle.size,
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

  drawParticles(
    demolitionParticles
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

  const car =
    localCar();

  if (boostFill) {

    boostFill.style.width =
      `${car.boost}%`;
  }

  setText(
    boostNumber,
    Math.floor(
      car.boost
    )
  );

  const speed =
    Math.abs(car.speed);

  const kmh =
    car.boosting

      ? Math.round(
          Math.min(
            83,
            speed *
              (83 / 11.7)
          )
        )

      : Math.round(
          Math.min(
            51,
            speed *
              (51 / 7.2)
          )
        );

  setText(
    speedNumber,
    kmh
  );
}

/* =========================================================
   OUTILS
========================================================= */

function roundRect(
  x,
  y,
  width,
  height,
  radius
) {

  ctx.beginPath();

  ctx.moveTo(
    x + radius,
    y
  );

  ctx.lineTo(
    x + width - radius,
    y
  );

  ctx.quadraticCurveTo(
    x + width,
    y,
    x + width,
    y + radius
  );

  ctx.lineTo(
    x + width,
    y + height - radius
  );

  ctx.quadraticCurveTo(
    x + width,
    y + height,
    x + width - radius,
    y + height
  );

  ctx.lineTo(
    x + radius,
    y + height
  );

  ctx.quadraticCurveTo(
    x,
    y + height,
    x,
    y + height - radius
  );

  ctx.lineTo(
    x,
    y + radius
  );

  ctx.quadraticCurveTo(
    x,
    y,
    x + radius,
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

    if (
      gameMode === "multiplayer"
    ) {

      if (onlineHost) {

        player.update();

        bot.updateRemote(
          remoteInput
        );

        if (!bot.demolished) {

          bot.x +=
            Math.cos(bot.angle) *
            bot.speed;

          bot.y +=
            Math.sin(bot.angle) *
            bot.speed;

          bot.speed *= 0.985;

          if (
            Math.abs(bot.speed) <
            0.02
          ) {
            bot.speed = 0;
          }

          bot.keepInside();

          bot.boost =
            Math.min(
              100,
              bot.boost + 0.025
            );
        }

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

        if (
          performance.now() -
            lastNetworkSend >
          45
        ) {

          sendNetworkState(
            false
          );
        }

      } else {

        /*
           JOUEUR 2 :
           envoie ses touches
        */

        sendLocalInput();
      }

    } else {

      /*
         HORS LIGNE
      */

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
   ONLINE : RECHERCHE
========================================================= */

function makeSearchOverlay() {

  if (searchOverlay) {
    return;
  }

  searchOverlay =
    document.createElement("div");

  searchOverlay.id =
    "onlineSearchOverlay";

  searchOverlay.innerHTML = `
    <div style="
      font-size:42px;
      font-weight:900;
      letter-spacing:3px;
    ">
      1V1 EN LIGNE
    </div>

    <div id="onlineSearchText"
      style="
        margin-top:18px;
        font-size:22px;
      ">
      RECHERCHE D'UN JOUEUR…
    </div>

    <button id="cancelOnlineSearch"
      style="
        margin-top:28px;
        padding:13px 24px;
        border:0;
        border-radius:10px;
        font-weight:800;
        cursor:pointer;
      ">
      ANNULER
    </button>
  `;

  Object.assign(
    searchOverlay.style,
    {
      position: "fixed",
      inset: "0",
      zIndex: "12000",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      background:
        "rgba(3,8,16,.96)",
      color: "white",
      fontFamily:
        "Arial,sans-serif",
      textAlign: "center"
    }
  );

  document.body.appendChild(
    searchOverlay
  );

  $("cancelOnlineSearch").onclick =
    cancelOnlineSearch;
}

function setSearchText(text) {

  makeSearchOverlay();

  const element =
    $("onlineSearchText");

  if (element) {
    element.textContent = text;
  }
}

/* =========================================================
   ONLINE : CONNEXION
========================================================= */

function connectOnline() {

  if (
    socket &&
    (
      socket.readyState ===
        WebSocket.OPEN ||
      socket.readyState ===
        WebSocket.CONNECTING
    )
  ) {
    return;
  }

  try {

    socket =
      new WebSocket(
        ONLINE_SERVER_URL
      );

  } catch (error) {

    setSearchText(
      "CONNEXION AU SERVEUR…"
    );

    scheduleReconnect();

    return;
  }

  socket.onopen = () => {

    onlineSearching = true;

    setSearchText(
      "RECHERCHE D'UN JOUEUR…"
    );

    socket.send(
      JSON.stringify({
        type: "find-match",
        mode: "1v1"
      })
    );
  };

  socket.onmessage = event => {

    let data;

    try {

      data =
        JSON.parse(
          event.data
        );

    } catch {

      return;
    }

    if (
      data.type ===
      "searching"
    ) {

      onlineSearching = true;

      setSearchText(
        "RECHERCHE D'UN JOUEUR…"
      );
    }

    if (
      data.type ===
      "match-found"
    ) {

      onlineSearching = false;

      onlineHost =
        !!data.isHost;

      onlinePlayerNumber =
        data.playerNumber;

      onlineMatchId =
        data.matchId;

      if (searchOverlay) {

        searchOverlay.remove();

        searchOverlay = null;
      }

      startMatch(
        "multiplayer"
      );
    }

    if (
      data.type ===
      "opponent-input"
    ) {

      remoteInput = {
        ...remoteInput,
        ...(data.input || {})
      };
    }

    if (
      data.type ===
      "game-state"
    ) {

      applyNetworkState(
        data.state
      );
    }

    if (
      data.type ===
      "opponent-left"
    ) {

      alert(
        "L'adversaire a quitté la partie."
      );

      stopOnline();

      showMainMenu();
    }

    if (
      data.type === "pong"
    ) {

      lastHeartbeat =
        performance.now();
    }
  };

  socket.onclose = () => {

    if (onlineSearching) {

      setSearchText(
        "RECONNEXION AU SERVEUR…"
      );

      scheduleReconnect();
    }
  };

  socket.onerror = () => {};
}

/* =========================================================
   RECONNEXION
========================================================= */

function scheduleReconnect() {

  if (
    reconnectTimer ||
    !onlineSearching
  ) {
    return;
  }

  reconnectTimer =
    setTimeout(
      () => {

        reconnectTimer = null;

        connectOnline();
      },
      3000
    );
}

/* =========================================================
   LANCER RECHERCHE
========================================================= */

function startOnlineSearch() {

  gameMode =
    "multiplayer";

  onlineSearching = true;

  onlineHost = false;

  onlinePlayerNumber = 0;

  onlineMatchId = null;

  makeSearchOverlay();

  setSearchText(
    "RECHERCHE D'UN JOUEUR…"
  );

  connectOnline();
}

/* =========================================================
   ANNULER RECHERCHE
========================================================= */

function cancelOnlineSearch() {

  onlineSearching = false;

  if (reconnectTimer) {

    clearTimeout(
      reconnectTimer
    );

    reconnectTimer = null;
  }

  if (
    socket &&
    socket.readyState ===
      WebSocket.OPEN
  ) {

    socket.send(
      JSON.stringify({
        type: "cancel-search"
      })
    );
  }

  if (socket) {

    try {
      socket.close();
    } catch {}
  }

  socket = null;

  if (searchOverlay) {

    searchOverlay.remove();

    searchOverlay = null;
  }

  gameMode =
    "offline";

  showMainMenu();
}

/* =========================================================
   ARRÊT ONLINE
========================================================= */

function stopOnline() {

  onlineSearching = false;

  if (reconnectTimer) {

    clearTimeout(
      reconnectTimer
    );

    reconnectTimer = null;
  }

  if (
    socket &&
    socket.readyState ===
      WebSocket.OPEN &&
    onlineMatchId
  ) {

    socket.send(
      JSON.stringify({
        type: "leave-match"
      })
    );
  }

  if (socket) {

    try {
      socket.close();
    } catch {}
  }

  socket = null;

  onlineMatchId = null;

  onlineHost = false;

  onlinePlayerNumber = 0;

  if (searchOverlay) {

    searchOverlay.remove();

    searchOverlay = null;
  }
}

/* =========================================================
   ENVOI TOUCHES JOUEUR ONLINE
========================================================= */

function sendLocalInput() {

  if (
    !socket ||
    socket.readyState !==
      WebSocket.OPEN ||
    !onlineMatchId
  ) {
    return;
  }

  /*
     LES TOUCHES SONT BIEN
     TRANSFORMÉES EN INPUT ONLINE.
  */

  const input = {

    forward:
      controlPressed(
        "forward"
      ),

    reverse:
      controlPressed(
        "reverse"
      ),

    left:
      controlPressed(
        "left"
      ),

    right:
      controlPressed(
        "right"
      ),

    boost:
      controlPressed(
        "boost"
      )
  };

  const now =
    performance.now();

  if (
    now -
      lastNetworkSend >
    45
  ) {

    socket.send(
      JSON.stringify({
        type: "input",
        input
      })
    );

    lastNetworkSend = now;
  }
}

/* =========================================================
   ENVOI ÉTAT HÔTE
========================================================= */

function sendNetworkState(
  force
) {

  if (
    !onlineHost ||
    !socket ||
    socket.readyState !==
      WebSocket.OPEN ||
    !onlineMatchId
  ) {
    return;
  }

  const now =
    performance.now();

  if (
    !force &&
    now -
      lastNetworkSend <
      45
  ) {
    return;
  }

  const state = {

    player: {

      x: player.x,
      y: player.y,

      angle: player.angle,

      speed: player.speed,

      boost: player.boost,

      boosting:
        player.boosting,

      demolished:
        player.demolished,

      demoTimer:
        player.demoTimer
    },

    bot: {

      x: bot.x,
      y: bot.y,

      angle: bot.angle,

      speed: bot.speed,

      boost: bot.boost,

      boosting:
        bot.boosting,

      demolished:
        bot.demolished,

      demoTimer:
        bot.demoTimer
    },

    ball: {

      x: ball.x,
      y: ball.y,

      vx: ball.vx,
      vy: ball.vy
    },

    blueScore,
    orangeScore,

    gameTime,

    goalActive,

    gameRunning,

    bluePoints:
      onlinePlayerNumber === 1
        ? playerPoints
        : 0,

    orangePoints:
      onlinePlayerNumber === 2
        ? playerPoints
        : 0
  };

  socket.send(
    JSON.stringify({
      type: "game-state",
      state
    })
  );

  lastNetworkSend = now;

  lastHeartbeat = now;
}

/* =========================================================
   RÉCEPTION ÉTAT ONLINE
========================================================= */

function applyNetworkState(
  state
) {

  if (
    !state ||
    onlineHost
  ) {
    return;
  }

  Object.assign(
    player,
    state.player || {}
  );

  Object.assign(
    bot,
    state.bot || {}
  );

  Object.assign(
    ball,
    state.ball || {}
  );

  blueScore =
    state.blueScore || 0;

  orangeScore =
    state.orangeScore || 0;

  if (
    typeof state.gameTime ===
    "number"
  ) {

    gameTime =
      state.gameTime;
  }

  const wasGoal =
    lastNetGoalActive;

  goalActive =
    !!state.goalActive;

  if (
    goalActive &&
    !wasGoal
  ) {

    goalMessage?.classList.remove(
      "hidden"
    );

    setText(
      goalText,
      "GOAL!"
    );
  }

  if (
    !goalActive &&
    wasGoal
  ) {

    goalMessage?.classList.add(
      "hidden"
    );
  }

  lastNetGoalActive =
    goalActive;

  setText(
    blueScoreEl,
    blueScore
  );

  setText(
    orangeScoreEl,
    orangeScore
  );

  updateTimerDisplay();

  playerPoints =
    onlinePlayerNumber === 1
      ? state.bluePoints || 0
      : state.orangePoints || 0;

  updatePoints();

  if (
    state.gameRunning ===
      false &&
    resultScreen?.classList.contains(
      "hidden"
    )
  ) {

    gameRunning = false;

    paused = false;

    goalActive = true;

    updateMobileVisibility();

    let winner = "DRAW";

    if (
      blueScore >
      orangeScore
    ) {
      winner = "BLUE WINS";
    }

    if (
      orangeScore >
      blueScore
    ) {
      winner = "ORANGE WINS";
    }

    setText(
      winnerDisplay,
      winner
    );

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
}

/* =========================================================
   MENU ONLINE + HORS LIGNE
========================================================= */

function setupOnlineMenu() {

  const onlineButton =
    $("playButton");

  if (!onlineButton) {
    return;
  }

  onlineButton.type =
    "button";

  onlineButton.disabled =
    false;

  onlineButton.textContent =
    "1V1 EN LIGNE";

  onlineButton.onclick =
    () => startOnlineSearch();

  /*
     JEU HORS LIGNE
  */

  let offline =
    $("offlinePlayButton");

  if (!offline) {

    offline =
      document.createElement(
        "button"
      );

    offline.id =
      "offlinePlayButton";

    offline.className =
      onlineButton.className;

    offline.type =
      "button";

    offline.style.marginTop =
      "10px";

    onlineButton.parentNode?.insertBefore(
      offline,
      onlineButton.nextSibling
    );
  }

  offline.disabled =
    false;

  offline.textContent =
    "JEU HORS LIGNE";

  offline.onclick =
    () => {

      if (onlineSearching) {
        cancelOnlineSearch();
      }

      startMatch(
        "offline"
      );
    };
}

/* =========================================================
   BOUTONS FIN DE MATCH
========================================================= */

playAgainButton?.addEventListener(
  "click",
  () => {

    if (
      gameMode ===
      "multiplayer"
    ) {

      startOnlineSearch();

    } else {

      startMatch(
        "offline"
      );
    }
  }
);

mainMenuButton?.addEventListener(
  "click",
  showMainMenu
);

$("restartButton")?.addEventListener(
  "click",
  () =>
    startMatch(
      "offline"
    )
);

/* =========================================================
   HEARTBEAT SERVEUR
========================================================= */

setInterval(
  () => {

    if (
      socket &&
      socket.readyState ===
        WebSocket.OPEN
    ) {

      socket.send(
        JSON.stringify({
          type: "ping"
        })
      );
    }
  },
  10000
);

/* =========================================================
   INITIALISATION
========================================================= */

updateControlUI();

resetPoints();

updateTimerDisplay();

drawArena();

ball.draw();

player.draw();

bot.draw();

updateHUD();

/*
   Création du système mobile.
*/

createMobileControls();

ensureMobileSettings();

updateMobileSettings();

/*
   Le choix PC/MOBILE est affiché
   au démarrage pour pouvoir changer
   d'appareil.
*/

showDeviceChooser();

updateMobileVisibility();

/*
   Lancement de la boucle.
*/

requestAnimationFrame(
  gameLoop
);
