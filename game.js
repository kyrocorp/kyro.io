"use strict";

/* =========================================================
   TURBOKICK.IO - GAME.JS
   Jeu 2D
========================================================= */

/* =========================================================
   CONFIG
========================================================= */

const GAME_NAME = "TurboKick.io";

const CANVAS_WIDTH = 1200;
const CANVAS_HEIGHT = 700;

const MATCH_DURATION = 120;

const PLAYER_MAX_SPEED = 7.2;
const BOT_MAX_SPEED = 6.2;

const PLAYER_ACCELERATION = 0.32;
const PLAYER_FRICTION = 0.91;

const BOOST_MAX = 100;
const BOOST_USE_SPEED = 0.72;
const BOOST_RECHARGE = 0.18;

const BALL_RADIUS = 16;
const PLAYER_RADIUS = 28;

const MAX_BALL_SPEED = 13;

const FIELD_LEFT = 25;
const FIELD_RIGHT = CANVAS_WIDTH - 25;
const FIELD_TOP = 25;
const FIELD_BOTTOM = CANVAS_HEIGHT - 25;

const GOAL_TOP = 220;
const GOAL_BOTTOM = 480;
const GOAL_DEPTH = 80;

const GOAL_POST_RADIUS = 8;

const BOOST_PAD_RADIUS = 19;
const BOOST_PAD_AMOUNT = 100;
const BOOST_PAD_RESPAWN = 5000;

/* Serveur Render */

const SERVER_URL = "wss://kyro-io.onrender.com";

/* =========================================================
   CONTROLS
========================================================= */

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
  bluePoints: 0,
  orangePoints: 0,

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

  websocket: null,

  goalInProgress: false,

  lastFrame: 0,

  lastStateSent: 0,

  lastPointTime: {
    blue: 0,
    orange: 0
  },

  saveCooldown: {
    blue: 0,
    orange: 0
  }
};

/* =========================================================
   DOM
========================================================= */

const gameWrapper =
  document.getElementById("gameWrapper");

const mainMenu =
  document.getElementById("mainMenu");

const howToPlayMenu =
  document.getElementById("howToPlayMenu");

const settingsMenu =
  document.getElementById("settingsMenu");

const matchIntro =
  document.getElementById("matchIntro");

const resultScreen =
  document.getElementById("resultScreen");

const canvas =
  document.getElementById("gameCanvas");

const ctx =
  canvas
    ? canvas.getContext("2d")
    : null;

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
   PLAYERS
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

/* =========================================================
   BALL
========================================================= */

const ball = {
  x: CANVAS_WIDTH / 2,
  y: CANVAS_HEIGHT / 2,

  vx: 0,
  vy: 0,

  lastTouchTeam: null,
  lastTouchTime: 0
};

/* =========================================================
   6 BOOST PADS
========================================================= */

const boostPads = [
  {
    x: 135,
    y: 135,
    active: true,
    respawnAt: 0
  },

  {
    x: 135,
    y: CANVAS_HEIGHT - 135,
    active: true,
    respawnAt: 0
  },

  {
    x: CANVAS_WIDTH - 135,
    y: 135,
    active: true,
    respawnAt: 0
  },

  {
    x: CANVAS_WIDTH - 135,
    y: CANVAS_HEIGHT - 135,
    active: true,
    respawnAt: 0
  },

  {
    x: CANVAS_WIDTH / 2,
    y: 85,
    active: true,
    respawnAt: 0
  },

  {
    x: CANVAS_WIDTH / 2,
    y: CANVAS_HEIGHT - 85,
    active: true,
    respawnAt: 0
  }
];

/* =========================================================
   UTILS
========================================================= */

function clamp(value, min, max) {
  return Math.max(
    min,
    Math.min(max, value)
  );
}

function distance(a, b) {
  return Math.hypot(
    a.x - b.x,
    a.y - b.y
  );
}

function normalizeKey(key) {
  if (key === " ") {
    return " ";
  }

  return key.toLowerCase();
}

function formatTime(seconds) {
  seconds = Math.max(
    0,
    Math.ceil(seconds)
  );

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
   GAME NAME
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
        element.textContent =
          element.classList.contains("logo-io")
            ? "TURBOKICK.IO"
            : "TurboKick.io";
      }
    });
}

/* =========================================================
   DEVICE MENU
========================================================= */

function createDeviceMenu() {
  const menu =
    document.createElement("div");

  menu.id = "deviceMenu";
  menu.className = "menu-screen";

  menu.innerHTML = `
    <div class="menu-background"></div>

    <div class="menu-content">

      <div class="logo">

        <div class="logo-small">
          WELCOME TO
        </div>

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

      <div
        class="menu-buttons"
        style="margin-top:25px"
      >

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
    .addEventListener(
      "click",
      () => chooseDevice("pc")
    );

  document
    .getElementById("mobileDeviceButton")
    .addEventListener(
      "click",
      () => chooseDevice("mobile")
    );
}

function chooseDevice(device) {
  gameState.device = device;

  const deviceMenu =
    document.getElementById(
      "deviceMenu"
    );

  hide(deviceMenu);

  buildMainMenu();
}

/* =========================================================
   MAIN MENU
========================================================= */

function buildMainMenu() {
  if (!mainMenu) return;

  mainMenu.className =
    "menu-screen";

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
            style="
              width:100%;
              margin-bottom:12px;
            "
          >
            ⚙ SETTINGS
          </button>

          <button
            id="shopButton"
            class="secondary-button"
            style="width:100%"
          >
            🛒 SHOP
          </button>

        </div>

        <div>

          <button
            id="onlineButton"
            class="main-button"
            style="
              width:100%;
              margin-bottom:12px;
            "
          >
            🌐 1V1 ONLINE
          </button>

          <button
            id="offlineButton"
            class="secondary-button"
            style="width:100%"
          >
            🤖 1V1 OFFLINE
          </button>

        </div>

      </div>

      <div class="menu-footer">
        ${String(
          gameState.device || "PC"
        ).toUpperCase()} MODE
      </div>

    </div>
  `;

  show(mainMenu);

  document
    .getElementById("settingsButtonNew")
    .addEventListener(
      "click",
      openSettings
    );

  document
    .getElementById("shopButton")
    .addEventListener(
      "click",
      openShop
    );

  document
    .getElementById("onlineButton")
    .addEventListener(
      "click",
      startOnlineSearch
    );

  document
    .getElementById("offlineButton")
    .addEventListener(
      "click",
      startOfflineMatch
    );
}

