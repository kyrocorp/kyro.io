/* =========================================================
   TURBOKICK.IO
   Main Game Script
   ========================================================= */

"use strict";

/* =========================================================
   CONFIGURATION
========================================================= */

const GAME_NAME = "TurboKick.io";

const CANVAS_WIDTH = 1200;
const CANVAS_HEIGHT = 700;

const MATCH_DURATION = 120;

const PLAYER_MAX_SPEED = 7.2;
const BOT_MAX_SPEED = 6.2;

const PLAYER_ACCELERATION = 0.35;
const PLAYER_FRICTION = 0.90;

const BOOST_MAX = 100;
const BOOST_USE_SPEED = 0.75;
const BOOST_RECHARGE = 0.20;

const BALL_RADIUS = 16;
const PLAYER_RADIUS = 28;

const MAX_BALL_SPEED = 9;

const GOAL_TOP = 230;
const GOAL_BOTTOM = 470;
const GOAL_DEPTH = 70;

/* Serveur WebSocket */

const SERVER_URL = "wss://kyro-io.onrender.com";

/* Boost pads */

const BOOST_PAD_AMOUNT = 100;
const BOOST_PAD_RESPAWN_TIME = 5000;

const BOOST_PADS = [
  {
    x: 110,
    y: 110,
    active: true,
    respawnAt: 0
  },
  {
    x: 110,
    y: CANVAS_HEIGHT - 110,
    active: true,
    respawnAt: 0
  },
  {
    x: CANVAS_WIDTH - 110,
    y: 110,
    active: true,
    respawnAt: 0
  },
  {
    x: CANVAS_WIDTH - 110,
    y: CANVAS_HEIGHT - 110,
    active: true,
    respawnAt: 0
  },
  {
    x: CANVAS_WIDTH / 2,
    y: 75,
    active: true,
    respawnAt: 0
  },
  {
    x: CANVAS_WIDTH / 2,
    y: CANVAS_HEIGHT - 75,
    active: true,
    respawnAt: 0
  }
];

/* Zones de save invisibles */

const SAVE_ZONE_WIDTH = 95;
const SAVE_ZONE_HEIGHT = GOAL_BOTTOM - GOAL_TOP + 70;

const DEFAULT_CONTROLS = {
  forward: "z",
  reverse: "s",
  left: "q",
  right: "d",
  boost: " "
};

/* =========================================================
   GAME STATE
========================================================= */

const gameState = {
  device: null,

  mode: null,

  running: false,
  paused: false,

  countdown: false,

  timeRemaining: MATCH_DURATION,

  blueScore: 0,
  orangeScore: 0,

  playerPoints: 0,

  blueGoals: 0,
  orangeGoals: 0,

  controls: {
    ...DEFAULT_CONTROLS
  },

  keys: {},

  currentSetting: null,

  onlineSearching: false,
  onlineConnected: false,

  playerId: null,
  playerNumber: null,
  team: null,
  matchId: null,
  isHost: false,

  opponent: null,

  websocket: null,

  lastFrame: 0,

  goalInProgress: false,

  matchMode: "offline",

  lastBallTouchBy: null,

  lastSaveBy: null
};

/* =========================================================
   DOM
========================================================= */

const gameWrapper = document.getElementById("gameWrapper");

const mainMenu = document.getElementById("mainMenu");
const howToPlayMenu = document.getElementById("howToPlayMenu");
const settingsMenu = document.getElementById("settingsMenu");

const matchIntro = document.getElementById("matchIntro");
const resultScreen = document.getElementById("resultScreen");

const canvas = document.getElementById("gameCanvas");
const ctx = canvas ? canvas.getContext("2d") : null;

const playerPointsElement =
  document.getElementById("playerPoints");

const blueScoreElement =
  document.getElementById("blueScore");

const orangeScoreElement =
  document.getElementById("orangeScore");

const timerElement =
  document.getElementById("timer");

const boostFill =
  document.getElementById("boostFill");

const boostNumber =
  document.getElementById("boostNumber");

const speedNumber =
  document.getElementById("speedNumber");

const goalMessage =
  document.getElementById("goalMessage");

const goalText =
  document.getElementById("goalText");

const goalScorer =
  document.getElementById("goalScorer");

const countdownElement =
  document.getElementById("countdown");

const pauseMenu =
  document.getElementById("pauseMenu");

const endScreen =
  document.getElementById("endScreen");

const finalScore =
  document.getElementById("finalScore");

/* =========================================================
   GAME OBJECTS
========================================================= */

const player = {
  x: 300,
  y: CANVAS_HEIGHT / 2,

  vx: 0,
  vy: 0,

  angle: 0,

  boost: BOOST_MAX,

  speed: 0,

  team: "blue"
};

const opponent = {
  x: 900,
  y: CANVAS_HEIGHT / 2,

  vx: 0,
  vy: 0,

  angle: Math.PI,

  boost: BOOST_MAX,

  speed: 0,

  team: "orange",

  remoteInput: null
};

const bot = {
  x: 900,
  y: CANVAS_HEIGHT / 2,

  vx: 0,
  vy: 0,

  angle: Math.PI,

  boost: BOOST_MAX,

  speed: 0,

  team: "orange"
};

const ball = {
  x: CANVAS_WIDTH / 2,
  y: CANVAS_HEIGHT / 2,

  vx: 0,
  vy: 0
};

/* =========================================================
   UTILITIES
========================================================= */

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function distance(a, b) {
  return Math.hypot(
    a.x - b.x,
    a.y - b.y
  );
}

function normalizeKey(key) {
  if (key === " ") return " ";
  return key.toLowerCase();
}

function formatTime(seconds) {
  seconds = Math.max(0, Math.ceil(seconds));

  const minutes =
    Math.floor(seconds / 60);

  const remaining =
    seconds % 60;

  return (
    String(minutes).padStart(2, "0") +
    ":" +
    String(remaining).padStart(2, "0")
  );
}

function show(element) {
  if (!element) return;

  element.classList.remove("hidden");
  element.style.display = "";
}

function hide(element) {
  if (!element) return;

  element.classList.add("hidden");
  element.style.display = "none";
}

/* =========================================================
   NAME
========================================================= */

function updateGameName() {
  document.title = GAME_NAME;

  document
    .querySelectorAll("h1, .logo-io")
    .forEach(element => {
      if (
        element.textContent
          .toUpperCase()
          .includes("TURBOBALL")
      ) {
        if (element.classList.contains("logo-io")) {
          element.textContent = "TURBOKICK.IO";
        } else {
          element.textContent = "TurboKick.io";
        }
      }
    });
}

/* =========================================================
   DEVICE MENU
========================================================= */

