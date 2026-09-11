document.title = "Rocket League.io";

const canvas = document.getElementById("gameCanvas");

if (!canvas) {
  throw new Error("gameCanvas introuvable");
}

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

const defaults = {
  forward: "z",
  reverse: "s",
  left: "q",
  right: "d",
  boost: "space"
};

let controls = {
  ...defaults
};

try {
  const saved = JSON.parse(
    localStorage.getItem("turboball-controls") || "null"
  );

  if (saved) {
    controls = {
      ...defaults,
      ...saved
    };
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

const keys = Object.create(null);

let waitingForAction = null;
let settingsReturn = "main";

function keyName(key) {
  if (key === " ") return "SPACE";
  if (key === "space") return "SPACE";

  return String(key).length === 1
    ? key.toUpperCase()
    : String(key).toUpperCase();
}

function saveControls() {
  localStorage.setItem(
    "turboball-controls",
    JSON.stringify(controls)
  );
}

function updateControlUI() {
  for (const action of Object.keys(controls)) {
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

function clearKeys() {
  for (const key in keys) {
    keys[key] = false;
  }

  mobileInput.forward = false;
  mobileInput.reverse = false;
  mobileInput.left = false;
  mobileInput.right = false;
  mobileInput.boost = false;
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
      newKey === "" ||
      newKey === "p" ||
      newKey === "escape"
    ) {
      return;
    }

    const alreadyUsed =
      Object.keys(controls).find(
        a =>
          a !== action &&
          controls[a] === newKey
      );

    if (alreadyUsed) return;

    controls[action] = newKey;

    saveControls();
    updateControlUI();

    waitingForAction = null;

    return;
  }

  const key = normalizedKey(e);

  if (key === "space") {
    e.preventDefault();
  }

  if (
    gameRunning &&
    !paused &&
    !goalActive &&
    key === "p"
  ) {
    togglePause();
    return;
  }

  keys[key] = true;
});

document.addEventListener("keyup", e => {
  keys[normalizedKey(e)] = false;
});

window.addEventListener("blur", clearKeys);

for (const action of Object.keys(keyButtons)) {
  keyButtons[action]?.addEventListener(
    "click",
    () => {
      if (waitingForAction) return;

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
    controls = {
      ...defaults
    };

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
  updateMobileSettingsUI();
}

$("settingsBackButton")?.addEventListener(
  "click",
  () => {
    settingsMenu?.classList.add("hidden");

    if (
      settingsReturn === "pause" &&
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

$("howToPlayButton")?.addEventListener(
  "click",
  () => {
    mainMenu?.classList.add("hidden");
    howToPlayMenu?.classList.remove(
      "hidden"
    );

    updateControlUI();
  }
);

$("backButton")?.addEventListener(
  "click",
  () => {
    howToPlayMenu?.classList.add("hidden");
    mainMenu?.classList.remove(
      "hidden"
    );
  }
);

/* =========================================================
   GAME STATE
========================================================= */

let blueScore = 0;
let orangeScore = 0;

let playerPoints = 0;
let opponentPoints = 0;

let gameTime = 120;

let gameRunning = false;
let paused = false;
let goalActive = false;

let goalTimer = null;
let countdownTimer = null;
let countdownFinish = null;
let introTimer = null;

let lastTime = performance.now();

let saveCooldown = 0;

let pointsTimer = null;

function setText(el, value) {
  if (el) {
    el.textContent = value;
  }
}

function updatePoints() {
  setText(
    playerPointsEl,
    Math.floor(playerPoints)
  );
}

function showPoints(amount, reason) {
  if (!pointsNotification) return;

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

  pointsTimer = setTimeout(() => {
    pointsNotification.classList.remove(
      "show"
    );
  }, 1100);
}

function awardPoints(
  amount,
  reason,
  owner = "player"
) {
  if (owner === "player") {
    playerPoints += amount;

    updatePoints();

    showPoints(
      amount,
      reason
    );
  } else {
    opponentPoints += amount;
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
  opponentPoints = 0;

  saveCooldown = 0;

  updatePoints();

  pointsNotification?.classList.remove(
    "show"
  );
}

/* =========================================================
   FIELD
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

const effects = {
  boost: [],
  goal: [],
  demolition: []
};

let goalFlash = 0;

/* =========================================================
   CAR
========================================================= */

class Car {
  constructor(
    x,
    y,
    color,
    team,
    isBot = false
  ) {
    this.startX = x;
    this.startY = y;

    this.x = x;
    this.y = y;

    this.color = color;
    this.team = team;

    this.isBot = isBot;

    this.radius = 25;

    this.angle =
      team === "blue"
        ? 0
        : Math.PI;

    this.speed = 0;

    this.maxSpeed = 7.2;
    this.boostMax = 11.7;

    this.boost = 100;

    this.boosting = false;

    this.ballContact = false;

    this.demolished = false;
    this.respawnTimer = 0;
    this.demoInvulnerable = 0;

    this.aiTarget = null;
    this.aiThink = 0;
  }

  reset() {
    this.x = this.startX;
    this.y = this.startY;

    this.angle =
      this.team === "blue"
        ? 0
        : Math.PI;

    this.speed = 0;
    this.boost = 100;

    this.boosting = false;

    this.ballContact = false;

    this.demolished = false;
    this.respawnTimer = 0;
    this.demoInvulnerable = 0;
  }

  update(input) {
    if (this.demolished) {
      this.respawnTimer -= 1 / 60;

      if (this.respawnTimer <= 0) {
        this.reset();
      }

      return;
    }

    this.demoInvulnerable =
      Math.max(
        0,
        this.demoInvulnerable -
          1 / 60
      );

    if (this.isBot) {
      this.updateAI();
    } else {
      this.updateInput(input);
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

  updateInput(input) {
    this.boosting = false;

    if (!input) {
      input = {
        forward: false,
        reverse: false,
        left: false,
        right: false,
        boost: false
      };
    }

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
        Math.abs(this.speed) / 2 +
          0.3,
        1
      );

    if (input.left) {
      this.angle -=
        turn *
        (this.speed >= 0
          ? 1
          : -1);
    }

    if (input.right) {
      this.angle +=
        turn *
        (this.speed >= 0
          ? 1
          : -1);
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

  updateAI() {
    const dx =
      ball.x - this.x;

    const dy =
      ball.y - this.y;

    const distance =
      Math.hypot(dx, dy);

    let tx = ball.x;
    let ty = ball.y;

    if (
      ball.x >
        field.right - 270 &&
      ball.vx > 0
    ) {
      tx =
        field.right - 55;

      ty =
        H / 2 +
        (ball.y - H / 2) *
          0.7;
    } else if (
      ball.x < W * 0.42
    ) {
      tx = ball.x + 45;
      ty = ball.y;
    }

    this.aiThink -=
      1 / 60;

    const dangerous =
      ball.x >
        field.right - 270 &&
      ball.vx > 0;

    if (
      this.boost < 25 &&
      distance > 180 &&
      !dangerous
    ) {
      if (
        !this.aiTarget ||
        this.aiThink <= 0 ||
        this.aiTarget.cooldown > 0
      ) {
        let best = null;
        let bestDistance =
          Infinity;

        for (
          const pad of boostPads
        ) {
          if (
            pad.cooldown > 0
          ) continue;

          const d =
            Math.hypot(
              pad.x - this.x,
              pad.y - this.y
            );

          if (
            d < bestDistance
          ) {
            bestDistance = d;
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

    const targetAngle =
      Math.atan2(
        ty - this.y,
        tx - this.x
      );

    let diff =
      targetAngle -
      this.angle;

    while (
      diff > Math.PI
    ) {
      diff -=
        Math.PI * 2;
    }

    while (
      diff < -Math.PI
    ) {
      diff +=
        Math.PI * 2;
    }

    if (diff > 0.06) {
      this.angle += 0.062;
    } else if (
      diff < -0.06
    ) {
      this.angle -= 0.062;
    }

    const aligned =
      Math.abs(diff) < 0.32;

    const attack =
      ball.x <
        W * 0.55 &&
      this.x > ball.x;

    this.boosting =
      this.boost > 4 &&
      aligned &&
      (
        distance > 260 ||
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

    this.speed = Math.min(
      this.speed,
      this.boosting
        ? 10.2
        : 6.7
    );

    if (this.aiTarget) {
      const d =
        Math.hypot(
          this.aiTarget.x -
            this.x,
          this.aiTarget.y -
            this.y
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

        this.aiTarget.cooldown =
          5;

        this.aiTarget.flash =
          1;

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
    if (this.demolished) return;

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

/* =========================================================
   BALL
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

    if (speed > 9) {
      this.vx =
        this.vx /
        speed *
        9;

      this.vy =
        this.vy /
        speed *
        9;
    }

    this.checkGoal();

    if (!goalActive) {
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

    if (!inOpening) {
      return;
    }

    if (
      this.x -
        this.radius <=
      field.left - 2
    ) {
      scoreGoal("orange");
    }

    if (
      this.x +
        this.radius >=
      field.right + 2
    ) {
      scoreGoal("blue");
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

      this.vy *= -0.82;
    }

    if (
      this.y +
        this.radius >
      field.bottom
    ) {
      this.y =
        field.bottom -
        this.radius;

      this.vy *= -0.82;
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

      this.vx *= -0.82;
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

    ctx.shadowColor =
      "#fff";

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
      0.55,
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

const player =
  new Car(
    350,
    H / 2,
    "#20cfff",
    "blue"
  );

const bot =
  new Car(
    W - 350,
    H / 2,
    "#ff8a18",
    "orange",
    true
  );

const ball =
  new Ball();

/* =========================================================
   MOBILE
========================================================= */

let deviceMode =
  localStorage.getItem(
    "rocketleague-device-mode"
  ) || "pc";

let mobileBoostSide =
  localStorage.getItem(
    "rocketleague-mobile-boost-side"
  ) || "left";

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

let mobilePad = null;
let mobileBoostButton = null;
let mobilePauseButton = null;

function applyMobileVector(
  dx,
  dy
) {
  const deadzone = 12;

  if (
    Math.hypot(dx, dy) <
    deadzone
  ) {
    mobileInput.forward = false;
    mobileInput.reverse = false;
    mobileInput.left = false;
    mobileInput.right = false;

    return;
  }

  const max = 100;

  dx = Math.max(
    -max,
    Math.min(max, dx)
  );

  dy = Math.max(
    -max,
    Math.min(max, dy)
  );

  mobileInput.left = false;
  mobileInput.right = false;
  mobileInput.forward = false;
  mobileInput.reverse = false;

  if (
    Math.abs(dx) >
    Math.abs(dy)
  ) {
    if (dx < 0) {
      mobileInput.left = true;
    } else {
      mobileInput.right = true;
    }
  } else {
    if (dy < 0) {
      mobileInput.forward = true;
    } else {
      mobileInput.reverse = true;
    }
  }
}

function updateMobilePad() {
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
  if (
    document.getElementById(
      "rocketMobilePad"
    )
  ) {
    return;
  }

  mobilePad =
    document.createElement(
      "div"
    );

  mobilePad.id =
    "rocketMobilePad";

  mobilePad.style.position =
    "fixed";

  mobilePad.style.inset = "0";

  mobilePad.style.zIndex =
    "9000";

  mobilePad.style.touchAction =
    "none";

  mobilePad.style.pointerEvents =
    "none";

  mobilePad.style.background =
    "transparent";

  document.body.appendChild(
    mobilePad
  );

  mobilePad.addEventListener(
    "pointerdown",
    e => {
      if (
        deviceMode !==
        "mobile"
      ) {
        return;
      }

      mobileInput.active =
        true;

      mobileInput.id =
        e.pointerId;

      mobileInput.startX =
        e.clientX;

      mobileInput.startY =
        e.clientY;

      mobileInput.x =
        e.clientX;

      mobileInput.y =
        e.clientY;

      mobilePad.setPointerCapture(
        e.pointerId
      );
    }
  );

  mobilePad.addEventListener(
    "pointermove",
    e => {
      if (
        !mobileInput.active ||
        e.pointerId !==
          mobileInput.id
      ) {
        return;
      }

      mobileInput.x =
        e.clientX;

      mobileInput.y =
        e.clientY;

      applyMobileVector(
        e.clientX -
          mobileInput.startX,
        e.clientY -
          mobileInput.startY
      );
    }
  );

  const stopTouch = e => {
    if (
      e.pointerId !==
      mobileInput.id
    ) {
      return;
    }

    mobileInput.active =
      false;

    mobileInput.id = null;

    applyMobileVector(
      0,
      0
    );
  };

  mobilePad.addEventListener(
    "pointerup",
    stopTouch
  );

  mobilePad.addEventListener(
    "pointercancel",
    stopTouch
  );

  mobileBoostButton =
    document.createElement(
      "button"
    );

  mobileBoostButton.id =
    "rocketMobileBoost";

  mobileBoostButton.textContent =
    "BOOST";

  mobileBoostButton.style.position =
    "fixed";

  mobileBoostButton.style.bottom =
    "30px";

  mobileBoostButton.style.left =
    "25px";

  mobileBoostButton.style.width =
    "105px";

  mobileBoostButton.style.height =
    "105px";

  mobileBoostButton.style.borderRadius =
    "50%";

  mobileBoostButton.style.zIndex =
    "9100";

  mobileBoostButton.style.display =
    "none";

  mobileBoostButton.style.fontWeight =
    "900";

  mobileBoostButton.style.fontSize =
    "16px";

  document.body.appendChild(
    mobileBoostButton
  );

  const boostDown = e => {
    e.preventDefault();

    if (
      deviceMode ===
      "mobile"
    ) {
      mobileInput.boost =
        true;
    }
  };

  const boostUp = e => {
    e.preventDefault();

    mobileInput.boost =
      false;
  };

  mobileBoostButton.addEventListener(
    "pointerdown",
    boostDown
  );

  mobileBoostButton.addEventListener(
    "pointerup",
    boostUp
  );

  mobileBoostButton.addEventListener(
    "pointercancel",
    boostUp
  );

  mobileBoostButton.addEventListener(
    "pointerleave",
    boostUp
  );

  mobilePauseButton =
    document.createElement(
      "button"
    );

  mobilePauseButton.id =
    "rocketMobilePause";

  mobilePauseButton.textContent =
    "Ⅱ";

  mobilePauseButton.style.position =
    "fixed";

  mobilePauseButton.style.top =
    "20px";

  mobilePauseButton.style.right =
    "20px";

  mobilePauseButton.style.width =
    "55px";

  mobilePauseButton.style.height =
    "55px";

  mobilePauseButton.style.borderRadius =
    "50%";

  mobilePauseButton.style.zIndex =
    "9100";

  mobilePauseButton.style.display =
    "none";

  document.body.appendChild(
    mobilePauseButton
  );

  mobilePauseButton.addEventListener(
    "click",
    () => {
      if (
        gameRunning &&
        !goalActive
      ) {
        togglePause();
      }
    }
  );

  updateMobileControlsVisibility();
}

function updateMobileControlsVisibility() {
  const visible =
    deviceMode ===
    "mobile";

  if (mobileBoostButton) {
    mobileBoostButton.style.display =
      visible
        ? "block"
        : "none";

    mobileBoostButton.style.left =
      mobileBoostSide ===
      "left"
        ? "25px"
        : "auto";

    mobileBoostButton.style.right =
      mobileBoostSide ===
      "right"
        ? "25px"
        : "auto";
  }

  if (mobilePauseButton) {
    mobilePauseButton.style.display =
      visible
        ? "block"
        : "none";
  }

  document.body.classList.toggle(
    "rocket-mobile",
    visible
  );

  updateMobilePad();
}

function updateMobileSettingsUI() {
  if (
    !settingsMenu ||
    document.getElementById(
      "mobileSettingsBlock"
    )
  ) {
    return;
  }

  const block =
    document.createElement(
      "div"
    );

  block.id =
    "mobileSettingsBlock";

  block.style.marginTop =
    "20px";

  block.innerHTML = `
    <div style="font-weight:900;margin-bottom:8px">
      MOBILE
    </div>

    <button id="mobileBoostLeft">
      BOOST À GAUCHE
    </button>

    <button id="mobileBoostRight">
      BOOST À DROITE
    </button>

    <button id="mobileBoostReset">
      RESET BOOST
    </button>
  `;

  settingsMenu.appendChild(
    block
  );

  block
    .querySelector(
      "#mobileBoostLeft"
    )
    .addEventListener(
      "click",
      () => {
        mobileBoostSide =
          "left";

        localStorage.setItem(
          "rocketleague-mobile-boost-side",
          "left"
        );

        updateMobileControlsVisibility();
      }
    );

  block
    .querySelector(
      "#mobileBoostRight"
    )
    .addEventListener(
      "click",
      () => {
        mobileBoostSide =
          "right";

        localStorage.setItem(
          "rocketleague-mobile-boost-side",
          "right"
        );

        updateMobileControlsVisibility();
      }
    );

  block
    .querySelector(
      "#mobileBoostReset"
    )
    .addEventListener(
      "click",
      () => {
        mobileBoostSide =
          "left";

        localStorage.setItem(
          "rocketleague-mobile-boost-side",
          "left"
        );

        updateMobileControlsVisibility();
      }
    );
}

function setupDeviceChoice() {
  const overlay =
    document.createElement(
      "div"
    );

  overlay.id =
    "deviceChoice";

  overlay.style.position =
    "fixed";

  overlay.style.inset = "0";

  overlay.style.zIndex =
    "20000";

  overlay.style.background =
    "rgba(3,8,16,.97)";

  overlay.style.display =
    "flex";

  overlay.style.alignItems =
    "center";

  overlay.style.justifyContent =
    "center";

  overlay.style.flexDirection =
    "column";

  overlay.style.gap =
    "20px";

  overlay.innerHTML = `
    <div style="
      font-size:32px;
      font-weight:1000;
      letter-spacing:3px;
    ">
      ROCKET LEAGUE.IO
    </div>

    <div style="
      font-size:18px;
      opacity:.8;
    ">
      CHOISIS TON APPAREIL
    </div>

    <div style="
      display:flex;
      gap:15px;
      flex-wrap:wrap;
      justify-content:center;
    ">
      <button id="choosePC">
        🖥️ PC
      </button>

      <button id="chooseMobile">
        📱 MOBILE
      </button>
    </div>
  `;

  document.body.appendChild(
    overlay
  );

  overlay
    .querySelector("#choosePC")
    .addEventListener(
      "click",
      () => {
        deviceMode =
          "pc";

        localStorage.setItem(
          "rocketleague-device-mode",
          "pc"
        );

        overlay.remove();

        updateMobileControlsVisibility();
      }
    );

  overlay
    .querySelector(
      "#chooseMobile"
    )
    .addEventListener(
      "click",
      () => {
        deviceMode =
          "mobile";

        localStorage.setItem(
          "rocketleague-device-mode",
          "mobile"
        );

        overlay.remove();

        updateMobileControlsVisibility();
      }
    );
}

/* =========================================================
   INPUT
========================================================= */

function getLocalInput() {
  return {
    forward:
      deviceMode === "mobile"
        ? mobileInput.forward
        : !!keys[
            controls.forward
          ],

    reverse:
      deviceMode === "mobile"
        ? mobileInput.reverse
        : !!keys[
            controls.reverse
          ],

    left:
      deviceMode === "mobile"
        ? mobileInput.left
        : !!keys[
            controls.left
          ],

    right:
      deviceMode === "mobile"
        ? mobileInput.right
        : !!keys[
            controls.right
          ],

    boost:
      deviceMode === "mobile"
        ? mobileInput.boost
        : !!keys[
            controls.boost
          ]
  };
}

/* =========================================================
   OFFLINE / ONLINE
========================================================= */

let gameMode =
  "offline";

const MULTIPLAYER_URL =
  "wss://kyro-io.onrender.com";

const multiplayer = {
  ws: null,

  connected: false,
  searching: false,
  inMatch: false,

  matchId: null,

  playerNumber: 1,
  team: "blue",
  isHost: false,

  opponentInput: {
    forward: false,
    reverse: false,
    left: false,
    right: false,
    boost: false
  },

  lastInputSend: 0,
  lastStateSend: 0,

  lastRemoteState: null
};

let onlineMenu = null;
let onlineStatus = null;
let onlineSearchButton = null;
let onlineCancelButton = null;

function createOnlineUI() {
  if (
    document.getElementById(
      "rocketOnlineButton"
    )
  ) {
    document
      .getElementById(
        "rocketOnlineButton"
      )
      .addEventListener(
        "click",
        openOnlineMenu
      );
  } else {
    const button =
      document.createElement(
        "button"
      );

    button.id =
      "rocketOnlineButton";

    button.textContent =
      "1V1 EN LIGNE";

    button.style.margin =
      "10px";

    button.addEventListener(
      "click",
      openOnlineMenu
    );

    mainMenu?.appendChild(
      button
    );
  }

  if (
    !document.getElementById(
      "rocketOfflineButton"
    )
  ) {
    const offline =
      document.createElement(
        "button"
      );

    offline.id =
      "rocketOfflineButton";

    offline.textContent =
      "JEU HORS LIGNE";

    offline.style.margin =
      "10px";

    offline.addEventListener(
      "click",
      () => {
        gameMode =
          "offline";

        startMatch();
      }
    );

    mainMenu?.appendChild(
      offline
    );
  } else {
    document
      .getElementById(
        "rocketOfflineButton"
      )
      .addEventListener(
        "click",
        () => {
          gameMode =
            "offline";

          startMatch();
        }
      );
  }

  onlineMenu =
    document.createElement(
      "div"
    );

  onlineMenu.id =
    "rocketOnlineMenu";

  onlineMenu.style.position =
    "fixed";

  onlineMenu.style.inset = "0";

  onlineMenu.style.zIndex =
    "19000";

  onlineMenu.style.display =
    "none";

  onlineMenu.style.alignItems =
    "center";

  onlineMenu.style.justifyContent =
    "center";

  onlineMenu.style.flexDirection =
    "column";

  onlineMenu.style.background =
    "rgba(3,8,16,.97)";

  onlineMenu.innerHTML = `
    <div style="
      font-size:34px;
      font-weight:1000;
      letter-spacing:3px;
    ">
      1V1 EN LIGNE
    </div>

    <div id="rocketOnlineStatus"
      style="
        margin:25px;
        font-size:18px;
        opacity:.9;
        text-align:center;
      ">
      Prêt à chercher un adversaire
    </div>

    <button id="rocketOnlineSearch">
      🔎 CHERCHER UNE PARTIE
    </button>

    <button id="rocketOnlineCancel">
      RETOUR
    </button>
  `;

  document.body.appendChild(
    onlineMenu
  );

  onlineStatus =
    document.getElementById(
      "rocketOnlineStatus"
    );

  onlineSearchButton =
    document.getElementById(
      "rocketOnlineSearch"
    );

  onlineCancelButton =
    document.getElementById(
      "rocketOnlineCancel"
    );

  onlineSearchButton.addEventListener(
    "click",
    searchOnlineMatch
  );

  onlineCancelButton.addEventListener(
    "click",
    cancelOnlineSearch
  );
}

function openOnlineMenu() {
  mainMenu?.classList.add(
    "hidden"
  );

  onlineMenu.style.display =
    "flex";

  setOnlineStatus(
    "Prêt à chercher un adversaire"
  );
}

function setOnlineStatus(text) {
  if (onlineStatus) {
    onlineStatus.textContent =
      text;
  }
}

function connectServer() {
  return new Promise(
    (resolve, reject) => {
      if (
        multiplayer.ws &&
        multiplayer.ws.readyState ===
          WebSocket.OPEN
      ) {
        resolve();
        return;
      }

      setOnlineStatus(
        "Connexion au serveur..."
      );

      const ws =
        new WebSocket(
          MULTIPLAYER_URL
        );

      multiplayer.ws =
        ws;

      const timeout =
        setTimeout(
          () => {
            reject(
              new Error(
                "Connexion trop longue"
              )
            );
          },
          15000
        );

      ws.onopen = () => {
        clearTimeout(
          timeout
        );

        multiplayer.connected =
          true;

        resolve();
      };

      ws.onerror = () => {
        clearTimeout(
          timeout
        );

        multiplayer.connected =
          false;

        reject(
          new Error(
            "Serveur inaccessible"
          )
        );
      };

      ws.onclose = () => {
        multiplayer.connected =
          false;

        multiplayer.searching =
          false;

        if (
          multiplayer.inMatch
        ) {
          multiplayer.inMatch =
            false;

          if (gameRunning) {
            gameRunning =
              false;

            setOnlineStatus(
              "Connexion perdue"
            );

            showMainMenu();
          }
        }
      };

      ws.onmessage =
        event => {
          let data;

          try {
            data =
              JSON.parse(
                event.data
              );
          } catch {
            return;
          }

          handleServerMessage(
            data
          );
        };
    }
  );
}

function handleServerMessage(
  data
) {
  if (
    data.type ===
    "connected"
  ) {
    return;
  }

  if (
    data.type ===
    "pong"
  ) {
    return;
  }

  if (
    data.type ===
    "searching"
  ) {
    multiplayer.searching =
      true;

    setOnlineStatus(
      "🔎 RECHERCHE D'UN ADVERSAIRE..."
    );

    return;
  }

  if (
    data.type ===
    "search-cancelled"
  ) {
    multiplayer.searching =
      false;

    setOnlineStatus(
      "Recherche annulée"
    );

    return;
  }

  if (
    data.type ===
    "match-found"
  ) {
    multiplayer.searching =
      false;

    multiplayer.inMatch =
      true;

    multiplayer.matchId =
      data.matchId;

    multiplayer.playerNumber =
      data.playerNumber;

    multiplayer.team =
      data.team;

    multiplayer.isHost =
      data.isHost;

    gameMode =
      "online";

    onlineMenu.style.display =
      "none";

    startMatch();

    setTimeout(
      () => {
        setOnlineStatus(
          "ADVERSAIRE TROUVÉ !"
        );
      },
      10
    );

    return;
  }

  if (
    data.type ===
    "opponent-input"
  ) {
    multiplayer.opponentInput =
      normalizeInput(
        data.input
      );

    return;
  }

  if (
    data.type ===
    "game-state"
  ) {
    multiplayer.lastRemoteState =
      data.state;

    if (
      gameMode ===
        "online" &&
      !multiplayer.isHost
    ) {
      applyNetworkState(
        data.state
      );
    }

    return;
  }

  if (
    data.type ===
    "opponent-left"
  ) {
    multiplayer.inMatch =
      false;

    gameRunning =
      false;

    clearKeys();

    alert(
      "Ton adversaire a quitté la partie."
    );

    showMainMenu();

    return;
  }
}

function normalizeInput(input) {
  return {
    forward:
      !!input?.forward,

    reverse:
      !!input?.reverse,

    left:
      !!input?.left,

    right:
      !!input?.right,

    boost:
      !!input?.boost
  };
}

async function searchOnlineMatch() {
  try {
    await connectServer();

    if (
      !multiplayer.ws ||
      multiplayer.ws.readyState !==
        WebSocket.OPEN
    ) {
      throw new Error();
    }

    multiplayer.ws.send(
      JSON.stringify({
        type: "find-match",
        mode: "1v1"
      })
    );

    multiplayer.searching =
      true;

    setOnlineStatus(
      "🔎 RECHERCHE AUTOMATIQUE..."
    );
  } catch {
    setOnlineStatus(
      "❌ Serveur indisponible. Réessaie."
    );
  }
}

function cancelOnlineSearch() {
  if (
    multiplayer.ws &&
    multiplayer.ws.readyState ===
      WebSocket.OPEN
  ) {
    multiplayer.ws.send(
      JSON.stringify({
        type: "cancel-search"
      })
    );
  }

  multiplayer.searching =
    false;

  onlineMenu.style.display =
    "none";

  mainMenu?.classList.remove(
    "hidden"
  );
}

function sendInput() {
  if (
    gameMode !== "online" ||
    !multiplayer.inMatch ||
    !multiplayer.ws ||
    multiplayer.ws.readyState !==
      WebSocket.OPEN
  ) {
    return;
  }

  const now =
    performance.now();

  if (
    now -
      multiplayer.lastInputSend <
    50
  ) {
    return;
  }

  multiplayer.lastInputSend =
    now;

  multiplayer.ws.send(
    JSON.stringify({
      type: "input",
      input:
        getLocalInput()
    })
  );
}

function sendGameState() {
  if (
    gameMode !== "online" ||
    !multiplayer.isHost ||
    !multiplayer.inMatch ||
    !multiplayer.ws ||
    multiplayer.ws.readyState !==
      WebSocket.OPEN
  ) {
    return;
  }

  const now =
    performance.now();

  if (
    now -
      multiplayer.lastStateSend <
    50
  ) {
    return;
  }

  multiplayer.lastStateSend =
    now;

  multiplayer.ws.send(
    JSON.stringify({
      type: "game-state",
      state: {
        blue: serializeCar(
          player
        ),

        orange: serializeCar(
          bot
        ),

        ball: {
          x: ball.x,
          y: ball.y,
          vx: ball.vx,
          vy: ball.vy
        },

        blueScore,
        orangeScore,

        gameTime,

        bluePoints:
          playerPoints,

        orangePoints:
          opponentPoints
      }
    })
  );
}

function serializeCar(car) {
  return {
    x: car.x,
    y: car.y,
    angle: car.angle,
    speed: car.speed,
    boost: car.boost,
    boosting:
      car.boosting,
    demolished:
      car.demolished,
    respawnTimer:
      car.respawnTimer
  };
}

function applyCarState(
  car,
  state
) {
  if (!state) return;

  const wasDemolished =
    car.demolished;

  car.x = state.x;
  car.y = state.y;

  car.angle =
    state.angle;

  car.speed =
    state.speed;

  car.boost =
    state.boost;

  car.boosting =
    state.boosting;

  car.demolished =
    state.demolished;

  car.respawnTimer =
    state.respawnTimer;

  if (
    !wasDemolished &&
    car.demolished
  ) {
    spawnDemolition(
      car.x,
      car.y
    );
  }
}

function applyNetworkState(
  state
) {
  if (!state) return;

  applyCarState(
    player,
    multiplayer.team ===
      "blue"
      ? state.blue
      : state.orange
  );

  applyCarState(
    bot,
    multiplayer.team ===
      "blue"
      ? state.orange
      : state.blue
  );

  ball.x =
    state.ball.x;

  ball.y =
    state.ball.y;

  ball.vx =
    state.ball.vx;

  ball.vy =
    state.ball.vy;

  blueScore =
    state.blueScore;

  orangeScore =
    state.orangeScore;

  gameTime =
    state.gameTime;

  if (
    multiplayer.team ===
    "blue"
  ) {
    playerPoints =
      state.bluePoints;
  } else {
    playerPoints =
      state.orangePoints;
  }

  updatePoints();

  setText(
    blueScoreEl,
    blueScore
  );

  setText(
    orangeScoreEl,
    orangeScore
  );

  updateTimerDisplay();
}

/* =========================================================
   COLLISIONS
========================================================= */

function getSaveZone(team) {
  if (team === "blue") {
    return {
      x:
        field.left + 10,
      y:
        goal.top + 12,
      width: 145,
      height:
        goal.bottom -
        goal.top -
        24
    };
  }

  return {
    x:
      field.right -
      155,

    y:
      goal.top + 12,

    width: 145,

    height:
      goal.bottom -
      goal.top -
      24
  };
}

function carInsideSaveZone(
  car
) {
  const zone =
    getSaveZone(
      car.team
    );

  return (
    car.x >= zone.x &&
    car.x <=
      zone.x +
        zone.width &&
    car.y >= zone.y &&
    car.y <=
      zone.y +
        zone.height
  );
}

function ballDangerousFor(
  team
) {
  const inLane =
    ball.y +
      ball.radius >
      goal.top &&
    ball.y -
      ball.radius <
      goal.bottom;

  if (!inLane) {
    return false;
  }

  if (
    team === "blue"
  ) {
    return (
      ball.x <
        field.left + 250 &&
      (
        ball.vx < -0.1 ||
        ball.x <
          field.left + 105
      )
    );
  }

  return (
    ball.x >
      field.right - 250 &&
    (
      ball.vx > 0.1 ||
      ball.x >
        field.right - 105
    )
  );
}

function ownerOfCar(car) {
  if (
    gameMode ===
    "offline"
  ) {
    return car === player
      ? "player"
      : "opponent";
  }

  if (
    car.team ===
    multiplayer.team
  ) {
    return "player";
  }

  return "opponent";
}

function carBallCollision(
  car
) {
  if (
    car.demolished
  ) {
    return;
  }

  const dx =
    ball.x - car.x;

  const dy =
    ball.y - car.y;

  const distance =
    Math.hypot(
      dx,
      dy
    );

  const minDistance =
    car.radius +
    ball.radius;

  if (
    distance >=
    minDistance
  ) {
    car.ballContact =
      false;

    return;
  }

  const newContact =
    !car.ballContact;

  car.ballContact =
    true;

  const owner =
    ownerOfCar(car);

  if (newContact) {
    awardPoints(
      2,
      "BALL TOUCH",
      owner
    );
  }

  const safeDistance =
    distance || 0.001;

  const nx =
    dx / safeDistance;

  const ny =
    dy / safeDistance;

  const overlap =
    minDistance -
    distance;

  ball.x +=
    nx * overlap;

  ball.y +=
    ny * overlap;

  const force =
    Math.min(
      Math.abs(
        car.speed
      ) * 1.15 +
        1.2,
      7
    );

  ball.vx +=
    nx * force;

  ball.vy +=
    ny * force;

  ball.vx +=
    Math.cos(
      car.angle
    ) *
    Math.abs(
      car.speed
    ) *
    0.25;

  ball.vy +=
    Math.sin(
      car.angle
    ) *
    Math.abs(
      car.speed
    ) *
    0.25;

  car.speed *=
    0.82;

  if (
    newContact &&
    carInsideSaveZone(
      car
    ) &&
    ballDangerousFor(
      car.team
    ) &&
    saveCooldown <= 0
  ) {
    saveCooldown = 4;

    if (
      car.team ===
      "blue"
    ) {
      ball.vx =
        Math.abs(
          ball.vx
        ) * 0.65 +
        1.8;
    } else {
      ball.vx =
        -Math.abs(
          ball.vx
        ) * 0.65 -
        1.8;
    }

    ball.vy *=
      0.65;

    awardPoints(
      50,
      "SAVE",
      owner
    );
  }

  /*
    Pinch boost.
    Un gros choc voiture/balle peut
    envoyer la balle très vite.
  */

  if (
    Math.abs(
      car.speed
    ) > 5.8 &&
    Math.hypot(
      ball.vx,
      ball.vy
    ) < 8.2
  ) {
    const impulse =
      Math.abs(
        car.speed
      ) * 0.9;

    ball.vx +=
      Math.cos(
        car.angle
      ) *
      impulse;

    ball.vy +=
      Math.sin(
        car.angle
      ) *
      impulse;

    const speed =
      Math.hypot(
        ball.vx,
        ball.vy
      );

    if (
      speed > 9
    ) {
      ball.vx =
        ball.vx /
        speed *
        9;

      ball.vy =
        ball.vy /
        speed *
        9;
    }
  }
}

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

  if (
    a.demoInvulnerable >
      0 ||
    b.demoInvulnerable >
      0
  ) {
    return;
  }

  const dx =
    b.x - a.x;

  const dy =
    b.y - a.y;

  const distance =
    Math.hypot(
      dx,
      dy
    );

  const minDistance =
    a.radius +
    b.radius;

  if (
    distance <= 0 ||
    distance >=
      minDistance
  ) {
    return;
  }

  const nx =
    dx / distance;

  const ny =
    dy / distance;

  const attackerA =
    carCanDemolish(
      a,
      b,
      nx,
      ny
    );

  const attackerB =
    carCanDemolish(
      b,
      a,
      -nx,
      -ny
    );

  if (attackerA) {
    demolishCar(
      a,
      b
    );

    return;
  }

  if (attackerB) {
    demolishCar(
      b,
      a
    );

    return;
  }

  const overlap =
    minDistance -
    distance;

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

  const oldSpeed =
    a.speed;

  a.speed =
    b.speed * 0.55;

  b.speed =
    oldSpeed * 0.55;

  a.keepInside();
  b.keepInside();
}

function carCanDemolish(
  attacker,
  victim,
  nx,
  ny
) {
  if (
    attacker.team ===
    victim.team
  ) {
    return false;
  }

  if (
    attacker.demolished ||
    victim.demolished
  ) {
    return false;
  }

  const kmh =
    carSpeedKmh(
      attacker
    );

  if (kmh < 70) {
    return false;
  }

  const direction =
    Math.cos(
      attacker.angle
    ) *
      nx +
    Math.sin(
      attacker.angle
    ) *
      ny;

  return (
    direction > 0.25
  );
}

function demolishCar(
  attacker,
  victim
) {
  victim.demolished =
    true;

  victim.respawnTimer =
    2.2;

  victim.speed = 0;

  victim.boosting =
    false;

  victim.ballContact =
    false;

  spawnDemolition(
    victim.x,
    victim.y
  );

  if (
    ownerOfCar(
      attacker
    ) === "player"
  ) {
    showPoints(
      0,
      "DEMOLITION!"
    );
  }
}

function spawnDemolition(
  x,
  y
) {
  for (
    let i = 0;
    i < 40;
    i++
  ) {
    const angle =
      Math.random() *
      Math.PI *
      2;

    const speed =
      1.5 +
      Math.random() *
        4;

    effects.demolition.push(
      {
        x,
        y,

        vx:
          Math.cos(
            angle
          ) * speed,

        vy:
          Math.sin(
            angle
          ) * speed,

        life:
          1,

        size:
          2 +
          Math.random() *
            5
      }
    );
  }
}

/* =========================================================
   BOOST
========================================================= */

function spawnPadParticles(
  pad
) {
  for (
    let i = 0;
    i < 10;
    i++
  ) {
    const angle =
      Math.PI *
      2 *
      i /
      10;

    const speed =
      1.2 +
      Math.random() *
        1.4;

    effects.boost.push(
      {
        x: pad.x,
        y: pad.y,

        vx:
          Math.cos(
            angle
          ) * speed,

        vy:
          Math.sin(
            angle
          ) * speed,

        life:
          0.55,

        size:
          2 +
          Math.random() *
            2,

        color:
          pad.color
      }
    );
  }
}

function updateBoostPads(
  dt
) {
  const seconds =
    Math.min(
      dt / 1000,
      0.1
    );

  for (
    const pad of boostPads
  ) {
    pad.cooldown =
      Math.max(
        0,
        pad.cooldown -
          seconds
      );

    pad.pulse +=
      seconds *
      2.4;

    pad.flash =
      Math.max(
        0,
        pad.flash -
          seconds *
          2.5
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
    gameMode ===
    "online"
      ? [player, bot]
      : [player, bot];

  for (
    const pad of boostPads
  ) {
    if (
      pad.cooldown > 0
    ) {
      continue;
    }

    for (
      const car of cars
    ) {
      if (
        car.demolished
      ) continue;

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

        pad.cooldown =
          5;

        pad.flash =
          1;

        spawnPadParticles(
          pad
        );

        break;
      }
    }
  }
}

/* =========================================================
   GOALS
========================================================= */

function scoreGoal(team) {
  if (
    goalActive ||
    !gameRunning
  ) {
    return;
  }

  /*
    En online, seul l'hôte
    valide les buts.
  */

  if (
    gameMode ===
      "online" &&
    !multiplayer.isHost
  ) {
    return;
  }

  goalActive =
    true;

  clearKeys();

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
      "GOAL",
      player.team ===
        "blue"
        ? "player"
        : "opponent"
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
  } else {
    orangeScore++;

    setText(
      orangeScoreEl,
      orangeScore
    );

    awardPoints(
      150,
      "GOAL",
      player.team ===
        "orange"
        ? "player"
        : "opponent"
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
    const angle =
      Math.random() *
      Math.PI *
      2;

    const speed =
      1.5 +
      Math.random() *
        3.5;

    effects.goal.push(
      {
        x: W / 2,
        y: H / 2,

        vx:
          Math.cos(
            angle
          ) * speed,

        vy:
          Math.sin(
            angle
          ) * speed,

        life:
          1.1,

        size:
          2 +
          Math.random() *
            4,

        color
      }
    );
  }
}

/* =========================================================
   MATCH
========================================================= */

function resetPositions() {
  player.startX =
    player.team ===
    "blue"
      ? 350
      : W - 350;

  bot.startX =
    player.team ===
    "blue"
      ? W - 350
      : 350;

  player.startY =
    H / 2;

  bot.startY =
    H / 2;

  player.reset();
  bot.reset();

  ball.reset();

  saveCooldown =
    0;
}

function startCountdown() {
  clearInterval(
    countdownTimer
  );

  clearTimeout(
    countdownFinish
  );

  goalActive =
    true;

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

                updateMobilePad();
              },
              700
            );
        }
      },
      1000
    );
}

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

  effects.boost.length =
    0;

  effects.goal.length =
    0;

  effects.demolition.length =
    0;

  goalFlash = 0;

  for (
    const pad of boostPads
  ) {
    pad.cooldown =
      0;

    pad.flash =
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

  /*
    En ligne :
    joueur 1 = bleu
    joueur 2 = orange
  */

  if (
    gameMode ===
    "online"
  ) {
    player.team =
      multiplayer.team;

    bot.team =
      multiplayer.team ===
      "blue"
        ? "orange"
        : "blue";

    player.isBot =
      false;

    bot.isBot =
      false;

    multiplayer.lastRemoteState =
      null;
  } else {
    player.team =
      "blue";

    bot.team =
      "orange";

    player.isBot =
      false;

    bot.isBot =
      true;
  }

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

  updateMobileControlsVisibility();

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

  let playerWon =
    false;

  let draw =
    false;

  if (
    conceded
  ) {
    playerWon =
      false;
  } else if (
    blueScore >
    orangeScore
  ) {
    playerWon =
      player.team ===
      "blue";
  } else if (
    orangeScore >
    blueScore
  ) {
    playerWon =
      player.team ===
      "orange";
  } else {
    draw = true;
  }

  if (draw) {
    setText(
      winnerDisplay,
      "DRAW"
    );
  } else if (
    playerWon
  ) {
    setText(
      winnerDisplay,
      "YOU WIN"
    );
  } else {
    setText(
      winnerDisplay,
      "YOU LOSE"
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

  updateMobilePad();
}

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

  onlineMenu.style.display =
    "none";

  mainMenu?.classList.remove(
    "hidden"
  );

  updateMobilePad();
}

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

  pauseMenu?.classList.toggle(
    "hidden",
    !paused
  );

  updateMobilePad();
}

/* =========================================================
   BUTTONS
========================================================= */

$("resumeButton")?.addEventListener(
  "click",
  () => {
    if (!gameRunning) {
      return;
    }

    paused =
      false;

    clearKeys();

    pauseMenu?.classList.add(
      "hidden"
    );

    updateMobilePad();
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

    endMatch(
      true
    );
  }
);

$("pauseMainMenuButton")?.addEventListener(
  "click",
  () => {
    if (
      gameMode ===
      "online"
    ) {
      leaveOnlineMatch();
    }

    showMainMenu();
  }
);

$("playButton")?.addEventListener(
  "click",
  () => {
    gameMode =
      "offline";

    startMatch();
  }
);

playAgainButton?.addEventListener(
  "click",
  () => {
    if (
      gameMode ===
      "online"
    ) {
      /*
        Pour l'instant le bouton
        relance une nouvelle recherche.
      */

      showMainMenu();

      openOnlineMenu();

      searchOnlineMatch();

      return;
    }

    startMatch();
  }
);

mainMenuButton?.addEventListener(
  "click",
  () => {
    if (
      gameMode ===
      "online"
    ) {
      leaveOnlineMatch();
    }

    showMainMenu();
  }
);

$("restartButton")?.addEventListener(
  "click",
  () => {
    gameMode =
      "offline";

    startMatch();
  }
);

function leaveOnlineMatch() {
  if (
    multiplayer.ws &&
    multiplayer.ws.readyState ===
      WebSocket.OPEN &&
    multiplayer.inMatch
  ) {
    multiplayer.ws.send(
      JSON.stringify({
        type: "leave-match"
      })
    );
  }

  multiplayer.inMatch =
    false;

  multiplayer.searching =
    false;

  multiplayer.matchId =
    null;
}

/* =========================================================
   TIMER
========================================================= */

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

  /*
    Seul l'hôte contrôle
    le chrono en ligne.
  */

  if (
    gameMode ===
      "online" &&
    !multiplayer.isHost
  ) {
    return;
  }

  gameTime -=
    dt / 1000;

  if (
    gameTime <= 0
  ) {
    gameTime =
      0;

    updateTimerDisplay();

    endMatch();

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
    `${minutes}:${String(
      seconds
    ).padStart(2, "0")}`
  );
}

/* =========================================================
   EFFECTS
========================================================= */

function updateEffects(
  dt
) {
  const seconds =
    Math.min(
      dt / 1000,
      0.1
    );

  goalFlash =
    Math.max(
      0,
      goalFlash -
        seconds *
        2.2
    );

  for (
    const list of [
      effects.boost,
      effects.goal
    ]
  ) {
    for (
      const p of list
    ) {
      p.x += p.vx;
      p.y += p.vy;

      p.vx *=
        0.97;

      p.vy *=
        0.97;

      p.life -=
        seconds;
    }

    for (
      let i =
        list.length - 1;
      i >= 0;
      i--
    ) {
      if (
        list[i].life <= 0
      ) {
        list.splice(
          i,
          1
        );
      }
    }
  }

  for (
    const p of
      effects.demolition
  ) {
    p.x += p.vx;
    p.y += p.vy;

    p.vx *=
      0.96;

    p.vy *=
      0.96;

    p.life -=
      seconds;
  }

  for (
    let i =
      effects.demolition.length -
      1;
    i >= 0;
    i--
  ) {
    if (
      effects.demolition[
        i
      ].life <= 0
    ) {
      effects.demolition.splice(
        i,
        1
      );
    }
  }

  saveCooldown =
    Math.max(
      0,
      saveCooldown -
        seconds
    );
}

/* =========================================================
   DRAW
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
  for (
    const pad of boostPads
  ) {
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

    ctx.restore();
  }

  drawParticles(
    effects.boost
  );
}

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
      p.color ||
      "#fff";

    ctx.shadowColor =
      p.color ||
      "#fff";

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
    effects.goal
  );

  drawParticles(
    effects.demolition
  );

  if (
    goalFlash > 0
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

/* =========================================================
   HUD
========================================================= */

function carSpeedKmh(
  car
) {
  const speed =
    Math.abs(
      car.speed
    );

  if (
    car.boosting
  ) {
    return Math.round(
      Math.min(
        83,
        speed *
          (83 / 11.7)
      )
    );
  }

  return Math.round(
    Math.min(
      51,
      speed *
        (51 / 7.2)
    )
  );
}

function ballSpeedKmh() {
  return Math.round(
    Math.min(
      216,
      Math.hypot(
        ball.vx,
        ball.vy
      ) *
        24
    )
  );
}

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

  setText(
    speedNumber,
    carSpeedKmh(
      player
    )
  );

  const ballSpeed =
    ballSpeedKmh();

  let ballSpeedEl =
    document.getElementById(
      "ballSpeed"
    );

  if (
    !ballSpeedEl
  ) {
    ballSpeedEl =
      document.createElement(
        "div"
      );

    ballSpeedEl.id =
      "ballSpeed";

    ballSpeedEl.style.position =
      "fixed";

    ballSpeedEl.style.top =
      "20px";

    ballSpeedEl.style.right =
      "20px";

    ballSpeedEl.style.zIndex =
      "1000";

    ballSpeedEl.style.fontWeight =
      "900";

    document.body.appendChild(
      ballSpeedEl
    );
  }

  ballSpeedEl.textContent =
    `${ballSpeed} KM/H`;
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
   MAIN LOOP
========================================================= */

function gameLoop(now) {
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
    if (
      gameMode ===
      "offline"
    ) {
      player.update(
        getLocalInput()
      );

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

        updateTimer(
          dt
        );
      }
    } else if (
      gameMode ===
      "online"
    ) {
      /*
        L'hôte contrôle toute
        la physique.

        Le joueur 1 est bleu.
        Le joueur 2 est orange.
      */

      if (
        multiplayer.isHost
      ) {
        player.update(
          getLocalInput()
        );

        bot.update(
          multiplayer.opponentInput
        );

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

        sendGameState();
      } else {
        /*
          Le joueur 2 envoie
          uniquement ses commandes.
        */

        sendInput();

        /*
          L'état de jeu vient
          du serveur/hôte.
        */
      }
    }
  }

  drawArena();

  ball.draw();

  player.draw();

  bot.draw();

  drawGoalEffects();

  updateHUD();

  updateMobilePad();

  requestAnimationFrame(
    gameLoop
  );
}

/* =========================================================
   KEEP SERVER CONNECTION ALIVE
========================================================= */

setInterval(
  () => {
    if (
      multiplayer.ws &&
      multiplayer.ws.readyState ===
        WebSocket.OPEN
    ) {
      multiplayer.ws.send(
        JSON.stringify({
          type: "ping"
        })
      );
    }
  },
  10000
);

/* =========================================================
   INIT
========================================================= */

updateControlUI();

resetPoints();

updateTimerDisplay();

createMobileControls();

updateMobileSettingsUI();

setupDeviceChoice();

createOnlineUI();

drawArena();

ball.draw();

player.draw();

bot.draw();

updateHUD();

requestAnimationFrame(
  gameLoop
);
