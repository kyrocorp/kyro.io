/* =========================================================
   TURBOBALL.IO — GAME.JS
   ========================================================= */

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const W = canvas.width;
const H = canvas.height;

/* ---------- OUTILS ---------- */

const $ = id => document.getElementById(id);

const blueScoreEl = $("blueScore");
const orangeScoreEl = $("orangeScore");
const timerEl = $("timer");

const playerPointsEl = $("playerPoints");
const pointsNotification = $("pointsNotification");

const boostFill = $("boostFill");
const boostNumber = $("boostNumber");
const speedNumber = $("speedNumber");

const mainMenu = $("mainMenu");
const howToPlayMenu = $("howToPlayMenu");
const settingsMenu = $("settingsMenu");
const matchIntro = $("matchIntro");
const pauseMenu = $("pauseMenu");
const concedeConfirm = $("concedeConfirm");
const resultScreen = $("resultScreen");

const goalMessage = $("goalMessage");
const goalText = $("goalText");
const goalScorer = $("goalScorer");
const countdown = $("countdown");

const winnerDisplay = $("winnerDisplay");
const finalBlueScore = $("finalBlueScore");
const finalOrangeScore = $("finalOrangeScore");

/* ---------- CONTRÔLES ---------- */

const defaultControls = {
    forward: "z",
    reverse: "s",
    left: "q",
    right: "d",
    boost: "space"
};

let controls = {...defaultControls};

try {
    const saved = JSON.parse(localStorage.getItem("turboballControls"));
    if (saved) controls = {...defaultControls, ...saved};
} catch(e) {}

const controlButtons = {
    forward: $("forwardKeyButton"),
    reverse: $("reverseKeyButton"),
    left: $("leftKeyButton"),
    right: $("rightKeyButton"),
    boost: $("boostKeyButton")
};

const howKeys = {
    forward: $("howZKey"),
    reverse: $("howSKey"),
    left: $("howQKey"),
    right: $("howDKey"),
    boost: $("howSpaceKey")
};

let changingControl = null;

function displayKey(key) {
    if (key === "space") return "SPACE";
    return key.toUpperCase();
}

function updateControlDisplay() {
    for (const action in controlButtons) {
        if (controlButtons[action])
            controlButtons[action].textContent =
                displayKey(controls[action]);
    }

    if (howKeys.forward) howKeys.forward.textContent = displayKey(controls.forward);
    if (howKeys.reverse) howKeys.reverse.textContent = displayKey(controls.reverse);
    if (howKeys.left) howKeys.left.textContent = displayKey(controls.left);
    if (howKeys.right) howKeys.right.textContent = displayKey(controls.right);
    if (howKeys.boost) howKeys.boost.textContent = displayKey(controls.boost);
}

function saveControls() {
    localStorage.setItem(
        "turboballControls",
        JSON.stringify(controls)
    );
}

function getKey(e) {
    if (e.code === "Space") return "space";
    return e.key.toLowerCase();
}

const keys = {};

document.addEventListener("keydown", e => {

    const key = getKey(e);

    if (changingControl) {

        e.preventDefault();

        if (key === "escape") {
            changingControl.textContent =
                displayKey(controls[changingControl.dataset.action]);

            changingControl = null;
            return;
        }

        const action = changingControl.dataset.action;

        const alreadyUsed = Object.keys(controls)
            .some(a => a !== action && controls[a] === key);

        if (alreadyUsed) return;

        controls[action] = key;

        saveControls();
        updateControlDisplay();

        changingControl = null;
        return;
    }

    if (key === "space") e.preventDefault();

    if (key === "p" && gameRunning && !goalActive) {
        togglePause();
        return;
    }

    keys[key] = true;
});

document.addEventListener("keyup", e => {
    keys[getKey(e)] = false;
});

window.addEventListener("blur", () => {
    for (const k in keys) keys[k] = false;
});

/* ---------- RÉGLAGES ---------- */

for (const action in controlButtons) {

    const button = controlButtons[action];

    if (!button) continue;

    button.dataset.action = action;

    button.addEventListener("click", () => {

        if (changingControl) return;

        changingControl = button;
        button.textContent = "PRESS A KEY";
    });
}

$("resetControlsButton")?.addEventListener("click", () => {

    controls = {...defaultControls};

    saveControls();
    updateControlDisplay();
});