function createDeviceMenu() {
  const menu = document.createElement("div");

  menu.id = "deviceMenu";
  menu.className = "menu-screen";

  menu.innerHTML = `
    <div class="menu-background"></div>

    <div class="menu-content">

      <div class="logo">
        <div class="logo-small">WELCOME TO</div>

        <h1>
          TURBO<span>KICK</span>
        </h1>

        <div class="logo-io">
          .IO
        </div>
      </div>

      <div class="menu-footer">
        CHOOSE YOUR DEVICE
      </div>

      <div class="menu-buttons" style="margin-top:25px">

        <button
          id="pcDeviceButton"
          class="main-button">
          💻 PC
        </button>

        <button
          id="mobileDeviceButton"
          class="secondary-button">
          📱 MOBILE
        </button>

      </div>

    </div>
  `;

  document.body.appendChild(menu);

  document
    .getElementById("pcDeviceButton")
    .addEventListener("click", () => {
      chooseDevice("pc");
    });

  document
    .getElementById("mobileDeviceButton")
    .addEventListener("click", () => {
      chooseDevice("mobile");
    });
}

function chooseDevice(device) {
  gameState.device = device;

  const deviceMenu =
    document.getElementById("deviceMenu");

  hide(deviceMenu);

  buildMainMenu();
}

/* =========================================================
   MAIN MENU
========================================================= */

function buildMainMenu() {
  if (!mainMenu) return;

  mainMenu.className = "menu-screen";

  mainMenu.innerHTML = `
    <div class="menu-background"></div>

    <div class="menu-content">

      <div class="logo">

        <div class="logo-small">
          WELCOME
        </div>

        <h1>
          TURBO<span>KICK</span>
        </h1>

        <div class="logo-io">
          .IO
        </div>

      </div>

      <div
        style="
          display:grid;
          grid-template-columns:1fr 1fr;
          gap:25px;
          width:min(760px,90vw);
          margin:auto;
        "
      >

        <div>

          <button
            id="settingsButtonNew"
            class="secondary-button"
            style="width:100%;margin-bottom:12px">
            ⚙ SETTINGS
          </button>

          <button
            id="shopButton"
            class="secondary-button"
            style="width:100%">
            🛒 SHOP
          </button>

        </div>

        <div>

          <button
            id="onlineButton"
            class="main-button"
            style="width:100%;margin-bottom:12px">
            🌐 1V1 ONLINE
          </button>

          <button
            id="offlineButton"
            class="secondary-button"
            style="width:100%">
            🤖 1V1 OFFLINE
          </button>

        </div>

      </div>

      <div class="menu-footer">
        ${gameState.device.toUpperCase()} MODE
      </div>

    </div>
  `;

  show(mainMenu);

  document
    .getElementById("settingsButtonNew")
    .addEventListener("click", openSettings);

  document
    .getElementById("shopButton")
    .addEventListener("click", openShop);

  document
    .getElementById("onlineButton")
    .addEventListener("click", startOnlineSearch);

  document
    .getElementById("offlineButton")
    .addEventListener("click", startOfflineMatch);
}

/* =========================================================
   SHOP
========================================================= */

function openShop() {
  hide(mainMenu);

  const existing =
    document.getElementById("shopMenu");

  if (existing) {
    existing.remove();
  }

  const shop = document.createElement("div");

  shop.id = "shopMenu";
  shop.className = "menu-screen";

  shop.innerHTML = `
    <div class="menu-background"></div>

    <div class="panel">

      <h2>SHOP</h2>

      <p
        style="
          color:#71859a;
          font-size:12px;
          margin:30px 0;
        "
      >
        THE SHOP IS CURRENTLY EMPTY.
      </p>

      <button
        id="shopBackButton"
        class="secondary-button">
        BACK
      </button>

    </div>
  `;

  document.body.appendChild(shop);

  document
    .getElementById("shopBackButton")
    .addEventListener("click", () => {
      shop.remove();
      show(mainMenu);
    });
}

/* =========================================================
   SETTINGS
========================================================= */

function openSettings() {
  if (!settingsMenu) return;

  hide(mainMenu);
  show(settingsMenu);

  updateSettingsButtons();
}

function closeSettings() {
  hide(settingsMenu);
  show(mainMenu);
}

function updateSettingsButtons() {
  const map = {
    forward: "forwardKeyButton",
    reverse: "reverseKeyButton",
    left: "leftKeyButton",
    right: "rightKeyButton",
    boost: "boostKeyButton"
  };

  Object.keys(map).forEach(action => {
    const button =
      document.getElementById(map[action]);

    if (!button) return;

    let text =
      gameState.controls[action];

    if (text === " ") {
      text = "SPACE";
    }

    button.textContent =
      text.toUpperCase();
  });
}

function resetControls() {
  gameState.controls = {
    ...DEFAULT_CONTROLS
  };

  updateSettingsButtons();
  updateControlDisplay();
}

function waitForNewKey(action) {
  gameState.currentSetting = action;

  const ids = {
    forward: "forwardKeyButton",
    reverse: "reverseKeyButton",
    left: "leftKeyButton",
    right: "rightKeyButton",
    boost: "boostKeyButton"
  };

  const button =
    document.getElementById(ids[action]);

  if (!button) return;

  button.classList.add("waiting");
  button.textContent = "PRESS A KEY...";
}

function handleSettingKey(event) {
  if (!gameState.currentSetting) {
    return false;
  }

  event.preventDefault();

  const key =
    normalizeKey(event.key);

  if (
    key === "escape" ||
    key === "tab"
  ) {
    gameState.currentSetting = null;
    updateSettingsButtons();
    return true;
  }

  gameState.controls[
    gameState.currentSetting
  ] = key;

  gameState.currentSetting = null;

  updateSettingsButtons();
  updateControlDisplay();

  return true;
}

/* =========================================================
   HOW TO PLAY
========================================================= */

function openHowToPlay() {
  hide(mainMenu);

  if (!howToPlayMenu) return;

  show(howToPlayMenu);

  updateHowToPlayKeys();
}

function updateHowToPlayKeys() {
  const ids = {
    forward: "howZKey",
    reverse: "howSKey",
    left: "howQKey",
    right: "howDKey",
    boost: "howSpaceKey"
  };

  Object.keys(ids).forEach(action => {
    const element =
      document.getElementById(ids[action]);

    if (!element) return;

    let key =
      gameState.controls[action];

    if (key === " ") {
      key = "SPACE";
    }

    element.textContent =
      key.toUpperCase();
  });
}

/* =========================================================
   CONTROL DISPLAY
========================================================= */

function updateControlDisplay() {
  const controls = document.querySelectorAll(
    "#controls b"
  );

  if (!controls.length) return;

  const values = [
    gameState.controls.forward,
    gameState.controls.reverse,
    gameState.controls.left,
    gameState.controls.right,
    gameState.controls.boost,
    "P"
  ];

  controls.forEach((element, index) => {
    if (index >= values.length) return;

    let value = values[index];

    if (value === " ") {
      value = "SPACE";
    }

    element.textContent =
      value.toUpperCase();
  });
}

