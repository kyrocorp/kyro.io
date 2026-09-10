// ============================================================
// TURBOBALL.IO - GAME.JS
// ============================================================

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const W = canvas.width;
const H = canvas.height;

// ============================================================
// ELEMENTS HTML
// ============================================================

const mainMenu = document.getElementById("mainMenu");
const howToPlayMenu = document.getElementById("howToPlayMenu");
const settingsMenu = document.getElementById("settingsMenu");
const matchIntro = document.getElementById("matchIntro");

const pauseMenu = document.getElementById("pauseMenu");
const concedeConfirm = document.getElementById("concedeConfirm");

const goalMessage = document.getElementById("goalMessage");
const countdown = document.getElementById("countdown");

const resultScreen = document.getElementById("resultScreen");

const blueScoreElement = document.getElementById("blueScore");
const orangeScoreElement = document.getElementById("orangeScore");
const timerElement = document.getElementById("timer");

const playerPointsElement = document.getElementById("playerPoints");
const pointsNotification = document.getElementById("pointsNotification");

const boostFill = document.getElementById("boostFill");
const boostNumber = document.getElementById("boostNumber");
const speedNumber = document.getElementById("speedNumber");

const winnerDisplay = document.getElementById("winnerDisplay");
const finalBlueScore = document.getElementById("finalBlueScore");
const finalOrangeScore = document.getElementById("finalOrangeScore");

// ============================================================
// BOUTONS
// ============================================================

const playButton = document.getElementById("playButton");
const howToPlayButton = document.getElementById("howToPlayButton");
const backButton = document.getElementById("backButton");

const settingsButton = document.getElementById("settingsButton");
const settingsBackButton = document.getElementById("settingsBackButton");
const resetControlsButton = document.getElementById("resetControlsButton");

const resumeButton = document.getElementById("resumeButton");
const pauseSettingsButton = document.getElementById("pauseSettingsButton");
const concedeButton = document.getElementById("concedeButton");
const pauseMainMenuButton = document.getElementById("pauseMainMenuButton");

const confirmConcedeButton = document.getElementById("confirmConcedeButton");
const cancelConcedeButton = document.getElementById("cancelConcedeButton");

const playAgainButton = document.getElementById("playAgainButton");
const mainMenuButton = document.getElementById("mainMenuButton");

// ============================================================
// TOUCHES
// ============================================================

const DEFAULT_CONTROLS = {
    forward: "z",
    reverse: "s",
    left: "q",
    right: "d",
    boost: "space"
};

let controls = {
    ...DEFAULT_CONTROLS
};

// Chargement des touches sauvegardées
try {
    const savedControls =
        JSON.parse(localStorage.getItem("turboball_controls"));

    if (savedControls) {
        for (const action in DEFAULT_CONTROLS) {
            if (typeof savedControls[action] === "string") {
                controls[action] = savedControls[action];
            }
        }
    }
} catch (error) {
    controls = { ...DEFAULT_CONTROLS };
}

// ============================================================
// BOUTONS DES TOUCHES
// ============================================================

const controlButtons = {
    forward: document.getElementById("forwardKeyButton"),
    reverse: document.getElementById("reverseKeyButton"),
    left: document.getElementById("leftKeyButton"),
    right: document.getElementById("rightKeyButton"),
    boost: document.getElementById("boostKeyButton")
};

const howToButtons = {
    forward: document.getElementById("howZKey"),
    reverse: document.getElementById("howSKey"),
    left: document.getElementById("howQKey"),
    right: document.getElementById("howDKey"),
    boost: document.getElementById("howSpaceKey")
};

let waitingForControl = null;
let settingsReturn = "main";

// ============================================================
// AFFICHAGE DES TOUCHES
// ============================================================

function displayKey(key) {
    if (key === "space") {
        return "SPACE";
    }

    if (key === " ") {
        return "SPACE";
    }

    return key.toUpperCase();
}

function updateControlButtons() {

    for (const action in controlButtons) {

        const button = controlButtons[action];

        if (button) {
            button.textContent = displayKey(controls[action]);
            button.dataset.action = action;
        }

        const howButton = howToButtons[action];

        if (howButton) {
            howButton.textContent = displayKey(controls[action]);
        }
    }
}

// ============================================================
// SAUVEGARDE
// ============================================================

function saveControls() {

    localStorage.setItem(
        "turboball_controls",
        JSON.stringify(controls)
    );
}

// ============================================================
// CONVERSION TOUCHE
// ============================================================

function getGameKey(event) {

    if (event.code === "Space") {
        return "space";
    }

    return event.key.toLowerCase();
}

// ============================================================
// TOUCHES ENFONCÉES
// ============================================================

const pressedKeys = {};