/* ---------- ÉTATS DU JEU ---------- */

let blueScore = 0;
let orangeScore = 0;

let points = 0;

let timeLeft = 120;

let gameRunning = false;
let paused = false;
let goalActive = false;

let settingsReturn = "main";

let countdownInterval = null;
let goalTimeout = null;
let introTimeout = null;

let lastFrame = performance.now();

/* ---------- TERRAIN ---------- */

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

/* ---------- BOOST ---------- */

const boostPads = [

    {x: 175, y: 130, cooldown: 0, flash: 0},
    {x: W - 175, y: 130, cooldown: 0, flash: 0},

    {x: 175, y: H - 130, cooldown: 0, flash: 0},
    {x: W - 175, y: H - 130, cooldown: 0, flash: 0},

    {x: W / 2, y: 100, cooldown: 0, flash: 0},
    {x: W / 2, y: H - 100, cooldown: 0, flash: 0}
];

const particles = [];

/* ---------- POINTS ---------- */

function updatePoints() {
    if (playerPointsEl)
        playerPointsEl.textContent = points;
}

function givePoints(amount, text) {

    points += amount;
    updatePoints();

    if (pointsNotification) {

        pointsNotification.textContent =
            `+${amount} ${text}`;

        pointsNotification.classList.remove("show");

        void pointsNotification.offsetWidth;

        pointsNotification.classList.add("show");

        setTimeout(() => {
            pointsNotification.classList.remove("show");
        }, 1000);
    }
}