/* =========================================================
   OFFLINE MATCH
========================================================= */

function startOfflineMatch() {
  gameState.mode = "offline";
  gameState.matchMode = "offline";

  player.team = "blue";
  opponent.team = "orange";

  hide(mainMenu);

  resetMatch();

  showMatchIntro();

  setTimeout(() => {
    startCountdown();
  }, 900);
}

/* =========================================================
   ONLINE MATCHMAKING
========================================================= */

function getWebSocketURL() {
  return SERVER_URL;
}

function startOnlineSearch() {
  if (gameState.onlineSearching) {
    return;
  }

  gameState.mode = "online";
  gameState.matchMode = "online";

  hide(mainMenu);

  createSearchScreen();

  connectWebSocket();
}

function createSearchScreen() {
  const existing =
    document.getElementById("searchMenu");

  if (existing) {
    existing.remove();
  }

  const searchMenu =
    document.createElement("div");

  searchMenu.id = "searchMenu";
  searchMenu.className = "menu-screen";

  searchMenu.innerHTML = `
    <div class="menu-background"></div>

    <div class="panel">

      <h2>1V1 ONLINE</h2>

      <p
        id="searchStatus"
        style="
          color:#91a2b4;
          font-size:12px;
          margin:30px 0;
        "
      >
        CONNEXION AU SERVEUR...
      </p>

      <button
        id="cancelSearchButton"
        class="secondary-button">
        CANCEL
      </button>

    </div>
  `;

  document.body.appendChild(searchMenu);

  document
    .getElementById("cancelSearchButton")
    .addEventListener(
      "click",
      cancelOnlineSearch
    );
}

function updateSearchStatus(text) {
  const element =
    document.getElementById("searchStatus");

  if (element) {
    element.textContent = text;
  }
}

function connectWebSocket() {
  closeWebSocket(false);

  try {
    gameState.websocket =
      new WebSocket(
        getWebSocketURL()
      );
  } catch (error) {
    updateSearchStatus(
      "IMPOSSIBLE DE SE CONNECTER AU SERVEUR"
    );

    return;
  }

  gameState.websocket.addEventListener(
    "open",
    () => {
      gameState.onlineConnected = true;
      gameState.onlineSearching = true;

      updateSearchStatus(
        "RECHERCHE D'UN ADVERSAIRE..."
      );

      sendSocket({
        type: "find-match"
      });
    }
  );

  gameState.websocket.addEventListener(
    "message",
    event => {
      handleSocketMessage(event.data);
    }
  );

  gameState.websocket.addEventListener(
    "close",
    () => {
      gameState.onlineConnected = false;

      if (
        gameState.onlineSearching
      ) {
        updateSearchStatus(
          "CONNEXION PERDUE"
        );
      }
    }
  );

  gameState.websocket.addEventListener(
    "error",
    () => {
      gameState.onlineConnected = false;

      updateSearchStatus(
        "ERREUR DE CONNEXION"
      );
    }
  );
}

function sendSocket(data) {
  if (
    !gameState.websocket ||
    gameState.websocket.readyState !==
      WebSocket.OPEN
  ) {
    return;
  }

  gameState.websocket.send(
    JSON.stringify(data)
  );
}

function handleSocketMessage(raw) {
  let data;

  try {
    data =
      typeof raw === "string"
        ? JSON.parse(raw)
        : JSON.parse(
            new TextDecoder().decode(raw)
          );
  } catch {
    return;
  }

  switch (data.type) {
    case "connected":
      gameState.playerId =
        data.playerId;
      break;

    case "searching":
      gameState.onlineSearching = true;

      updateSearchStatus(
        "RECHERCHE D'UN ADVERSAIRE..."
      );
      break;

    case "match-found":
      handleMatchFound(data);
      break;

    case "opponent-input":
      handleOpponentInput(
        data.input
      );
      break;

    case "game-state":
      handleRemoteGameState(
        data.state
      );
      break;

    case "opponent-left":
      handleOpponentLeft();
      break;

    case "search-cancelled":
      gameState.onlineSearching = false;
      break;

    case "pong":
      break;
  }
}

function handleMatchFound(data) {
  gameState.onlineSearching = false;
  gameState.onlineConnected = true;

  gameState.matchId =
    data.matchId;

  gameState.playerNumber =
    data.playerNumber;

  gameState.team =
    data.team;

  gameState.isHost =
    data.isHost;

  player.team =
    data.team || "blue";

  opponent.team =
    player.team === "blue"
      ? "orange"
      : "blue";

  resetMatch();

  hide(
    document.getElementById(
      "searchMenu"
    )
  );

  showMatchIntro();

  setTimeout(() => {
    startCountdown();
  }, 900);
}

function cancelOnlineSearch() {
  if (gameState.onlineConnected) {
    sendSocket({
      type: "cancel-search"
    });
  }

  gameState.onlineSearching = false;

  closeWebSocket(true);

  const searchMenu =
    document.getElementById(
      "searchMenu"
    );

  if (searchMenu) {
    searchMenu.remove();
  }

  show(mainMenu);
}

function closeWebSocket(sendLeave) {
  if (!gameState.websocket) {
    return;
  }

  if (sendLeave) {
    sendSocket({
      type: "leave-match"
    });
  }

  try {
    gameState.websocket.close();
  } catch {}

  gameState.websocket = null;

  gameState.onlineConnected = false;
}

/* =========================================================
   ONLINE INPUT
========================================================= */

function sendPlayerInput() {
  if (
    gameState.mode !== "online" ||
    !gameState.onlineConnected
  ) {
    return;
  }

  sendSocket({
    type: "input",
    input: {
      forward:
        !!gameState.keys[
          gameState.controls.forward
        ],

      reverse:
        !!gameState.keys[
          gameState.controls.reverse
        ],

      left:
        !!gameState.keys[
          gameState.controls.left
        ],

      right:
        !!gameState.keys[
          gameState.controls.right
        ],

      boost:
        !!gameState.keys[
          gameState.controls.boost
        ]
    }
  });
}

function handleOpponentInput(input) {
  if (!input) return;

  opponent.remoteInput =
    input;
}

