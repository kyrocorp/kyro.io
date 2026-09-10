const canvas = document.getElementById("gameCanvas");
if (!canvas) throw new Error("gameCanvas introuvable");

const ctx = canvas.getContext("2d");
const W = canvas.width;
const H = canvas.height;

const $ = id => document.getElementById(id);

// =====================================================
// ROCKET LEAGUE.IO
// =====================================================

document.title = "Rocket League.io";

function renameGameBrand() {
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT
  );

  const nodes = [];

  while (walker.nextNode()) {
    nodes.push(walker.currentNode);
  }

  for (const node of nodes) {
    if (/TURBOBALL\.IO/i.test(node.nodeValue)) {
      node.nodeValue = node.nodeValue.replace(
        /TURBOBALL\.IO/gi,
        "ROCKET LEAGUE.IO"
      );
    }
  }
}

// =====================================================
// MOBILE
// =====================================================

let deviceMode = null;

const mobileInput = {
  active: false,
  id: null,

  startX: 0,
  startY: 0,

  x: 0,
  y: 0,

  forward: false,
  reverse: false,
  left: false,
  right: false,
  boost: false
};

let mobileBoostSide = "left";

try {
  mobileBoostSide =
    localStorage.getItem(
      "rocketleague-mobile-boost-side"
    ) || "left";
} catch {}

function clearMobileInput() {
  mobileInput.active = false;
  mobileInput.id = null;

  mobileInput.x = 0;
  mobileInput.y = 0;

  mobileInput.forward = false;
  mobileInput.reverse = false;
  mobileInput.left = false;
  mobileInput.right = false;
  mobileInput.boost = false;
}

function setDeviceMode(mode) {
  deviceMode = mode;

  try {
    localStorage.setItem(
      "rocketleague-device-mode",
      mode
    );
  } catch {}

  if (mode === "mobile") {
    createMobileControls();
  } else {
    removeMobileControls();
  }

  updateMobileSettingsUI();
}

function createDeviceChoice() {
  if (
    document.getElementById(
      "deviceChoiceOverlay"
    )
  ) {
    return;
  }

  const overlay =
    document.createElement("div");

  overlay.id =
    "deviceChoiceOverlay";

  overlay.style.cssText = `
    position:fixed;
    inset:0;
    z-index:99999;
    display:flex;
    align-items:center;
    justify-content:center;
    background:rgba(3,8,15,.97);
    font-family:Arial,sans-serif;
    color:#fff;
    text-align:center;
  `;

  overlay.innerHTML = `
    <div style="
      width:min(580px,90vw);
      padding:36px 22px;
      border:1px solid rgba(100,220,255,.45);
      border-radius:24px;
      background:rgba(8,18,30,.97);
      box-shadow:0 0 50px rgba(0,190,255,.2)
    ">

      <div style="
        font-size:42px;
        font-weight:900;
        letter-spacing:3px;
        margin-bottom:10px
      ">
        ROCKET LEAGUE.IO
      </div>

      <div style="
        opacity:.7;
        font-size:15px;
        margin-bottom:30px
      ">
        CHOISIS TON APPAREIL
      </div>

      <div style="
        display:flex;
        gap:14px;
        justify-content:center;
        flex-wrap:wrap
      ">

        <button id="devicePC" style="
          min-width:190px;
          padding:18px 25px;
          border:1px solid #43d9ff;
          border-radius:14px;
          background:#0b2130;
          color:#fff;
          font-weight:900;
          font-size:18px;
        ">
          🖥️ PC
        </button>

        <button id="deviceMobile" style="
          min-width:190px;
          padding:18px 25px;
          border:1px solid #ff9d2e;
          border-radius:14px;
          background:#301d0b;
          color:#fff;
          font-weight:900;
          font-size:18px;
        ">
          📱 MOBILE
        </button>

      </div>
    </div>
  `;

  document.body.appendChild(
    overlay
  );

  overlay.querySelector(
    "#devicePC"
  ).onclick = () => {
    setDeviceMode("pc");
    overlay.remove();
  };

  overlay.querySelector(
    "#deviceMobile"
  ).onclick = () => {
    setDeviceMode("mobile");
    overlay.remove();
  };
}

// =====================================================
// MOBILE CONTROLS
// =====================================================

let mobilePad = null;
let mobileBoostButton = null;
let mobilePauseButton = null;

function removeMobileControls() {
  mobilePad?.remove();
  mobileBoostButton?.remove();
  mobilePauseButton?.remove();

  mobilePad = null;
  mobileBoostButton = null;
  mobilePauseButton = null;

  clearMobileInput();
}

function applyMobileVector(
  dx,
  dy
) {
  const deadZone = 15;
  const maxDistance = 110;

  const x = Math.max(
    -1,
    Math.min(
      1,
      dx / maxDistance
    )
  );

  const y = Math.max(
    -1,
    Math.min(
      1,
      dy / maxDistance
    )
  );

  mobileInput.x = x;
  mobileInput.y = y;

  mobileInput.left =
    x < -0.18;

  mobileInput.right =
    x > 0.18;

  mobileInput.forward =
    y < -0.18;

  mobileInput.reverse =
    y > 0.18;

  if (
    Math.abs(dx) <
    deadZone
  ) {
    mobileInput.left = false;
    mobileInput.right = false;
  }

  if (
    Math.abs(dy) <
    deadZone
  ) {
    mobileInput.forward = false;
    mobileInput.reverse = false;
  }
}

function updateMobilePadInteractivity() {
  if (!mobilePad) return;

  mobilePad.style.pointerEvents =
    deviceMode === "mobile" &&
    gameRunning &&
    !paused &&
    !goalActive
      ? "auto"
      : "none";
}