/* ---------- BALLON ---------- */

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

        const maxSpeed = 9;

        const speed = Math.hypot(this.vx, this.vy);

        if (speed > maxSpeed) {
            this.vx = this.vx / speed * maxSpeed;
            this.vy = this.vy / speed * maxSpeed;
        }

        const opening =
            this.y + this.radius > goal.top &&
            this.y - this.radius < goal.bottom;

        /* BUT */

        if (opening) {

            if (this.x < field.left - 2) {
                scoreGoal("orange");
                return;
            }

            if (this.x > field.right + 2) {
                scoreGoal("blue");
                return;
            }
        }

        /* MURS */

        if (this.y - this.radius < field.top) {
            this.y = field.top + this.radius;
            this.vy *= -0.82;
        }

        if (this.y + this.radius > field.bottom) {
            this.y = field.bottom - this.radius;
            this.vy *= -0.82;
        }

        if (!opening) {

            if (this.x - this.radius < field.left) {
                this.x = field.left + this.radius;
                this.vx *= -0.82;
            }

            if (this.x + this.radius > field.right) {
                this.x = field.right - this.radius;
                this.vx *= -0.82;
            }
        }

        /* FOND DES CAGES */

        if (opening && this.x < field.left - goal.depth + this.radius) {
            this.x = field.left - goal.depth + this.radius;
            this.vx *= -0.82;
        }

        if (opening && this.x > field.right + goal.depth - this.radius) {
            this.x = field.right + goal.depth - this.radius;
            this.vx *= -0.82;
        }
    }

    draw() {

        ctx.save();

        ctx.shadowColor = "#ffffff";
        ctx.shadowBlur = 18;

        const gradient = ctx.createRadialGradient(
            this.x - 6,
            this.y - 7,
            2,
            this.x,
            this.y,
            this.radius
        );

        gradient.addColorStop(0, "#ffffff");
        gradient.addColorStop(0.6, "#dce5ec");
        gradient.addColorStop(1, "#788998");

        ctx.fillStyle = gradient;

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

/* ---------- VOITURE ---------- */

class Car {

    constructor(x, y, color, bot = false) {

        this.startX = x;
        this.startY = y;

        this.x = x;
        this.y = y;

        this.color = color;

        this.bot = bot;

        this.radius = 25;

        this.angle = bot ? Math.PI : 0;

        this.speed = 0;

        this.maxSpeed = 7.2;
        this.boostSpeed = 11.7;

        this.boost = 100;

        this.boosting = false;

        this.touchingBall = false;

        this.aiBoostTarget = null;
        this.aiTimer = 0;
    }

    reset() {

        this.x = this.startX;
        this.y = this.startY;

        this.angle = this.bot ? Math.PI : 0;

        this.speed = 0;

        this.boost = 100;

        this.boosting = false;

        this.touchingBall = false;

        this.aiBoostTarget = null;
    }

    update() {

        if (this.bot)
            this.updateAI();
        else
            this.updatePlayer();

        this.x += Math.cos(this.angle) * this.speed;
        this.y += Math.sin(this.angle) * this.speed;

        this.speed *= 0.985;

        if (Math.abs(this.speed) < 0.02)
            this.speed = 0;

        this.keepInside();

        this.boost = Math.min(
            100,
            this.boost + 0.025
        );
    }

    updatePlayer() {

        this.boosting = false;

        if (keys[controls.forward])
            this.speed += 0.18;

        if (keys[controls.reverse]) {

            if (this.speed > 0)
                this.speed -= 0.25;
            else
                this.speed -= 0.12;
        }

        const turn =
            0.055 *
            Math.min(
                Math.abs(this.speed) / 2 + 0.3,
                1
            );

        if (keys[controls.left])
            this.angle -= turn * (this.speed >= 0 ? 1 : -1);

        if (keys[controls.right])
            this.angle += turn * (this.speed >= 0 ? 1 : -1);

        if (
            keys[controls.boost] &&
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
                this.boosting ?
                    this.boostSpeed :
                    this.maxSpeed
            )
        );
    }

    updateAI() {

        const dx = ball.x - this.x;
        const dy = ball.y - this.y;

        const distance = Math.hypot(dx, dy);

        let targetX = ball.x;
        let targetY = ball.y;

        /* Défense */

        if (
            ball.x > field.right - 280 &&
            ball.vx > 0
        ) {

            targetX = field.right - 80;
            targetY = ball.y;
        }

        /* Attaque */

        else if (ball.x < W * 0.55) {

            targetX = ball.x + 45;
            targetY = ball.y;
        }

        /* Recherche boost */

        this.aiTimer -= 1 / 60;

        if (
            this.boost < 25 &&
            distance > 180
        ) {

            if (
                !this.aiBoostTarget ||
                this.aiTimer <= 0
            ) {

                let best = null;
                let bestDistance = Infinity;

                for (const pad of boostPads) {

                    if (pad.cooldown > 0)
                        continue;

                    const d = Math.hypot(
                        pad.x - this.x,
                        pad.y - this.y
                    );

                    if (d < bestDistance) {
                        bestDistance = d;
                        best = pad;
                    }
                }

                this.aiBoostTarget = best;
                this.aiTimer = 0.6;
            }

            if (this.aiBoostTarget) {

                targetX = this.aiBoostTarget.x;
                targetY = this.aiBoostTarget.y;
            }
        }

        const wantedAngle =
            Math.atan2(
                targetY - this.y,
                targetX - this.x
            );

        let difference =
            wantedAngle - this.angle;

        while (difference > Math.PI)
            difference -= Math.PI * 2;

        while (difference < -Math.PI)
            difference += Math.PI * 2;

        if (difference > 0.06)
            this.angle += 0.062;

        if (difference < -0.06)
            this.angle -= 0.062;

        const aligned =
            Math.abs(difference) < 0.35;

        this.boosting =
            aligned &&
            this.boost > 5 &&
            (
                distance > 260 ||
                ball.x < W * 0.55
            );

        this.speed +=
            this.boosting ?
                0.24 :
                0.145;

        if (this.boosting)
            this.boost -= 0.55;

        this.speed = Math.min(
            this.speed,
            this.boosting ? 9.6 : 6.7
        );

        /* Ramassage boost IA */

        if (this.aiBoostTarget) {

            const d = Math.hypot(
                this.x - this.aiBoostTarget.x,
                this.y - this.aiBoostTarget.y
            );

            if (
                d < this.radius + 22 &&
                this.aiBoostTarget.cooldown <= 0
            ) {

                this.boost =
                    Math.min(
                        100,
                        this.boost + 25
                    );

                this.aiBoostTarget.cooldown = 5;

                this.aiBoostTarget.flash = 1;

                this.aiBoostTarget = null;
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

        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);

        /* BOOST */

        if (this.boosting) {

            ctx.fillStyle =
                "rgba(50,220,255,.75)";

            ctx.beginPath();

            ctx.moveTo(-30, -10);
            ctx.lineTo(-65 - Math.random() * 15, 0);
            ctx.lineTo(-30, 10);

            ctx.fill();
        }

        /* carrosserie */

        ctx.shadowColor = this.color;
        ctx.shadowBlur = 18;

        ctx.fillStyle = this.color;

        roundRect(
            -28,
            -17,
            56,
            34,
            9
        );

        ctx.fill();

        ctx.shadowBlur = 0;

        /* vitre */

        ctx.fillStyle = "#07101a";

        roundRect(
            -5,
            -12,
            24,
            24,
            6
        );

        ctx.fill();

        /* phares */

        ctx.fillStyle = "#ffffff";

        ctx.fillRect(20,-9,5,7);
        ctx.fillRect(20,2,5,7);

        /* roues */

        ctx.fillStyle = "#030508";

        ctx.fillRect(-18,-22,12,7);
        ctx.fillRect(8,-22,12,7);
        ctx.fillRect(-18,15,12,7);
        ctx.fillRect(8,15,12,7);

        ctx.restore();
    }
}

/* ---------- OBJETS ---------- */

const player =
    new Car(350, H / 2, "#20cfff");

const bot =
    new Car(W - 350, H / 2, "#ff8a18", true);

const ball = new Ball();

/* ---------- COLLISION BALLON ---------- */

function collideCarBall(car) {

    const dx = ball.x - car.x;
    const dy = ball.y - car.y;

    const distance = Math.hypot(dx, dy);

    const minimum =
        car.radius + ball.radius;

    if (distance >= minimum) {

        car.touchingBall = false;
        return;
    }

    const newTouch = !car.touchingBall;

    car.touchingBall = true;

    if (car === player && newTouch)
        givePoints(2, "BALL TOUCH");

    const dangerous =
        car === player &&
        ball.x < field.left + 260 &&
        ball.vx < 0 &&
        ball.y > goal.top &&
        ball.y < goal.bottom;

    const d = distance || 0.001;

    const nx = dx / d;
    const ny = dy / d;

    const overlap = minimum - d;

    ball.x += nx * overlap;
    ball.y += ny * overlap;

    const force =
        Math.min(
            Math.abs(car.speed) * 1.15 + 1.2,
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

    /* SAVE */

    if (
        car === player &&
        newTouch &&
        dangerous &&
        player.x < field.left + 160 &&
        player.y > goal.top &&
        player.y < goal.bottom &&
        !car.saveCooldown
    ) {

        car.saveCooldown = 4;

        ball.vx =
            Math.abs(ball.vx) * 0.7 + 1.5;

        ball.vy *= 0.65;

        givePoints(50, "SAVE");
    }
}

/* ---------- COLLISION VOITURES ---------- */

function collideCars(a, b) {

    const dx = b.x - a.x;
    const dy = b.y - a.y;

    const distance = Math.hypot(dx, dy);

    const minimum =
        a.radius + b.radius;

    if (
        distance <= 0 ||
        distance >= minimum
    ) return;

    const nx = dx / distance;
    const ny = dy / distance;

    const overlap =
        minimum - distance;

    a.x -= nx * overlap / 2;
    a.y -= ny * overlap / 2;

    b.x += nx * overlap / 2;
    b.y += ny * overlap / 2;

    const oldA = a.speed;

    a.speed = b.speed * 0.55;
    b.speed = oldA * 0.55;
}

/* ---------- BUT ---------- */

function scoreGoal(team) {

    if (goalActive || !gameRunning)
        return;

    goalActive = true;

    for (const k in keys)
        keys[k] = false;

    if (team === "blue") {

        blueScore++;

        if (blueScoreEl)
            blueScoreEl.textContent = blueScore;

        givePoints(150, "GOAL");

        if (goalText)
            goalText.textContent = "GOAL!";

        if (goalScorer)
            goalScorer.textContent =
                "BLUE SCORES";
    }

    else {

        orangeScore++;

        if (orangeScoreEl)
            orangeScoreEl.textContent =
                orangeScore;

        if (goalText)
            goalText.textContent = "GOAL!";

        if (goalScorer)
            goalScorer.textContent =
                "ORANGE SCORES";
    }

    goalMessage?.classList.remove("hidden");

    goalTimeout = setTimeout(() => {

        goalMessage?.classList.add("hidden");

        player.reset();
        bot.reset();
        ball.reset();

        startCountdown();

    }, 1800);
}

/* ---------- COMPTE À REBOURS ---------- */

function startCountdown() {

    clearInterval(countdownInterval);

    goalActive = true;

    let number = 3;

    if (countdown) {

        countdown.textContent = number;
        countdown.classList.remove("hidden");
    }

    countdownInterval =
        setInterval(() => {

            number--;

            if (number > 0) {

                if (countdown)
                    countdown.textContent = number;

            } else {

                clearInterval(countdownInterval);

                if (countdown)
                    countdown.textContent = "GO!";

                setTimeout(() => {

                    countdown?.classList.add("hidden");

                    goalActive = false;

                }, 700);
            }

        }, 1000);
}

/* ---------- BOOST ---------- */

function updateBoostPads(dt) {

    for (const pad of boostPads) {

        pad.cooldown =
            Math.max(
                0,
                pad.cooldown - dt
            );

        pad.flash =
            Math.max(
                0,
                pad.flash - dt
            );
    }

    if (!gameRunning || paused || goalActive)
        return;

    for (const pad of boostPads) {

        if (pad.cooldown > 0)
            continue;

        const distance =
            Math.hypot(
                player.x - pad.x,
                player.y - pad.y
            );

        if (distance < player.radius + 22) {

            player.boost =
                Math.min(
                    100,
                    player.boost + 25
                );

            pad.cooldown = 5;
            pad.flash = 1;
        }
    }
}

/* ---------- TIMER ---------- */

function updateTimer(dt) {

    if (
        !gameRunning ||
        paused ||
        goalActive
    ) return;

    timeLeft -= dt;

    if (timeLeft <= 0) {

        timeLeft = 0;

        updateTimerDisplay();

        endMatch();

        return;
    }

    updateTimerDisplay();
}

function updateTimerDisplay() {

    const minutes =
        Math.floor(timeLeft / 60);

    const seconds =
        Math.floor(timeLeft % 60);

    if (timerEl)
        timerEl.textContent =
            `${minutes}:${String(seconds).padStart(2,"0")}`;
}

/* ---------- PAUSE ---------- */

function togglePause() {

    if (!gameRunning || goalActive)
        return;

    paused = !paused;

    for (const k in keys)
        keys[k] = false;

    pauseMenu?.classList.toggle(
        "hidden",
        !paused
    );
}

$("resumeButton")?.addEventListener(
    "click",
    () => {

        paused = false;

        pauseMenu?.classList.add("hidden");
    }
);

/* ---------- SETTINGS ---------- */

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
    pauseMenu?.classList.add("hidden");
    howToPlayMenu?.classList.add("hidden");

    settingsMenu?.classList.remove("hidden");

    updateControlDisplay();
}

$("settingsBackButton")?.addEventListener(
    "click",
    () => {

        settingsMenu?.classList.add("hidden");

        if (
            settingsReturn === "pause" &&
            gameRunning
        )
            pauseMenu?.classList.remove("hidden");
        else
            mainMenu?.classList.remove("hidden");
    }
);

/* ---------- HOW TO PLAY ---------- */

$("howToPlayButton")?.addEventListener(
    "click",
    () => {

        mainMenu?.classList.add("hidden");

        howToPlayMenu?.classList.remove("hidden");

        updateControlDisplay();
    }
);

$("backButton")?.addEventListener(
    "click",
    () => {

        howToPlayMenu?.classList.add("hidden");

        mainMenu?.classList.remove("hidden");
    }
);

/* ---------- ABANDON ---------- */

$("concedeButton")?.addEventListener(
    "click",
    () => {

        if (!gameRunning)
            return;

        concedeConfirm?.classList.remove("hidden");
    }
);

$("cancelConcedeButton")?.addEventListener(
    "click",
    () => {

        concedeConfirm?.classList.add("hidden");
    }
);

$("confirmConcedeButton")?.addEventListener(
    "click",
    () => {

        concedeConfirm?.classList.add("hidden");

        endMatch(true);
    }
);

$("pauseMainMenuButton")?.addEventListener(
    "click",
    mainMenuScreen
);

/* ---------- FIN DU MATCH ---------- */

function endMatch(conceded = false) {

    if (!gameRunning && !conceded)
        return;

    gameRunning = false;
    paused = false;
    goalActive = true;

    for (const k in keys)
        keys[k] = false;

    clearInterval(countdownInterval);
    clearTimeout(goalTimeout);
    clearTimeout(introTimeout);

    pauseMenu?.classList.add("hidden");
    matchIntro?.classList.add("hidden");
    goalMessage?.classList.add("hidden");

    if (conceded) {

        winnerDisplay.textContent =
            "ORANGE WINS";
    }

    else if (blueScore > orangeScore) {

        winnerDisplay.textContent =
            "BLUE WINS";
    }

    else if (orangeScore > blueScore) {

        winnerDisplay.textContent =
            "ORANGE WINS";
    }

    else {

        winnerDisplay.textContent =
            "DRAW";
    }

    if (finalBlueScore)
        finalBlueScore.textContent = blueScore;

    if (finalOrangeScore)
        finalOrangeScore.textContent = orangeScore;

    resultScreen?.classList.remove("hidden");
}

/* ---------- NOUVELLE PARTIE ---------- */

function startGame() {

    clearInterval(countdownInterval);
    clearTimeout(goalTimeout);
    clearTimeout(introTimeout);

    blueScore = 0;
    orangeScore = 0;

    points = 0;

    timeLeft = 120;

    paused = false;
    gameRunning = true;
    goalActive = true;

    updatePoints();

    if (blueScoreEl)
        blueScoreEl.textContent = "0";

    if (orangeScoreEl)
        orangeScoreEl.textContent = "0";

    updateTimerDisplay();

    player.reset();
    bot.reset();
    ball.reset();

    for (const pad of boostPads) {
        pad.cooldown = 0;
        pad.flash = 0;
    }

    mainMenu?.classList.add("hidden");
    howToPlayMenu?.classList.add("hidden");
    settingsMenu?.classList.add("hidden");
    pauseMenu?.classList.add("hidden");
    resultScreen?.classList.add("hidden");

    matchIntro?.classList.remove("hidden");

    introTimeout = setTimeout(() => {

        matchIntro?.classList.add("hidden");

        startCountdown();

    }, 900);
}

/* ---------- RETOUR MENU ---------- */

function mainMenuScreen() {

    clearInterval(countdownInterval);
    clearTimeout(goalTimeout);
    clearTimeout(introTimeout);

    gameRunning = false;
    paused = false;
    goalActive = false;

    blueScore = 0;
    orangeScore = 0;

    points = 0;

    updatePoints();

    player.reset();
    bot.reset();
    ball.reset();

    pauseMenu?.classList.add("hidden");
    resultScreen?.classList.add("hidden");
    settingsMenu?.classList.add("hidden");
    howToPlayMenu?.classList.add("hidden");
    concedeConfirm?.classList.add("hidden");
    matchIntro?.classList.add("hidden");
    goalMessage?.classList.add("hidden");
    countdown?.classList.add("hidden");

    mainMenu?.classList.remove("hidden");
}

/* ---------- BOUTONS ---------- */

$("playButton")?.addEventListener(
    "click",
    startGame
);

$("playAgainButton")?.addEventListener(
    "click",
    startGame
);

$("mainMenuButton")?.addEventListener(
    "click",
    mainMenuScreen
);

$("restartButton")?.addEventListener(
    "click",
    startGame
);

/* ---------- DESSIN TERRAIN ---------- */

function drawArena() {

    ctx.fillStyle = "#06131f";
    ctx.fillRect(0,0,W,H);

    /* grille */

    ctx.strokeStyle =
        "rgba(100,200,255,.07)";

    ctx.lineWidth = 1;

    for (
        let x = 0;
        x < W;
        x += 60
    ) {

        ctx.beginPath();
        ctx.moveTo(x,0);
        ctx.lineTo(x,H);
        ctx.stroke();
    }

    for (
        let y = 0;
        y < H;
        y += 60
    ) {

        ctx.beginPath();
        ctx.moveTo(0,y);
        ctx.lineTo(W,y);
        ctx.stroke();
    }

    /* terrain */

    ctx.strokeStyle =
        "rgba(100,220,255,.45)";

    ctx.lineWidth = 3;

    ctx.strokeRect(
        field.left,
        field.top,
        field.right - field.left,
        field.bottom - field.top
    );

    /* ligne centrale */

    ctx.beginPath();

    ctx.moveTo(W / 2, field.top);
    ctx.lineTo(W / 2, field.bottom);

    ctx.stroke();

    /* cercle central */

    ctx.beginPath();

    ctx.arc(
        W / 2,
        H / 2,
        85,
        0,
        Math.PI * 2
    );

    ctx.stroke();

    /* but bleu */

    ctx.shadowColor = "#00aaff";
    ctx.shadowBlur = 18;

    ctx.strokeStyle = "#20cfff";

    ctx.strokeRect(
        field.left - goal.depth,
        goal.top,
        goal.depth,
        goal.bottom - goal.top
    );

    /* but orange */

    ctx.shadowColor = "#ff6500";

    ctx.strokeStyle = "#ff8a18";

    ctx.strokeRect(
        field.right,
        goal.top,
        goal.depth,
        goal.bottom - goal.top
    );

    ctx.shadowBlur = 0;

    drawBoostPads();
}

/* ---------- BOOST PADS DESSIN ---------- */

function drawBoostPads() {

    for (const pad of boostPads) {

        const available =
            pad.cooldown <= 0;

        ctx.save();

        ctx.translate(
            pad.x,
            pad.y
        );

        ctx.globalAlpha =
            available ? 1 : 0.3;

        ctx.shadowColor =
            "#20dfff";

        ctx.shadowBlur =
            available ? 20 : 5;

        ctx.fillStyle =
            "#081827";

        ctx.beginPath();

        ctx.ellipse(
            0,
            0,
            28,
            16,
            0,
            0,
            Math.PI * 2
        );

        ctx.fill();

        ctx.fillStyle =
            "#35dfff";

        ctx.beginPath();

        ctx.ellipse(
            0,
            0,
            18,
            8,
            0,
            0,
            Math.PI * 2
        );

        ctx.fill();

        ctx.restore();
    }
}

/* ---------- HUD ---------- */

function updateHUD() {

    if (boostFill)
        boostFill.style.width =
            `${player.boost}%`;

    if (boostNumber)
        boostNumber.textContent =
            Math.floor(player.boost);

    const speed =
        Math.abs(player.speed);

    let kmh;

    if (player.boosting) {

        kmh = Math.round(
            Math.min(
                83,
                speed * (83 / 11.7)
            )
        );

    } else {

        kmh = Math.round(
            Math.min(
                51,
                speed * (51 / 7.2)
            )
        );
    }

    if (speedNumber)
        speedNumber.textContent = kmh;
}

/* ---------- RECTANGLE ARRONDI ---------- */

function roundRect(x,y,w,h,r) {

    ctx.beginPath();

    ctx.moveTo(x+r,y);

    ctx.lineTo(x+w-r,y);

    ctx.quadraticCurveTo(
        x+w,
        y,
        x+w,
        y+r
    );

    ctx.lineTo(
        x+w,
        y+h-r
    );

    ctx.quadraticCurveTo(
        x+w,
        y+h,
        x+w-r,
        y+h
    );

    ctx.lineTo(
        x+r,
        y+h
    );

    ctx.quadraticCurveTo(
        x,
        y+h,
        x,
        y+h-r
    );

    ctx.lineTo(
        x,
        y+r
    );

    ctx.quadraticCurveTo(
        x,
        y,
        x+r,
        y
    );

    ctx.closePath();
}

/* ---------- BOUCLE PRINCIPALE ---------- */

function gameLoop(now) {

    const dt =
        Math.min(
            (now - lastFrame) / 1000,
            0.1
        );

    lastFrame = now;

    if (
        gameRunning &&
        !paused &&
        !goalActive
    ) {

        player.update();

        bot.update();

        ball.update();

        if (!goalActive) {

            collideCarBall(player);

            collideCarBall(bot);

            collideCars(player,bot);

            updateTimer(dt);
        }
    }

    updateBoostPads(dt);

    drawArena();

    ball.draw();

    player.draw();

    bot.draw();

    updateHUD();

    requestAnimationFrame(gameLoop);
}

/* ---------- INITIALISATION ---------- */

updateControlDisplay();

updatePoints();

updateTimerDisplay();

player.saveCooldown = 0;

requestAnimationFrame(gameLoop);