function handleRemoteGameState(state) {
  if (!state) return;

  if (
    typeof state.ballX === "number"
  ) {
    ball.x = state.ballX;
  }

  if (
    typeof state.ballY === "number"
  ) {
    ball.y = state.ballY;
  }

  if (
    typeof state.ballVX === "number"
  ) {
    ball.vx = state.ballVX;
  }

  if (
    typeof state.ballVY === "number"
  ) {
    ball.vy = state.ballVY;
  }

  if (
    typeof state.blueScore === "number"
  ) {
    gameState.blueScore =
      state.blueScore;
  }

  if (
    typeof state.orangeScore === "number"
  ) {
    gameState.orangeScore =
      state.orangeScore;
  }

  if (
    typeof state.timeRemaining === "number"
  ) {
    gameState.timeRemaining =
      state.timeRemaining;
  }

  if (
    typeof state.opponentX === "number"
  ) {
    opponent.x =
      state.opponentX;
  }

  if (
    typeof state.opponentY === "number"
  ) {
    opponent.y =
      state.opponentY;
  }

  if (
    typeof state.opponentVX === "number"
  ) {
    opponent.vx =
      state.opponentVX;
  }

  if (
    typeof state.opponentVY === "number"
  ) {
    opponent.vy =
      state.opponentVY;
  }

  if (
    typeof state.opponentAngle === "number"
  ) {
    opponent.angle =
      state.opponentAngle;
  }

  updateHUD();
}

function handleOpponentLeft() {
  if (
    gameState.mode !== "online"
  ) {
    return;
  }

  gameState.running = false;

  closeWebSocket(false);

  showEndScreen(
    gameState.team === "blue"
      ? "BLUE WINS"
      : "ORANGE WINS",
    "OPPONENT LEFT"
  );
}

/* =========================================================
   AUTHORITATIVE ONLINE STATE
========================================================= */

function sendGameState() {
  if (
    gameState.mode !== "online" ||
    !gameState.isHost ||
    !gameState.onlineConnected
  ) {
    return;
  }

  sendSocket({
    type: "game-state",

    state: {
      ballX: ball.x,
      ballY: ball.y,

      ballVX: ball.vx,
      ballVY: ball.vy,

      blueScore:
        gameState.blueScore,

      orangeScore:
        gameState.orangeScore,

      timeRemaining:
        gameState.timeRemaining,

      opponentX:
        opponent.x,

      opponentY:
        opponent.y,

      opponentVX:
        opponent.vx,

      opponentVY:
        opponent.vy,

      opponentAngle:
        opponent.angle
    }
  });
}

/* =========================================================
   MATCH INTRO
========================================================= */

function showMatchIntro() {
  if (!matchIntro) return;

  show(matchIntro);

  const blue =
    matchIntro.querySelector(
      ".blue-intro"
    );

  const orange =
    matchIntro.querySelector(
      ".orange-intro"
    );

  if (blue) {
    blue.textContent = "BLUE";
  }

  if (orange) {
    orange.textContent = "ORANGE";
  }
}

/* =========================================================
   COUNTDOWN
========================================================= */

function startCountdown() {
  if (gameState.running) return;

  hide(matchIntro);

  gameState.countdown = true;

  show(countdownElement);

  let number = 3;

  countdownElement.textContent =
    number;

  const interval =
    setInterval(() => {
      number--;

      if (number > 0) {
        countdownElement.textContent =
          number;
        return;
      }

      if (number === 0) {
        countdownElement.textContent =
          "GO!";
        return;
      }

      clearInterval(interval);

      hide(countdownElement);

      gameState.countdown = false;
      gameState.running = true;
      gameState.paused = false;
    }, 800);
}

/* =========================================================
   RESET BOOST PADS
========================================================= */

function resetBoostPads() {
  BOOST_PADS.forEach(pad => {
    pad.active = true;
    pad.respawnAt = 0;
  });
}

function updateBoostPads() {
  const now = Date.now();

  BOOST_PADS.forEach(pad => {
    if (
      !pad.active &&
      now >= pad.respawnAt
    ) {
      pad.active = true;
      pad.respawnAt = 0;
    }
  });
}

function collectBoostPad(car) {
  BOOST_PADS.forEach(pad => {
    if (!pad.active) return;

    const dist =
      Math.hypot(
        car.x - pad.x,
        car.y - pad.y
      );

    if (dist > 32) return;

    car.boost =
      Math.min(
        BOOST_MAX,
        car.boost + BOOST_PAD_AMOUNT
      );

    pad.active = false;

    pad.respawnAt =
      Date.now() +
      BOOST_PAD_RESPAWN_TIME;
  });
}

/* =========================================================
   MATCH RESET
========================================================= */

function resetMatch() {
  gameState.running = false;
  gameState.paused = false;

  gameState.timeRemaining =
    MATCH_DURATION;

  gameState.blueScore = 0;
  gameState.orangeScore = 0;

  gameState.playerPoints = 0;

  gameState.blueGoals = 0;
  gameState.orangeGoals = 0;

  gameState.goalInProgress = false;

  gameState.lastBallTouchBy = null;
  gameState.lastSaveBy = null;

  player.x =
    player.team === "orange"
      ? 900
      : 300;

  player.y =
    CANVAS_HEIGHT / 2;

  player.vx = 0;
  player.vy = 0;

  player.angle =
    player.team === "orange"
      ? Math.PI
      : 0;

  player.boost =
    BOOST_MAX;

  opponent.x =
    player.team === "orange"
      ? 300
      : 900;

  opponent.y =
    CANVAS_HEIGHT / 2;

  opponent.vx = 0;
  opponent.vy = 0;

  opponent.angle =
    player.team === "orange"
      ? 0
      : Math.PI;

  opponent.boost =
    BOOST_MAX;

  opponent.remoteInput = null;

  bot.x = 900;
  bot.y =
    CANVAS_HEIGHT / 2;

  bot.vx = 0;
  bot.vy = 0;

  bot.angle =
    Math.PI;

  bot.boost =
    BOOST_MAX;

  resetBall();

  resetBoostPads();

  updateHUD();

  hide(goalMessage);
  hide(pauseMenu);
  hide(endScreen);
}

/* =========================================================
   BALL
========================================================= */

function resetBall() {
  ball.x =
    CANVAS_WIDTH / 2;

  ball.y =
    CANVAS_HEIGHT / 2;

  ball.vx = 0;
  ball.vy = 0;
}

function limitBallSpeed() {
  const speed =
    Math.hypot(
      ball.vx,
      ball.vy
    );

  if (speed <= MAX_BALL_SPEED) {
    return;
  }

  const factor =
    MAX_BALL_SPEED /
    speed;

  ball.vx *= factor;
  ball.vy *= factor;
}

/* =========================================================
   PLAYER MOVEMENT
========================================================= */