/* =========================================================
   SHOP
========================================================= */

function openShop() {
  hide(mainMenu);

  const oldShop =
    document.getElementById(
      "shopMenu"
    );

  if (oldShop) {
    oldShop.remove();
  }

  const shop =
    document.createElement("div");

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
        class="secondary-button"
      >
        BACK
      </button>

    </div>
  `;

  document.body.appendChild(shop);

  document
    .getElementById("shopBackButton")
    .addEventListener(
      "click",
      () => {
        shop.remove();
        show(mainMenu);
      }
    );
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
  const ids = {
    forward: "forwardKeyButton",
    reverse: "reverseKeyButton",
    left: "leftKeyButton",
    right: "rightKeyButton",
    boost: "boostKeyButton"
  };

  Object.keys(ids).forEach(action => {
    const button =
      document.getElementById(
        ids[action]
      );

    if (!button) return;

    let key =
      gameState.controls[action];

    if (key === " ") {
      key = "SPACE";
    }

    button.textContent =
      key.toUpperCase();
  });
}

function resetControls() {
  gameState.controls = {
    ...DEFAULT_CONTROLS
  };

  gameState.currentSetting =
    null;

  updateSettingsButtons();
  updateHowToPlayKeys();
  updateControlDisplay();
}

function waitForNewKey(action) {
  gameState.currentSetting =
    action;

  const ids = {
    forward: "forwardKeyButton",
    reverse: "reverseKeyButton",
    left: "leftKeyButton",
    right: "rightKeyButton",
    boost: "boostKeyButton"
  };

  const button =
    document.getElementById(
      ids[action]
    );

  if (!button) return;

  button.textContent =
    "PRESS A KEY...";
}

function handleSettingKey(event) {
  if (!gameState.currentSetting) {
    return false;
  }

  event.preventDefault();

  const key =
    normalizeKey(event.key);

  if (key === "escape") {
    gameState.currentSetting =
      null;

    updateSettingsButtons();

    return true;
  }

  gameState.controls[
    gameState.currentSetting
  ] = key;

  gameState.currentSetting =
    null;

  updateSettingsButtons();
  updateHowToPlayKeys();
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
      document.getElementById(
        ids[action]
      );

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

function updateControlDisplay() {
  const values = [
    gameState.controls.forward,
    gameState.controls.reverse,
    gameState.controls.left,
    gameState.controls.right,
    gameState.controls.boost,
    "p"
  ];

  document
    .querySelectorAll("#controls b")
    .forEach((element, index) => {
      if (index >= values.length) {
        return;
      }

      let value = values[index];

      if (value === " ") {
        value = "SPACE";
      }

      element.textContent =
        value.toUpperCase();
    });
}

/* =========================================================
   OFFLINE
========================================================= */

function startOfflineMatch() {
  closeWebSocket(false);

  gameState.mode =
    "offline";

  gameState.team =
    "blue";

  player.team =
    "blue";

  opponent.team =
    "orange";

  hide(mainMenu);

  resetMatch();

  showMatchIntro();

  setTimeout(
    startCountdown,
    800
  );
}

/* =========================================================
   ONLINE
========================================================= */

function getWebSocketURL() {
  return SERVER_URL;
}

function startOnlineSearch() {
  hide(mainMenu);

  gameState.mode =
    "online";

  gameState.onlineSearching =
    true;

  createSearchScreen();

  connectWebSocket();
}

function createSearchScreen() {
  const old =
    document.getElementById(
      "searchMenu"
    );

  if (old) {
    old.remove();
  }

  const search =
    document.createElement("div");

  search.id = "searchMenu";
  search.className = "menu-screen";

  search.innerHTML = `
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
        class="secondary-button"
      >
        CANCEL
      </button>

    </div>
  `;

  document.body.appendChild(search);

  document
    .getElementById(
      "cancelSearchButton"
    )
    .addEventListener(
      "click",
      cancelOnlineSearch
    );
}

function updateSearchStatus(text) {
  const status =
    document.getElementById(
      "searchStatus"
    );

  if (status) {
    status.textContent =
      text;
  }
}

function connectWebSocket() {
  closeWebSocket(false);

  try {
    gameState.websocket =
      new WebSocket(
        getWebSocketURL()
      );
  } catch {
    updateSearchStatus(
      "ERREUR DE CONNEXION"
    );

    return;
  }

  gameState.websocket.addEventListener(
    "open",
    () => {
      gameState.onlineConnected =
        true;

      gameState.onlineSearching =
        true;

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
      handleSocketMessage(
        event.data
      );
    }
  );

  gameState.websocket.addEventListener(
    "close",
    () => {
      gameState.onlineConnected =
        false;

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
      gameState.onlineConnected =
        false;

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
      JSON.parse(raw);
  } catch {
    return;
  }

  if (!data) return;

  switch (data.type) {
    case "connected":
      gameState.playerId =
        data.playerId;
      break;

    case "searching":
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
      gameState.onlineSearching =
        false;
      break;

    case "pong":
      break;
  }
}

function handleMatchFound(data) {
  gameState.onlineSearching =
    false;

  gameState.onlineConnected =
    true;

  gameState.matchId =
    data.matchId;

  gameState.playerNumber =
    data.playerNumber;

  gameState.team =
    data.team;

  gameState.isHost =
    !!data.isHost;

  player.team =
    data.team;

  opponent.team =
    data.team === "blue"
      ? "orange"
      : "blue";

  resetMatch();

  const searchMenu =
    document.getElementById(
      "searchMenu"
    );

  hide(searchMenu);

  showMatchIntro();

  setTimeout(
    startCountdown,
    800
  );
}

function cancelOnlineSearch() {
  if (
    gameState.onlineConnected
  ) {
    sendSocket({
      type: "cancel-search"
    });
  }

  gameState.onlineSearching =
    false;

  closeWebSocket(false);

  const search =
    document.getElementById(
      "searchMenu"
    );

  if (search) {
    search.remove();
  }

  buildMainMenu();
}

function closeWebSocket(
  sendLeave
) {
  if (
    !gameState.websocket
  ) {
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

  gameState.websocket =
    null;

  gameState.onlineConnected =
    false;
}

/* =========================================================
   ONLINE INPUT
========================================================= */

function sendPlayerInput() {
  if (
    gameState.mode !==
      "online" ||
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
  opponent.remoteInput =
    input;
}

/* =========================================================
   ONLINE GAME STATE
========================================================= */

function sendGameState() {
  if (
    gameState.mode !==
      "online" ||
    !gameState.isHost ||
    !gameState.onlineConnected
  ) {
    return;
  }

  const now =
    performance.now();

  if (
    now -
      gameState.lastStateSent <
    50
  ) {
    return;
  }

  gameState.lastStateSent =
    now;

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

      bluePoints:
        gameState.bluePoints,

      orangePoints:
        gameState.orangePoints,

      timeRemaining:
        gameState.timeRemaining,

      blueX:
        player.team === "blue"
          ? player.x
          : opponent.x,

      blueY:
        player.team === "blue"
          ? player.y
          : opponent.y,

      blueVX:
        player.team === "blue"
          ? player.vx
          : opponent.vx,

      blueVY:
        player.team === "blue"
          ? player.vy
          : opponent.vy,

      blueAngle:
        player.team === "blue"
          ? player.angle
          : opponent.angle,

      orangeX:
        player.team === "orange"
          ? player.x
          : opponent.x,

      orangeY:
        player.team === "orange"
          ? player.y
          : opponent.y,

      orangeVX:
        player.team === "orange"
          ? player.vx
          : opponent.vx,

      orangeVY:
        player.team === "orange"
          ? player.vy
          : opponent.vy,

      orangeAngle:
        player.team === "orange"
          ? player.angle
          : opponent.angle,

      boostPads:
        boostPads.map(pad => ({
          active: pad.active,
          respawnAt: pad.respawnAt
        }))
    }
  });
}

function handleRemoteGameState(
  state
) {
  if (!state) return;

  ball.x =
    Number(state.ballX) ||
    ball.x;

  ball.y =
    Number(state.ballY) ||
    ball.y;

  ball.vx =
    Number(state.ballVX) ||
    0;

  ball.vy =
    Number(state.ballVY) ||
    0;

  gameState.blueScore =
    Number(state.blueScore) ||
    0;

  gameState.orangeScore =
    Number(state.orangeScore) ||
    0;

  gameState.bluePoints =
    Number(state.bluePoints) ||
    0;

  gameState.orangePoints =
    Number(state.orangePoints) ||
    0;

  gameState.timeRemaining =
    Number(
      state.timeRemaining
    );

  if (
    player.team === "blue"
  ) {
    opponent.x =
      Number(state.orangeX);

    opponent.y =
      Number(state.orangeY);

    opponent.vx =
      Number(state.orangeVX);

    opponent.vy =
      Number(state.orangeVY);

    opponent.angle =
      Number(state.orangeAngle);
  } else {
    opponent.x =
      Number(state.blueX);

    opponent.y =
      Number(state.blueY);

    opponent.vx =
      Number(state.blueVX);

    opponent.vy =
      Number(state.blueVY);

    opponent.angle =
      Number(state.blueAngle);
  }

  if (
    Array.isArray(
      state.boostPads
    )
  ) {
    state.boostPads.forEach(
      (remotePad, index) => {
        if (!boostPads[index]) {
          return;
        }

        boostPads[index].active =
          !!remotePad.active;

        boostPads[index].respawnAt =
          Number(
            remotePad.respawnAt
          ) || 0;
      }
    );
  }

  if (
    player.team === "blue"
  ) {
    gameState.playerPoints =
      gameState.bluePoints;
  } else {
    gameState.playerPoints =
      gameState.orangePoints;
  }

  updateHUD();

  if (
    gameState.timeRemaining <=
      0 &&
    gameState.running
  ) {
    gameState.timeRemaining =
      0;

    endMatch();
  }
}

/* =========================================================
   OPPONENT LEAVES
========================================================= */

function handleOpponentLeft() {
  if (
    gameState.mode !==
    "online"
  ) {
    return;
  }

  gameState.running =
    false;

  closeWebSocket(false);

  showEndScreen(
    player.team === "blue"
      ? "BLUE WINS"
      : "ORANGE WINS",
    "OPPONENT LEFT"
  );
}

/* =========================================================
   MATCH INTRO
========================================================= */

function showMatchIntro() {
  if (!matchIntro) {
    return;
  }

  show(matchIntro);
}

/* =========================================================
   COUNTDOWN
========================================================= */

function startCountdown() {
  if (gameState.running) {
    return;
  }

  /*
    IMPORTANT :
    On affiche le jeu ici.
    Le canvas contient la map 2D.
    La map est donc visible pendant
    le compte à rebours et au début
    de la partie.
  */

  show(gameWrapper);

  hide(matchIntro);

  gameState.countdown =
    true;

  show(countdownElement);

  let number = 3;

  if (countdownElement) {
    countdownElement.textContent =
      number;
  }

  const interval =
    setInterval(() => {
      number--;

      if (number > 0) {
        if (countdownElement) {
          countdownElement.textContent =
            number;
        }

        return;
      }

      if (number === 0) {
        if (countdownElement) {
          countdownElement.textContent =
            "GO!";
        }

        return;
      }

      clearInterval(interval);

      hide(countdownElement);

      gameState.countdown =
        false;

      gameState.running =
        true;

      gameState.paused =
        false;

      gameState.lastFrame =
        performance.now();
    }, 800);
}

/* =========================================================
   RESET BOOST PADS
========================================================= */

function resetBoostPads() {
  boostPads.forEach(pad => {
    pad.active = true;
    pad.respawnAt = 0;
  });
}

function updateBoostPads() {
  const now =
    Date.now();

  boostPads.forEach(pad => {
    if (
      !pad.active &&
      now >= pad.respawnAt
    ) {
      pad.active = true;
      pad.respawnAt = 0;
    }
  });
}

/* =========================================================
   COLLECT BOOST
========================================================= */

function collectBoostPad(car) {
  for (
    let i = 0;
    i < boostPads.length;
    i++
  ) {
    const pad =
      boostPads[i];

    if (!pad.active) {
      continue;
    }

    const dist =
      Math.hypot(
        car.x - pad.x,
        car.y - pad.y
      );

    if (
      dist >
      PLAYER_RADIUS +
        BOOST_PAD_RADIUS
    ) {
      continue;
    }

    car.boost =
      Math.min(
        BOOST_MAX,
        car.boost +
          BOOST_PAD_AMOUNT
      );

    pad.active =
      false;

    pad.respawnAt =
      Date.now() +
      BOOST_PAD_RESPAWN;
  }
}

/* =========================================================
   RESET MATCH
========================================================= */

function resetMatch() {
  gameState.running =
    false;

  gameState.paused =
    false;

  gameState.countdown =
    false;

  gameState.timeRemaining =
    MATCH_DURATION;

  gameState.blueScore =
    0;

  gameState.orangeScore =
    0;

  gameState.bluePoints =
    0;

  gameState.orangePoints =
    0;

  gameState.playerPoints =
    0;

  gameState.blueGoals =
    0;

  gameState.orangeGoals =
    0;

  gameState.goalInProgress =
    false;

  gameState.lastPointTime.blue =
    0;

  gameState.lastPointTime.orange =
    0;

  gameState.saveCooldown.blue =
    0;

  gameState.saveCooldown.orange =
    0;

  player.team =
    gameState.team ||
    "blue";

  opponent.team =
    player.team === "blue"
      ? "orange"
      : "blue";

  player.x =
    player.team === "blue"
      ? 300
      : 900;

  player.y =
    CANVAS_HEIGHT / 2;

  player.vx = 0;
  player.vy = 0;

  player.angle =
    player.team === "blue"
      ? 0
      : Math.PI;

  player.boost =
    BOOST_MAX;

  opponent.x =
    player.team === "blue"
      ? 900
      : 300;

  opponent.y =
    CANVAS_HEIGHT / 2;

  opponent.vx = 0;
  opponent.vy = 0;

  opponent.angle =
    player.team === "blue"
      ? Math.PI
      : 0;

  opponent.boost =
    BOOST_MAX;

  opponent.remoteInput =
    null;

  bot.x =
    900;

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
   RESET BALL
========================================================= */

function resetBall() {
  ball.x =
    CANVAS_WIDTH / 2;

  ball.y =
    CANVAS_HEIGHT / 2;

  ball.vx = 0;
  ball.vy = 0;

  ball.lastTouchTeam =
    null;

  ball.lastTouchTime =
    0;
}

/* =========================================================
   BALL SPEED
========================================================= */

function limitBallSpeed() {
  const speed =
    Math.hypot(
      ball.vx,
      ball.vy
    );

  if (
    speed <=
    MAX_BALL_SPEED
  ) {
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

  if (forward) {
    player.vx +=
      Math.cos(player.angle) *
      PLAYER_ACCELERATION;

    player.vy +=
      Math.sin(player.angle) *
      PLAYER_ACCELERATION;
  }

  if (reverse) {
    player.vx -=
      Math.cos(player.angle) *
      PLAYER_ACCELERATION *
      0.7;

    player.vy -=
      Math.sin(player.angle) *
      PLAYER_ACCELERATION *
      0.7;
  }

  if (left) {
    player.angle -=
      0.055;
  }

  if (right) {
    player.angle +=
      0.055;
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

  limitCarSpeed(player);

  player.x +=
    player.vx;

  player.y +=
    player.vy;

  keepCarInsideField(
    player
  );

  if (
    gameState.mode !==
      "online" ||
    gameState.isHost
  ) {
    collectBoostPad(player);
  }

  player.speed =
    Math.hypot(
      player.vx,
      player.vy
    );
}

function limitCarSpeed(car) {
  const speed =
    Math.hypot(
      car.vx,
      car.vy
    );

  if (
    speed <=
    PLAYER_MAX_SPEED
  ) {
    return;
  }

  const factor =
    PLAYER_MAX_SPEED /
    speed;

  car.vx *= factor;
  car.vy *= factor;
}

/* =========================================================
   KEEP CAR INSIDE MAP
========================================================= */

function keepCarInsideField(car) {
  const margin =
    PLAYER_RADIUS + 5;

  car.x =
    clamp(
      car.x,
      FIELD_LEFT + margin,
      FIELD_RIGHT - margin
    );

  car.y =
    clamp(
      car.y,
      FIELD_TOP + margin,
      FIELD_BOTTOM - margin
    );

  if (
    car.x <=
      FIELD_LEFT + margin ||
    car.x >=
      FIELD_RIGHT - margin
  ) {
    car.vx *= -0.25;
  }

  if (
    car.y <=
      FIELD_TOP + margin ||
    car.y >=
      FIELD_BOTTOM - margin
  ) {
    car.vy *= -0.25;
  }
}

/* =========================================================
   BOT
========================================================= */

function updateBot() {
  const dx =
    ball.x - bot.x;

  const dy =
    ball.y - bot.y;

  const targetAngle =
    Math.atan2(
      dy,
      dx
    );

  let difference =
    targetAngle -
    bot.angle;

  while (
    difference > Math.PI
  ) {
    difference -=
      Math.PI * 2;
  }

  while (
    difference < -Math.PI
  ) {
    difference +=
      Math.PI * 2;
  }

  if (
    difference > 0.05
  ) {
    bot.angle +=
      0.045;
  }

  if (
    difference < -0.05
  ) {
    bot.angle -=
      0.045;
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
    speed >
    BOT_MAX_SPEED
  ) {
    const factor =
      BOT_MAX_SPEED /
      speed;

    bot.vx *= factor;
    bot.vy *= factor;
  }

  if (
    distance(bot, ball) <
      180 &&
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

  keepCarInsideField(
    bot
  );

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
    opponent.angle -=
      0.055;
  }

  if (input.right) {
    opponent.angle +=
      0.055;
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

  limitCarSpeed(opponent);

  opponent.x +=
    opponent.vx;

  opponent.y +=
    opponent.vy;

  keepCarInsideField(
    opponent
  );

  collectBoostPad(
    opponent
  );

  opponent.speed =
    Math.hypot(
      opponent.vx,
      opponent.vy
    );
}

/* =========================================================
   BALL PHYSICS
========================================================= */

function updateBall() {
  ball.x += ball.vx;
  ball.y += ball.vy;

  ball.vx *=
    0.994;

  ball.vy *=
    0.994;

  const insideGoal =
    ball.y >= GOAL_TOP &&
    ball.y <= GOAL_BOTTOM;

  /* Mur haut */

  if (
    ball.y - BALL_RADIUS <=
    FIELD_TOP
  ) {
    ball.y =
      FIELD_TOP +
      BALL_RADIUS;

    ball.vy =
      Math.abs(ball.vy) *
      0.92;
  }

  /* Mur bas */

  if (
    ball.y + BALL_RADIUS >=
    FIELD_BOTTOM
  ) {
    ball.y =
      FIELD_BOTTOM -
      BALL_RADIUS;

    ball.vy =
      -Math.abs(ball.vy) *
      0.92;
  }

  /* But gauche */

  if (
    ball.x - BALL_RADIUS <
    FIELD_LEFT
  ) {
    if (insideGoal) {
      scoreGoal("orange");
      return;
    }

    ball.x =
      FIELD_LEFT +
      BALL_RADIUS;

    ball.vx =
      Math.abs(ball.vx) *
      0.92;
  }

  /* But droit */

  if (
    ball.x + BALL_RADIUS >
    FIELD_RIGHT
  ) {
    if (insideGoal) {
      scoreGoal("blue");
      return;
    }

    ball.x =
      FIELD_RIGHT -
      BALL_RADIUS;

    ball.vx =
      -Math.abs(ball.vx) *
      0.92;
  }

  /* Profondeur des cages */

  if (
    insideGoal
  ) {
    if (
      ball.x <
      FIELD_LEFT + GOAL_DEPTH
    ) {
      ball.vx *=
        0.995;
    }

    if (
      ball.x >
      FIELD_RIGHT - GOAL_DEPTH
    ) {
      ball.vx *=
        0.995;
    }
  }

  limitBallSpeed();
}

/* =========================================================
   CAR / BALL COLLISION
========================================================= */

function collideCarWithBall(
  car
) {
  const dx =
    ball.x - car.x;

  const dy =
    ball.y - car.y;

  const dist =
    Math.hypot(
      dx,
      dy
    );

  const minDistance =
    PLAYER_RADIUS +
    BALL_RADIUS;

  if (
    dist <= 0 ||
    dist >= minDistance
  ) {
    return false;
  }

  const nx =
    dx / dist;

  const ny =
    dy / dist;

  const overlap =
    minDistance - dist;

  car.x -=
    nx *
    overlap *
    0.45;

  car.y -=
    ny *
    overlap *
    0.45;

  ball.x +=
    nx *
    overlap *
    0.55;

  ball.y +=
    ny *
    overlap *
    0.55;

  const relativeSpeed =
    Math.hypot(
      car.vx,
      car.vy
    );

  const carVelocity =
    car.vx * nx +
    car.vy * ny;

  const hitPower =
    3.0 +
    Math.abs(
      carVelocity
    ) * 1.3;

  ball.vx +=
    nx * hitPower;

  ball.vy +=
    ny * hitPower;

  if (
    relativeSpeed >
    1
  ) {
    ball.vx +=
      car.vx * 0.35;

    ball.vy +=
      car.vy * 0.35;
  }

  limitBallSpeed();

  ball.lastTouchTeam =
    car.team;

  ball.lastTouchTime =
    Date.now();

  addTeamPoints(
    car.team,
    2,
    car === player
  );

  if (
    car === player
  ) {
    createPointNotification(
      "+2 TOUCH"
    );
  }

  checkSave(
    car
  );

  return true;
}

/* =========================================================
   SAVE ZONES
   INVISIBLE
========================================================= */

function isInsideSaveZone(
  car
) {
  if (
    car.team === "blue"
  ) {
    return (
      car.x >=
        FIELD_LEFT &&
      car.x <=
        FIELD_LEFT + 135 &&
      car.y >=
        GOAL_TOP - 35 &&
      car.y <=
        GOAL_BOTTOM + 35
    );
  }

  return (
    car.x >=
      FIELD_RIGHT - 135 &&
    car.x <=
      FIELD_RIGHT &&
    car.y >=
      GOAL_TOP - 35 &&
    car.y <=
      GOAL_BOTTOM + 35
  );
}

function checkSave(car) {
  if (
    !isInsideSaveZone(car)
  ) {
    return;
  }

  const team =
    car.team;

  const now =
    Date.now();

  if (
    now <
    gameState.saveCooldown[
      team
    ]
  ) {
    return;
  }

  const ballGoingTowardGoal =
    team === "blue"
      ? ball.vx < 0
      : ball.vx > 0;

  if (
    !ballGoingTowardGoal
  ) {
    return;
  }

  const dist =
    distance(
      car,
      ball
    );

  if (
    dist >
    PLAYER_RADIUS +
      BALL_RADIUS +
      20
  ) {
    return;
  }

  gameState.saveCooldown[
    team
  ] =
    now + 1200;

  addTeamPoints(
    team,
    50,
    car === player
  );

  if (
    car === player
  ) {
    createPointNotification(
      "+50 SAVE"
    );
  }
}

/* =========================================================
   POINTS
========================================================= */

function addTeamPoints(
  team,
  amount,
  isLocalPlayer
) {
  if (team === "blue") {
    gameState.bluePoints +=
      amount;
  }

  if (team === "orange") {
    gameState.orangePoints +=
      amount;
  }

  if (isLocalPlayer) {
    gameState.playerPoints +=
      amount;
  }

  updateHUD();
}

/* =========================================================
   GOAL
========================================================= */

function scoreGoal(team) {
  if (
    gameState.goalInProgress
  ) {
    return;
  }

  gameState.goalInProgress =
    true;

  if (team === "blue") {
    gameState.blueScore++;
    gameState.blueGoals++;
  } else {
    gameState.orangeScore++;
    gameState.orangeGoals++;
  }

  addTeamPoints(
    team,
    150,
    team === player.team
  );

  if (
    team === player.team
  ) {
    createPointNotification(
      "+150 GOAL"
    );
  }

  showGoalOverlay(
    team
  );

  updateHUD();

  if (
    gameState.mode ===
      "online" &&
    gameState.isHost
  ) {
    sendGameState();
  }

  setTimeout(() => {
    resetBall();

    gameState.goalInProgress =
      false;

    hide(goalMessage);
  }, 1700);
}

/* =========================================================
   GOAL MESSAGE
========================================================= */

function showGoalOverlay(
  team
) {
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
   POINT NOTIFICATION
========================================================= */

function createPointNotification(
  text
) {
  const arena =
    document.getElementById(
      "arenaContainer"
    );

  if (!arena) return;

  const element =
    document.createElement(
      "div"
    );

  element.className =
    "points-notification";

  element.textContent =
    text;

  arena.appendChild(
    element
  );

  requestAnimationFrame(() => {
    element.classList.add(
      "show"
    );
  });

  setTimeout(() => {
    element.remove();
  }, 1200);
}

/* =========================================================
   HUD
========================================================= */

function updateHUD() {
  if (
    blueScoreElement
  ) {
    blueScoreElement.textContent =
      gameState.blueScore;
  }

  if (
    orangeScoreElement
  ) {
    orangeScoreElement.textContent =
      gameState.orangeScore;
  }

  if (
    timerElement
  ) {
    timerElement.textContent =
      formatTime(
        gameState.timeRemaining
      );
  }

  if (
    playerPointsElement
  ) {
    playerPointsElement.textContent =
      gameState.playerPoints;
  }

  if (
    boostFill
  ) {
    boostFill.style.width =
      `${player.boost}%`;
  }

  if (
    boostNumber
  ) {
    boostNumber.textContent =
      Math.round(
        player.boost
      );
  }

  if (
    speedNumber
  ) {
    const kmh =
      Math.round(
        player.speed *
          7.1
      );

    speedNumber.textContent =
      kmh;
  }
}

/* =========================================================
   TIMER
========================================================= */

function updateTimer(
  delta
) {
  if (
    gameState.mode ===
      "online" &&
    !gameState.isHost
  ) {
    return;
  }

  gameState.timeRemaining -=
    delta;

  if (
    gameState.timeRemaining <=
    0
  ) {
    gameState.timeRemaining =
      0;

    endMatch();

    return;
  }

  updateHUD();

  if (
    gameState.mode ===
    "online"
  ) {
    sendGameState();
  }
}

/* =========================================================
   PAUSE
========================================================= */

function togglePause() {
  if (
    !gameState.running
  ) {
    return;
  }

  if (
    gameState.mode ===
    "online"
  ) {
    return;
  }

  gameState.paused =
    !gameState.paused;

  if (
    gameState.paused
  ) {
    show(pauseMenu);
  } else {
    hide(pauseMenu);
  }
}

/* =========================================================
   END
========================================================= */

function endMatch() {
  if (
    !gameState.running
  ) {
    return;
  }

  gameState.running =
    false;

  let winner =
    "DRAW";

  if (
    gameState.blueScore >
    gameState.orangeScore
  ) {
    winner =
      "BLUE WINS";
  }

  if (
    gameState.orangeScore >
    gameState.blueScore
  ) {
    winner =
      "ORANGE WINS";
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

  show(endScreen);

  if (
    finalScore
  ) {
    finalScore.textContent =
      `${gameState.blueScore} - ${gameState.orangeScore}`;
  }

  const winnerDisplay =
    document.getElementById(
      "winnerDisplay"
    );

  if (
    winnerDisplay
  ) {
    winnerDisplay.textContent =
      winner;
  }

  const resultTitle =
    document.querySelector(
      ".result-title"
    );

  if (
    resultTitle
  ) {
    resultTitle.textContent =
      reason;
  }
}

/* =========================================================
   RETURN MAIN MENU
========================================================= */

function returnToMainMenu() {
  gameState.running =
    false;

  gameState.paused =
    false;

  gameState.onlineSearching =
    false;

  closeWebSocket(true);

  hide(gameWrapper);
  hide(endScreen);
  hide(pauseMenu);
  hide(matchIntro);
  hide(countdownElement);
  hide(goalMessage);

  const search =
    document.getElementById(
      "searchMenu"
    );

  if (search) {
    search.remove();
  }

  buildMainMenu();
}

/* =========================================================
   RESTART
========================================================= */

function restartMatch() {
  hide(endScreen);

  resetMatch();

  show(gameWrapper);

  showMatchIntro();

  setTimeout(
    startCountdown,
    500
  );
}

/* =========================================================
   DRAW MAP
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
    "#06101b";

  ctx.fillRect(
    0,
    0,
    CANVAS_WIDTH,
    CANVAS_HEIGHT
  );

  /* Terrain */

  ctx.fillStyle =
    "#102b38";

  ctx.fillRect(
    FIELD_LEFT,
    FIELD_TOP,
    FIELD_RIGHT -
      FIELD_LEFT,
    FIELD_BOTTOM -
      FIELD_TOP
  );

  /* Bandes du terrain */

  ctx.fillStyle =
    "rgba(255,255,255,0.018)";

  for (
    let x =
      FIELD_LEFT;
    x <
      FIELD_RIGHT;
    x += 60
  ) {
    ctx.fillRect(
      x,
      FIELD_TOP,
      30,
      FIELD_BOTTOM -
        FIELD_TOP
    );
  }

  /* Bordure */

  ctx.strokeStyle =
    "rgba(220,245,255,0.7)";

  ctx.lineWidth = 3;

  ctx.strokeRect(
    FIELD_LEFT,
    FIELD_TOP,
    FIELD_RIGHT -
      FIELD_LEFT,
    FIELD_BOTTOM -
      FIELD_TOP
  );

  /* Ligne centrale */

  ctx.beginPath();

  ctx.moveTo(
    CANVAS_WIDTH / 2,
    FIELD_TOP
  );

  ctx.lineTo(
    CANVAS_WIDTH / 2,
    FIELD_BOTTOM
  );

  ctx.stroke();

  /* Cercle central */

  ctx.beginPath();

  ctx.arc(
    CANVAS_WIDTH / 2,
    CANVAS_HEIGHT / 2,
    92,
    0,
    Math.PI * 2
  );

  ctx.stroke();

  /* Point central */

  ctx.beginPath();

  ctx.arc(
    CANVAS_WIDTH / 2,
    CANVAS_HEIGHT / 2,
    7,
    0,
    Math.PI * 2
  );

  ctx.fillStyle =
    "#ffffff";

  ctx.fill();

  /* Surface gauche */

  ctx.strokeStyle =
    "rgba(50,190,255,0.45)";

  ctx.strokeRect(
    FIELD_LEFT,
    GOAL_TOP - 65,
    150,
    GOAL_BOTTOM -
      GOAL_TOP +
      130
  );

  /* Surface droite */

  ctx.strokeStyle =
    "rgba(255,120,40,0.45)";

  ctx.strokeRect(
    FIELD_RIGHT - 150,
    GOAL_TOP - 65,
    150,
    GOAL_BOTTOM -
      GOAL_TOP +
      130
  );

  drawGoals();

  drawBoostPads();
}

/* =========================================================
   GOALS / CAGES
========================================================= */

function drawGoals() {
  const goalHeight =
    GOAL_BOTTOM -
    GOAL_TOP;

  /* =========================
     CAGE BLEUE / GAUCHE
  ========================= */

  ctx.fillStyle =
    "rgba(20,170,255,0.12)";

  ctx.fillRect(
    FIELD_LEFT,
    GOAL_TOP,
    GOAL_DEPTH,
    goalHeight
  );

  /* Filet horizontal */

  ctx.strokeStyle =
    "rgba(80,200,255,0.22)";

  ctx.lineWidth = 1;

  for (
    let y =
      GOAL_TOP;
    y <=
      GOAL_BOTTOM;
    y += 18
  ) {
    ctx.beginPath();

    ctx.moveTo(
      FIELD_LEFT,
      y
    );

    ctx.lineTo(
      FIELD_LEFT +
        GOAL_DEPTH,
      y
    );

    ctx.stroke();
  }

  /* Filet vertical */

  for (
    let x =
      FIELD_LEFT;
    x <=
      FIELD_LEFT +
        GOAL_DEPTH;
    x += 18
  ) {
    ctx.beginPath();

    ctx.moveTo(
      x,
      GOAL_TOP
    );

    ctx.lineTo(
      x,
      GOAL_BOTTOM
    );

    ctx.stroke();
  }

  /* Poteaux */

  drawGoalPost(
    FIELD_LEFT,
    GOAL_TOP,
    "blue"
  );

  drawGoalPost(
    FIELD_LEFT,
    GOAL_BOTTOM,
    "blue"
  );

  /* Barre */

  ctx.strokeStyle =
    "#42c9ff";

  ctx.lineWidth = 7;

  ctx.beginPath();

  ctx.moveTo(
    FIELD_LEFT,
    GOAL_TOP
  );

  ctx.lineTo(
    FIELD_LEFT,
    GOAL_BOTTOM
  );

  ctx.stroke();

  /* =========================
     CAGE ORANGE / DROITE
  ========================= */

  ctx.fillStyle =
    "rgba(255,100,25,0.12)";

  ctx.fillRect(
    FIELD_RIGHT -
      GOAL_DEPTH,
    GOAL_TOP,
    GOAL_DEPTH,
    goalHeight
  );

  ctx.strokeStyle =
    "rgba(255,140,60,0.22)";

  ctx.lineWidth = 1;

  for (
    let y =
      GOAL_TOP;
    y <=
      GOAL_BOTTOM;
    y += 18
  ) {
    ctx.beginPath();

    ctx.moveTo(
      FIELD_RIGHT -
        GOAL_DEPTH,
      y
    );

    ctx.lineTo(
      FIELD_RIGHT,
      y
    );

    ctx.stroke();
  }

  for (
    let x =
      FIELD_RIGHT -
        GOAL_DEPTH;
    x <=
      FIELD_RIGHT;
    x += 18
  ) {
    ctx.beginPath();

    ctx.moveTo(
      x,
      GOAL_TOP
    );

    ctx.lineTo(
      x,
      GOAL_BOTTOM
    );

    ctx.stroke();
  }

  drawGoalPost(
    FIELD_RIGHT,
    GOAL_TOP,
    "orange"
  );

  drawGoalPost(
    FIELD_RIGHT,
    GOAL_BOTTOM,
    "orange"
  );

  ctx.strokeStyle =
    "#ff812f";

  ctx.lineWidth = 7;

  ctx.beginPath();

  ctx.moveTo(
    FIELD_RIGHT,
    GOAL_TOP
  );

  ctx.lineTo(
    FIELD_RIGHT,
    GOAL_BOTTOM
  );

  ctx.stroke();
}

function drawGoalPost(
  x,
  y,
  team
) {
  ctx.save();

  ctx.beginPath();

  ctx.arc(
    x,
    y,
    GOAL_POST_RADIUS,
    0,
    Math.PI * 2
  );

  ctx.fillStyle =
    team === "blue"
      ? "#36caff"
      : "#ff8130";

  ctx.shadowBlur = 15;

  ctx.shadowColor =
    team === "blue"
      ? "#20bfff"
      : "#ff7020";

  ctx.fill();

  ctx.restore();
}

/* =========================================================
   DRAW BOOST PADS
========================================================= */

function drawBoostPads() {
  boostPads.forEach(pad => {
    ctx.save();

    if (
      pad.active
    ) {
      /* Halo */

      ctx.beginPath();

      ctx.arc(
        pad.x,
        pad.y,
        27,
        0,
        Math.PI * 2
      );

      ctx.fillStyle =
        "rgba(180,255,30,0.08)";

      ctx.fill();

      /* Pad */

      ctx.beginPath();

      ctx.arc(
        pad.x,
        pad.y,
        BOOST_PAD_RADIUS,
        0,
        Math.PI * 2
      );

      ctx.fillStyle =
        "#b7ff32";

      ctx.shadowBlur = 18;

      ctx.shadowColor =
        "#9cff00";

      ctx.fill();

      /* Centre */

      ctx.beginPath();

      ctx.arc(
        pad.x,
        pad.y,
        7,
        0,
        Math.PI * 2
      );

      ctx.fillStyle =
        "#ffffff";

      ctx.fill();
    } else {
      ctx.beginPath();

      ctx.arc(
        pad.x,
        pad.y,
        BOOST_PAD_RADIUS,
        0,
        Math.PI * 2
      );

      ctx.fillStyle =
        "rgba(90,100,110,0.28)";

      ctx.strokeStyle =
        "rgba(180,190,200,0.2)";

      ctx.lineWidth = 2;

      ctx.fill();
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

  /* Ombre */

  ctx.beginPath();

  ctx.arc(
    ball.x + 4,
    ball.y + 5,
    BALL_RADIUS,
    0,
    Math.PI * 2
  );

  ctx.fillStyle =
    "rgba(0,0,0,0.35)";

  ctx.fill();

  /* Ball */

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

  ctx.shadowBlur = 15;

  ctx.shadowColor =
    "#ffffff";

  ctx.fill();

  /* Motif */

  ctx.beginPath();

  ctx.arc(
    ball.x,
    ball.y,
    5,
    0,
    Math.PI * 2
  );

  ctx.fillStyle =
    "#172331";

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

  const isBlue =
    car.team === "blue";

  const mainColor =
    isBlue
      ? "#20cfff"
      : "#ff852d";

  const glowColor =
    isBlue
      ? "#00aaff"
      : "#ff5a00";

  /* Ombre */

  ctx.fillStyle =
    "rgba(0,0,0,0.3)";

  ctx.fillRect(
    -24,
    -12,
    54,
    30
  );

  /* Car */

  ctx.shadowBlur = 18;

  ctx.shadowColor =
    glowColor;

  ctx.fillStyle =
    mainColor;

  ctx.fillRect(
    -27,
    -16,
    54,
    32
  );

  /* Nez */

  ctx.fillRect(
    20,
    -11,
    9,
    22
  );

  /* Vitre */

  ctx.shadowBlur = 0;

  ctx.fillStyle =
    "#08131e";

  ctx.fillRect(
    -5,
    -12,
    18,
    24
  );

  /* Ligne centrale */

  ctx.fillStyle =
    "rgba(255,255,255,0.45)";

  ctx.fillRect(
    18,
    -9,
    3,
    18
  );

  /* Roues */

  ctx.fillStyle =
    "#080b0f";

  ctx.fillRect(
    -21,
    -20,
    12,
    7
  );

  ctx.fillRect(
    8,
    -20,
    12,
    7
  );

  ctx.fillRect(
    -21,
    13,
    12,
    7
  );

  ctx.fillRect(
    8,
    13,
    12,
    7
  );

  ctx.restore();
}

/* =========================================================
   RENDER
========================================================= */

function render() {
  drawField();

  if (
    gameState.mode ===
    "online"
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
    gameState.mode ===
    "offline"
  ) {
    updateBot();

    collideCarWithBall(
      bot
    );

    collideCarWithBall(
      player
    );
  }

  if (
    gameState.mode ===
    "online"
  ) {
    sendPlayerInput();

    /*
      Le joueur hôte fait tourner
      toute la physique.
    */

    if (
      gameState.isHost
    ) {
      updateOnlineOpponent();

      collideCarWithBall(
        opponent
      );

      collideCarWithBall(
        player
      );

      updateBall();
    }
  }

  if (
    gameState.mode ===
    "offline"
  ) {
    updateBall();
  }

  updateTimer(delta);

  updateHUD();
}

/* =========================================================
   GAME LOOP
========================================================= */

function gameLoop(
  timestamp
) {
  if (
    !gameState.lastFrame
  ) {
    gameState.lastFrame =
      timestamp;
  }

  let delta =
    (
      timestamp -
      gameState.lastFrame
    ) / 1000;

  gameState.lastFrame =
    timestamp;

  delta =
    Math.min(
      delta,
      0.05
    );

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
      handleSettingKey(
        event
      );

      return;
    }

    const key =
      normalizeKey(
        event.key
      );

    gameState.keys[key] =
      true;

    if (
      key === "p"
    ) {
      togglePause();
    }
  }
);

window.addEventListener(
  "keyup",
  event => {
    const key =
      normalizeKey(
        event.key
      );

    gameState.keys[key] =
      false;
  }
);

/* =========================================================
   BUTTONS
========================================================= */

function connectExistingButtons() {
  const settingsButton =
    document.getElementById(
      "settingsButton"
    );

  if (
    settingsButton
  ) {
    settingsButton.addEventListener(
      "click",
      openSettings
    );
  }

  const howToPlayButton =
    document.getElementById(
      "howToPlayButton"
    );

  if (
    howToPlayButton
  ) {
    howToPlayButton.addEventListener(
      "click",
      openHowToPlay
    );
  }

  const backButton =
    document.getElementById(
      "backButton"
    );

  if (
    backButton
  ) {
    backButton.addEventListener(
      "click",
      () => {
        hide(
          howToPlayMenu
        );

        show(
          mainMenu
        );
      }
    );
  }

  const settingsBackButton =
    document.getElementById(
      "settingsBackButton"
    );

  if (
    settingsBackButton
  ) {
    settingsBackButton.addEventListener(
      "click",
      closeSettings
    );
  }

  const resetButton =
    document.getElementById(
      "resetControlsButton"
    );

  if (
    resetButton
  ) {
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

  actions.forEach(
    action => {
      const button =
        document.querySelector(
          `[data-action="${action}"]`
        );

      if (!button) {
        return;
      }

      button.addEventListener(
        "click",
        () => {
          waitForNewKey(
            action
          );
        }
      );
    }
  );

  const restartButton =
    document.getElementById(
      "restartButton"
    );

  if (
    restartButton
  ) {
    restartButton.addEventListener(
      "click",
      restartMatch
    );
  }

  const mainMenuButton =
    document.getElementById(
      "mainMenuButton"
    );

  if (
    mainMenuButton
  ) {
    mainMenuButton.addEventListener(
      "click",
      returnToMainMenu
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

  if (canvas) {
    canvas.width =
      CANVAS_WIDTH;

    canvas.height =
      CANVAS_HEIGHT;
  }

  resetBoostPads();

  updateHUD();

  createDeviceMenu();

  requestAnimationFrame(
    gameLoop
  );
}

initialize();