function createMobileControls() {
  removeMobileControls();

  const oldStyle =
    document.getElementById(
      "rocketMobileStyles"
    );

  oldStyle?.remove();

  const style =
    document.createElement("style");

  style.id =
    "rocketMobileStyles";

  style.textContent = `
    #rocketMobilePad {
      position:fixed;
      inset:0;
      z-index:9000;
      background:transparent;
      touch-action:none;
      user-select:none;
      -webkit-user-select:none;
    }

    #rocketMobileBoost,
    #rocketMobilePause {
      position:fixed;
      z-index:9002;
      color:#fff;
      font-weight:900;
      user-select:none;
      -webkit-user-select:none;
      touch-action:none;
    }

    #rocketMobileBoost {
      width:94px;
      height:94px;
      border-radius:50%;
      border:2px solid rgba(255,255,255,.55);
      background:rgba(20,30,42,.72);
      font-size:15px;
      box-shadow:
        0 0 25px rgba(255,255,255,.2);
    }

    #rocketMobileBoost.left {
      left:18px;
      bottom:22px;
    }

    #rocketMobileBoost.right {
      right:18px;
      bottom:22px;
    }

    #rocketMobilePause {
      right:18px;
      top:18px;
      width:58px;
      height:58px;
      border-radius:16px;
      border:2px solid rgba(255,255,255,.5);
      background:rgba(8,18,30,.75);
      font-size:20px;
    }

    #rocketMobileBoost:active {
      transform:scale(.94);
      background:rgba(70,130,180,.8);
    }
  `;

  document.head.appendChild(
    style
  );

  // PAVE TACTILE INVISIBLE
  mobilePad =
    document.createElement("div");

  mobilePad.id =
    "rocketMobilePad";

  document.body.appendChild(
    mobilePad
  );

  // BOOST
  mobileBoostButton =
    document.createElement("button");

  mobileBoostButton.id =
    "rocketMobileBoost";

  mobileBoostButton.className =
    mobileBoostSide;

  mobileBoostButton.textContent =
    "BOOST";

  document.body.appendChild(
    mobileBoostButton
  );

  // PAUSE
  mobilePauseButton =
    document.createElement("button");

  mobilePauseButton.id =
    "rocketMobilePause";

  mobilePauseButton.textContent =
    "Ⅱ";

  document.body.appendChild(
    mobilePauseButton
  );

  // ---------------------------------------------------
  // BOOST
  // ---------------------------------------------------

  mobileBoostButton.addEventListener(
    "pointerdown",
    e => {
      e.preventDefault();
      e.stopPropagation();

      mobileInput.boost =
        true;

      mobileBoostButton.setPointerCapture?.(
        e.pointerId
      );
    }
  );

  [
    "pointerup",
    "pointercancel",
    "pointerleave"
  ].forEach(type => {
    mobileBoostButton.addEventListener(
      type,
      e => {
        e.preventDefault();
        mobileInput.boost =
          false;
      }
    );
  });

  // ---------------------------------------------------
  // PAUSE
  // ---------------------------------------------------

  mobilePauseButton.addEventListener(
    "pointerdown",
    e => {
      e.preventDefault();
      e.stopPropagation();

      if (
        gameRunning &&
        !goalActive
      ) {
        togglePause();
      }
    }
  );

  // ---------------------------------------------------
  // PAVE TACTILE
  // ---------------------------------------------------

  mobilePad.addEventListener(
    "pointerdown",
    e => {
      if (
        e.target !== mobilePad
      ) {
        return;
      }

      e.preventDefault();

      mobileInput.active =
        true;

      mobileInput.id =
        e.pointerId;

      mobileInput.startX =
        e.clientX;

      mobileInput.startY =
        e.clientY;

      mobilePad.setPointerCapture?.(
        e.pointerId
      );

      applyMobileVector(
        0,
        0
      );
    },
    {
      passive:false
    }
  );

  mobilePad.addEventListener(
    "pointermove",
    e => {
      if (
        !mobileInput.active
      ) {
        return;
      }

      if (
        e.pointerId !==
        mobileInput.id
      ) {
        return;
      }

      e.preventDefault();

      const dx =
        e.clientX -
        mobileInput.startX;

      const dy =
        e.clientY -
        mobileInput.startY;

      applyMobileVector(
        dx,
        dy
      );
    },
    {
      passive:false
    }
  );

  [
    "pointerup",
    "pointercancel"
  ].forEach(type => {
    mobilePad.addEventListener(
      type,
      e => {
        if (
          e.pointerId !==
          mobileInput.id
        ) {
          return;
        }

        e.preventDefault();

        clearMobileInput();
      },
      {
        passive:false
      }
    );
  });

  updateMobilePadInteractivity();
}

// =====================================================
// MOBILE SETTINGS
// =====================================================

function setMobileBoostSide(
  side
) {
  mobileBoostSide =
    side === "right"
      ? "right"
      : "left";

  try {
    localStorage.setItem(
      "rocketleague-mobile-boost-side",
      mobileBoostSide
    );
  } catch {}

  if (mobileBoostButton) {
    mobileBoostButton.className =
      mobileBoostSide;
  }
}

function updateMobileSettingsUI() {
  const old =
    document.getElementById(
      "rocketMobileSettings"
    );

  old?.remove();

  if (deviceMode !== "mobile") {
    return;
  }

  const box =
    document.createElement("div");

  box.id =
    "rocketMobileSettings";

  box.style.cssText = `
    margin-top:18px;
    padding:16px;
    border:1px solid rgba(100,220,255,.3);
    border-radius:14px;
    background:rgba(7,16,27,.85);
    color:#fff;
  `;

  box.innerHTML = `
    <div style="
      font-weight:900;
      font-size:18px;
      margin-bottom:8px;
    ">
      📱 RÉGLAGES MOBILE
    </div>

    <div style="
      opacity:.75;
      margin-bottom:12px;
      line-height:1.4;
    ">
      Glisse ton doigt sur l'écran
      pour déplacer la voiture.
    </div>

    <div style="
      font-weight:800;
      margin-bottom:7px;
    ">
      Position du BOOST
    </div>

    <button id="mobileBoostLeft">
      GAUCHE
    </button>

    <button id="mobileBoostRight">
      DROITE
    </button>

    <button id="mobileBoostReset">
      RÉINITIALISER
    </button>
  `;

  const buttons =
    box.querySelectorAll(
      "button"
    );

  buttons.forEach(button => {
    button.style.cssText = `
      padding:10px 15px;
      margin:5px;
      border-radius:10px;
      border:1px solid #43d9ff;
      background:#102536;
      color:#fff;
      font-weight:800;
    `;
  });

  settingsMenu?.appendChild(
    box
  );

  box.querySelector(
    "#mobileBoostLeft"
  ).onclick = () => {
    setMobileBoostSide(
      "left"
    );
  };

  box.querySelector(
    "#mobileBoostRight"
  ).onclick = () => {
    setMobileBoostSide(
      "right"
    );
  };

  box.querySelector(
    "#mobileBoostReset"
  ).onclick = () => {
    setMobileBoostSide(
      "left"
    );
  };
}

// =====================================================
// DOM
// =====================================================

const blueScoreEl =
  $("blueScore");

const orangeScoreEl =
  $("orangeScore");

const timerEl =
  $("timer");

const goalMessage =
  $("goalMessage");

const goalText =
  $("goalText");

const goalScorer =
  $("goalScorer");

const countdownEl =
  $("countdown");

const pauseMenu =
  $("pauseMenu");

const resultScreen =
  $("resultScreen");

const winnerDisplay =
  $("winnerDisplay");

const finalBlueScore =
  $("finalBlueScore");

const finalOrangeScore =
  $("finalOrangeScore");

const playAgainButton =
  $("playAgainButton");

const mainMenuButton =
  $("mainMenuButton");

const mainMenu =
  $("mainMenu");

const howToPlayMenu =
  $("howToPlayMenu");

const matchIntro =
  $("matchIntro");

const pointsPanel =
  $("pointsPanel");

const playerPointsEl =
  $("playerPoints");

const pointsNotification =
  $("pointsNotification");

const boostFill =
  $("boostFill");

const boostNumber =
  $("boostNumber");

const speedNumber =
  $("speedNumber");