function updatePlayer() {
  const forward =
    !!gameState.keys[
      gameState.controls.forward
    ];

  const reverse =
    !!gameState.keys[
      gameState.controls.reverse
    ];

  const left =
    !!gameState.keys[
      gameState.controls.left
    ];

  const right =
    !!gameState.keys[
      gameState.controls.right
    ];

  const boost =
    !!gameState.keys[
      gameState.controls.boost
    ];

  let acceleration = 0;

  if (forward) {
    acceleration +=
      PLAYER_ACCELERATION;
  }

  if (reverse) {
    acceleration -=
      PLAYER_ACCELERATION * 0.7;
  }

  player.vx +=
    Math.cos(player.angle) *
    acceleration;

  player.vy +=
    Math.sin(player.angle) *
    acceleration;

  if (left) {
    player.angle -= 0.055;
  }

  if (right) {
    player.angle += 0.055;
  }

  if (
    boost &&
    player.boost > 0
  ) {
    player.vx +=
      Math.cos(player.angle) *
      BOOST_USE_SPEED;

    player.vy +=
      Math.sin(player.angle) *
      BOOST_USE_SPEED;

    player.boost =
      Math.max(
        0,
        player.boost - 0.9
      );
  } else {
    player.boost =
      Math.min(
        BOOST_MAX,
        player.boost +
          BOOST_RECHARGE
      );
  }

  player.vx *=
    PLAYER_FRICTION;

  player.vy *=
    PLAYER_FRICTION;

  limitPlayerSpeed();

  player.x += player.vx;
  player.y += player.vy;

  keepCarInsideField(player);

  collectBoostPad(player);

  player.speed =
    Math.hypot(
      player.vx,
      player.vy
    );
}

function limitPlayerSpeed() {
  const speed =
    Math.hypot(
      player.vx,
      player.vy
    );

  if (
    speed <= PLAYER_MAX_SPEED
  ) {
    return;
  }

  const factor =
    PLAYER_MAX_SPEED /
    speed;

  player.vx *= factor;
  player.vy *= factor;
}

function keepCarInsideField(car) {
  const margin = 35;

  car.x =
    clamp(
      car.x,
      margin,
      CANVAS_WIDTH - margin
    );

  car.y =
    clamp(
      car.y,
      margin,
      CANVAS_HEIGHT - margin
    );
}

/* =========================================================
   OFFLINE AI
========================================================= */

function updateBot() {
  const targetX = ball.x;
  const targetY = ball.y;

  const dx =
    targetX - bot.x;

  const dy =
    targetY - bot.y;

  const targetAngle =
    Math.atan2(dy, dx);

  let angleDifference =
    targetAngle - bot.angle;

  while (
    angleDifference > Math.PI
  ) {
    angleDifference -=
      Math.PI * 2;
  }

  while (
    angleDifference < -Math.PI
  ) {
    angleDifference +=
      Math.PI * 2;
  }

  if (
    angleDifference > 0.05
  ) {
    bot.angle += 0.045;
  }

  if (
    angleDifference < -0.05
  ) {
    bot.angle -= 0.045;
  }

  bot.vx +=
    Math.cos(bot.angle) *
    0.27;

  bot.vy +=
    Math.sin(bot.angle) *
    0.27;

  const speed =
    Math.hypot(
      bot.vx,
      bot.vy
    );

  if (
    speed > BOT_MAX_SPEED
  ) {
    const factor =
      BOT_MAX_SPEED /
      speed;

    bot.vx *= factor;
    bot.vy *= factor;
  }

  if (
    distance(bot, ball) < 180 &&
    bot.boost > 0
  ) {
    bot.vx +=
      Math.cos(bot.angle) *
      0.35;

    bot.vy +=
      Math.sin(bot.angle) *
      0.35;

    bot.boost =
      Math.max(
        0,
        bot.boost - 0.7
      );
  } else {
    bot.boost =
      Math.min(
        BOOST_MAX,
        bot.boost + 0.15
      );
  }

  bot.vx *=
    PLAYER_FRICTION;

  bot.vy *=
    PLAYER_FRICTION;

  bot.x += bot.vx;
  bot.y += bot.vy;

  keepCarInsideField(bot);

  collectBoostPad(bot);

  bot.speed =
    Math.hypot(
      bot.vx,
      bot.vy
    );
}

/* =========================================================
   ONLINE OPPONENT
========================================================= */

function updateOnlineOpponent() {
  if (!opponent.remoteInput) {
    return;
  }

  const input =
    opponent.remoteInput;

  if (input.left) {
    opponent.angle -= 0.055;
  }

  if (input.right) {
    opponent.angle += 0.055;
  }

  if (input.forward) {
    opponent.vx +=
      Math.cos(opponent.angle) *
      PLAYER_ACCELERATION;

    opponent.vy +=
      Math.sin(opponent.angle) *
      PLAYER_ACCELERATION;
  }

  if (input.reverse) {
    opponent.vx -=
      Math.cos(opponent.angle) *
      PLAYER_ACCELERATION *
      0.7;

    opponent.vy -=
      Math.sin(opponent.angle) *
      PLAYER_ACCELERATION *
      0.7;
  }

  if (
    input.boost &&
    opponent.boost > 0
  ) {
    opponent.vx +=
      Math.cos(opponent.angle) *
      BOOST_USE_SPEED;

    opponent.vy +=
      Math.sin(opponent.angle) *
      BOOST_USE_SPEED;

    opponent.boost =
      Math.max(
        0,
        opponent.boost - 0.9
      );
  } else {
    opponent.boost =
      Math.min(
        BOOST_MAX,
        opponent.boost +
          BOOST_RECHARGE
      );
  }

  opponent.vx *=
    PLAYER_FRICTION;

  opponent.vy *=
    PLAYER_FRICTION;

  const speed =
    Math.hypot(
      opponent.vx,
      opponent.vy
    );

  if (
    speed > PLAYER_MAX_SPEED
  ) {
    const factor =
      PLAYER_MAX_SPEED /
      speed;

    opponent.vx *= factor;
    opponent.vy *= factor;
  }

  opponent.x +=
    opponent.vx;

  opponent.y +=
    opponent.vy;

  keepCarInsideField(opponent);

  collectBoostPad(opponent);
}

/* =========================================================
   BALL PHYSICS
========================================================= */

function updateBall() {
  ball.x += ball.vx;
  ball.y += ball.vy;

  ball.vx *= 0.992;
  ball.vy *= 0.992;

  if (
    ball.y - BALL_RADIUS < 20
  ) {
    ball.y =
      20 + BALL_RADIUS;

    ball.vy =
      Math.abs(ball.vy);
  }

  if (
    ball.y + BALL_RADIUS >
    CANVAS_HEIGHT - 20
  ) {
    ball.y =
      CANVAS_HEIGHT -
      20 -
      BALL_RADIUS;

    ball.vy =
      -Math.abs(ball.vy);
  }

  const inGoalOpening =
    ball.y >= GOAL_TOP &&
    ball.y <= GOAL_BOTTOM;

  if (
    ball.x - BALL_RADIUS < 20
  ) {
    if (inGoalOpening) {
      scoreGoal("orange");
      return;
    }

    ball.x =
      20 + BALL_RADIUS;

    ball.vx =
      Math.abs(ball.vx);
  }

  if (
    ball.x + BALL_RADIUS >
    CANVAS_WIDTH - 20
  ) {
    if (inGoalOpening) {
      scoreGoal("blue");
      return;
    }

    ball.x =
      CANVAS_WIDTH -
      20 -
      BALL_RADIUS;

    ball.vx =
      -Math.abs(ball.vx);
  }

  limitBallSpeed();
}

