const canvas = document.getElementById("gameCanvas");

if (!canvas) {
  throw new Error("gameCanvas introuvable dans index.html");
}

const ctx = canvas.getContext("2d");

/* =========================
   ELEMENTS
========================= */

const blueScoreEl = document.getElementById("blueScore");
const orangeScoreEl = document.getElementById("orangeScore");
const timerEl = document.getElementById("timer");

const goalMessage = document.getElementById("goalMessage");
const goalText = document.getElementById("goalText");
const goalScorer = document.getElementById("goalScorer");

const countdownEl = document.getElementById("countdown");

const pauseMenu = document.getElementById("pauseMenu");
const endScreen = document.getElementById("endScreen");
const winnerText = document.getElementById("winnerText");
const finalScore = document.getElementById("finalScore");

const boostFill = document.getElementById("boostFill");
const boostNumber = document.getElementById("boostNumber");
const speedNumber = document.getElementById("speedNumber");

const pointsPanel = document.getElementById("pointsPanel");
const playerPointsEl = document.getElementById("playerPoints");
const pointsNotification = document.getElementById("pointsNotification");

const mainMenu = document.getElementById("mainMenu");
const howToPlayMenu = document.getElementById("howToPlayMenu");
const matchIntro = document.getElementById("matchIntro");

const resultScreen = document.getElementById("resultScreen");
const winnerDisplay = document.getElementById("winnerDisplay");
const finalBlueScore = document.getElementById("finalBlueScore");
const finalOrangeScore = document.getElementById("finalOrangeScore");

const playButton = document.getElementById("playButton");
const howToPlayButton = document.getElementById("howToPlayButton");
const backButton = document.getElementById("backButton");
const playAgainButton = document.getElementById("playAgainButton");
const mainMenuButton = document.getElementById("mainMenuButton");

const resumeButton = document.getElementById("resumeButton");
const restartButton = document.getElementById("restartButton");

/* =========================
   ARENA
========================= */

const W = canvas.width;
const H = canvas.height;

const field = {
  left: 90,
  right: W - 90,
  top: 45,
  bottom: H - 45
};

const goal = {
  openingTop: 230,
  openingBottom: 470,
  depth: 70
};

/* =========================
   INVISIBLE GOAL ZONES
========================= */

const blueGoalZone = {
  x: field.left - goal.depth,
  y: goal.openingTop,
  width: goal.depth,
  height: goal.openingBottom - goal.openingTop
};

const orangeGoalZone = {
  x: field.right,
  y: goal.openingTop,
  width: goal.depth,
  height: goal.openingBottom - goal.openingTop
};

/* =========================
   SAVE ZONE
   Devant le but bleu.
   Elle ne rentre pas dans la cage.
========================= */

const saveZone = {
  x: field.left + 15,
  y: goal.openingTop + 15,
  width: 165,
  height: goal.openingBottom - goal.openingTop - 30
};

/* =========================
   BOOST PADS
========================= */

const BOOST_PICKUP_AMOUNT = 25;
const BOOST_PICKUP_COOLDOWN = 5;

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
    pulse: 1.2,
    flash: 0
  },
  {
    x: field.left + 85,
    y: field.bottom - 85,
    color: "#20cfff",
    cooldown: 2.4,
    pulse: 2.4,
    flash: 0
  },
  {
    x: field.right - 85,
    y: field.bottom - 85,
    color: "#ff8a18",
    cooldown: 3.6,
    pulse: 3.6,
    flash: 0
  },
  {
    x: W / 2,
    y: field.top + 55,
    color: "#65e8ff",
    cooldown: 1.8,
    pulse: 4.8,
    flash: 0
  },
  {
    x: W / 2,
    y: field.bottom - 55,
    color: "#baff35",
    cooldown: 4.2,
    pulse: 6,
    flash: 0
  }
];

const boostParticles = [];
const goalParticles = [];

/* =========================
   GAME STATE
========================= */

let blueScore = 0;
let orangeScore = 0;

let gameTime = 120;
let lastTime = performance.now();

let paused = false;
let gameRunning = false;
let goalActive = false;

let countdownInterval = null;
let countdownTimeout = null;
let matchIntroTimeout = null;
let goalTimeout = null;

let goalFlash = 0;

let playerPoints = 0;

let saveCooldown = 0;
let saveAwardedForDanger = false;

let pointsNotificationTimeout = null;

const keys = {};

/* =========================
   CONTROLS
========================= */

function getControlKey(event) {
  const key = event.key.toLowerCase();

  if (["z", "q", "s", "d", "p"].includes(key)) {
    return key;
  }

  if (event.code === "Space") {
    return "space";
  }

  return null;
}

document.addEventListener("keydown", event => {
  const controlKey = getControlKey(event);

  if (event.code === "Space") {
    event.preventDefault();
  }

  if (!gameRunning || goalActive) {
    return;
  }

  if (controlKey === "p") {
    paused = !paused;

    if (pauseMenu) {
      pauseMenu.classList.toggle("hidden", !paused);
    }

    clearKeys();
    return;
  }

  if (controlKey) {
    keys[controlKey] = true;
  }
});