document.addEventListener("keydown", function(event) {

    const key = getGameKey(event);

    // --------------------------------------------------------
    // MODE CHANGEMENT DE TOUCHE
    // --------------------------------------------------------

    if (waitingForControl) {

        event.preventDefault();

        const action = waitingForControl;

        // ESC = annuler
        if (key === "escape") {

            waitingForControl = null;

            updateControlButtons();

            return;
        }

        // P reste réservé à la pause
        if (key === "p") {
            return;
        }

        // Vérifie si la touche est déjà utilisée
        const alreadyUsed = Object.keys(controls).some(
            existingAction =>
                existingAction !== action &&
                controls[existingAction] === key
        );

        if (alreadyUsed) {

            if (pointsNotification) {

                pointsNotification.textContent =
                    "TOUCHE DÉJÀ UTILISÉE";

                pointsNotification.classList.add("show");

                setTimeout(() => {
                    pointsNotification.classList.remove("show");
                }, 1000);
            }

            return;
        }

        // Nouvelle touche
        controls[action] = key;

        saveControls();

        waitingForControl = null;

        updateControlButtons();

        return;
    }

    // --------------------------------------------------------
    // PAUSE
    // --------------------------------------------------------

    if (
        key === "p" &&
        gameRunning &&
        !goalActive
    ) {

        event.preventDefault();

        togglePause();

        return;
    }

    // --------------------------------------------------------
    // JEU
    // --------------------------------------------------------

    pressedKeys[key] = true;

    if (key === "space") {
        event.preventDefault();
    }
});

document.addEventListener("keyup", function(event) {

    const key = getGameKey(event);

    pressedKeys[key] = false;
});

window.addEventListener("blur", function() {

    for (const key in pressedKeys) {
        pressedKeys[key] = false;
    }
});

// ============================================================
// CHANGEMENT DES TOUCHES
// ============================================================

for (const action in controlButtons) {

    const button = controlButtons[action];

    if (!button) continue;

    button.dataset.action = action;

    button.addEventListener("click", function() {

        if (waitingForControl) {
            return;
        }

        waitingForControl = action;

        button.textContent = "PRESS A KEY";
    });
}

// ============================================================
// RESET DES TOUCHES
// ============================================================

if (resetControlsButton) {

    resetControlsButton.addEventListener("click", function() {

        controls = {
            ...DEFAULT_CONTROLS
        };

        saveControls();

        waitingForControl = null;

        updateControlButtons();
    });
}

// ============================================================
// TEST TOUCHE
// ============================================================

function isKeyPressed(action) {

    return !!pressedKeys[controls[action]];
}

// ============================================================
// ETAT DU JEU
// ============================================================

let gameRunning = false;
let paused = false;
let goalActive = false;

let blueScore = 0;
let orangeScore = 0;

let playerPoints = 0;

let matchTime = 120;

let lastTime = performance.now();

let goalTimeout = null;
let countdownInterval = null;
let countdownTimeout = null;

// ============================================================
// TERRAIN
// ============================================================

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

// ============================================================
// VOITURE
// ============================================================

class Car {

    constructor(x, y, color, isAI = false) {

        this.startX = x;
        this.startY = y;

        this.x = x;
        this.y = y;

        this.color = color;

        this.isAI = isAI;

        this.radius = 25;

        this.angle = isAI ? Math.PI : 0;

        this.speed = 0;

        this.normalMaxSpeed = 7.2;
        this.boostMaxSpeed = 11.7;

        this.boost = 100;

        this.boosting = false;

        this.touchingBall = false;

        this.aiBoostTarget = null;
    }

    reset() {

        this.x = this.startX;
        this.y = this.startY;

        this.angle = this.isAI ? Math.PI : 0;

        this.speed = 0;

        this.boost = 100;

        this.boosting = false;

        this.touchingBall = false;

        this.aiBoostTarget = null;
    }

    update() {

        if (this.isAI) {
            this.updateAI();
        } else {
            this.updatePlayer();
        }

        this.x += Math.cos(this.angle) * this.speed;
        this.y += Math.sin(this.angle) * this.speed;

        this.speed *= 0.985;

        if (Math.abs(this.speed) < 0.02) {
            this.speed = 0;
        }

        this.keepInside();

        this.boost += 0.025;

        if (this.boost > 100) {
            this.boost = 100;
        }
    }

    // ========================================================
    // JOUEUR
    // ========================================================