/* =========================================================
   SAVE ZONES
========================================================= */

function isInsideSaveZone(car, team) {
  if (team === "blue") {
    return (
      car.x >= 20 &&
      car.x <=
        20 + SAVE_ZONE_WIDTH &&
      car.y >=
        GOAL_TOP - 35 &&
      car.y <=
        GOAL_BOTTOM + 35
    );
  }

  return (
    car.x >=
      CANVAS_WIDTH -
      20 -
      SAVE_ZONE_WIDTH &&
    car.x <=
      CANVAS_WIDTH - 20 &&
    car.y >=
      GOAL_TOP - 35 &&
    car.y <=
      GOAL_BOTTOM + 35
  );
}

function checkForSave(car, team) {
  if (
    gameState.lastBallTouchBy === car
  ) {
    return;
  }

  if (
    !isInsideSaveZone(car, team)
  ) {
    return;
  }

  const ballHeadingTowardGoal =
    team === "blue"
      ? ball.vx < 0
      : ball.vx > 0;

  if (!ballHeadingTowardGoal) {
    return;
  }

  const dist =
    distance(car, ball);

  if (
    dist >
    PLAYER_RADIUS +
    BALL_RADIUS +
    25
  ) {
    return;
  }

  if (
    gameState.lastSaveBy === car
  ) {
    return;
  }

  gameState.lastSaveBy = car;

  addPoints(
    50,
    car === player
  );

  if (car === player) {
    createPointNotification(
      "+50 SAVE"
    );
  }

  setTimeout(() => {
    if (
      gameState.lastSaveBy === car
    ) {
      gameState.lastSaveBy = null;
    }
  }, 500);
}

/* =========================================================
   CAR / BALL COLLISION
========================================================= */

function collideCarWithBall(car, team) {
  const dx =
    ball.x - car.x;

  const dy =
    ball.y - car.y;

  const dist =
    Math.hypot(dx, dy);

  const minDistance =
    PLAYER_RADIUS +
    BALL_RADIUS;

  if (
    dist === 0 ||
    dist >= minDistance
  ) {
    return;
  }

  const nx =
    dx / dist;

  const ny =
    dy / dist;

  const overlap =
    minDistance - dist;

  car.x -=
    nx * overlap * 0.5;

  car.y -=
    ny * overlap * 0.5;

  ball.x +=
    nx * overlap * 0.5;

  ball.y +=
    ny * overlap * 0.5;

  const carVelocity =
    car.vx * nx +
    car.vy * ny;

  ball.vx +=
    nx *
    (2.2 + Math.abs(carVelocity));

  ball.vy +=
    ny *
    (2.2 + Math.abs(carVelocity));

  limitBallSpeed();

  gameState.lastBallTouchBy =
    car;

  addPoints(
    2,
    car === player
  );

  if (
    car === player
  ) {
    createPointNotification(
      "+2 BALL TOUCH"
    );
  }

  checkForSave(
    car,
    team
  );
}

/* =========================================================
   GOALS
========================================================= */

function scoreGoal(team) {
  if (
    gameState.goalInProgress
  ) {
    return;
  }

  gameState.goalInProgress = true;

  if (team === "blue") {
    gameState.blueScore++;
    gameState.blueGoals++;
  } else {
    gameState.orangeScore++;
    gameState.orangeGoals++;
  }

  addPoints(
    150,
    team === player.team
  );

  if (team === player.team) {
    createPointNotification(
      "+150 GOAL"
    );
  }

  showGoalOverlay(team);

  updateHUD();

  if (
    gameState.mode === "online" &&
    gameState.isHost
  ) {
    sendGameState();
  }

  setTimeout(() => {
    resetBall();

    gameState.lastBallTouchBy = null;
    gameState.lastSaveBy = null;

    gameState.goalInProgress = false;

    hide(goalMessage);
  }, 1600);
}

function showGoalOverlay(team) {
  show(goalMessage);

  if (goalText) {
    goalText.textContent =
      "GOAL!";
  }

  if (goalScorer) {
    goalScorer.textContent =
      team.toUpperCase() +
      " SCORED";
  }
}

/* =========================================================
   POINTS
========================================================= */

function addPoints(amount, belongsToPlayer) {
  if (!belongsToPlayer) {
    return;
  }

  gameState.playerPoints +=
    amount;

  updateHUD();

  if (playerPointsElement) {
    const panel =
      playerPointsElement
        .parentElement;

    if (panel) {
      panel.classList.remove(
        "earned"
      );

      void panel.offsetWidth;

      panel.classList.add(
        "earned"
      );
    }
  }
}

function createPointNotification(text) {
  if (!gameWrapper) return;

  const element =
    document.createElement("div");

  element.className =
    "points-notification";

  element.textContent = text;

  const arena =
    document.getElementById(
      "arenaContainer"
    );

  if (!arena) return;

  arena.appendChild(element);

  requestAnimationFrame(() => {
    element.classList.add(
      "show"
    );
  });

  setTimeout(() => {
    element.remove();
  }, 1300);
}

/* =========================================================
   UPDATE HUD
========================================================= */

function updateHUD() {
  if (blueScoreElement) {
    blueScoreElement.textContent =
      gameState.blueScore;
  }

  if (orangeScoreElement) {
    orangeScoreElement.textContent =
      gameState.orangeScore;
  }

  if (timerElement) {
    timerElement.textContent =
      formatTime(
        gameState.timeRemaining
      );
  }

  if (playerPointsElement) {
    playerPointsElement.textContent =
      gameState.playerPoints;
  }

  if (boostFill) {
    boostFill.style.width =
      player.boost + "%";
  }

  if (boostNumber) {
    boostNumber.textContent =
      Math.round(
        player.boost
      );
  }

  if (speedNumber) {
    const speedKmh =
      Math.round(
        player.speed * 7.1
      );

    speedNumber.textContent =
      speedKmh;
  }
}

/* =========================================================
   GAME TIMER
========================================================= */

function updateTimer(delta) {
  gameState.timeRemaining -=
    delta;

  if (
    gameState.timeRemaining <= 0
  ) {
    gameState.timeRemaining = 0;

    endMatch();

    return;
  }

  if (
    gameState.mode === "online" &&
    gameState.isHost
  ) {
    sendGameState();
  }

  updateHUD();
}