const settingsMenu =
  $("settingsMenu");

const concedeConfirm =
  $("concedeConfirm");

// =====================================================
// BALL SPEED HUD
// =====================================================

let ballSpeedEl =
  document.getElementById(
    "ballSpeedNumber"
  );

if (!ballSpeedEl) {
  const hud =
    document.createElement("div");

  hud.id =
    "ballSpeedHud";

  hud.style.cssText = `
    position:fixed;
    right:18px;
    top:82px;
    z-index:8000;
    text-align:right;
    color:#fff;
    font-family:Arial,sans-serif;
    font-weight:900;
    pointer-events:none;
    text-shadow:
      0 0 12px rgba(100,220,255,.7);
  `;

  hud.innerHTML = `
    <div style="
      font-size:11px;
      letter-spacing:2px;
      opacity:.7;
    ">
      BALL SPEED
    </div>

    <div id="ballSpeedNumber"
      style="
        font-size:28px;
        line-height:30px;
      ">
      0
    </div>

    <div style="
      font-size:11px;
      opacity:.65;
    ">
      KM/H
    </div>
  `;

  document.body.appendChild(
    hud
  );

  ballSpeedEl =
    document.getElementById(
      "ballSpeedNumber"
    );
}

// =====================================================
// CONTROLS
// =====================================================

const defaults = {
  forward:"z",
  reverse:"s",
  left:"q",
  right:"d",
  boost:"space"
};

let controls = {
  ...defaults
};

try {
  const saved =
    JSON.parse(
      localStorage.getItem(
        "turboball-controls"
      ) || "null"
    );

  if (
    saved &&
    Object.keys(
      defaults
    ).every(
      k =>
        typeof saved[k] ===
        "string"
    )
  ) {
    controls = {
      ...defaults,
      ...saved
    };
  }
} catch {}

const keyButtons = {
  forward:
    $("forwardKeyButton"),

  reverse:
    $("reverseKeyButton"),

  left:
    $("leftKeyButton"),

  right:
    $("rightKeyButton"),

  boost:
    $("boostKeyButton")
};

const howButtons = {
  forward:
    $("howZKey"),

  reverse:
    $("howSKey"),

  left:
    $("howQKey"),

  right:
    $("howDKey"),

  boost:
    $("howSpaceKey")
};

let waitingForAction =
  null;

let settingsReturn =
  "main";

const keys =
  Object.create(null);

function keyName(key) {
  if (
    key === " " ||
    key === "space"
  ) {
    return "SPACE";
  }

  if (
    key.length === 1
  ) {
    return key.toUpperCase();
  }

  return key.toUpperCase();
}

function saveControls() {
  localStorage.setItem(
    "turboball-controls",
    JSON.stringify(
      controls
    )
  );
}

function updateControlUI() {
  for (
    const action of
    Object.keys(
      keyButtons
    )
  ) {
    if (
      keyButtons[action]
    ) {
      keyButtons[action]
        .textContent =
        keyName(
          controls[action]
        );
    }

    if (
      howButtons[action]
    ) {
      howButtons[action]
        .textContent =
        keyName(
          controls[action]
        );
    }
  }
}

function normalizedKey(e) {
  if (
    e.code ===
    "Space"
  ) {
    return "space";
  }

  return e.key.toLowerCase();
}

function controlPressed(
  action
) {
  if (
    deviceMode ===
    "mobile"
  ) {
    return !!mobileInput[
      action
    ];
  }

  return !!keys[
    controls[action]
  ];
}

function clearKeys() {
  for (
    const k in keys
  ) {
    keys[k] = false;
  }

  clearMobileInput();
}