document.addEventListener("keyup", event => {
  const controlKey = getControlKey(event);

  if (controlKey) {
    keys[controlKey] = false;
  }
});

window.addEventListener("blur", clearKeys);

function clearKeys() {
  Object.keys(keys).forEach(key => {
    keys[key] = false;
  });
}

/* =========================
   POINTS
========================= */

function updatePointsDisplay() {
  if (playerPointsEl) {
    playerPointsEl.textContent = playerPoints;
  }
}

function showPointsNotification(text) {
  if (!pointsNotification) return;

  clearTimeout(pointsNotificationTimeout);

  pointsNotification.textContent = text;

  pointsNotification.classList.remove("show");

  void pointsNotification.offsetWidth;

  pointsNotification.classList.add("show");

  pointsNotificationTimeout = setTimeout(() => {
    pointsNotification.classList.remove("show");
    pointsNotificationTimeout = null;
  }, 1200);
}

function awardPoints(amount, reason) {
  playerPoints += amount;

  updatePointsDisplay();

  if (pointsPanel) {
    pointsPanel.classList.remove("earned");

    void pointsPanel.offsetWidth;

    pointsPanel.classList.add("earned");
  }

  showPointsNotification(`+${amount} ${reason}`);
}

function resetPointState() {
  playerPoints = 0;

  saveCooldown = 0;
  saveAwardedForDanger = false;

  updatePointsDisplay();

  if (pointsPanel) {
    pointsPanel.classList.remove("earned");
  }

  clearTimeout(pointsNotificationTimeout);

  if (pointsNotification) {
    pointsNotification.classList.remove("show");
    pointsNotification.textContent = "";
  }
}

/* =========================
   CAR
========================= */

class Car {

  constructor(x, y, color, isBot = false) {

    this.x = x;
    this.y = y;

    this.startX = x;
    this.startY = y;

    this.color = color;
    this.isBot = isBot;

    this.angle = isBot ? Math.PI : 0;

    this.speed = 0;

    this.radius = 25;

    this.acceleration = 0.18;
    this.reverseAcceleration = 0.12;

    /*
    7.2 = vitesse normale maximale.
    Le boost permet d'aller plus vite.
    */

    this.maxSpeed = 7.2;
    this.boostMaxSpeed = 11.7;

    this.maxReverse = -3.2;

    this.turnSpeed = 0.055;

    this.boost = 100;

    this.boosting = false;

    this.ballContact = false;

    /* IA */
    this.aiBoostTarget = null;
    this.aiBoostTimer = 0;
  }

  reset() {

    this.x = this.startX;
    this.y = this.startY;

    this.speed = 0;

    this.angle = this.isBot ? Math.PI : 0;

    this.boost = 100;

    this.boosting = false;

    this.ballContact = false;

    this.aiBoostTarget = null;
    this.aiBoostTimer = 0;
  }

  update() {

    if (this.isBot) {
      this.updateBot();
    } else {
      this.updatePlayer();
    }

    this.x += Math.cos(this.angle) * this.speed;
    this.y += Math.sin(this.angle) * this.speed;

    this.speed *= 0.985;

    if (Math.abs(this.speed) < 0.02) {
      this.speed = 0;
    }

    this.keepInsideField();

    /*
    Recharge lente naturelle.
    */

    this.boost = Math.min(
      100,
      this.boost + 0.025
    );
  }

  /* =========================
     PLAYER
  ========================= */

  updatePlayer() {

    this.boosting = false;

    /* Z = avancer */

    if (keys["z"]) {
      this.speed += this.acceleration;
    }

    /* S = reculer / freiner */

    if (keys["s"]) {

      if (this.speed > 0) {
        this.speed -= 0.25;
      } else {
        this.speed -= this.reverseAcceleration;
      }
    }

    /* Q = gauche */

    if (keys["q"]) {

      const direction =
        this.speed >= 0 ? 1 : -1;

      this.angle -=
        this.turnSpeed *
        Math.min(
          Math.abs(this.speed) / 2 + 0.3,
          1
        ) *
        direction;
    }

    /* D = droite */

    if (keys["d"]) {

      const direction =
        this.speed >= 0 ? 1 : -1;

      this.angle +=
        this.turnSpeed *
        Math.min(
          Math.abs(this.speed) / 2 + 0.3,
          1
        ) *
        direction;
    }

    /* SPACE = BOOST */

    if (
      keys.space &&
      this.boost > 0 &&
      this.speed > 0
    ) {

      this.speed += 0.28;

      this.boost -= 0.7;

      this.boosting = true;
    }

    const currentMax =
      this.boosting
        ? this.boostMaxSpeed
        : this.maxSpeed;

    this.speed = Math.max(
      this.maxReverse,
      Math.min(
        this.speed,
        currentMax
      )
    );
  }

  /* =========================
     IA
  ========================= */