/* =========================================================
   PAUSE
========================================================= */

function togglePause() {
  if (
    !gameState.running ||
    gameState.mode === "online"
  ) {
    return;
  }

  gameState.paused =
    !gameState.paused;

  if (gameState.paused) {
    show(pauseMenu);
  } else {
    hide(pauseMenu);
  }
}

/* =========================================================
   END MATCH
========================================================= */

function endMatch() {
  if (!gameState.running) {
    return;
  }

  gameState.running = false;

  let winner = "DRAW";

  if (
    gameState.blueScore >
    gameState.orangeScore
  ) {
    winner = "BLUE WINS";
  }

  if (
    gameState.orangeScore >
    gameState.blueScore
  ) {
    winner = "ORANGE WINS";
  }

  showEndScreen(
    winner,
    "MATCH FINISHED"
  );
}

function showEndScreen(
  winner,
  reason
) {
  hide(pauseMenu);
  hide(goalMessage);

  if (endScreen) {
    show(endScreen);
  }

  if (finalScore) {
    finalScore.textContent =
      `${gameState.blueScore} - ${gameState.orangeScore}`;
  }

  const winnerDisplay =
    document.getElementById(
      "winnerDisplay"
    );

  if (winnerDisplay) {
    winnerDisplay.textContent =
      winner;
  }

  const resultTitle =
    document.querySelector(
      ".result-title"
    );

  if (resultTitle) {
    resultTitle.textContent =
      reason;
  }
}

/* =========================================================
   MAIN MENU AFTER MATCH
========================================================= */

function returnToMainMenu() {
  gameState.running = false;
  gameState.paused = false;

  closeWebSocket(true);

  hide(endScreen);
  hide(pauseMenu);
  hide(matchIntro);
  hide(countdownElement);
  hide(goalMessage);

  const searchMenu =
    document.getElementById(
      "searchMenu"
    );

  if (searchMenu) {
    searchMenu.remove();
  }

  buildMainMenu();
}

/* =========================================================
   RESTART
========================================================= */

function restartMatch() {
  hide(endScreen);

  resetMatch();

  showMatchIntro();

  setTimeout(() => {
    startCountdown();
  }, 500);
}

/* =========================================================
   RENDER FIELD
========================================================= */

function drawField() {
  if (!ctx) return;

  ctx.clearRect(
    0,
    0,
    CANVAS_WIDTH,
    CANVAS_HEIGHT
  );

  /* Fond */

  ctx.fillStyle =
    "#071421";

  ctx.fillRect(
    0,
    0,
    CANVAS_WIDTH,
    CANVAS_HEIGHT
  );

  /* Bordure */

  ctx.strokeStyle =
    "rgba(120,210,255,0.25)";

  ctx.lineWidth = 2;

  ctx.strokeRect(
    20,
    20,
    CANVAS_WIDTH - 40,
    CANVAS_HEIGHT - 40
  );

  /* Ligne centrale */

  ctx.beginPath();

  ctx.moveTo(
    CANVAS_WIDTH / 2,
    20
  );

  ctx.lineTo(
    CANVAS_WIDTH / 2,
    CANVAS_HEIGHT - 20
  );

  ctx.stroke();

  /* Cercle central */

  ctx.beginPath();

  ctx.arc(
    CANVAS_WIDTH / 2,
    CANVAS_HEIGHT / 2,
    85,
    0,
    Math.PI * 2
  );

  ctx.stroke();

  /* Petit cercle central */

  ctx.beginPath();

  ctx.arc(
    CANVAS_WIDTH / 2,
    CANVAS_HEIGHT / 2,
    8,
    0,
    Math.PI * 2
  );

  ctx.fillStyle =
    "rgba(255,255,255,0.7)";

  ctx.fill();

  /* Ligne de surface gauche */

  ctx.beginPath();

  ctx.moveTo(
    160,
    20
  );

  ctx.lineTo(
    160,
    CANVAS_HEIGHT - 20
  );

  ctx.stroke();

  /* Ligne de surface droite */

  ctx.beginPath();

  ctx.moveTo(
    CANVAS_WIDTH - 160,
    20
  );

  ctx.lineTo(
    CANVAS_WIDTH - 160,
    CANVAS_HEIGHT - 20
  );

  ctx.stroke();

  /* Cage gauche */

  ctx.fillStyle =
    "rgba(40,200,255,0.08)";

  ctx.fillRect(
    0,
    GOAL_TOP,
    GOAL_DEPTH,
    GOAL_BOTTOM - GOAL_TOP
  );

  ctx.strokeStyle =
    "rgba(40,200,255,0.6)";

  ctx.strokeRect(
    0,
    GOAL_TOP,
    GOAL_DEPTH,
    GOAL_BOTTOM - GOAL_TOP
  );

  /* Cage droite */

  ctx.fillStyle =
    "rgba(255,130,30,0.08)";

  ctx.fillRect(
    CANVAS_WIDTH - GOAL_DEPTH,
    GOAL_TOP,
    GOAL_DEPTH,
    GOAL_BOTTOM - GOAL_TOP
  );

  ctx.strokeStyle =
    "rgba(255,130,30,0.6)";

  ctx.strokeRect(
    CANVAS_WIDTH - GOAL_DEPTH,
    GOAL_TOP,
    GOAL_DEPTH,
    GOAL_BOTTOM - GOAL_TOP
  );

  drawBoostPads();
}

/* =========================================================
   DRAW BOOST PADS
========================================================= */

function drawBoostPads() {
  BOOST_PADS.forEach(pad => {
    ctx.save();

    ctx.beginPath();

    ctx.arc(
      pad.x,
      pad.y,
      18,
      0,
      Math.PI * 2
    );

    if (pad.active) {
      ctx.fillStyle =
        "#baff35";

      ctx.shadowBlur = 20;
      ctx.shadowColor =
        "#8cff00";

      ctx.fill();

      ctx.beginPath();

      ctx.arc(
        pad.x,
        pad.y,
        8,
        0,
        Math.PI * 2
      );

      ctx.fillStyle =
        "#ffffff";

      ctx.fill();
    } else {
      ctx.fillStyle =
        "rgba(80,90,100,0.35)";

      ctx.fill();

      ctx.strokeStyle =
        "rgba(150,160,170,0.25)";

      ctx.stroke();
    }

    ctx.restore();
  });
}

/* =========================================================
   DRAW BALL
========================================================= */

function drawBall() {
  if (!ctx) return;

  ctx.save();

  ctx.beginPath();

  ctx.arc(
    ball.x,
    ball.y,
    BALL_RADIUS,
    0,
    Math.PI * 2
  );

  ctx.fillStyle =
    "#ffffff";

  ctx.shadowBlur = 18;
  ctx.shadowColor =
    "#ffffff";

  ctx.fill();

  ctx.restore();
}