document.addEventListener(
  "keydown",
  e => {
    if (waitingForAction) {
      e.preventDefault();

      if (
        e.key ===
        "Escape"
      ) {
        waitingForAction
          .textContent =
          keyName(
            controls[
              waitingForAction
                .dataset
                .action
            ]
          );

        waitingForAction =
          null;

        return;
      }

      const action =
        waitingForAction
          .dataset
          .action;

      const newKey =
        normalizedKey(e);

      if (
        ["p","escape"]
          .includes(newKey) ||
        newKey === ""
      ) {
        return;
      }

      const other =
        Object.keys(
          controls
        ).find(
          a =>
            a !== action &&
            controls[a] ===
              newKey
        );

      if (other) {
        return;
      }

      controls[action] =
        newKey;

      saveControls();
      updateControlUI();

      waitingForAction =
        null;

      return;
    }

    const k =
      normalizedKey(e);

    if (
      k === "space"
    ) {
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
  }
);

document.addEventListener(
  "keyup",
  e => {
    keys[
      normalizedKey(e)
    ] = false;
  }
);

window.addEventListener(
  "blur",
  clearKeys
);

for (
  const action of
  Object.keys(
    keyButtons
  )
) {
  keyButtons[action]
    ?.addEventListener(
      "click",
      () => {
        if (
          waitingForAction
        ) {
          return;
        }

        waitingForAction =
          keyButtons[action];

        waitingForAction
          .dataset
          .action =
          action;

        waitingForAction
          .textContent =
          "PRESS A KEY";
      }
    );
}

$("resetControlsButton")
  ?.addEventListener(
    "click",
    () => {
      controls = {
        ...defaults
      };

      saveControls();
      updateControlUI();
    }
  );

// =====================================================
// SETTINGS
// =====================================================

$("settingsButton")
  ?.addEventListener(
    "click",
    () =>
      openSettings(
        "main"
      )
  );

$("pauseSettingsButton")
  ?.addEventListener(
    "click",
    () =>
      openSettings(
        "pause"
      )
  );

function openSettings(
  from
) {
  settingsReturn =
    from;

  mainMenu?.classList.add(
    "hidden"
  );

  howToPlayMenu?.classList.add(
    "hidden"
  );

  pauseMenu?.classList.add(
    "hidden"
  );

  settingsMenu?.classList.remove(
    "hidden"
  );

  updateControlUI();
  updateMobileSettingsUI();
}

$("settingsBackButton")
  ?.addEventListener(
    "click",
    () => {
      settingsMenu?.classList.add(
        "hidden"
      );

      if (
        settingsReturn ===
          "pause" &&
        gameRunning
      ) {
        pauseMenu?.classList.remove(
          "hidden"
        );
      } else {
        mainMenu?.classList.remove(
          "hidden"
        );
      }
    }
  );

$("howToPlayButton")
  ?.addEventListener(
    "click",
    () => {
      mainMenu?.classList.add(
        "hidden"
      );

      howToPlayMenu?.classList.remove(
        "hidden"
      );

      updateControlUI();
    }
  );

$("backButton")
  ?.addEventListener(
    "click",
    () => {
      howToPlayMenu?.classList.add(
        "hidden"
      );

      mainMenu?.classList.remove(
        "hidden"
      );
    }
  );

// =====================================================
// GAME STATE
// =====================================================

let blueScore = 0;
let orangeScore = 0;

let playerPoints = 0;

let gameTime = 120;

let gameRunning =
  false;

let paused = false;

let goalActive =
  false;

let goalTimer = null;

let countdownTimer =
  null;

let countdownFinish =
  null;

let introTimer = null;

let lastTime =
  performance.now();

let pointsTimer = null;

let saveCooldown = 0;

let saveDangerHandled =
  false;

let pinchCooldown = 0;

// =====================================================
// DEMOLITION STATE
// =====================================================

const DEMO_SPEED_KMH = 70;

const DEMO_SPEED_INTERNAL =
  70 * (7.2 / 51);

let demolitionParticles =
  [];

let demolitionTextTimer =
  0;

// =====================================================
// HELPERS
// =====================================================

function setText(
  el,
  value
) {
  if (el) {
    el.textContent =
      value;
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
  playerPoints +=
    amount;

  updatePoints();

  if (
    pointsNotification
  ) {
    clearTimeout(
      pointsTimer
    );

    pointsNotification
      .textContent =
      `+${amount} ${reason}`;

    pointsNotification
      .classList.remove(
        "show"
      );

    void pointsNotification
      .offsetWidth;

    pointsNotification
      .classList.add(
        "show"
      );

    pointsTimer =
      setTimeout(
        () =>
          pointsNotification
            .classList.remove(
              "show"
            ),
        1100
      );
  }

  pointsPanel?.classList.remove(
    "earned"
  );

  if (pointsPanel) {
    void pointsPanel
      .offsetWidth;

    pointsPanel.classList.add(
      "earned"
    );
  }
}

function resetPoints() {
  playerPoints = 0;

  saveCooldown = 0;

  saveDangerHandled =
    false;

  updatePoints();

  pointsNotification?.classList.remove(
    "show"
  );
}

// =====================================================
// ARENA
// =====================================================

const field = {
  left:90,
  right:W - 90,
  top:45,
  bottom:H - 45
};

const goal = {
  top:230,
  bottom:470,
  depth:70
};

const saveZone = {
  x:
    field.left + 10,

  y:
    goal.top + 12,

  width:145,

  height:
    goal.bottom -
    goal.top -
    24
};

const boostPads = [
  {
    x:
      field.left + 85,
    y:
      field.top + 85,
    color:"#20cfff",
    cooldown:0,
    pulse:0,
    flash:0
  },

  {
    x:
      field.right - 85,
    y:
      field.top + 85,
    color:"#ff8a18",
    cooldown:0,
    pulse:1,
    flash:0
  },

  {
    x:
      field.left + 85,
    y:
      field.bottom - 85,
    color:"#20cfff",
    cooldown:0,
    pulse:2,
    flash:0
  },

  {
    x:
      field.right - 85,
    y:
      field.bottom - 85,
    color:"#ff8a18",
    cooldown:0,
    pulse:3,
    flash:0
  },

  {
    x:W / 2,
    y:
      field.top + 55,
    color:"#65e8ff",
    cooldown:0,
    pulse:4,
    flash:0
  },

  {
    x:W / 2,
    y:
      field.bottom - 55,
    color:"#baff35",
    cooldown:0,
    pulse:5,
    flash:0
  }
];

const boostParticles =
  [];

const goalParticles =
  [];

let goalFlash = 0;

// =====================================================
// CAR
// =====================================================

class Car {
  constructor(
    x,
    y,
    color,
    bot = false
  ) {
    this.startX = x;
    this.startY = y;

    this.color =
      color;

    this.isBot =
      bot;

    this.radius =
      25;

    this.x = x;
    this.y = y;

    this.angle =
      bot
        ? Math.PI
        : 0;

    this.speed = 0;

    this.maxSpeed =
      7.2;

    this.boostMax =
      11.7;

    this.boost =
      100;

    this.boosting =
      false;

    this.ballContact =
      false;

    this.aiTarget =
      null;

    this.aiThink =
      0;

    // DEMOLITION
    this.demolished =
      false;

    this.demoTimer =
      0;

    this.demoInvincible =
      false;

    this.demoCooldown =
      0;
  }

  reset() {
    this.x =
      this.startX;

    this.y =
      this.startY;

    this.angle =
      this.isBot
        ? Math.PI
        : 0;

    this.speed =
      0;

    this.boost =
      100;

    this.boosting =
      false;

    this.ballContact =
      false;

    this.aiTarget =
      null;

    this.demolished =
      false;

    this.demoTimer =
      0;

    this.demoInvincible =
      false;

    this.demoCooldown =
      0;
  }

  demolish() {
    if (
      this.demolished
    ) {
      return;
    }

    this.demolished =
      true;

    this.demoTimer =
      2.2;

    this.speed = 0;

    this.boosting =
      false;

    spawnDemolitionParticles(
      this.x,
      this.y,
      this.color
    );
  }

  update() {
    if (
      this.demoCooldown >
      0
    ) {
      this.demoCooldown -=
        1 / 60;
    }

    if (
      this.demolished
    ) {
      this.demoTimer -=
        1 / 60;

      if (
        this.demoTimer <=
        0
      ) {
        this.demolished =
          false;

        this.demoInvincible =
          true;

        this.x =
          this.startX;

        this.y =
          this.startY;

        this.speed =
          0;

        this.boost =
          100;

        this.angle =
          this.isBot
            ? Math.PI
            : 0;

        setTimeout(
          () => {
            this.demoInvincible =
              false;
          },
          800
        );
      }

      return;
    }

    if (
      this.isBot
    ) {
      this.updateAI();
    } else {
      this.updatePlayer();
    }

    this.x +=
      Math.cos(
        this.angle
      ) *
      this.speed;

    this.y +=
      Math.sin(
        this.angle
      ) *
      this.speed;

    this.speed *=
      0.985;

    if (
      Math.abs(
        this.speed
      ) < 0.02
    ) {
      this.speed = 0;
    }

    this.keepInside();

    this.boost =
      Math.min(
        100,
        this.boost +
          0.025
      );
  }

  updatePlayer() {
    this.boosting =
      false;

    if (
      controlPressed(
        "forward"
      )
    ) {
      this.speed +=
        0.18;
    }

    if (
      controlPressed(
        "reverse"
      )
    ) {
      if (
        this.speed > 0
      ) {
        this.speed -=
          0.25;
      } else {
        this.speed -=
          0.12;
      }
    }

    const turn =
      0.055 *
      Math.min(
        Math.abs(
          this.speed
        ) / 2 +
          0.3,
        1
      );

    if (
      controlPressed(
        "left"
      )
    ) {
      this.angle -=
        turn *
        (
          this.speed >=
          0
            ? 1
            : -1
        );
    }

    if (
      controlPressed(
        "right"
      )
    ) {
      this.angle +=
        turn *
        (
          this.speed >=
          0
            ? 1
            : -1
        );
    }

    if (
      controlPressed(
        "boost"
      ) &&
      this.boost > 0 &&
      this.speed > 0
    ) {
      this.speed +=
        0.28;

      this.boost -=
        0.7;

      this.boosting =
        true;
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

  updateAI() {
    const dxBall =
      ball.x -
      this.x;

    const dyBall =
      ball.y -
      this.y;

    const distBall =
      Math.hypot(
        dxBall,
        dyBall
      );

    let tx =
      ball.x;

    let ty =
      ball.y;

    if (
      ball.x >
        field.right -
          270 &&
      ball.vx > 0
    ) {
      tx =
        Math.min(
          field.right -
            55,
          ball.x +
            55
        );

      ty =
        H / 2 +
        (
          ball.y -
          H / 2
        ) *
          0.7;
    } else if (
      ball.x <
      W * 0.42
    ) {
      tx =
        ball.x +
        45;

      ty =
        ball.y;
    }

    this.aiThink -=
      1 / 60;

    const dangerous =
      ball.x >
        field.right -
          270 &&
      ball.vx > 0;

    if (
      this.boost < 25 &&
      distBall > 180 &&
      !dangerous
    ) {
      if (
        !this.aiTarget ||
        this.aiThink <= 0 ||
        this.aiTarget
          .cooldown > 0
      ) {
        let best =
          null;

        let bestD =
          Infinity;

        for (
          const pad of
          boostPads
        ) {
          if (
            pad.cooldown >
            0
          ) {
            continue;
          }

          const d =
            Math.hypot(
              pad.x -
                this.x,
              pad.y -
                this.y
            );

          if (
            d <
            bestD
          ) {
            bestD =
              d;

            best =
              pad;
          }
        }

        this.aiTarget =
          best;

        this.aiThink =
          0.5;
      }

      if (
        this.aiTarget
      ) {
        tx =
          this.aiTarget.x;

        ty =
          this.aiTarget.y;
      }
    } else if (
      this.boost > 45 ||
      dangerous
    ) {
      this.aiTarget =
        null;
    }

    const targetAngle =
      Math.atan2(
        ty -
          this.y,
        tx -
          this.x
      );

    let diff =
      targetAngle -
      this.angle;

    while (
      diff >
      Math.PI
    ) {
      diff -=
        Math.PI * 2;
    }

    while (
      diff <
      -Math.PI
    ) {
      diff +=
        Math.PI * 2;
    }

    const turn =
      0.062;

    if (
      diff > 0.06
    ) {
      this.angle +=
        turn;
    } else if (
      diff < -0.06
    ) {
      this.angle -=
        turn;
    }

    const aligned =
      Math.abs(diff) <
      0.32;

    const attack =
      ball.x <
        W * 0.55 &&
      this.x >
        ball.x;

    this.boosting =
      this.boost > 4 &&
      aligned &&
      (
        distBall >
          260 ||
        attack ||
        !!this.aiTarget
      );

    this.speed +=
      this.boosting
        ? 0.24
        : 0.145;

    if (
      this.boosting
    ) {
      this.boost -=
        0.55;
    }

    this.speed =
      Math.min(
        this.speed,
        this.boosting
          ? 9.6
          : 6.7
      );

    if (
      this.aiTarget
    ) {
      const d =
        Math.hypot(
          this.aiTarget.x -
            this.x,
          this.aiTarget.y -
            this.y
        );

      if (
        d <
          this.radius +
            22 &&
        this.aiTarget
          .cooldown <= 0
      ) {
        this.boost =
          Math.min(
            100,
            this.boost +
              25
          );

        this.aiTarget
          .cooldown = 5;

        this.aiTarget
          .flash = 1;

        spawnPadParticles(
          this.aiTarget
        );

        this.aiTarget =
          null;
      }
    }
  }

  keepInside() {
    if (
      this.demolished
    ) {
      return;
    }

    const r =
      this.radius;

    if (
      this.x <
      field.left + r
    ) {
      this.x =
        field.left + r;

      this.speed *=
        -0.3;
    }

    if (
      this.x >
      field.right - r
    ) {
      this.x =
        field.right - r;

      this.speed *=
        -0.3;
    }

    if (
      this.y <
      field.top + r
    ) {
      this.y =
        field.top + r;

      this.speed *=
        -0.3;
    }

    if (
      this.y >
      field.bottom - r
    ) {
      this.y =
        field.bottom - r;

      this.speed *=
        -0.3;
    }
  }

  draw() {
    if (
      this.demolished
    ) {
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

    if (
      this.boosting
    ) {
      ctx.fillStyle =
        "rgba(80,220,255,.7)";

      ctx.beginPath();

      ctx.moveTo(
        -35,
        -11
      );

      ctx.lineTo(
        -65 -
          Math.random() *
            18,
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

    ctx.shadowBlur =
      18;

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

    ctx.shadowBlur =
      0;

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

    ctx.fillStyle =
      "#fff";

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

// =====================================================
// BALL
// =====================================================

class Ball {
  constructor() {
    this.radius =
      18;

    this.reset();
  }

  reset() {
    this.x =
      W / 2;

    this.y =
      H / 2;

    this.vx = 0;
    this.vy = 0;
  }

  update() {
    this.x +=
      this.vx;

    this.y +=
      this.vy;

    this.vx *=
      0.992;

    this.vy *=
      0.992;

    const s =
      Math.hypot(
        this.vx,
        this.vy
      );

    if (
      s > 9
    ) {
      this.vx =
        this.vx /
        s *
        9;

      this.vy =
        this.vy /
        s *
        9;
    }

    this.checkGoal();

    if (
      !goalActive
    ) {
      this.walls();
    }
  }

  checkGoal() {
    const inOpening =
      this.y +
        this.radius >
        goal.top &&
      this.y -
        this.radius <
        goal.bottom;

    if (
      !inOpening
    ) {
      return;
    }

    if (
      this.x -
        this.radius <=
      field.left - 2
    ) {
      scoreGoal(
        "orange"
      );
    } else if (
      this.x +
        this.radius >=
      field.right + 2
    ) {
      scoreGoal(
        "blue"
      );
    }
  }

  walls() {
    if (
      this.y -
        this.radius <
      field.top
    ) {
      this.y =
        field.top +
        this.radius;

      this.vy *=
        -0.82;
    }

    if (
      this.y +
        this.radius >
      field.bottom
    ) {
      this.y =
        field.bottom -
        this.radius;

      this.vy *=
        -0.82;
    }

    const inOpening =
      this.y +
        this.radius >
        goal.top &&
      this.y -
        this.radius <
        goal.bottom;

    if (
      this.x -
        this.radius <
        field.left &&
      !inOpening
    ) {
      this.x =
        field.left +
        this.radius;

      this.vx *=
        -0.82;
    }

    if (
      this.x +
        this.radius >
        field.right &&
      !inOpening
    ) {
      this.x =
        field.right -
        this.radius;

      this.vx *=
        -0.82;
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

      this.vx *=
        -0.82;
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

      this.vx *=
        -0.82;
    }
  }

  draw() {
    ctx.save();

    ctx.shadowColor =
      "#fff";

    ctx.shadowBlur =
      18;

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

    ctx.fillStyle =
      g;

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

// =====================================================
// OBJECTS
// =====================================================

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

// =====================================================
// SAVE
// =====================================================

function playerInSaveZone() {
  return (
    player.x >=
      saveZone.x &&
    player.x <=
      saveZone.x +
        saveZone.width &&
    player.y >=
      saveZone.y &&
    player.y <=
      saveZone.y +
        saveZone.height
  );
}

function ballDangerous() {
  const inLane =
    ball.y +
      ball.radius >
      goal.top &&
    ball.y -
      ball.radius <
      goal.bottom;

  const close =
    ball.x <
    field.left +
      250;

  return (
    inLane &&
    close &&
    (
      ball.vx <
        -0.1 ||
      ball.x <
        field.left +
          105
    )
  );
}

// =====================================================
// DEMOLITION
// =====================================================

function carSpeedKmh(
  car
) {
  const s =
    Math.abs(
      car.speed
    );

  return car.boosting
    ? Math.min(
        83,
        s *
          (83 / 11.7)
      )
    : Math.min(
        51,
        s *
          (51 / 7.2)
      );
}

function canDemolish(
  attacker
) {
  return (
    carSpeedKmh(
      attacker
    ) >=
      DEMO_SPEED_KMH &&
    !attacker.demolished &&
    !attacker.demoInvincible &&
    attacker.demoCooldown <=
      0
  );
}

function tryDemolition(
  attacker,
  target
) {
  if (
    attacker ===
    target
  ) {
    return;
  }

  if (
    target.demolished ||
    target.demoInvincible
  ) {
    return;
  }

  if (
    !canDemolish(
      attacker
    )
  ) {
    return;
  }

  const dx =
    target.x -
    attacker.x;

  const dy =
    target.y -
    attacker.y;

  const d =
    Math.hypot(
      dx,
      dy
    );

  const collisionDistance =
    attacker.radius +
    target.radius;

  if (
    d >
    collisionDistance
  ) {
    return;
  }

  const dirX =
    Math.cos(
      attacker.angle
    );

  const dirY =
    Math.sin(
      attacker.angle
    );

  const targetX =
    dx /
    (d || 1);

  const targetY =
    dy /
    (d || 1);

  const alignment =
    dirX * targetX +
    dirY * targetY;

  // Il faut arriver vers l'adversaire,
  // pas juste le toucher de côté.
  if (
    alignment <
    0.35
  ) {
    return;
  }

  target.demolish();

  attacker.speed *=
    0.35;

  attacker.demoCooldown =
    1.2;

  spawnDemolitionText(
    target
  );

  if (
    attacker ===
    player
  ) {
    awardPoints(
      100,
      "DEMOLITION"
    );
  }
}

function spawnDemolitionParticles(
  x,
  y,
  color
) {
  for (
    let i = 0;
    i < 34;
    i++
  ) {
    const a =
      Math.random() *
      Math.PI *
      2;

    const s =
      1.5 +
      Math.random() *
        4.5;

    demolitionParticles.push({
      x,
      y,
      vx:
        Math.cos(a) *
        s,
      vy:
        Math.sin(a) *
        s,
      life:
        1.1 +
        Math.random() *
          0.5,
      size:
        2 +
        Math.random() *
          4,
      color
    });
  }
}

function spawnDemolitionText(
  target
) {
  demolitionTextTimer =
    1.5;
}

function updateDemolition(
  dt
) {
  const sec =
    Math.min(
      dt / 1000,
      0.1
    );

  demolitionTextTimer =
    Math.max(
      0,
      demolitionTextTimer -
        sec
    );

  for (
    const p of
    demolitionParticles
  ) {
    p.x +=
      p.vx;

    p.y +=
      p.vy;

    p.vx *=
      0.97;

    p.vy *=
      0.97;

    p.life -=
      sec;
  }

  for (
    let i =
      demolitionParticles.length -
      1;
    i >= 0;
    i--
  ) {
    if (
      demolitionParticles[i]
        .life <= 0
    ) {
      demolitionParticles.splice(
        i,
        1
      );
    }
  }
}

function drawDemolitionEffects() {
  for (
    const p of
    demolitionParticles
  ) {
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

    ctx.shadowBlur =
      14;

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

  if (
    demolitionTextTimer >
    0
  ) {
    ctx.save();

    ctx.globalAlpha =
      Math.min(
        1,
        demolitionTextTimer
      );

    ctx.textAlign =
      "center";

    ctx.font =
      "900 46px Arial";

    ctx.fillStyle =
      "#fff";

    ctx.shadowColor =
      "#ff3b20";

    ctx.shadowBlur =
      25;

    ctx.fillText(
      "DEMOLITION!",
      W / 2,
      105
    );

    ctx.restore();
  }
}

// =====================================================
// CAR + BALL
// =====================================================

function carBallCollision(
  car
) {
  if (
    car.demolished
  ) {
    return;
  }

  const dx =
    ball.x -
    car.x;

  const dy =
    ball.y -
    car.y;

  const d =
    Math.hypot(
      dx,
      dy
    );

  const minD =
    car.radius +
    ball.radius;

  if (
    d >= minD
  ) {
    car.ballContact =
      false;

    return;
  }

  const dangerousBefore =
    car === player &&
    ballDangerous();

  const newContact =
    !car.ballContact;

  car.ballContact =
    true;

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
    dx /
    safeD;

  const ny =
    dy /
    safeD;

  const overlap =
    minD - d;

  ball.x +=
    nx *
    overlap;

  ball.y +=
    ny *
    overlap;

  const carVelocity =
    Math.abs(
      car.speed
    );

  const force =
    Math.min(
      carVelocity *
        1.15 +
        1.2,
      7
    );

  ball.vx +=
    nx *
    force;

  ball.vy +=
    ny *
    force;

  ball.vx +=
    Math.cos(
      car.angle
    ) *
    carVelocity *
    0.25;

  ball.vy +=
    Math.sin(
      car.angle
    ) *
    carVelocity *
    0.25;

  // PINCH
  const carDirX =
    Math.cos(
      car.angle
    );

  const carDirY =
    Math.sin(
      car.angle
    );

  const approach =
    carDirX * nx +
    carDirY * ny;

  if (
    pinchCooldown <= 0 &&
    carVelocity > 4.2 &&
    approach > 0.35 &&
    d <
      minD * 0.78
  ) {
    const pinchPower =
      Math.min(
        10.5,
        4.8 +
          carVelocity *
            0.72
      );

    ball.vx +=
      carDirX *
        pinchPower +
      nx *
        pinchPower *
        0.45;

    ball.vy +=
      carDirY *
        pinchPower +
      ny *
        pinchPower *
        0.45;

    pinchCooldown =
      0.12;
  }

  const maxBallSpeed =
    9;

  const ballSpeed =
    Math.hypot(
      ball.vx,
      ball.vy
    );

  if (
    ballSpeed >
    maxBallSpeed
  ) {
    ball.vx =
      ball.vx /
      ballSpeed *
      maxBallSpeed;

    ball.vy =
      ball.vy /
      ballSpeed *
      maxBallSpeed;
  }

  car.speed *=
    0.82;

  if (
    car === player &&
    newContact &&
    dangerousBefore &&
    playerInSaveZone() &&
    saveCooldown <= 0
  ) {
    saveCooldown =
      4;

    saveDangerHandled =
      true;

    ball.vx =
      Math.max(
        1.8,
        Math.abs(
          ball.vx
        ) *
          0.65
      );

    ball.vy *=
      0.65;

    awardPoints(
      50,
      "SAVE"
    );
  }
}

// =====================================================
// CAR VS CAR + DEMOLITION
// =====================================================

function carCarCollision(
  a,
  b
) {
  if (
    a.demolished ||
    b.demolished
  ) {
    return;
  }

  const dx =
    b.x -
    a.x;

  const dy =
    b.y -
    a.y;

  const d =
    Math.hypot(
      dx,
      dy
    );

  const minD =
    a.radius +
    b.radius;

  if (
    d <= 0 ||
    d >= minD
  ) {
    return;
  }

  // ---------------------------------------------------
  // DEMOLITION
  // ---------------------------------------------------

  if (
    canDemolish(a)
  ) {
    tryDemolition(
      a,
      b
    );

    if (
      b.demolished
    ) {
      return;
    }
  }

  if (
    canDemolish(b)
  ) {
    tryDemolition(
      b,
      a
    );

    if (
      a.demolished
    ) {
      return;
    }
  }

  // ---------------------------------------------------
  // NORMAL COLLISION
  // ---------------------------------------------------

  const nx =
    dx / d;

  const ny =
    dy / d;

  const overlap =
    minD - d;

  a.x -=
    nx *
    overlap /
    2;

  a.y -=
    ny *
    overlap /
    2;

  b.x +=
    nx *
    overlap /
    2;

  b.y +=
    ny *
    overlap /
    2;

  const av =
    a.speed;

  a.speed =
    b.speed *
    0.55;

  b.speed =
    av *
    0.55;

  a.keepInside();
  b.keepInside();
}

// =====================================================
// BOOST PARTICLES
// =====================================================

function spawnPadParticles(
  pad
) {
  for (
    let i = 0;
    i < 10;
    i++
  ) {
    const a =
      Math.PI *
      2 *
      i /
      10;

    const s =
      1.2 +
      Math.random() *
        1.4;

    boostParticles.push({
      x:pad.x,
      y:pad.y,

      vx:
        Math.cos(a) *
        s,

      vy:
        Math.sin(a) *
        s,

      life:0.55,

      size:
        2 +
        Math.random() *
          2,

      color:
        pad.color
    });
  }
}

// =====================================================
// GOAL PARTICLES
// =====================================================

function spawnGoalParticles(
  team
) {
  const color =
    team === "blue"
      ? "#43d9ff"
      : "#ff9d2e";

  for (
    let i = 0;
    i < 32;
    i++
  ) {
    const a =
      Math.random() *
      Math.PI *
      2;

    const s =
      1.5 +
      Math.random() *
        3.5;

    goalParticles.push({
      x:W / 2,
      y:H / 2,

      vx:
        Math.cos(a) *
        s,

      vy:
        Math.sin(a) *
        s,

      life:1.1,

      size:
        2 +
        Math.random() *
          4,

      color
    });
  }
}

// =====================================================
// EFFECTS
// =====================================================

function updateEffects(
  dt
) {
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
    for (
      const p of list
    ) {
      p.x +=
        p.vx;

      p.y +=
        p.vy;

      p.vx *=
        0.97;

      p.vy *=
        0.97;

      p.life -=
        sec;
    }

    for (
      let i =
        list.length -
        1;
      i >= 0;
      i--
    ) {
      if (
        list[i].life <=
        0
      ) {
        list.splice(
          i,
          1
        );
      }
    }
  }

  saveCooldown =
    Math.max(
      0,
      saveCooldown -
        sec
    );

  pinchCooldown =
    Math.max(
      0,
      pinchCooldown -
        sec
    );

  if (
    !ballDangerous()
  ) {
    saveDangerHandled =
      false;
  }

  updateDemolition(
    dt
  );
}

// =====================================================
// BOOST PADS
// =====================================================

function updateBoostPads(
  dt
) {
  const sec =
    Math.min(
      dt / 1000,
      0.1
    );

  for (
    const p of
    boostPads
  ) {
    p.cooldown =
      Math.max(
        0,
        p.cooldown -
          sec
      );

    p.pulse +=
      sec * 2.4;

    p.flash =
      Math.max(
        0,
        p.flash -
          sec * 2.5
      );
  }

  if (
    !gameRunning ||
    paused ||
    goalActive
  ) {
    return;
  }

  for (
    const p of
    boostPads
  ) {
    if (
      p.cooldown >
      0
    ) {
      continue;
    }

    if (
      !player.demolished &&
      Math.hypot(
        player.x -
          p.x,
        player.y -
          p.y
      ) <
        player.radius +
          22
    ) {
      player.boost =
        Math.min(
          100,
          player.boost +
            25
        );

      p.cooldown =
        5;

      p.flash =
        1;

      spawnPadParticles(
        p
      );
    }
  }
}

// =====================================================
// GOAL
// =====================================================

function scoreGoal(
  team
) {
  if (
    goalActive ||
    !gameRunning
  ) {
    return;
  }

  goalActive =
    true;

  clearKeys();

  updateMobilePadInteractivity();

  goalFlash =
    1;

  spawnGoalParticles(
    team
  );

  if (
    team === "blue"
  ) {
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

    if (
      goalText
    ) {
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

    setText(
      goalText,
      "GOAL!"
    );

    setText(
      goalScorer,
      "ORANGE CREW SCORES"
    );

    if (
      goalText
    ) {
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

  saveDangerHandled =
    false;
}

// =====================================================
// COUNTDOWN
// =====================================================

function startCountdown() {
  clearInterval(
    countdownTimer
  );

  clearTimeout(
    countdownFinish
  );

  goalActive =
    true;

  let count =
    3;

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

        if (
          count > 0
        ) {
          setText(
            countdownEl,
            count
          );
        } else {
          clearInterval(
            countdownTimer
          );

          countdownTimer =
            null;

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

                goalActive =
                  false;

                updateMobilePadInteractivity();
              },
              700
            );
        }
      },
      1000
    );
}

// =====================================================
// TIMER
// =====================================================

function updateTimer(
  dt
) {
  if (
    !gameRunning ||
    paused ||
    goalActive
  ) {
    return;
  }

  gameTime -=
    dt / 1000;

  if (
    gameTime <=
    0
  ) {
    gameTime =
      0;

    updateTimerDisplay();

    endMatch(
      false
    );

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

// =====================================================
// END MATCH
// =====================================================

function endMatch(
  conceded = false
) {
  if (
    !gameRunning &&
    !conceded
  ) {
    return;
  }

  gameRunning =
    false;

  paused =
    false;

  goalActive =
    true;

  clearKeys();

  updateMobilePadInteractivity();

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

  if (
    conceded
  ) {
    setText(
      winnerDisplay,
      "ORANGE WINS"
    );
  } else if (
    blueScore >
    orangeScore
  ) {
    setText(
      winnerDisplay,
      "BLUE WINS"
    );
  } else if (
    orangeScore >
    blueScore
  ) {
    setText(
      winnerDisplay,
      "ORANGE WINS"
    );
  } else {
    setText(
      winnerDisplay,
      "DRAW"
    );
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

// =====================================================
// START MATCH
// =====================================================

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

  boostParticles.length =
    0;

  goalParticles.length =
    0;

  demolitionParticles.length =
    0;

  goalFlash =
    0;

  pinchCooldown =
    0;

  demolitionTextTimer =
    0;

  for (
    const p of
    boostPads
  ) {
    p.cooldown =
      0;

    p.flash =
      0;
  }

  blueScore =
    0;

  orangeScore =
    0;

  gameTime =
    120;

  paused =
    false;

  gameRunning =
    true;

  goalActive =
    true;

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

  updateMobilePadInteractivity();

  introTimer =
    setTimeout(
      () => {
        if (
          !gameRunning
        ) {
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

// =====================================================
// MAIN MENU
// =====================================================

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

  gameRunning =
    false;

  paused =
    false;

  goalActive =
    false;

  resetPoints();

  updateMobilePadInteractivity();

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

// =====================================================
// PAUSE
// =====================================================

function togglePause() {
  if (
    !gameRunning ||
    goalActive
  ) {
    return;
  }

  paused =
    !paused;

  clearKeys();

  updateMobilePadInteractivity();

  pauseMenu?.classList.toggle(
    "hidden",
    !paused
  );
}

$("resumeButton")
  ?.addEventListener(
    "click",
    () => {
      if (
        !gameRunning
      ) {
        return;
      }

      paused =
        false;

      clearKeys();

      updateMobilePadInteractivity();

      pauseMenu?.classList.add(
        "hidden"
      );
    }
  );

$("concedeButton")
  ?.addEventListener(
    "click",
    () => {
      if (
        !gameRunning
      ) {
        return;
      }

      concedeConfirm?.classList.remove(
        "hidden"
      );
    }
  );

$("cancelConcedeButton")
  ?.addEventListener(
    "click",
    () => {
      concedeConfirm?.classList.add(
        "hidden"
      );
    }
  );

$("confirmConcedeButton")
  ?.addEventListener(
    "click",
    () => {
      concedeConfirm?.classList.add(
        "hidden"
      );

      endMatch(
        true
      );
    }
  );

$("pauseMainMenuButton")
  ?.addEventListener(
    "click",
    showMainMenu
  );

// =====================================================
// BUTTONS
// =====================================================

$("playButton")
  ?.addEventListener(
    "click",
    startMatch
  );

playAgainButton
  ?.addEventListener(
    "click",
    startMatch
  );

mainMenuButton
  ?.addEventListener(
    "click",
    showMainMenu
  );

$("restartButton")
  ?.addEventListener(
    "click",
    startMatch
  );

// =====================================================
// ARENA DRAW
// =====================================================

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

  ctx.lineWidth =
    1;

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

  ctx.lineWidth =
    3;

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

  // BLUE GOAL
  ctx.lineWidth =
    5;

  ctx.shadowBlur =
    18;

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

  // ORANGE GOAL
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

  ctx.shadowBlur =
    0;

  drawBoostPads();
}

// =====================================================
// BOOST PAD DRAW
// =====================================================

function drawBoostPads() {
  for (
    const p of
    boostPads
  ) {
    const available =
      p.cooldown <= 0;

    const pulse =
      1 +
      Math.sin(
        p.pulse
      ) *
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
      28 *
        pulse,
      16 *
        pulse,
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
      19 *
        pulse,
      8 *
        pulse,
      0,
      0,
      Math.PI * 2
    );

    ctx.fill();

    ctx.strokeStyle =
      "#fff";

    ctx.lineWidth =
      2;

    ctx.beginPath();

    ctx.arc(
      0,
      0,
      23 *
        pulse,
      0,
      Math.PI * 2
    );

    ctx.stroke();

    if (
      p.flash >
      0
    ) {
      ctx.globalAlpha =
        p.flash;

      ctx.strokeStyle =
        "#fff";

      ctx.lineWidth =
        4;

      ctx.beginPath();

      ctx.arc(
        0,
        0,
        32 +
          (
            1 -
            p.flash
          ) *
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

// =====================================================
// PARTICLES
// =====================================================

function drawParticles(
  list
) {
  for (
    const p of list
  ) {
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

    ctx.shadowBlur =
      12;

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

  if (
    goalFlash >
    0
  ) {
    ctx.save();

    ctx.globalAlpha =
      goalFlash *
      0.12;

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

// =====================================================
// HUD
// =====================================================

function updateHUD() {
  if (
    boostFill
  ) {
    boostFill.style.width =
      `${player.boost}%`;
  }

  setText(
    boostNumber,
    Math.floor(
      player.boost
    )
  );

  const s =
    Math.abs(
      player.speed
    );

  const kmh =
    player.boosting
      ? Math.round(
          Math.min(
            83,
            s *
              (
                83 /
                11.7
              )
          )
        )
      : Math.round(
          Math.min(
            51,
            s *
              (
                51 /
                7.2
              )
          )
        );

  setText(
    speedNumber,
    kmh
  );

  // BALL SPEED
  // 9 unités = 216 KM/H

  const ballSpeed =
    Math.hypot(
      ball.vx,
      ball.vy
    );

  const ballKmh =
    Math.round(
      Math.min(
        216,
        ballSpeed *
          (
            216 /
            9
          )
      )
    );

  setText(
    ballSpeedEl,
    ballKmh
  );
}

// =====================================================
// ROUND RECT
// =====================================================

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

// =====================================================
// GAME LOOP
// =====================================================

function gameLoop(
  now
) {
  const dt =
    Math.min(
      now -
        lastTime,
      100
    );

  lastTime =
    now;

  updateEffects(
    dt
  );

  updateBoostPads(
    dt
  );

  if (
    gameRunning &&
    !paused &&
    !goalActive
  ) {
    player.update();

    bot.update();

    ball.update();

    if (
      !goalActive
    ) {
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

      updateTimer(
        dt
      );
    }
  }

  drawArena();

  ball.draw();

  player.draw();

  bot.draw();

  drawGoalEffects();

  drawDemolitionEffects();

  updateHUD();

  requestAnimationFrame(
    gameLoop
  );
}

// =====================================================
// INITIALISATION
// =====================================================

renameGameBrand();

createDeviceChoice();

updateControlUI();

updateMobileSettingsUI();

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