  updateBot() {

    const distanceToBall =
      Math.hypot(
        ball.x - this.x,
        ball.y - this.y
      );

    const ballSpeed =
      Math.hypot(
        ball.vx,
        ball.vy
      );

    /*
    Le but de l'Orange est à droite.
    Le but du joueur est à gauche.
    */

    const ballNearBlueGoal =
      ball.x < W * 0.42;

    const ballNearOrangeGoal =
      ball.x > W * 0.58;

    const dangerousForOrange =
      ball.x > field.right - 260 &&
      ball.vx > 0;

    let targetX = ball.x;
    let targetY = ball.y;

    /*
    =================================
    1. DÉFENSE
    =================================
    */

    if (
      dangerousForOrange ||
      ballNearOrangeGoal
    ) {

      /*
      L'IA se place entre la balle
      et son propre but.
      */

      targetX =
        Math.max(
          field.right - 180,
          ball.x + 45
        );

      targetY =
        H / 2 +
        (ball.y - H / 2) * 0.55;

    }

    /*
    =================================
    2. ATTAQUE
    =================================
    */

    else {

      /*
      Quand la balle est proche du
      but bleu, l'IA attaque directement.
      */

      if (ballNearBlueGoal) {

        targetX = ball.x - 35;
        targetY = ball.y;

      } else {

        /*
        Elle vise la balle normalement.
        */

        targetX = ball.x;
        targetY = ball.y;
      }
    }

    /*
    =================================
    3. ALLER CHERCHER DU BOOST
    =================================
    */

    this.aiBoostTimer -= 1 / 60;

    const shouldGetBoost =
      this.boost < 25 &&
      distanceToBall > 180 &&
      !dangerousForOrange;

    if (shouldGetBoost) {

      /*
      Cherche le meilleur pad disponible.
      */

      let nearestPad = null;
      let nearestDistance = Infinity;

      boostPads.forEach(pad => {

        if (pad.cooldown > 0) {
          return;
        }

        const distance =
          Math.hypot(
            pad.x - this.x,
            pad.y - this.y
          );

        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestPad = pad;
        }
      });

      if (nearestPad) {

        this.aiBoostTarget = nearestPad;

        targetX = nearestPad.x;
        targetY = nearestPad.y;
      }

    } else {

      this.aiBoostTarget = null;
    }

    /*
    =================================
    4. DIRECTION
    =================================
    */

    const dx =
      targetX - this.x;

    const dy =
      targetY - this.y;

    const targetAngle =
      Math.atan2(dy, dx);

    let angleDifference =
      targetAngle - this.angle;

    while (angleDifference > Math.PI) {
      angleDifference -= Math.PI * 2;
    }

    while (angleDifference < -Math.PI) {
      angleDifference += Math.PI * 2;
    }

    /*
    Rotation progressive.
    */

    const rotation =
      this.turnSpeed * 1.25;

    if (angleDifference > 0.05) {
      this.angle += rotation;
    }

    if (angleDifference < -0.05) {
      this.angle -= rotation;
    }

    /*
    =================================
    5. BOOST IA
    =================================
    */

    this.boosting = false;

    const aligned =
      Math.abs(angleDifference) < 0.30;

    const farAway =
      distanceToBall > 240;

    const attacking =
      ballNearBlueGoal &&
      this.x > ball.x;

    const goingToBoost =
      this.aiBoostTarget !== null;

    if (
      this.boost > 5 &&
      aligned &&
      (
        farAway ||
        attacking ||
        goingToBoost
      )
    ) {

      this.boosting = true;

      this.boost -= 0.55;
    }

    /*
    =================================
    6. ACCÉLÉRATION IA
    =================================
    */

    if (this.boosting) {

      this.speed += 0.25;

    } else {

      this.speed += 0.15;
    }

    const aiMaxSpeed =
      this.boosting
        ? 9.5
        : 6.7;

    this.speed =
      Math.min(
        this.speed,
        aiMaxSpeed
      );

    /*
    =================================
    7. SI L'IA EST PROCHE DU PAD
    =================================
    */

