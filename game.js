const canvas = document.getElementById("gameCanvas");
if (!canvas) throw new Error("gameCanvas introuvable");

const ctx = canvas.getContext("2d");
const W = canvas.width;
const H = canvas.height;

const $ = id => document.getElementById(id);

document.title = "Rocket League.io";

/* =========================================================
   UI
========================================================= */

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

const ballSpeedEl =
  $("ballSpeed") ||
  $("ballSpeedNumber") ||
  $("speedBallNumber");

const settingsMenu = $("settingsMenu");
const concedeConfirm = $("concedeConfirm");


/* =========================================================
   CONTRÔLES PC
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

  if (saved) {
    controls = {
      ...defaults,
      ...saved
    };
  }
} catch {}

const keys = Object.create(null);

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

function keyName(key) {
  if (key === " " || key === "space") {
    return "SPACE";
  }

  return String(key || "").toUpperCase();
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

function controlPressed(action) {
  return !!keys[controls[action]];
}

function clearKeys() {
  for (const k in keys) {
    keys[k] = false;
  }
}


/* =========================================================
   MODE APPAREIL
========================================================= */

let deviceMode =
  localStorage.getItem("rocketleague-device-mode") || "pc";

let mobileMode = deviceMode === "mobile";

let mobileBoostSide =
  localStorage.getItem(
    "rocketleague-mobile-boost-side"
  ) || "left";

let mobileBoost = false;

const mobileTouch = {
  active: false,
  x: 0,
  y: 0,
  cx: 0,
  cy: 0
};


/* =========================================================
   MODE JEU / ONLINE
========================================================= */

let gameMode = "offline";

const ONLINE_SERVER_URL =
  "wss://kyro-io.onrender.com";

let socket = null;
let onlineConnected = false;
let onlinePlayerNumber = 0;
let onlineMatchId = null;
let isOnlineHost = false;

let opponentInput = {};

let networkStateTimer = 0;


/* =========================================================
   ÉTAT DU MATCH
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

let pointsTimer = null;

let saveCooldown = 0;
let saveDangerHandled = false;


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


/* =========================================================
   PARTICULES
========================================================= */

const boostParticles = [];
const goalParticles = [];
const demoParticles = [];

let goalFlash = 0;
let demoFlash = 0;


/* =========================================================
   POINTS
========================================================= */

function setText(element, value) {
  if (element) {
    element.textContent = value;
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

    pointsNotification.classList.remove("show");

    void pointsNotification.offsetWidth;

    pointsNotification.classList.add("show");

    pointsTimer = setTimeout(() => {
      pointsNotification.classList.remove("show");
    }, 1100);
  }

  pointsPanel?.classList.remove("earned");

  if (pointsPanel) {
    void pointsPanel.offsetWidth;
    pointsPanel.classList.add("earned");
  }
}

function awardOpponentPoints(amount) {
  opponentPoints += amount;
}

function resetPoints() {
  playerPoints = 0;
  opponentPoints = 0;

  saveCooldown = 0;
  saveDangerHandled = false;

  updatePoints();

  pointsNotification?.classList.remove("show");
}