    updatePlayer() {

        this.boosting = false;

        if (isKeyPressed("forward")) {
            this.speed += 0.18;
        }

        if (isKeyPressed("reverse")) {

            if (this.speed > 0) {
                this.speed -= 0.25;
            } else {
                this.speed -= 0.12;
            }
        }

        const turningPower =
            0.055 *
            Math.min(
                Math.abs(this.speed) / 2 + 0.3,
                1
            );

        if (isKeyPressed("left")) {

            this.angle -=
                turningPower *
                (this.speed >= 0 ? 1 : -1);
        }

        if (isKeyPressed("right")) {

            this.angle +=
                turningPower *
                (this.speed >= 0 ? 1 : -1);
        }

        if (
            isKeyPressed("boost") &&
            this.boost > 0 &&
            this.speed > 0
        ) {

            this.speed += 0.28;

            this.boost -= 0.7;

            this.boosting = true;
        }

        const maxSpeed =
            this.boosting
                ? this.boostMaxSpeed
                : this.normalMaxSpeed;

        if (this.speed > maxSpeed) {
            this.speed = maxSpeed;
        }

        if (this.speed < -3.2) {
            this.speed = -3.2;
        }
    }

    // ========================================================
    // IA
    // ========================================================

    updateAI() {

        let targetX = ball.x;
        let targetY = ball.y;

        const distance =
            Math.hypot(
                ball.x - this.x,
                ball.y - this.y
            );

        // Défense
        if (
            ball.x > field.right - 280 &&
            ball.vx > 0
        ) {

            targetX = field.right - 70;
            targetY = ball.y;
        }

        // Attaque
        else {

            targetX = ball.x + 40;
            targetY = ball.y;
        }

        const angleToTarget =
            Math.atan2(
                targetY - this.y,
                targetX - this.x
            );

        let difference =
            angleToTarget - this.angle;

        while (difference > Math.PI) {
            difference -= Math.PI * 2;
        }

        while (difference < -Math.PI) {
            difference += Math.PI * 2;
        }

        if (difference > 0.05) {
            this.angle += 0.06;
        }

        if (difference < -0.05) {
            this.angle -= 0.06;
        }

        const aligned =
            Math.abs(difference) < 0.4;

        this.boosting =
            aligned &&
            this.boost > 5 &&
            distance > 220;

        this.speed +=
            this.boosting
                ? 0.24
                : 0.15;

        if (this.boosting) {
            this.boost -= 0.55;
        }

        const maxSpeed =
            this.boosting
                ? 9.6
                : 6.7;

        if (this.speed > maxSpeed) {
            this.speed = maxSpeed;
        }
    }

    // ========================================================
    // LIMITES
    // ========================================================

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

    // ========================================================
    // DESSIN
    // ========================================================

    draw() {

        ctx.save();

        ctx.translate(this.x, this.y);

        ctx.rotate(this.angle);

        if (this.boosting) {

            ctx.fillStyle = "#55eaff";

            ctx.beginPath();

            ctx.moveTo(-30, -10);
            ctx.lineTo(-60 - Math.random() * 15, 0);
            ctx.lineTo(-30, 10);

            ctx.fill();
        }

        ctx.shadowColor = this.color;
        ctx.shadowBlur = 20;

        ctx.fillStyle = this.color;

        roundedRect(
            -28,
            -17,
            56,
            34,
            9
        );

        ctx.fill();

        ctx.shadowBlur = 0;

        ctx.fillStyle = "#071019";

        roundedRect(
            -5,
            -12,
            25,
            24,
            6
        );

        ctx.fill();

        ctx.fillStyle = "#fff";

        ctx.fillRect(20, -9, 5, 7);
        ctx.fillRect(20, 2, 5, 7);

        ctx.fillStyle = "#020407";

        ctx.fillRect(-18, -22, 12, 7);
        ctx.fillRect(8, -22, 12, 7);

        ctx.fillRect(-18, 15, 12, 7);
        ctx.fillRect(8, 15, 12, 7);

        ctx.restore();
    }
}

// ============================================================
// BALLE
// ============================================================

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

        const velocity =
            Math.hypot(
                this.vx,
                this.vy
            );

        if (velocity > 9) {

            this.vx =
                this.vx / velocity * 9;

            this.vy =
                this.vy / velocity * 9;
        }

        checkGoal();

        if (!goalActive) {
            this.bounceWalls();
        }
    }

    bounceWalls() {

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

        const insideGoal =
            this.y + this.radius > goal.top &&
            this.y - this.radius < goal.bottom;

        if (
            this.x - this.radius <
            field.left &&
            !insideGoal
        ) {

            this.x =
                field.left + this.radius;

            this.vx *= -0.82;
        }

        if (
            this.x + this.radius >
            field.right &&
            !insideGoal
        ) {

            this.x =
                field.right - this.radius;

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
            "#ffffff"
        );

        gradient.addColorStop(
            0.55,
            "#dce7f0"
        );

        gradient.addColorStop(
            1,
            "#7d91a3"
        );

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

// ============================================================
// CREATION