    if (this.aiBoostTarget) {

      const padDistance =
        Math.hypot(
          this.aiBoostTarget.x - this.x,
          this.aiBoostTarget.y - this.y
        );

      if (padDistance < this.radius + 22) {

        if (
          this.aiBoostTarget.cooldown <= 0
        ) {

          this.boost =
            Math.min(
              100,
              this.boost +
              BOOST_PICKUP_AMOUNT
            );

          this.aiBoostTarget.cooldown =
            BOOST_PICKUP_COOLDOWN;

          this.aiBoostTarget.flash = 1;

          spawnBoostParticles(
            this.aiBoostTarget
          );
        }

        this.aiBoostTarget = null;
      }
    }
  }

  /* =========================
     LIMITES
  ========================= */

  keepInsideField() {

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

  /* =========================
     DRAW CAR
  ========================= */

  draw() {

    ctx.save();

    ctx.translate(
      this.x,
      this.y
    );

    ctx.rotate(this.angle);

    /* Boost trail */

    if (this.boosting) {

      ctx.fillStyle =
        "rgba(80,220,255,0.7)";

      ctx.beginPath();

      ctx.moveTo(-38, -12);

      ctx.lineTo(
        -65 - Math.random() * 20,
        0
      );

      ctx.lineTo(-38, 12);

      ctx.fill();
    }

    /* Ombre / glow */

    ctx.shadowColor =
      this.color;

    ctx.shadowBlur = 20;

    /* Corps */

    ctx.fillStyle =
      this.color;

    roundRect(
      ctx,
      -28,
      -17,
      56,
      34,
      10
    );

    ctx.fill();

    /* Toit */

    ctx.fillStyle =
      "#08101a";

    roundRect(
      ctx,
      -5,
      -12,
      24,
      24,
      7
    );

    ctx.fill();

    /* Phares */

    ctx.fillStyle =
      "#ffffff";

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

    /* Roues */

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

/* =========================
   BALL
========================= */

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

    if (Math.abs(this.vx) < 0.01) {
      this.vx = 0;
    }

    if (Math.abs(this.vy) < 0.01) {
      this.vy = 0;
    }

    /* Vitesse maximale */

    const speed =
      Math.hypot(
        this.vx,
        this.vy
      );

    const maxBallSpeed = 9;

    if (speed > maxBallSpeed) {

      this.vx =
        this.vx /
        speed *
        maxBallSpeed;

      this.vy =
        this.vy /
        speed *
        maxBallSpeed;
    }

    this.checkGoal();

    if (!goalActive) {
      this.wallCollision();
    }
  }

  checkGoal() {

    /* BUT BLEU */

    if (
      this.x - this.radius <= field.left &&
      this.y > goal.openingTop &&
      this.y < goal.openingBottom
    ) {

      scoreGoal("orange");

      return;
    }

    /* BUT ORANGE */

    if (
      this.x + this.radius >= field.right &&
      this.y > goal.openingTop &&
      this.y < goal.openingBottom
    ) {

      scoreGoal("blue");
    }
  }

  wallCollision() {

    /* Haut */

    if (
      this.y - this.radius < field.top
    ) {

      this.y =
        field.top +
        this.radius;

      this.vy *= -0.8;
    }

    /* Bas */

    if (
      this.y + this.radius > field.bottom
    ) {

      this.y =
        field.bottom -
        this.radius;

      this.vy *= -0.8;
    }

    const insideGoalOpening =
      this.y > goal.openingTop &&
      this.y < goal.openingBottom;

    /* Gauche */

    if (
      this.x - this.radius < field.left &&
      !insideGoalOpening
    ) {

      this.x =
        field.left +
        this.radius;

      this.vx *= -0.8;
    }

    /* Droite */

    if (
      this.x + this.radius > field.right &&
      !insideGoalOpening
    ) {

      this.x =
        field.right -
        this.radius;

      this.vx *= -0.8;
    }

    /* Fond du but bleu */

    if (
      this.x <
      field.left -
      goal.depth +
      this.radius &&
      insideGoalOpening
    ) {

      this.x =
        field.left -
        goal.depth +
        this.radius;

      this.vx *= -0.7;
    }

    /* Fond du but orange */

    if (
      this.x >
      field.right +
      goal.depth -
      this.radius &&
      insideGoalOpening
    ) {

      this.x =
        field.right +
        goal.depth -
        this.radius;

      this.vx *= -0.7;
    }
  }

  draw() {

    ctx.save();

    /* Ombre */

    ctx.fillStyle =
      "rgba(0,0,0,0.35)";

    ctx.beginPath();

    ctx.ellipse(
      this.x + 6,
      this.y + 8,
      this.radius,
      this.radius * 0.45,
      0,
      0,
      Math.PI * 2
    );

    ctx.fill();

    /* Glow */

    ctx.shadowColor =
      "#ffffff";

    ctx.shadowBlur = 20;

    /* Ball */

    const gradient =
      ctx.createRadialGradient(
        this.x - 5,
        this.y - 5,
        2,
        this.x,
        this.y,
        this.radius
      );

    gradient.addColorStop(
      0,
      "#ffffff"
    );

    gradient.addColorStop(
      0.5,
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

/* =========================
   OBJECTS
========================= */

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

/* =========================
   SAVE SYSTEM
========================= */

function isPlayerInSaveZone() {

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

function isBallDangerousForBlueGoal() {

  const insideGoalLane =
    ball.y + ball.radius >
      goal.openingTop &&
    ball.y - ball.radius <
      goal.openingBottom;

  const closeToBlueGoal =
    ball.x <
    field.left + 250;

  const movingTowardBlueGoal =
    ball.vx < -0.1;

  const alreadyAtGoalLine =
    ball.x <
    field.left + 110;

  return (
    insideGoalLane &&
    closeToBlueGoal &&
    (
      movingTowardBlueGoal ||
      alreadyAtGoalLine
    )
  );
}

function updateSaveState(delta) {

  const seconds =
    Math.min(
      delta / 1000,
      0.1
    );

  saveCooldown =
    Math.max(
      0,
      saveCooldown -
      seconds
    );

  /*
  Lorsque la balle n'est plus dangereuse,
  une nouvelle sauvegarde peut être obtenue.
  */

  if (
    !isBallDangerousForBlueGoal()
  ) {

    saveAwardedForDanger = false;
  }
}

/*
Cette fonction est appelée AVANT
la modification de vitesse de la balle.
*/

function tryAwardSave(
  car,
  wasDangerousBeforeCollision
) {

  if (
    car !== player ||
    saveAwardedForDanger ||
    saveCooldown > 0 ||
    !isPlayerInSaveZone() ||
    !wasDangerousBeforeCollision
  ) {

    return;
  }

  /*
  Vérification supplémentaire :
  la balle doit vraiment être proche
  de la voiture.
  */

  const distance =
    Math.hypot(
      ball.x - car.x,
      ball.y - car.y
    );

  if (distance > 90) {
    return;
  }

  saveAwardedForDanger = true;

  saveCooldown = 4;

  /*
  Repousse la balle vers le terrain.
  */

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

/* =========================
   COLLISION VOITURE / BALLE
========================= */

function carBallCollision(car) {

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
    distance >= minDistance
  ) {

    car.ballContact = false;

    return;
  }

  /*
  IMPORTANT :
  On vérifie la situation avant
  de modifier la balle.
  */

  const dangerousBeforeCollision =
    car === player &&
    isBallDangerousForBlueGoal();

  const newContact =
    !car.ballContact;

  car.ballContact = true;

  /*
  +2 seulement au début d'un contact.
  */

  if (
    car === player &&
    newContact
  ) {

    awardPoints(
      2,
      "BALL TOUCH"
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

  /*
  Puissance de frappe.
  */

  const hitForce =
    Math.min(
      Math.abs(car.speed) * 1.15 + 1.2,
      7
    );

  ball.vx +=
    nx * hitForce;

  ball.vy +=
    ny * hitForce;

  /*
  Direction de la voiture.
  */

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
  SAVE après avoir enregistré
  l'état dangereux précédent.
  */

  if (
    car === player &&
    newContact
  ) {

    tryAwardSave(
      car,
      dangerousBeforeCollision
    );
  }
}

/* =========================
   COLLISION VOITURE / VOITURE
========================= */

function carCarCollision(a, b) {

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
    distance >= minDistance
  ) {

    return;
  }

  const nx =
    dx / distance;

  const ny =
    dy / distance;

  const overlap =
    minDistance -
    distance;

  a.x -=
    nx * overlap / 2;

  a.y -=
    ny * overlap / 2;

  b.x +=
    nx * overlap / 2;

  b.y +=
    ny * overlap / 2;

  const temp =
    a.speed;

  a.speed =
    b.speed * 0.55;

  b.speed =
    temp * 0.55;

  a.keepInsideField();
  b.keepInsideField();
}

/* =========================
   BOOST PARTICLES
========================= */

function spawnBoostParticles(pad) {

  for (
    let i = 0;
    i < 10;
    i++
  ) {

    const angle =
      (
        Math.PI * 2 * i
      ) / 10;

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

/* =========================
   BOOST UPDATE
========================= */

function updateBoostPickups(delta) {

  const seconds =
    Math.min(
      delta / 1000,
      0.1
    );

  boostPads.forEach(pad => {

    pad.cooldown =
      Math.max(
        0,
        pad.cooldown -
        seconds
      );

    pad.pulse +=
      seconds * 2.4;

    pad.flash =
      Math.max(
        0,
        pad.flash -
        seconds * 2.5
      );
  });

  if (
    !gameRunning ||
    paused ||
    goalActive
  ) {

    return;
  }

  /*
  BOOST DU JOUEUR
  */

  boostPads.forEach(pad => {

    const distance =
      Math.hypot(
        player.x - pad.x,
        player.y - pad.y
      );

    if (
      pad.cooldown <= 0 &&
      distance <
        player.radius + 22
    ) {

      player.boost =
        Math.min(
          100,
          player.boost +
          BOOST_PICKUP_AMOUNT
        );

      pad.cooldown =
        BOOST_PICKUP_COOLDOWN;

      pad.flash = 1;

      spawnBoostParticles(pad);
    }
  });
}

/* =========================
   GOAL PARTICLES
========================= */

function spawnGoalParticles(team) {

  const color =
    team === "blue"
      ? "#43d9ff"
      : "#ff9d2e";

  for (
    let i = 0;
    i < 28;
    i++
  ) {

    const angle =
      Math.random() *
      Math.PI * 2;

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

/* =========================
   EFFECTS
========================= */

function updateEffects(delta) {

  const seconds =
    Math.min(
      delta / 1000,
      0.1
    );

  goalFlash =
    Math.max(
      0,
      goalFlash -
      seconds * 2.2
    );

  [
    boostParticles,
    goalParticles
  ].forEach(particles => {

    particles.forEach(particle => {

      particle.x +=
        particle.vx;

      particle.y +=
        particle.vy;

      particle.vx *= 0.97;
      particle.vy *= 0.97;

      particle.life -=
        seconds;
    });

    for (
      let i =
        particles.length - 1;
      i >= 0;
      i--
    ) {

      if (
        particles[i].life <= 0
      ) {

        particles.splice(
          i,
          1
        );
      }
    }
  });
}

/* =========================
   GOAL SYSTEM
========================= */

function scoreGoal(team) {

  if (goalActive) {
    return;
  }

  goalActive = true;

  clearTimeout(goalTimeout);

  clearKeys();

  goalFlash = 1;

  spawnGoalParticles(team);

  if (team === "blue") {

    blueScore++;

    if (blueScoreEl) {
      blueScoreEl.textContent =
        blueScore;
    }

    /*
    +150 uniquement pour
    le joueur bleu.
    */

    awardPoints(
      150,
      "GOAL"
    );

    if (goalText) {

      goalText.textContent =
        "GOAL!";

      goalText.style.color =
        "#43d9ff";

      goalText.style.textShadow =
        "0 0 25px #00aaff, 0 0 80px #0077ff";
    }

    if (goalScorer) {

      goalScorer.textContent =
        "BLUE UNIT SCORES";
    }

  } else {

    orangeScore++;

    if (orangeScoreEl) {
      orangeScoreEl.textContent =
        orangeScore;
    }

    if (goalText) {

      goalText.textContent =
        "GOAL!";

      goalText.style.color =
        "#ff9d2e";

      goalText.style.textShadow =
        "0 0 25px #ff6600, 0 0 80px #ff3300";
    }

    if (goalScorer) {

      goalScorer.textContent =
        "ORANGE CREW SCORES";
    }
  }

  if (goalMessage) {
    goalMessage.classList.remove("hidden");
  }

  goalTimeout =
    setTimeout(() => {

      if (goalMessage) {
        goalMessage.classList.add(
          "hidden"
        );
      }

      resetPositions();

      startCountdown();

      goalTimeout = null;

    }, 1800);
}

/* =========================
   RESET POSITIONS
========================= */

function resetPositions() {

  player.reset();

  bot.reset();

  ball.reset();

  saveAwardedForDanger = false;
}

/* =========================
   COUNTDOWN
========================= */

function startCountdown() {

  clearInterval(
    countdownInterval
  );

  clearTimeout(
    countdownTimeout
  );

  let count = 3;

  goalActive = true;

  if (countdownEl) {

    countdownEl.classList.remove(
      "hidden"
    );

    countdownEl.textContent =
      count;
  }

  countdownInterval =
    setInterval(() => {

      count--;

      if (count > 0) {

        if (countdownEl) {
          countdownEl.textContent =
            count;
        }

      } else {

        clearInterval(
          countdownInterval
        );

        countdownInterval = null;

        if (countdownEl) {
          countdownEl.textContent =
            "GO!";
        }

        countdownTimeout =
          setTimeout(() => {

            if (countdownEl) {
              countdownEl.classList.add(
                "hidden"
              );
            }

            goalActive = false;

            countdownTimeout = null;

          }, 700);
      }

    }, 1000);
}

/* =========================
   TIMER
========================= */

function updateTimer(delta) {

  if (
    !gameRunning ||
    paused ||
    goalActive
  ) {

    return;
  }

  gameTime -=
    delta / 1000;

  if (gameTime <= 0) {

    gameTime = 0;

    updateTimerDisplay();

    endMatch();

    return;
  }

  updateTimerDisplay();
}

function updateTimerDisplay() {

  if (!timerEl) {
    return;
  }

  const minutes =
    Math.floor(
      gameTime / 60
    );

  const seconds =
    Math.floor(
      gameTime % 60
    );

  timerEl.textContent =
    `${minutes}:${seconds
      .toString()
      .padStart(2, "0")}`;
}

/* =========================
   END MATCH
========================= */

function endMatch() {

  gameRunning = false;

  paused = false;

  goalActive = true;

  clearKeys();

  clearInterval(
    countdownInterval
  );

  clearTimeout(
    countdownTimeout
  );

  clearTimeout(
    matchIntroTimeout
  );

  clearTimeout(
    goalTimeout
  );

  if (pauseMenu) {
    pauseMenu.classList.add(
      "hidden"
    );
  }

  if (matchIntro) {
    matchIntro.classList.add(
      "hidden"
    );
  }

  if (endScreen) {
    endScreen.classList.add(
      "hidden"
    );
  }

  /*
  Gagnant.
  */

  if (blueScore > orangeScore) {

    if (winnerText) {
      winnerText.textContent =
        "BLUE UNIT WINS";

      winnerText.style.color =
        "#43d9ff";
    }

    if (winnerDisplay) {
      winnerDisplay.textContent =
        "BLUE WINS";

      winnerDisplay.style.color =
        "#43cfff";
    }

  } else if (
    orangeScore > blueScore
  ) {

    if (winnerText) {
      winnerText.textContent =
        "ORANGE CREW WINS";

      winnerText.style.color =
        "#ff9d2e";
    }

    if (winnerDisplay) {
      winnerDisplay.textContent =
        "ORANGE WINS";

      winnerDisplay.style.color =
        "#ff8a20";
    }

  } else {

    if (winnerText) {
      winnerText.textContent =
        "DRAW";

      winnerText.style.color =
        "#ffffff";
    }

    if (winnerDisplay) {
      winnerDisplay.textContent =
        "DRAW";

      winnerDisplay.style.color =
        "#ffffff";
    }
  }

  if (finalScore) {

    finalScore.textContent =
      `${blueScore} - ${orangeScore}`;
  }

  if (finalBlueScore) {
    finalBlueScore.textContent =
      blueScore;
  }

  if (finalOrangeScore) {
    finalOrangeScore.textContent =
      orangeScore;
  }

  /*
  Les points restent visibles
  jusqu'au résultat.
  */

  if (resultScreen) {
    resultScreen.classList.remove(
      "hidden"
    );
  }
}

/* =========================
   ARENA
========================= */

function drawArena() {

  /* Fond */

  ctx.fillStyle =
    "#06131f";

  ctx.fillRect(
    0,
    0,
    W,
    H
  );

  /* Grille */

  ctx.strokeStyle =
    "rgba(80,180,255,0.08)";

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

  /* Terrain */

  ctx.strokeStyle =
    "rgba(120,220,255,0.35)";

  ctx.lineWidth = 3;

  ctx.strokeRect(
    field.left,
    field.top,
    field.right -
      field.left,
    field.bottom -
      field.top
  );

  /* Ligne centrale */

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

  /* Cercle central */

  ctx.beginPath();

  ctx.arc(
    W / 2,
    H / 2,
    85,
    0,
    Math.PI * 2
  );

  ctx.stroke();

  /* Point central */

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

  /* =========================
     BUT BLEU
  ========================= */

  ctx.strokeStyle =
    "#18cfff";

  ctx.shadowColor =
    "#00aaff";

  ctx.shadowBlur = 20;

  ctx.lineWidth = 5;

  ctx.strokeRect(
    field.left -
      goal.depth,
    goal.openingTop,
    goal.depth,
    goal.openingBottom -
      goal.openingTop
  );

  /* =========================
     BUT ORANGE
  ========================= */

  ctx.strokeStyle =
    "#ff851b";

  ctx.shadowColor =
    "#ff5e00";

  ctx.strokeRect(
    field.right,
    goal.openingTop,
    goal.depth,
    goal.openingBottom -
      goal.openingTop
  );

  ctx.shadowBlur = 0;

  /* Ouverture bleue */

  ctx.strokeStyle =
    "#38dfff";

  ctx.beginPath();

  ctx.moveTo(
    field.left,
    goal.openingTop
  );

  ctx.lineTo(
    field.left,
    goal.openingBottom
  );

  ctx.stroke();

  /* Ouverture orange */

  ctx.strokeStyle =
    "#ff9b35";

  ctx.beginPath();

  ctx.moveTo(
    field.right,
    goal.openingTop
  );

  ctx.lineTo(
    field.right,
    goal.openingBottom
  );

  ctx.stroke();

  /* Boost */

  drawBoostPads();
}

/* =========================
   BOOST DRAW
========================= */

function drawBoostPads() {

  boostPads.forEach(
    drawBoostPad
  );

  drawParticles(
    boostParticles
  );
}

function drawBoostPad(pad) {

  const available =
    pad.cooldown <= 0;

  const pulse =
    1 +
    Math.sin(
      pad.pulse
    ) *
    0.08;

  const opacity =
    available
      ? 1
      : 0.35;

  ctx.save();

  ctx.translate(
    pad.x,
    pad.y
  );

  ctx.globalAlpha =
    opacity;

  ctx.shadowColor =
    pad.color;

  ctx.shadowBlur =
    available
      ? 22
      : 8;

  ctx.fillStyle =
    "rgba(8,18,30,0.9)";

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
    "#ffffff";

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

  ctx.globalAlpha =
    available
      ? 0.85
      : 0.25;

  ctx.strokeStyle =
    pad.color;

  ctx.lineWidth = 3;

  ctx.beginPath();

  const progress =
    available
      ? 1
      : 1 -
        pad.cooldown /
        BOOST_PICKUP_COOLDOWN;

  ctx.arc(
    0,
    0,
    31,
    -Math.PI / 2,
    -Math.PI / 2 +
      Math.PI * 2 *
      progress
  );

  ctx.stroke();

  if (pad.flash > 0) {

    ctx.globalAlpha =
      pad.flash;

    ctx.strokeStyle =
      "#ffffff";

    ctx.lineWidth = 4;

    ctx.beginPath();

    ctx.arc(
      0,
      0,
      32 +
        (1 -
          pad.flash) *
        18,
      0,
      Math.PI * 2
    );

    ctx.stroke();
  }

  ctx.restore();
}

/* =========================
   PARTICLES
========================= */

function drawParticles(
  particles
) {

  particles.forEach(
    particle => {

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
  );
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
      "#ffffff";

    ctx.fillRect(
      0,
      0,
      W,
      H
    );

    ctx.restore();
  }
}

/* =========================
   HUD
========================= */

function updateHUD() {

  if (boostFill) {

    boostFill.style.width =
      `${player.boost}%`;
  }

  if (boostNumber) {

    boostNumber.textContent =
      Math.floor(
        player.boost
      );
  }

  /*
  7.2 = 51 km/h
  11.7 = 83 km/h
  */

  const physicsSpeed =
    Math.abs(
      player.speed
    );

  let displayedSpeed;

  if (player.boosting) {

    displayedSpeed =
      Math.round(
        Math.min(
          83,
          physicsSpeed *
          (83 / 11.7)
        )
      );

  } else {

    displayedSpeed =
      Math.round(
        Math.min(
          51,
          physicsSpeed *
          (51 / 7.2)
        )
      );
  }

  if (speedNumber) {

    speedNumber.textContent =
      displayedSpeed;
  }
}

/* =========================
   ROUND RECT
========================= */

function roundRect(
  ctx,
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

/* =========================
   GAME LOOP
========================= */

function gameLoop(now) {

  const delta =
    Math.min(
      now - lastTime,
      100
    );

  lastTime = now;

  updateSaveState(delta);

  updateBoostPickups(delta);

  updateEffects(delta);

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

      updateTimer(delta);
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

/* =========================
   START MATCH
========================= */

function startMatch() {

  clearInterval(
    countdownInterval
  );

  clearTimeout(
    countdownTimeout
  );

  clearTimeout(
    matchIntroTimeout
  );

  clearTimeout(
    goalTimeout
  );

  clearKeys();

  resetPointState();

  boostParticles.length = 0;

  goalParticles.length = 0;

  goalFlash = 0;

  boostPads.forEach(
    pad => {

      pad.cooldown = 0;

      pad.flash = 0;
    }
  );

  blueScore = 0;

  orangeScore = 0;

  if (blueScoreEl) {
    blueScoreEl.textContent =
      "0";
  }

  if (orangeScoreEl) {
    orangeScoreEl.textContent =
      "0";
  }

  gameTime = 120;

  updateTimerDisplay();

  paused = false;

  gameRunning = true;

  goalActive = true;

  resetPositions();

  if (mainMenu) {
    mainMenu.classList.add(
      "hidden"
    );
  }

  if (howToPlayMenu) {
    howToPlayMenu.classList.add(
      "hidden"
    );
  }

  if (resultScreen) {
    resultScreen.classList.add(
      "hidden"
    );
  }

  if (endScreen) {
    endScreen.classList.add(
      "hidden"
    );
  }

  if (pauseMenu) {
    pauseMenu.classList.add(
      "hidden"
    );
  }

  if (matchIntro) {

    matchIntro.classList.remove(
      "hidden"
    );
  }

  matchIntroTimeout =
    setTimeout(() => {

      if (!gameRunning) {
        return;
      }

      if (matchIntro) {

        matchIntro.classList.add(
          "hidden"
        );
      }

      startCountdown();

      matchIntroTimeout = null;

    }, 900);
}

/* =========================
   MAIN MENU
========================= */

function showMainMenu() {

  clearInterval(
    countdownInterval
  );

  clearTimeout(
    countdownTimeout
  );

  clearTimeout(
    matchIntroTimeout
  );

  clearTimeout(
    goalTimeout
  );

  clearKeys();

  resetPointState();

  gameRunning = false;

  paused = false;

  goalActive = false;

  if (matchIntro) {
    matchIntro.classList.add(
      "hidden"
    );
  }

  if (howToPlayMenu) {
    howToPlayMenu.classList.add(
      "hidden"
    );
  }

  if (resultScreen) {
    resultScreen.classList.add(
      "hidden"
    );
  }

  if (endScreen) {
    endScreen.classList.add(
      "hidden"
    );
  }

  if (pauseMenu) {
    pauseMenu.classList.add(
      "hidden"
    );
  }

  if (countdownEl) {
    countdownEl.classList.add(
      "hidden"
    );
  }

  if (mainMenu) {
    mainMenu.classList.remove(
      "hidden"
    );
  }
}

/* =========================
   BUTTONS
========================= */

if (resumeButton) {

  resumeButton.addEventListener(
    "click",
    () => {

      if (!gameRunning) {
        return;
      }

      paused = false;

      pauseMenu.classList.add(
        "hidden"
      );

      clearKeys();
    }
  );
}

if (playButton) {

  playButton.addEventListener(
    "click",
    startMatch
  );
}

if (playAgainButton) {

  playAgainButton.addEventListener(
    "click",
    startMatch
  );
}

if (howToPlayButton) {

  howToPlayButton.addEventListener(
    "click",
    () => {

      if (mainMenu) {
        mainMenu.classList.add(
          "hidden"
        );
      }

      if (howToPlayMenu) {
        howToPlayMenu.classList.remove(
          "hidden"
        );
      }
    }
  );
}

if (backButton) {

  backButton.addEventListener(
    "click",
    () => {

      if (howToPlayMenu) {
        howToPlayMenu.classList.add(
          "hidden"
        );
      }

      if (mainMenu) {
        mainMenu.classList.remove(
          "hidden"
        );
      }
    }
  );
}

if (mainMenuButton) {

  mainMenuButton.addEventListener(
    "click",
    showMainMenu
  );
}

if (restartButton) {

  restartButton.addEventListener(
    "click",
    startMatch
  );
}

/* =========================
   INITIALISATION
========================= */

resetPointState();

updateTimerDisplay();

updateHUD();

drawArena();

ball.draw();

player.draw();

bot.draw();

/*
IMPORTANT :
la boucle démarre ici.
*/

requestAnimationFrame(
  gameLoop
);