/* =========================================================
   CLASSES
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

    /*
      7.2 = environ 51 km/h
      11.7 = environ 83 km/h
    */
    this.maxSpeed = 7.2;
    this.boostMax = 11.7;

    this.boost = 100;

    this.boosting = false;

    this.ballContact = false;

    this.aiTarget = null;
    this.aiThink = 0;

    this.demolished = false;
    this.demoTimer = 0;
    this.demoCooldown = 0;
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

    this.demolished = false;
    this.demoTimer = 0;
  }


  update(dt) {

    if (this.demolished) {

      this.demoTimer -= dt / 1000;

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

    this.move();

    this.demoCooldown =
      Math.max(
        0,
        this.demoCooldown - dt / 1000
      );
  }


  move() {

    this.x +=
      Math.cos(this.angle) * this.speed;

    this.y +=
      Math.sin(this.angle) * this.speed;

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


  updatePlayer() {

    this.boosting = false;

    if (mobileMode) {

      const dx =
        mobileTouch.x -
        mobileTouch.cx;

      const dy =
        mobileTouch.y -
        mobileTouch.cy;

      const distance =
        Math.hypot(dx, dy);

      if (
        mobileTouch.active &&
        distance > 8
      ) {

        const targetAngle =
          Math.atan2(dy, dx);

        let diff =
          targetAngle -
          this.angle;

        while (diff > Math.PI) {
          diff -= Math.PI * 2;
        }

        while (diff < -Math.PI) {
          diff += Math.PI * 2;
        }

        this.angle +=
          Math.max(
            -0.09,
            Math.min(
              0.09,
              diff
            )
          );

        this.speed +=
          Math.min(
            0.22,
            distance * 0.0028
          );

        if (distance > 35) {
          this.speed += 0.04;
        }
      }

    } else {

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
    }


    const boostPressed =
      controlPressed("boost") ||
      mobileBoost;


    if (
      boostPressed &&
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


  updateFromNetworkInput(input) {

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

    this.move();
  }


  updateAI() {

    const dx =
      ball.x - this.x;

    const dy =
      ball.y - this.y;

    const dist =
      Math.hypot(dx, dy);

    let tx = ball.x;
    let ty = ball.y;

    const dangerous =
      ball.x >
        field.right - 270 &&
      ball.vx > 0;


    /*
      Défense
    */

    if (dangerous) {

      tx =
        Math.min(
          field.right - 55,
          ball.x + 55
        );

      ty =
        H / 2 +
        (ball.y - H / 2) *
        0.7;

    } else if (ball.x < W * 0.42) {

      /*
        Attaque
      */

      tx = ball.x + 45;
      ty = ball.y;
    }


    /*
      Recherche de boost
    */

    this.aiThink -= 1 / 60;

    if (
      this.boost < 25 &&
      dist > 180 &&
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


    /*
      Direction
    */

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


    /*
      IA utilise le boost
      jusqu'à 10.2
    */

    this.boosting =
      this.boost > 4 &&
      aligned &&
      (
        dist > 260 ||
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
          ? 10.2
          : 6.7
      );


    /*
      Ramassage boost
    */

    if (
      this.aiTarget &&
      Math.hypot(
        this.aiTarget.x - this.x,
        this.aiTarget.y - this.y
      ) <
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

    if (this.demolished) {
      return;
    }

    ctx.save();

    ctx.translate(
      this.x,
      this.y
    );

    ctx.rotate(this.angle);


    /*
      Boost
    */

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


    /*
      Voiture
    */

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


    /*
      Roues
    */

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


    /*
      Vitesse max interne :
      9 = 216 km/h
    */

    const speed =
      Math.hypot(
        this.vx,
        this.vy
      );

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
      this.y + this.radius > goal.top &&
      this.y - this.radius < goal.bottom;

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
      this.y + this.radius > goal.top &&
      this.y - this.radius < goal.bottom;


    if (
      this.x - this.radius <
        field.left &&
      !inOpening
    ) {

      this.x =
        field.left + this.radius;

      this.vx *= -0.82;
    }


    if (
      this.x + this.radius >
        field.right &&
      !inOpening
    ) {

      this.x =
        field.right - this.radius;

      this.vx *= -0.82;
    }


    /*
      Fond des cages
    */

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
   JOUEUR LOCAL
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

function localTeam() {

  if (
    gameMode === "multiplayer" &&
    onlinePlayerNumber === 2
  ) {
    return "orange";
  }

  return "blue";
}


/* =========================================================
   SAVE
========================================================= */

function saveZoneFor(team) {

  if (team === "blue") {

    return {
      x: field.left + 10,
      y: goal.top + 12,
      width: 145,
      height:
        goal.bottom -
        goal.top -
        24
    };
  }

  return {
    x: field.right - 155,
    y: goal.top + 12,
    width: 145,
    height:
      goal.bottom -
      goal.top -
      24
  };
}


function carInSaveZone(car, team) {

  const z =
    saveZoneFor(team);

  return (
    car.x >= z.x &&
    car.x <= z.x + z.width &&
    car.y >= z.y &&
    car.y <= z.y + z.height
  );
}


function ballDangerousFor(team) {

  const inLane =
    ball.y + ball.radius > goal.top &&
    ball.y - ball.radius < goal.bottom;


  if (team === "blue") {

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


  const team =
    car === player
      ? "blue"
      : "orange";

  const dangerousBefore =
    ballDangerousFor(team);

  const newContact =
    !car.ballContact;

  car.ballContact = true;


  /*
    Points contact
  */

  if (newContact) {

    if (car === localCar()) {

      awardPoints(
        2,
        "BALL TOUCH"
      );

    } else if (
      gameMode === "multiplayer"
    ) {

      awardOpponentPoints(2);
    }
  }


  const safeD =
    d || 0.001;

  const nx =
    dx / safeD;

  const ny =
    dy / safeD;

  const overlap =
    minD - d;


  ball.x += nx * overlap;
  ball.y += ny * overlap;


  const force =
    Math.min(
      Math.abs(car.speed) *
        1.15 +
        1.2,
      7
    );


  ball.vx += nx * force;
  ball.vy += ny * force;


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
    car === localCar() &&
    newContact &&
    dangerousBefore &&
    carInSaveZone(
      car,
      team
    ) &&
    saveCooldown <= 0
  ) {

    saveCooldown = 4;

    saveDangerHandled = true;


    if (team === "blue") {

      ball.vx =
        Math.max(
          1.8,
          Math.abs(ball.vx) * 0.65
        );

    } else {

      ball.vx =
        -Math.max(
          1.8,
          Math.abs(ball.vx) * 0.65
        );
    }


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

function demolish(attacker, victim) {

  if (
    attacker.demolished ||
    victim.demolished
  ) {
    return;
  }


  if (
    attacker.demoCooldown > 0
  ) {
    return;
  }


  /*
    70 km/h minimum.

    11.7 = 83 km/h
    70 km/h = environ 9.86
  */

  const demolitionSpeed =
    70 * (11.7 / 83);


  if (
    Math.abs(attacker.speed) <
    demolitionSpeed
  ) {
    return;
  }


  const distance =
    Math.hypot(
      victim.x - attacker.x,
      victim.y - attacker.y
    );


  if (
    distance >
    attacker.radius +
    victim.radius +
    3
  ) {
    return;
  }


  /*
    SEULEMENT L'ADVERSAIRE
    est démoli.
  */

  victim.demolished = true;

  victim.demoTimer = 2.0;

  victim.speed = 0;

  spawnDemo(
    victim.x,
    victim.y,
    attacker.color
  );

  attacker.demoCooldown = 1.1;

  demoFlash = 1;
}


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


  /*
    Démolition dans les deux sens :
    joueur -> IA
    IA -> joueur
    joueur online -> adversaire
  */

  if (
    Math.abs(a.speed) >=
    70 * (11.7 / 83)
  ) {

    demolish(a, b);
  }


  if (
    Math.abs(b.speed) >=
    70 * (11.7 / 83)
  ) {

    demolish(b, a);
  }


  if (
    a.demolished ||
    b.demolished
  ) {
    return;
  }


  const nx = dx / d;
  const ny = dy / d;

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

  a.speed =
    b.speed * 0.55;

  b.speed =
    av * 0.55;


  a.keepInside();
  b.keepInside();
}


/* =========================================================
   PARTICULES
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

      color: pad.color
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
      Math.random() *
      3.5;


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


function spawnDemo(
  x,
  y,
  color
) {

  for (let i = 0; i < 55; i++) {

    const angle =
      Math.random() *
      Math.PI *
      2;

    const speed =
      2 +
      Math.random() *
      5;


    demoParticles.push({

      x,
      y,

      vx:
        Math.cos(angle) *
        speed,

      vy:
        Math.sin(angle) *
        speed,

      life:
        0.8 +
        Math.random() *
        0.7,

      size:
        2 +
        Math.random() *
        5,

      color
    });
  }
}


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


  demoFlash =
    Math.max(
      0,
      demoFlash -
      sec * 3
    );


  for (
    const list of [
      boostParticles,
      goalParticles,
      demoParticles
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


  if (
    !ballDangerousFor(
      localTeam()
    )
  ) {

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
        pad.flash -
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


  for (const pad of boostPads) {

    if (pad.cooldown > 0) {
      continue;
    }


    for (
      const car of [
        player,
        bot
      ]
    ) {

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
      localTeam() === "blue"
    ) {

      awardPoints(
        150,
        "GOAL"
      );

    } else {

      awardOpponentPoints(150);
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
      localTeam() === "orange"
    ) {

      awardPoints(
        150,
        "GOAL"
      );

    } else {

      awardOpponentPoints(150);
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


  sendNetworkState();


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
   RESET / COUNTDOWN
========================================================= */

function resetPositions() {

  player.reset();
  bot.reset();
  ball.reset();

  saveDangerHandled = false;
}


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
    setInterval(() => {

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
   FIN DU MATCH
========================================================= */

function endMatch(
  conceded = false
) {

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


  if (
    gameMode === "multiplayer"
  ) {

    sendNetworkState();
  }


  const local =
    localTeam();

  let winner;


  if (conceded) {

    winner =
      local === "blue"
        ? "ORANGE WINS"
        : "BLUE WINS";

  } else if (
    blueScore > orangeScore
  ) {

    winner = "BLUE WINS";

  } else if (
    orangeScore > blueScore
  ) {

    winner = "ORANGE WINS";

  } else {

    winner = "DRAW";
  }


  setText(
    winnerDisplay,
    winner
  );


  if (winnerDisplay) {

    winnerDisplay.style.color =
      winner.startsWith("BLUE")
        ? "#43cfff"
        : winner.startsWith("ORANGE")
          ? "#ff8a20"
          : "#fff";
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
   DÉMARRAGE MATCH
========================================================= */

function startMatch() {

  if (
    gameMode === "multiplayer" &&
    !onlineConnected
  ) {

    showNetworkStatus(
      "CONNEXION AU SERVEUR..."
    );

    connectOnline(true);

    return;
  }


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
  demoParticles.length = 0;


  goalFlash = 0;
  demoFlash = 0;


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

  if (
    socket &&
    onlineConnected
  ) {

    try {

      socket.send(
        JSON.stringify({
          type: "leave-match"
        })
      );

    } catch {}
  }


  gameRunning = false;
  paused = false;
  goalActive = false;


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


$("concedeButton")?.addEventListener(
  "click",
  () => {

    if (gameRunning) {

      concedeConfirm?.classList.remove(
        "hidden"
      );
    }
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
   PARAMÈTRES
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

  updateMobileSettings();
}


$("settingsBackButton")?.addEventListener(
  "click",
  () => {

    settingsMenu?.classList.add(
      "hidden"
    );


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


/* =========================================================
   COMMENT JOUER
========================================================= */

$("howToPlayButton")?.addEventListener(
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


$("backButton")?.addEventListener(
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


/* =========================================================
   REMAPPING CLAVIER
========================================================= */

for (
  const action of Object.keys(keyButtons)
) {

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

    controls = {
      ...defaults
    };

    saveControls();

    updateControlUI();
  }
);


document.addEventListener(
  "keydown",
  e => {

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

      const newKey =
        normalizedKey(e);


      if (
        !newKey ||
        newKey === "p" ||
        newKey === "escape"
      ) {
        return;
      }


      const alreadyUsed =
        Object.keys(controls).some(
          other =>
            other !== action &&
            controls[other] === newKey
        );


      if (alreadyUsed) {
        return;
      }


      controls[action] =
        newKey;

      saveControls();

      updateControlUI();

      waitingForAction = null;

      return;
    }


    const k =
      normalizedKey(e);


    if (k === "space") {
      e.preventDefault();
    }


    if (
      gameRunning &&
      !goalActive &&
      k === "p" &&
      !mobileMode
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


/* =========================================================
   APPAREIL / MOBILE
========================================================= */

function ensureMobileSystem() {

  /*
    CSS dynamique
  */

  const style =
    document.createElement("style");

  style.textContent = `

    #deviceChooser {
      position: fixed;
      inset: 0;
      background: rgba(2,8,16,.97);
      z-index: 9999;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
    }

    #deviceChooser.hidden {
      display: none;
    }

    .device-box {
      text-align: center;
      padding: 35px;
      border: 1px solid #36d8ff;
      border-radius: 20px;
      box-shadow:
        0 0 40px rgba(0,200,255,.2);
      background: #081522;
    }

    .device-box h1 {
      margin-bottom: 25px;
    }

    .device-box button,
    .online-btn,
    .mobile-boost-btn,
    .mobile-pause-btn {
      border: 1px solid #36d8ff;
      background: #0a2030;
      color: #fff;
      border-radius: 12px;
      padding: 14px 22px;
      font-weight: 800;
      cursor: pointer;
      margin: 6px;
    }

    .online-status {
      font-size: 13px;
      margin-top: 10px;
      color: #7deaff;
    }

    .mobile-controls {
      position: fixed;
      inset: 0;
      z-index: 20;
      pointer-events: none;
    }

    .mobile-controls.hidden {
      display: none;
    }

    .mobile-touchpad {
      position: absolute;
      inset: 0;
      pointer-events: auto;
      touch-action: none;
      background: transparent;
    }

    .mobile-boost-btn,
    .mobile-pause-btn {
      position: absolute;
      z-index: 21;
      pointer-events: auto;
      background:
        rgba(5,25,40,.78);
      box-shadow:
        0 0 25px rgba(0,200,255,.25);
    }

    .mobile-boost-btn {
      width: 92px;
      height: 92px;
      border-radius: 50%;
      font-size: 15px;
    }

    .mobile-pause-btn {
      top: 15px;
      right: 15px;
      width: 58px;
      height: 58px;
      border-radius: 50%;
    }

    .mobile-boost-btn.left {
      left: 20px;
      bottom: 22px;
    }

    .mobile-boost-btn.right {
      right: 20px;
      bottom: 22px;
    }

    .mobile-settings-row {
      margin-top: 18px;
      padding-top: 12px;
      border-top:
        1px solid rgba(255,255,255,.12);
    }

    .mobile-settings-row button {
      padding: 9px 12px;
    }

  `;

  document.head.appendChild(style);


  /*
    Choix PC / MOBILE
  */

  let chooser =
    document.getElementById(
      "deviceChooser"
    );


  if (!chooser) {

    chooser =
      document.createElement("div");

    chooser.id =
      "deviceChooser";


    chooser.innerHTML = `
      <div class="device-box">
        <h1>ROCKET LEAGUE.IO</h1>
        <p>CHOISIS TON APPAREIL</p>

        <button id="devicePC">
          💻 PC
        </button>

        <button id="deviceMobile">
          📱 MOBILE
        </button>
      </div>
    `;


    document.body.appendChild(
      chooser
    );
  }


  $("#devicePC").onclick =
    () => setDevice("pc");

  $("#deviceMobile").onclick =
    () => setDevice("mobile");


  /*
    Contrôles mobiles
  */

  let mobileControls =
    document.getElementById(
      "mobileControls"
    );


  if (!mobileControls) {

    mobileControls =
      document.createElement("div");

    mobileControls.id =
      "mobileControls";

    mobileControls.className =
      "mobile-controls";


    mobileControls.innerHTML = `
      <div
        id="mobileTouchpad"
        class="mobile-touchpad">
      </div>

      <button
        id="mobilePause"
        class="mobile-pause-btn">
        Ⅱ
      </button>

      <button
        id="mobileBoost"
        class="mobile-boost-btn">
        BOOST
      </button>
    `;


    document.body.appendChild(
      mobileControls
    );
  }


  const pad =
    $("mobileTouchpad");


  const stopTouch = () => {

    mobileTouch.active = false;

    mobileTouch.x =
      mobileTouch.cx;

    mobileTouch.y =
      mobileTouch.cy;
  };


  pad.addEventListener(
    "pointerdown",
    e => {

      mobileTouch.active = true;

      mobileTouch.cx =
        e.clientX;

      mobileTouch.cy =
        e.clientY;

      mobileTouch.x =
        e.clientX;

      mobileTouch.y =
        e.clientY;


      pad.setPointerCapture?.(
        e.pointerId
      );
    }
  );


  pad.addEventListener(
    "pointermove",
    e => {

      if (
        mobileTouch.active
      ) {

        mobileTouch.x =
          e.clientX;

        mobileTouch.y =
          e.clientY;
      }
    }
  );


  pad.addEventListener(
    "pointerup",
    stopTouch
  );

  pad.addEventListener(
    "pointercancel",
    stopTouch
  );


  const boostButton =
    $("mobileBoost");


  boostButton.addEventListener(
    "pointerdown",
    e => {

      e.preventDefault();

      mobileBoost = true;
    }
  );


  boostButton.addEventListener(
    "pointerup",
    () => {

      mobileBoost = false;
    }
  );


  boostButton.addEventListener(
    "pointercancel",
    () => {

      mobileBoost = false;
    }
  );


  $("mobilePause").addEventListener(
    "click",
    togglePause
  );
}


function setDevice(mode) {

  deviceMode = mode;

  mobileMode =
    mode === "mobile";


  localStorage.setItem(
    "rocketleague-device-mode",
    mode
  );


  $("#deviceChooser")?.classList.add(
    "hidden"
  );


  $("#mobileControls")?.classList.toggle(
    "hidden",
    !mobileMode
  );


  updateMobileSettings();

  updateBoostSide();
}


function showDeviceChooser() {

  $("#deviceChooser")?.classList.remove(
    "hidden"
  );


  $("#mobileControls")?.classList.add(
    "hidden"
  );
}


/* =========================================================
   SETTINGS MOBILE
========================================================= */

function updateMobileSettings() {

  if (!settingsMenu) {
    return;
  }


  let box =
    document.getElementById(
      "mobileSettingsBox"
    );


  if (!box) {

    box =
      document.createElement("div");

    box.id =
      "mobileSettingsBox";

    box.className =
      "mobile-settings-row";

    settingsMenu.appendChild(
      box
    );
  }


  box.innerHTML = `

    <b>📱 MOBILE</b>
    <br>

    <button id="boostLeftBtn">
      BOOST GAUCHE
    </button>

    <button id="boostRightBtn">
      BOOST DROITE
    </button>

    <button id="resetMobileButton">
      RESET MOBILE
    </button>
  `;


  box.style.display =
    mobileMode
      ? "block"
      : "none";


  $("#boostLeftBtn")?.addEventListener(
    "click",
    () => {

      mobileBoostSide = "left";

      localStorage.setItem(
        "rocketleague-mobile-boost-side",
        "left"
      );

      updateBoostSide();
    }
  );


  $("#boostRightBtn")?.addEventListener(
    "click",
    () => {

      mobileBoostSide = "right";

      localStorage.setItem(
        "rocketleague-mobile-boost-side",
        "right"
      );

      updateBoostSide();
    }
  );


  $("#resetMobileButton")?.addEventListener(
    "click",
    () => {

      mobileBoostSide = "left";

      localStorage.setItem(
        "rocketleague-mobile-boost-side",
        "left"
      );

      updateBoostSide();
    }
  );


  updateBoostSide();
}


function updateBoostSide() {

  const button =
    $("mobileBoost");

  if (!button) {
    return;
  }


  button.classList.remove(
    "left",
    "right"
  );


  button.classList.add(
    mobileBoostSide
  );
}


/* =========================================================
   MENU ONLINE
========================================================= */

function setupOnlineMenu() {

  const offlineButton =
    $("playButton");


  if (!offlineButton) {
    return;
  }


  if (
    document.getElementById(
      "onlinePlayButton"
    )
  ) {
    return;
  }


  const onlineButton =
    offlineButton.cloneNode(true);


  onlineButton.id =
    "onlinePlayButton";

  onlineButton.textContent =
    "1V1 EN LIGNE";


  offlineButton.parentNode?.insertBefore(
    onlineButton,
    offlineButton
  );


  offlineButton.textContent =
    "JEU HORS LIGNE";


  const status =
    document.createElement("div");


  status.id =
    "onlineStatus";

  status.className =
    "online-status";


  offlineButton.parentNode?.insertBefore(
    status,
    offlineButton.nextSibling
  );


  onlineButton.addEventListener(
    "click",
    startOnlineSearch
  );
}


function showNetworkStatus(text) {

  setText(
    $("onlineStatus"),
    text
  );
}


function startOffline() {

  gameMode = "offline";

  onlinePlayerNumber = 0;

  onlineMatchId = null;

  startMatch();
}


function startOnlineSearch() {

  gameMode = "multiplayer";

  gameRunning = false;

  showNetworkStatus(
    "RECHERCHE D'UN ADVERSAIRE..."
  );


  connectOnline(false);
}


/* =========================================================
   WEBSOCKET
========================================================= */

function connectOnline(
  startImmediately
) {

  if (
    socket &&
    socket.readyState ===
      WebSocket.OPEN
  ) {

    socket.send(
      JSON.stringify({
        type: "find-match"
      })
    );

    return;
  }


  try {

    socket =
      new WebSocket(
        ONLINE_SERVER_URL
      );

  } catch {

    showNetworkStatus(
      "SERVEUR INDISPONIBLE"
    );

    return;
  }


  socket.addEventListener(
    "open",
    () => {

      onlineConnected = true;


      showNetworkStatus(
        "RECHERCHE D'UN ADVERSAIRE..."
      );


      socket.send(
        JSON.stringify({
          type: "find-match"
        })
      );
    }
  );


  socket.addEventListener(
    "message",
    e => {

      let data;

      try {

        data =
          JSON.parse(
            e.data
          );

      } catch {

        return;
      }


      handleNetworkMessage(
        data
      );
    }
  );


  socket.addEventListener(
    "close",
    () => {

      onlineConnected = false;


      if (
        gameRunning &&
        gameMode ===
          "multiplayer"
      ) {

        showNetworkStatus(
          "ADVERSAIRE DÉCONNECTÉ"
        );

        endMatch(false);
      }
    }
  );


  socket.addEventListener(
    "error",
    () => {

      showNetworkStatus(
        "ERREUR SERVEUR"
      );
    }
  );
}


/* =========================================================
   RÉCEPTION ONLINE
========================================================= */

function handleNetworkMessage(data) {

  if (
    data.type === "connected"
  ) {
    return;
  }


  if (
    data.type === "searching"
  ) {

    showNetworkStatus(
      "RECHERCHE D'UN ADVERSAIRE..."
    );

    return;
  }


  if (
    data.type === "match-found"
  ) {

    onlineMatchId =
      data.matchId;

    onlinePlayerNumber =
      data.playerNumber;

    isOnlineHost =
      data.isHost;


    showNetworkStatus(
      `MATCH TROUVÉ — ${data.team.toUpperCase()}`
    );


    startMatch();

    return;
  }


  if (
    data.type ===
      "search-cancelled"
  ) {

    showNetworkStatus("");

    return;
  }


  if (
    data.type ===
      "opponent-input"
  ) {

    opponentInput =
      data.input || {};

    return;
  }


  if (
    data.type ===
      "game-state" &&
    !isOnlineHost
  ) {

    applyNetworkState(
      data.state
    );

    return;
  }


  if (
    data.type ===
      "opponent-left"
  ) {

    showNetworkStatus(
      "ADVERSAIRE DÉCONNECTÉ"
    );

    endMatch(false);
  }
}


/* =========================================================
   INPUT ONLINE
========================================================= */

function sendInput() {

  if (
    !onlineConnected ||
    !socket ||
    socket.readyState !==
      WebSocket.OPEN
  ) {
    return;
  }


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
      ) ||
      mobileBoost
  };


  try {

    socket.send(
      JSON.stringify({
        type: "input",
        input
      })
    );

  } catch {}
}


/* =========================================================
   ÉTAT ONLINE
========================================================= */

function sendNetworkState() {

  if (
    gameMode !==
      "multiplayer" ||
    !isOnlineHost ||
    !socket ||
    socket.readyState !==
      WebSocket.OPEN
  ) {
    return;
  }


  const state = {

    blue: {
      x: player.x,
      y: player.y,
      angle: player.angle,
      speed: player.speed,
      boost: player.boost,
      boosting: player.boosting,
      demolished:
        player.demolished,
      demoTimer:
        player.demoTimer
    },


    orange: {
      x: bot.x,
      y: bot.y,
      angle: bot.angle,
      speed: bot.speed,
      boost: bot.boost,
      boosting: bot.boosting,
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

    bluePoints:
      playerPoints,

    orangePoints:
      opponentPoints,

    gameRunning,
    paused,
    goalActive
  };


  try {

    socket.send(
      JSON.stringify({
        type: "game-state",
        state
      })
    );

  } catch {}
}


function applyNetworkState(state) {

  if (!state) {
    return;
  }


  const blue =
    state.blue || {};

  const orange =
    state.orange || {};

  const b =
    state.ball || {};


  Object.assign(
    player,
    {
      x:
        blue.x ??
        player.x,

      y:
        blue.y ??
        player.y,

      angle:
        blue.angle ??
        player.angle,

      speed:
        blue.speed ??
        player.speed,

      boost:
        blue.boost ??
        player.boost,

      boosting:
        !!blue.boosting,

      demolished:
        !!blue.demolished,

      demoTimer:
        blue.demoTimer ??
        0
    }
  );


  Object.assign(
    bot,
    {
      x:
        orange.x ??
        bot.x,

      y:
        orange.y ??
        bot.y,

      angle:
        orange.angle ??
        bot.angle,

      speed:
        orange.speed ??
        bot.speed,

      boost:
        orange.boost ??
        bot.boost,

      boosting:
        !!orange.boosting,

      demolished:
        !!orange.demolished,

      demoTimer:
        orange.demoTimer ??
        0
    }
  );


  Object.assign(
    ball,
    {
      x:
        b.x ??
        ball.x,

      y:
        b.y ??
        ball.y,

      vx:
        b.vx ??
        ball.vx,

      vy:
        b.vy ??
        ball.vy
    }
  );


  blueScore =
    state.blueScore ??
    blueScore;

  orangeScore =
    state.orangeScore ??
    orangeScore;


  gameTime =
    state.gameTime ??
    gameTime;


  if (
    onlinePlayerNumber === 2
  ) {

    playerPoints =
      state.orangePoints ??
      playerPoints;

    opponentPoints =
      state.bluePoints ??
      opponentPoints;

  } else {

    playerPoints =
      state.bluePoints ??
      playerPoints;

    opponentPoints =
      state.orangePoints ??
      opponentPoints;
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


  if (
    !gameRunning &&
    state.gameRunning
  ) {

    gameRunning = true;

    paused =
      !!state.paused;

    goalActive =
      !!state.goalActive;


    mainMenu?.classList.add(
      "hidden"
    );

    resultScreen?.classList.add(
      "hidden"
    );
  }
}


/* =========================================================
   ARENA
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


  /*
    Grille
  */

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


  /*
    Terrain
  */

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


  /*
    Ligne centrale
  */

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


  /*
    Cercle central
  */

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
    Cages visibles.
    Les zones de but restent invisibles.
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


/* =========================================================
   PADS VISUELS
========================================================= */

function drawBoostPads() {

  for (const pad of boostPads) {

    const available =
      pad.cooldown <= 0;

    const pulse =
      1 +
      Math.sin(
        pad.pulse
      ) * 0.08;


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


/* =========================================================
   PARTICULES VISUELLES
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

  drawParticles(
    demoParticles
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


  if (demoFlash > 0) {

    ctx.save();

    ctx.globalAlpha =
      demoFlash * 0.15;

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
    Math.abs(
      car.speed
    );


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


  /*
    Balle :
    9 unités = 216 km/h
  */

  const ballKmh =
    Math.round(
      Math.min(
        216,
        Math.hypot(
          ball.vx,
          ball.vy
        ) * 24
      )
    );


  setText(
    ballSpeedEl,
    ballKmh
  );
}


/* =========================================================
   OUTIL ROUND RECT
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
   BOUTONS PRINCIPAUX
========================================================= */

$("playButton")?.addEventListener(
  "click",
  startOffline
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


  /*
    ONLINE CLIENT
  */

  if (
    gameMode === "multiplayer" &&
    !isOnlineHost
  ) {
    /*
      Le client ne simule pas la physique.
      Il reçoit l'état du serveur.
    */
  }


  /*
    MATCH
  */

  if (
    gameRunning &&
    !paused &&
    !goalActive
  ) {


    /*
      OFFLINE
    */

    if (
      gameMode === "offline"
    ) {

      player.update(dt);

      bot.update(dt);

      ball.update();

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


    /*
      ONLINE HOST
    */

    else if (
      gameMode === "multiplayer" &&
      isOnlineHost
    ) {

      /*
        Joueur 1 = bleu
      */

      player.update(dt);


      /*
        Joueur 2 = orange.
        Le serveur utilise son input,
        pas l'IA.
      */

      bot.updateFromNetworkInput(
        opponentInput
      );


      ball.update();


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


      networkStateTimer += dt;


      /*
        Synchronisation fréquente
      */

      if (
        networkStateTimer >= 50
      ) {

        networkStateTimer = 0;

        sendNetworkState();
      }
    }


    /*
      ONLINE CLIENT
    */

    else {

      sendInput();
    }
  }


  /*
    Dessin
  */

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

ensureMobileSystem();

setupOnlineMenu();

updateControlUI();

updateMobileSettings();

updateBoostSide();

resetPoints();

updateTimerDisplay();

drawArena();

ball.draw();

player.draw();

bot.draw();

updateHUD();


/*
  Le choix PC / MOBILE
  revient à chaque lancement.
*/

showDeviceChooser();


/*
  Heartbeat serveur
*/

setInterval(
  () => {

    if (
      socket &&
      socket.readyState ===
        WebSocket.OPEN
    ) {

      try {

        socket.send(
          JSON.stringify({
            type: "ping"
          })
        );

      } catch {}
    }

  },
  10000
);


/*
  Lancement
*/

requestAnimationFrame(
  gameLoop
);