/* =========================================================
   DRAW CAR
========================================================= */

function drawCar(car) {
  if (!ctx) return;

  ctx.save();

  ctx.translate(
    car.x,
    car.y
  );

  ctx.rotate(
    car.angle
  );

  const blue =
    car.team === "blue";

  ctx.shadowBlur = 20;

  ctx.shadowColor =
    blue
      ? "#00aaff"
      : "#ff6a00";

  ctx.fillStyle =
    blue
      ? "#20cfff"
      : "#ff8a20";

  ctx.fillRect(
    -26,
    -16,
    52,
    32
  );

  ctx.fillStyle =
    "#071421";

  ctx.fillRect(
    -7,
    -12,
    18,
    24
  );

  ctx.fillStyle =
    "#ffffff";

  ctx.fillRect(
    15,
    -10,
    6,
    20
  );

  /* Roues */

  ctx.fillStyle =
    "#111111";

  ctx.fillRect(
    -20,
    -19,
    12,
    6
  );

  ctx.fillRect(
    8,
    -19,
    12,
    6
  );

  ctx.fillRect(
    -20,
    13,
    12,
    6
  );

  ctx.fillRect(
    8,
    13,
    12,
    6
  );

  ctx.restore();
}

/* =========================================================
   RENDER
========================================================= */

function render() {
  drawField();

  if (
    gameState.mode === "online"
  ) {
    drawCar(player);
    drawCar(opponent);
  } else {
    drawCar(player);
    drawCar(bot);
  }

  drawBall();
}

/* =========================================================
   GAME UPDATE
========================================================= */

function update(delta) {
  if (
    !gameState.running ||
    gameState.paused ||
    gameState.countdown
  ) {
    return;
  }

  updateBoostPads();

  updatePlayer();

  if (
    gameState.mode === "offline"
  ) {
    updateBot();

    collideCarWithBall(
      bot,
      "orange"
    );
  } else {
    updateOnlineOpponent();

    sendPlayerInput();
  }

  updateBall();

  if (
    gameState.mode === "online"
  ) {
    collideCarWithBall(
      opponent,
      opponent.team
    );

    checkForSave(
      opponent,
      opponent.team
    );
  }

  collideCarWithBall(
    player,
    player.team
  );

  checkForSave(
    player,
    player.team
  );

  updateTimer(delta);
}

/* =========================================================
   GAME LOOP
========================================================= */

function gameLoop(timestamp) {
  if (!gameState.lastFrame) {
    gameState.lastFrame =
      timestamp;
  }

  let delta =
    (timestamp -
      gameState.lastFrame) /
    1000;

  gameState.lastFrame =
    timestamp;

  delta =
    Math.min(delta, 0.05);

  update(delta);
  render();

  requestAnimationFrame(
    gameLoop
  );
}

/* =========================================================
   KEYBOARD
========================================================= */

window.addEventListener(
  "keydown",
  event => {
    if (
      gameState.currentSetting
    ) {
      handleSettingKey(event);
      return;
    }

    const key =
      normalizeKey(event.key);

    gameState.keys[key] = true;

    if (
      key === "p"
    ) {
      togglePause();
    }

    if (
      key === "escape" &&
      gameState.mode === "offline"
    ) {
      togglePause();
    }
  }
);

window.addEventListener(
  "keyup",
  event => {
    const key =
      normalizeKey(event.key);

    gameState.keys[key] = false;
  }
);

/* =========================================================
   BUTTON CONNECTIONS
========================================================= */

function connectExistingButtons() {
  const settingsButton =
    document.getElementById(
      "settingsButton"
    );

  if (settingsButton) {
    settingsButton.addEventListener(
      "click",
      openSettings
    );
  }

  const howToPlayButton =
    document.getElementById(
      "howToPlayButton"
    );

  if (howToPlayButton) {
    howToPlayButton.addEventListener(
      "click",
      openHowToPlay
    );
  }

  const backButton =
    document.getElementById(
      "backButton"
    );

  if (backButton) {
    backButton.addEventListener(
      "click",
      () => {
        hide(howToPlayMenu);
        show(mainMenu);
      }
    );
  }

  const settingsBackButton =
    document.getElementById(
      "settingsBackButton"
    );

  if (settingsBackButton) {
    settingsBackButton.addEventListener(
      "click",
      closeSettings
    );
  }

  const resetButton =
    document.getElementById(
      "resetControlsButton"
    );

  if (resetButton) {
    resetButton.addEventListener(
      "click",
      resetControls
    );
  }

  const actions = [
    "forward",
    "reverse",
    "left",
    "right",
    "boost"
  ];

  actions.forEach(action => {
    const button =
      document.querySelector(
        `[data-action="${action}"]`
      );

    if (!button) return;

    button.addEventListener(
      "click",
      () => {
        waitForNewKey(action);
      }
    );
  });

  const restartButton =
    document.getElementById(
      "restartButton"
    );

  if (restartButton) {
    restartButton.addEventListener(
      "click",
      restartMatch
    );
  }

  const mainMenuButton =
    document.getElementById(
      "mainMenuButton"
    );

  if (mainMenuButton) {
    mainMenuButton.addEventListener(
      "click",
      returnToMainMenu
    );
  }

  const confirmConcedeButton =
    document.getElementById(
      "confirmConcedeButton"
    );

  if (confirmConcedeButton) {
    confirmConcedeButton.addEventListener(
      "click",
      () => {
        gameState.running = false;

        hide(
          document.getElementById(
            "concedeConfirm"
          )
        );

        showEndScreen(
          "ORANGE WINS",
          "MATCH CONCEDED"
        );
      }
    );
  }

  const cancelConcedeButton =
    document.getElementById(
      "cancelConcedeButton"
    );

  if (cancelConcedeButton) {
    cancelConcedeButton.addEventListener(
      "click",
      () => {
        hide(
          document.getElementById(
            "concedeConfirm"
          )
        );
      }
    );
  }
}

/* =========================================================
   INITIALIZATION
========================================================= */

function initialize() {
  updateGameName();

  connectExistingButtons();

  updateSettingsButtons();
  updateHowToPlayKeys();
  updateControlDisplay();

  hide(gameWrapper);
  hide(mainMenu);
  hide(howToPlayMenu);
  hide(settingsMenu);
  hide(matchIntro);
  hide(resultScreen);
  hide(goalMessage);
  hide(countdownElement);
  hide(pauseMenu);
  hide(endScreen);

  createDeviceMenu();

  if (canvas) {
    canvas.width =
      CANVAS_WIDTH;

    canvas.height =
      CANVAS_HEIGHT;
  }

  resetBoostPads();

  updateHUD();

  requestAnimationFrame(
    gameLoop
  );
}

initialize();
