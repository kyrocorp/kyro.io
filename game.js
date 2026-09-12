(function () {
  'use strict';

  /* =====================================================
     CONFIG
  ===================================================== */

  const SERVER_URL = 'wss://kyro-io.onrender.com';

  const FIELD = {
    w: 1200,
    h: 700,
    goalHeight: 220,
    goalDepth: 22
  };

  const PX_PER_METER = 50;
  function kmhToPxFrame(kmh) { return (kmh / 3.6) * PX_PER_METER / 60; }
  function speedToKmh(pxFrame) { return (pxFrame * 60 / PX_PER_METER) * 3.6; }

  const CAR_CFG = {
    width: 46,
    height: 26,
    maxSpeed: kmhToPxFrame(36),
    maxSpeedBoost: kmhToPxFrame(58),
    turnSpeed: 0.05,
    friction: 0.985,
    boostDrain: 35,
    boostRegen: 0, // plus de régénération automatique : uniquement via les pads
    collisionRadius: 24
  };
  CAR_CFG.accel = CAR_CFG.maxSpeed / 40;
  CAR_CFG.boostThrustMult = CAR_CFG.maxSpeedBoost / CAR_CFG.maxSpeed;
  CAR_CFG.reverseAccel = CAR_CFG.accel * 0.6;

  const EXPLOSION_THRESHOLD_KMH = 70;

  const BALL_CFG = {
    radius: 16,
    friction: 0.992,
    wallBounce: 0.75,
    maxSpeed: kmhToPxFrame(216)
  };

  const MATCH_DURATION = 120;

  const BOOST_PAD_RADIUS = 20;
  const BOOST_PAD_COOLDOWN = 5;

  function makeBoostPads() {
    return [
      { x: 55, y: 150, radius: BOOST_PAD_RADIUS, active: true, cooldown: 0 },
      { x: 55, y: 350, radius: BOOST_PAD_RADIUS, active: true, cooldown: 0 },
      { x: 55, y: 550, radius: BOOST_PAD_RADIUS, active: true, cooldown: 0 },
      { x: FIELD.w - 55, y: 150, radius: BOOST_PAD_RADIUS, active: true, cooldown: 0 },
      { x: FIELD.w - 55, y: 350, radius: BOOST_PAD_RADIUS, active: true, cooldown: 0 },
      { x: FIELD.w - 55, y: 550, radius: BOOST_PAD_RADIUS, active: true, cooldown: 0 },
      { x: FIELD.w / 2, y: 55, radius: BOOST_PAD_RADIUS, active: true, cooldown: 0 },
      { x: FIELD.w / 2, y: FIELD.h - 55, radius: BOOST_PAD_RADIUS, active: true, cooldown: 0 }
    ];
  }

  const SAVE_ZONE_DEPTH = 160;
  const SAVE_ZONE_MARGIN = 50;

  function getSaveZone(team) {
    const yMin = FIELD.h / 2 - FIELD.goalHeight / 2 - SAVE_ZONE_MARGIN;
    const yMax = FIELD.h / 2 + FIELD.goalHeight / 2 + SAVE_ZONE_MARGIN;
    if (team === 'blue') {
      return { xMin: FIELD.goalDepth, xMax: FIELD.goalDepth + SAVE_ZONE_DEPTH, yMin, yMax };
    }
    return { xMin: FIELD.w - FIELD.goalDepth - SAVE_ZONE_DEPTH, xMax: FIELD.w - FIELD.goalDepth, yMin, yMax };
  }

  function isInOwnSaveZone(car) {
    const z = getSaveZone(car.team);
    return car.x >= z.xMin && car.x <= z.xMax && car.y >= z.yMin && car.y <= z.yMax;
  }

  const POINTS_TOUCH = 2;
  const POINTS_GOAL = 150;
  const POINTS_SAVE = 50;

  /* =====================================================
     ETAT GLOBAL
  ===================================================== */

  let deviceType = null;
  let mode = null;
  let ws = null;
  let myPlayerNumber = null;
  let isHost = false;
  let matchId = null;

  const controls = {
    forward: 'z',
    backward: 's',
    left: 'q',
    right: 'd',
    boost: ' '
  };

  const keysDown = {};
  const touchInput = { forward: false, backward: false, left: false, right: false, boost: false };

  let rebindingAction = null;
  let settingsOpenedFrom = 'mainMenu'; // 'mainMenu' | 'pauseMenu'

  let canvas, ctx;
  let running = false;
  let paused = false;
  let animFrameId = null;
  let lastTimestamp = 0;
  let matchTimeLeft = MATCH_DURATION;
  let timerInterval = null;

  let world = null;

  /* =====================================================
     UTILITAIRES
  ===================================================== */

  function $(id) { return document.getElementById(id); }

  function loadControls() {
    try {
      const saved = JSON.parse(localStorage.getItem('turboball_controls'));
      if (saved) Object.assign(controls, saved);
    } catch (e) {}
  }

  function saveControls() {
    try { localStorage.setItem('turboball_controls', JSON.stringify(controls)); } catch (e) {}
  }

  function show(el) { el.classList.remove('hidden'); }
  function hide(el) { el.classList.add('hidden'); }

  function teamOfPlayer(num) { return num === 1 ? 'blue' : 'orange'; }

  /* =====================================================
     STYLES DYNAMIQUES
  ===================================================== */

  function injectDynamicStyles() {
    const style = document.createElement('style');
    style.textContent = `
      #deviceMenu .menu-buttons { margin-top: 30px; }

      #mainMenuColumns {
        display: flex;
        gap: 60px;
        justify-content: center;
        margin-top: 20px;
      }
      #mainMenuColumns .menu-column-left,
      #mainMenuColumns .menu-column-right {
        display: flex;
        flex-direction: column;
        gap: 14px;
      }

      #shopMenu .shop-empty {
        color: #7d8ca0;
        font-size: 13px;
        letter-spacing: 2px;
        padding: 40px 0;
      }

      #searchingOverlay {
        position: fixed;
        inset: 0;
        z-index: 1200;
        display: flex;
        flex-direction: column;
        gap: 20px;
        justify-content: center;
        align-items: center;
        background: rgba(1,5,12,0.92);
        color: white;
        letter-spacing: 3px;
        font-size: 14px;
      }
      #searchingOverlay .spinner {
        width: 46px; height: 46px;
        border: 4px solid rgba(66,207,255,0.2);
        border-top-color: #42cfff;
        border-radius: 50%;
        animation: spin 0.9s linear infinite;
      }
      @keyframes spin { to { transform: rotate(360deg); } }

      #ballSpeedNumber {
        color: #ffd35c;
        font-size: 13px;
        margin-left: 10px;
        text-shadow: 0 0 10px rgba(255, 200, 50, 0.7);
      }

      #statsBar {
        display: flex;
        justify-content: space-between;
        padding: 8px 30px;
        gap: 20px;
      }
      #statsBar .statsColumn {
        display: flex;
        gap: 16px;
        font-size: 10px;
        letter-spacing: 1.5px;
        color: #91a2b4;
      }
      #statsBar .statsColumn b {
        margin-left: 4px;
      }
      #statsBar .statsColumn.blue b { color: #43d9ff; }
      #statsBar .statsColumn.orange b { color: #ff9d2e; }
      #statsBar .statsColumn.orange { justify-content: flex-end; margin-left: auto; }

      #mobileControls {
        position: absolute;
        inset: 0;
        pointer-events: none;
        z-index: 40;
      }
      #mobileControls button {
        position: absolute;
        pointer-events: all;
        width: 64px; height: 64px;
        border-radius: 50%;
        font-size: 11px;
        padding: 0;
      }
      #mcLeft   { bottom: 30px; left: 30px; }
      #mcRight  { bottom: 30px; left: 104px; }
      #mcForward{ bottom: 100px; left: 67px; }
      #mcBoost  { bottom: 55px; right: 30px; width: 80px; height: 80px; }
    `;
    document.head.appendChild(style);
  }

  function injectBallSpeedDisplay() {
    const orangeTeamEl = document.querySelector('#scoreboard .team.orange');
    if (!orangeTeamEl) return;
    const span = document.createElement('span');
    span.id = 'ballSpeedNumber';
    span.textContent = 'BALL: 0 KM/H';
    orangeTeamEl.appendChild(span);
  }

  function injectStatsBar() {
    const topBar = $('topBar');
    if (!topBar || $('statsBar')) return;
    const div = document.createElement('div');
    div.id = 'statsBar';
    div.innerHTML = `
      <div class="statsColumn blue">
        <span>BUTS<b id="statBlueGoals">0</b></span>
        <span>TOUCHES<b id="statBlueTouches">0</b></span>
        <span>SAVES<b id="statBlueSaves">0</b></span>
      </div>
      <div class="statsColumn orange">
        <span>SAVES<b id="statOrangeSaves">0</b></span>
        <span>TOUCHES<b id="statOrangeTouches">0</b></span>
        <span>BUTS<b id="statOrangeGoals">0</b></span>
      </div>
    `;
    topBar.insertAdjacentElement('afterend', div);
  }

  /* =====================================================
     ECRAN CHOIX PC / MOBILE
  ===================================================== */

  function buildDeviceMenu() {
    const div = document.createElement('div');
    div.id = 'deviceMenu';
    div.className = 'menu-screen';
    div.innerHTML = `
      <div class="menu-content">
        <div class="logo">
          <div class="logo-small">WELCOME TO</div>
          <h1>TURBO<span>BALL</span></h1>
          <div class="logo-io">.IO</div>
        </div>
        <div class="menu-buttons">
          <button id="choosePc" class="main-button">JOUER SUR PC</button>
          <button id="chooseMobile" class="secondary-button">JOUER SUR MOBILE</button>
        </div>
        <div class="menu-footer">ORIGINAL 2D CAR FOOTBALL GAME</div>
      </div>
    `;
    document.body.appendChild(div);

    $('choosePc').onclick = () => selectDevice('pc');
    $('chooseMobile').onclick = () => selectDevice('mobile');
  }

  function selectDevice(type) {
    deviceType = type;
    hide($('deviceMenu'));
    buildMainMenu();
  }

  /* =====================================================
     MENU PRINCIPAL
  ===================================================== */

  function buildMainMenu() {
    const mainMenu = $('mainMenu');
    const content = mainMenu.querySelector('.menu-content');

    content.innerHTML = `
      <div class="logo">
        <div class="logo-small">WELCOME TO</div>
        <h1>TURBO<span>BALL</span></h1>
        <div class="logo-io">.IO</div>
      </div>

      <div id="mainMenuColumns">
        <div class="menu-column-left">
          <button id="openSettingsBtn" class="secondary-button">SETTINGS</button>
          <button id="openShopBtn" class="secondary-button">BOUTIQUE</button>
        </div>
        <div class="menu-column-right">
          <button id="play1v1OnlineBtn" class="main-button">1V1 EN LIGNE</button>
          <button id="play1v1OfflineBtn" class="main-button">1V1 HORS LIGNE</button>
        </div>
      </div>

      <div class="menu-footer">ORIGINAL 2D CAR FOOTBALL GAME</div>
    `;

    show(mainMenu);

    $('openSettingsBtn').onclick = () => openSettings('mainMenu');
    $('openShopBtn').onclick = openShop;
    $('play1v1OnlineBtn').onclick = () => startMatch('online');
    $('play1v1OfflineBtn').onclick = () => startMatch('offline');
  }

  /* =====================================================
     SETTINGS
  ===================================================== */

  function refreshSettingsLabels() {
    $('forwardKeyButton').textContent = controls.forward.toUpperCase();
    $('reverseKeyButton').textContent = controls.backward.toUpperCase();
    $('leftKeyButton').textContent = controls.left.toUpperCase();
    $('rightKeyButton').textContent = controls.right.toUpperCase();
    $('boostKeyButton').textContent = controls.boost === ' ' ? 'SPACE' : controls.boost.toUpperCase();
  }

  function openSettings(fromMenu) {
    settingsOpenedFrom = fromMenu;
    if (fromMenu === 'mainMenu') {
      hide($('mainMenu'));
    } else {
      hide($('pauseMenu'));
    }
    refreshSettingsLabels();
    show($('settingsMenu'));
  }

  function initSettingsMenu() {
    const keyButtons = [
      { el: $('forwardKeyButton'), action: 'forward' },
      { el: $('reverseKeyButton'), action: 'backward' },
      { el: $('leftKeyButton'), action: 'left' },
      { el: $('rightKeyButton'), action: 'right' },
      { el: $('boostKeyButton'), action: 'boost' }
    ];

    keyButtons.forEach(({ el, action }) => {
      el.addEventListener('click', () => {
        keyButtons.forEach(b => b.el.classList.remove('waiting'));
        rebindingAction = action;
        el.classList.add('waiting');
        el.textContent = '...';
      });
    });

    window.addEventListener('keydown', (e) => {
      if (!rebindingAction) return;
      e.preventDefault();
      const key = e.key === ' ' ? ' ' : e.key.toLowerCase();
      controls[rebindingAction] = key;
      saveControls();
      keyButtons.forEach(b => b.el.classList.remove('waiting'));
      rebindingAction = null;
      refreshSettingsLabels();
    });

    $('resetControlsButton').onclick = () => {
      controls.forward = 'z';
      controls.backward = 's';
      controls.left = 'q';
      controls.right = 'd';
      controls.boost = ' ';
      saveControls();
      refreshSettingsLabels();
    };

    $('settingsBackButton').onclick = () => {
      hide($('settingsMenu'));
      if (settingsOpenedFrom === 'pauseMenu') {
        show($('pauseMenu'));
      } else {
        show($('mainMenu'));
      }
    };
  }

  /* =====================================================
     BOUTIQUE
  ===================================================== */

  function buildShopMenu() {
    const div = document.createElement('div');
    div.id = 'shopMenu';
    div.className = 'menu-screen hidden';
    div.innerHTML = `
      <div class="panel">
        <h2>BOUTIQUE</h2>
        <div class="shop-empty">RIEN POUR L'INSTANT</div>
        <button id="shopBackButton" class="secondary-button">BACK</button>
      </div>
    `;
    document.body.appendChild(div);
    $('shopBackButton').onclick = () => {
      hide($('shopMenu'));
      show($('mainMenu'));
    };
  }

  function openShop() {
    hide($('mainMenu'));
    show($('shopMenu'));
  }

  /* =====================================================
     RECHERCHE DE MATCH
  ===================================================== */

  function buildSearchingOverlay() {
    const div = document.createElement('div');
    div.id = 'searchingOverlay';
    div.className = 'hidden';
    div.innerHTML = `
      <div class="spinner"></div>
      <div>RECHERCHE D'UN ADVERSAIRE...</div>
      <button id="cancelSearchBtn" class="secondary-button">ANNULER</button>
    `;
    document.body.appendChild(div);
    $('cancelSearchBtn').onclick = cancelSearch;
  }

  function cancelSearch() {
    if (ws) {
      ws.send(JSON.stringify({ type: 'cancel-search' }));
      ws.close();
      ws = null;
    }
    hide($('searchingOverlay'));
    show($('mainMenu'));
  }

  /* =====================================================
     LANCEMENT D'UN MATCH
  ===================================================== */

  function startMatch(chosenMode) {
    mode = chosenMode;
    hide($('mainMenu'));

    if (mode === 'offline') {
      isHost = true;
      myPlayerNumber = 1;
      launchMatchIntro();
      return;
    }

    show($('searchingOverlay'));
    ws = new WebSocket(SERVER_URL);

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'find-match' }));
    };

    ws.onmessage = (event) => {
      let data;
      try { data = JSON.parse(event.data); } catch (e) { return; }
      handleServerMessage(data);
    };

    ws.onclose = () => {
      if (running) endMatchDueToDisconnect();
    };
  }

  function handleServerMessage(data) {
    switch (data.type) {
      case 'match-found':
        matchId = data.matchId;
        myPlayerNumber = data.playerNumber;
        isHost = data.isHost;
        hide($('searchingOverlay'));
        launchMatchIntro();
        break;

      case 'opponent-input':
        if (isHost && world) {
          world.cars[1]._pendingInput = data.input;
        }
        break;

      case 'game-state':
        if (!isHost && world) applyRemoteState(data.state);
        break;

      case 'opponent-left':
        endMatchDueToDisconnect();
        break;
    }
  }

  function endMatchDueToDisconnect() {
    stopGameLoop();
    showResult('ADVERSAIRE DÉCONNECTÉ', world ? world.scoreBlue : 0, world ? world.scoreOrange : 0);
  }

  /* =====================================================
     INTRO + COMPTE A REBOURS
  ===================================================== */

  function launchMatchIntro() {
    show($('matchIntro'));
    setTimeout(() => {
      hide($('matchIntro'));
      setupWorld();
      runCountdown(3, () => { beginPlay(); });
    }, 1800);
  }

  function runCountdown(n, onDone) {
    const el = $('countdown');
    if (n <= 0) {
      hide(el);
      onDone();
      return;
    }
    show(el);
    el.textContent = n;
    setTimeout(() => runCountdown(n - 1, onDone), 800);
  }

  /* =====================================================
     MONDE
  ===================================================== */

  function makeCar(x, y, angle, team) {
    return {
      x, y, angle, team,
      startX: x, startY: y, startAngle: angle,
      vx: 0, vy: 0,
      boost: 100,
      boosting: false,
      speed: 0,
      exploded: false,
      explodeTimer: 0,
      wasTouching: false
    };
  }

  function setupWorld() {
    canvas = $('gameCanvas');
    ctx = canvas.getContext('2d');

    world = {
      cars: [
        makeCar(FIELD.w * 0.25, FIELD.h / 2, 0, 'blue'),
        makeCar(FIELD.w * 0.75, FIELD.h / 2, Math.PI, 'orange')
      ],
      ball: { x: FIELD.w / 2, y: FIELD.h / 2, vx: 0, vy: 0 },
      scoreBlue: 0,
      scoreOrange: 0,
      frozen: false,
      boostPads: makeBoostPads(),
      particles: [],
      stats: {
        blue: { goals: 0, touches: 0, saves: 0, points: 0 },
        orange: { goals: 0, touches: 0, saves: 0, points: 0 }
      }
    };

    matchTimeLeft = MATCH_DURATION;
    updateTimerDisplay();
    updateScoreDisplay();
    updateStatsDisplay();
    updatePointsDisplay();

    if (deviceType === 'mobile') buildMobileControls();
  }

  /* =====================================================
     CONTROLES CLAVIER
  ===================================================== */

  window.addEventListener('keydown', (e) => {
    if (rebindingAction) return;
    const k = e.key.toLowerCase() === ' ' ? ' ' : e.key.toLowerCase();
    keysDown[k] = true;
    if (k === 'p' && running) togglePause();
  });
  window.addEventListener('keyup', (e) => {
    const k = e.key.toLowerCase() === ' ' ? ' ' : e.key.toLowerCase();
    keysDown[k] = false;
  });

  function readLocalInput() {
    return {
      forward: !!keysDown[controls.forward] || touchInput.forward,
      backward: !!keysDown[controls.backward] || touchInput.backward,
      left: !!keysDown[controls.left] || touchInput.left,
      right: !!keysDown[controls.right] || touchInput.right,
      boost: !!keysDown[controls.boost] || touchInput.boost
    };
  }

  /* =====================================================
     CONTROLES MOBILES
  ===================================================== */

  function buildMobileControls() {
    if ($('mobileControls')) return;
    const div = document.createElement('div');
    div.id = 'mobileControls';
    div.innerHTML = `
      <button id="mcForward">▲</button>
      <button id="mcLeft">◀</button>
      <button id="mcRight">▶</button>
      <button id="mcBoost">BOOST</button>
    `;
    $('arenaContainer').appendChild(div);

    const bind = (id, key) => {
      const el = $(id);
      el.addEventListener('touchstart', (e) => { e.preventDefault(); touchInput[key] = true; });
      el.addEventListener('touchend', (e) => { e.preventDefault(); touchInput[key] = false; });
      el.addEventListener('mousedown', () => touchInput[key] = true);
      el.addEventListener('mouseup', () => touchInput[key] = false);
    };

    bind('mcForward', 'forward');
    bind('mcLeft', 'left');
    bind('mcRight', 'right');
    bind('mcBoost', 'boost');
  }

  /* =====================================================
     PHYSIQUE VOITURE
  ===================================================== */

  function updateCar(car, input, dt) {
    if (car.exploded) {
      car.explodeTimer -= dt;
      if (car.explodeTimer <= 0) respawnCar(car);
      return;
    }

    if (world.frozen) {
      car.vx = 0;
      car.vy = 0;
      car.speed = 0;
      car.boosting = false;
      return;
    }

    const boosting = input.boost && car.boost > 0;
    const maxSpeed = boosting ? CAR_CFG.maxSpeedBoost : CAR_CFG.maxSpeed;

    if (input.left) car.angle -= CAR_CFG.turnSpeed * dt * 60;
    if (input.right) car.angle += CAR_CFG.turnSpeed * dt * 60;

    let thrust = 0;
    if (input.forward) thrust = CAR_CFG.accel * (boosting ? CAR_CFG.boostThrustMult : 1);
    if (input.backward) thrust = -CAR_CFG.reverseAccel;

    car.vx += Math.cos(car.angle) * thrust * dt * 60;
    car.vy += Math.sin(car.angle) * thrust * dt * 60;

    car.vx *= CAR_CFG.friction;
    car.vy *= CAR_CFG.friction;

    const newSpeed = Math.hypot(car.vx, car.vy);
    if (newSpeed > maxSpeed) {
      const ratio = maxSpeed / newSpeed;
      car.vx *= ratio;
      car.vy *= ratio;
    }

    car.x += car.vx * dt * 60;
    car.y += car.vy * dt * 60;

    car.x = Math.max(CAR_CFG.width / 2, Math.min(FIELD.w - CAR_CFG.width / 2, car.x));
    car.y = Math.max(CAR_CFG.height / 2, Math.min(FIELD.h - CAR_CFG.height / 2, car.y));

    if (boosting) {
      car.boost = Math.max(0, car.boost - CAR_CFG.boostDrain * dt);
    } else if (CAR_CFG.boostRegen > 0) {
      car.boost = Math.min(100, car.boost + CAR_CFG.boostRegen * dt);
    }
    car.boosting = boosting;
    car.speed = Math.hypot(car.vx, car.vy);
  }

  function explodeCar(car) {
    car.exploded = true;
    car.explodeTimer = 2;
    spawnExplosion(car.x, car.y, car.team);
    car.vx = 0;
    car.vy = 0;
  }

  function respawnCar(car) {
    car.exploded = false;
    car.x = car.startX;
    car.y = car.startY;
    car.angle = car.startAngle;
    car.vx = 0;
    car.vy = 0;
    car.speed = 0;
  }

  function resetCarsAndBallForGoal() {
    world.cars.forEach(car => {
      car.exploded = false;
      car.x = car.startX;
      car.y = car.startY;
      car.angle = car.startAngle;
      car.vx = 0;
      car.vy = 0;
      car.speed = 0;
      car.wasTouching = false;
    });
    world.ball.x = FIELD.w / 2;
    world.ball.y = FIELD.h / 2;
    world.ball.vx = 0;
    world.ball.vy = 0;
  }

  /* =====================================================
     COLLISIONS VOITURE - VOITURE (DEMOLITION)
  ===================================================== */

  function checkCarCollision(carA, carB) {
    if (carA.exploded || carB.exploded) return;

    const dx = carB.x - carA.x;
    const dy = carB.y - carA.y;
    const dist = Math.hypot(dx, dy);
    const minDist = CAR_CFG.collisionRadius * 2;

    if (dist >= minDist || dist === 0) return;

    const speedAKmh = speedToKmh(Math.hypot(carA.vx, carA.vy));
    const speedBKmh = speedToKmh(Math.hypot(carB.vx, carB.vy));
    const topSpeed = Math.max(speedAKmh, speedBKmh);

    if (topSpeed >= EXPLOSION_THRESHOLD_KMH) {
      if (speedAKmh > speedBKmh) {
        explodeCar(carB);
      } else if (speedBKmh > speedAKmh) {
        explodeCar(carA);
      } else {
        explodeCar(carA);
        explodeCar(carB);
      }
      return;
    }

    const nx = dx / dist;
    const ny = dy / dist;
    const overlap = minDist - dist;

    carA.x -= nx * overlap * 0.5;
    carA.y -= ny * overlap * 0.5;
    carB.x += nx * overlap * 0.5;
    carB.y += ny * overlap * 0.5;

    const relVx = carB.vx - carA.vx;
    const relVy = carB.vy - carA.vy;
    const relSpeed = relVx * nx + relVy * ny;

    if (relSpeed < 0) {
      const bounce = 0.6;
      carA.vx += nx * relSpeed * bounce;
      carA.vy += ny * relSpeed * bounce;
      carB.vx -= nx * relSpeed * bounce;
      carB.vy -= ny * relSpeed * bounce;
    }
  }

  /* =====================================================
     PADS DE BOOST
  ===================================================== */

  function updateBoostPads(dt) {
    world.boostPads.forEach(pad => {
      if (!pad.active) {
        pad.cooldown -= dt;
        if (pad.cooldown <= 0) pad.active = true;
        return;
      }

      world.cars.forEach(car => {
        if (car.exploded) return;
        const dx = car.x - pad.x;
        const dy = car.y - pad.y;
        const dist = Math.hypot(dx, dy);
        if (dist < pad.radius + CAR_CFG.collisionRadius) {
          car.boost = 100;
          pad.active = false;
          pad.cooldown = BOOST_PAD_COOLDOWN;
        }
      });
    });
  }

  /* =====================================================
     PARTICULES D'EXPLOSION
  ===================================================== */

  function spawnExplosion(x, y, team) {
    const colors = team === 'blue'
      ? ['#43d9ff', '#ffffff', '#ff9d2e']
      : ['#ff9d2e', '#ffffff', '#43d9ff'];

    for (let i = 0; i < 16; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 2 + Math.random() * 4;
      world.particles.push({
        x, y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        life: 0.6,
        maxLife: 0.6,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: 3 + Math.random() * 4
      });
    }
  }

  function updateParticles(dt) {
    for (let i = world.particles.length - 1; i >= 0; i--) {
      const p = world.particles[i];
      p.x += p.vx * dt * 60;
      p.y += p.vy * dt * 60;
      p.vx *= 0.92;
      p.vy *= 0.92;
      p.life -= dt;
      if (p.life <= 0) world.particles.splice(i, 1);
    }
  }

  /* =====================================================
     PHYSIQUE BALLE
  ===================================================== */

  function simulateBall(ball, dt) {
    ball.x += ball.vx * dt * 60;
    ball.y += ball.vy * dt * 60;
    ball.vx *= BALL_CFG.friction;
    ball.vy *= BALL_CFG.friction;

    const r = BALL_CFG.radius;
    const goalTop = FIELD.h / 2 - FIELD.goalHeight / 2;
    const goalBottom = FIELD.h / 2 + FIELD.goalHeight / 2;
    const insideGoalY = ball.y > goalTop && ball.y < goalBottom;

    if (ball.y - r < 0) { ball.y = r; ball.vy *= -BALL_CFG.wallBounce; }
    if (ball.y + r > FIELD.h) { ball.y = FIELD.h - r; ball.vy *= -BALL_CFG.wallBounce; }

    if (!insideGoalY) {
      if (ball.x - r < 0) { ball.x = r; ball.vx *= -BALL_CFG.wallBounce; }
      if (ball.x + r > FIELD.w) { ball.x = FIELD.w - r; ball.vx *= -BALL_CFG.wallBounce; }
    }

    const speed = Math.hypot(ball.vx, ball.vy);
    if (speed > BALL_CFG.maxSpeed) {
      const ratio = BALL_CFG.maxSpeed / speed;
      ball.vx *= ratio;
      ball.vy *= ratio;
    }
  }

  function registerTouch(car) {
    const stats = world.stats[car.team];
    if (isInOwnSaveZone(car)) {
      stats.saves++;
      stats.points += POINTS_SAVE;
    } else {
      stats.touches++;
      stats.points += POINTS_TOUCH;
    }
    updateStatsDisplay();
    updatePointsDisplay();
  }

  function carBallCollision(car, ball) {
    if (car.exploded) {
      car.wasTouching = false;
      return;
    }

    const dx = ball.x - car.x;
    const dy = ball.y - car.y;
    const dist = Math.hypot(dx, dy);
    const minDist = BALL_CFG.radius + CAR_CFG.collisionRadius;
    const touching = dist < minDist;

    if (touching && dist > 0) {
      const nx = dx / dist;
      const ny = dy / dist;
      const overlap = minDist - dist;

      ball.x += nx * overlap;
      ball.y += ny * overlap;

      const impactForce = Math.hypot(car.vx, car.vy) * 1.4 + 3;
      ball.vx += nx * impactForce;
      ball.vy += ny * impactForce;

      if (!car.wasTouching) {
        registerTouch(car);
      }
    }

    car.wasTouching = touching;
  }

  function checkGoal() {
    if (world.frozen) return;
    const ball = world.ball;
    const r = BALL_CFG.radius;
    const goalTop = FIELD.h / 2 - FIELD.goalHeight / 2;
    const goalBottom = FIELD.h / 2 + FIELD.goalHeight / 2;

    if (ball.x + r < -FIELD.goalDepth && ball.y > goalTop && ball.y < goalBottom) {
      onGoalScored('orange');
    } else if (ball.x - r > FIELD.w + FIELD.goalDepth && ball.y > goalTop && ball.y < goalBottom) {
      onGoalScored('blue');
    }
  }

  function onGoalScored(scoringTeam) {
    if (scoringTeam === 'blue') world.scoreBlue++;
    else world.scoreOrange++;

    world.stats[scoringTeam].goals++;
    world.stats[scoringTeam].points += POINTS_GOAL;

    updateScoreDisplay();
    updateStatsDisplay();
    updatePointsDisplay();

    world.frozen = true;
    resetCarsAndBallForGoal();

    showGoalMessage(scoringTeam, () => {
      runCountdown(3, () => {
        world.frozen = false;
      });
    });
  }

  function showGoalMessage(team, onHidden) {
    const msg = $('goalMessage');
    $('goalScorer').textContent = team === 'blue' ? 'BLUE UNIT' : 'ORANGE CREW';
    show(msg);
    setTimeout(() => {
      hide(msg);
      if (onHidden) onHidden();
    }, 1500);
  }

  /* =====================================================
     BOT
  ===================================================== */

  function botInput(car, ball) {
    const dx = ball.x - car.x;
    const dy = ball.y - car.y;
    const targetAngle = Math.atan2(dy, dx);
    let diff = targetAngle - car.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;

    return {
      forward: true,
      backward: false,
      left: diff < -0.05,
      right: diff > 0.05,
      boost: Math.hypot(dx, dy) > 300
    };
  }

  /* =====================================================
     BOUCLE DE JEU
  ===================================================== */

  function beginPlay() {
    running = true;
    paused = false;
    lastTimestamp = performance.now();

    timerInterval = setInterval(() => {
      if (paused) return;
      matchTimeLeft--;
      updateTimerDisplay();
      if (matchTimeLeft <= 0) endMatch();
    }, 1000);

    let lastNetworkSend = 0;

    function gameLoop(ts) {
      if (!running) return;
      const dt = Math.min(0.033, (ts - lastTimestamp) / 1000);
      lastTimestamp = ts;

      if (!paused) {
        if (isHost) {
          const myInput = readLocalInput();
          updateCar(world.cars[0], myInput, dt);

          let p2Input;
          if (mode === 'offline') {
            p2Input = botInput(world.cars[1], world.ball);
          } else {
            p2Input = world.cars[1]._pendingInput || { forward: false, backward: false, left: false, right: false, boost: false };
          }
          updateCar(world.cars[1], p2Input, dt);

          if (!world.frozen) {
            simulateBall(world.ball, dt);
            checkCarCollision(world.cars[0], world.cars[1]);
            carBallCollision(world.cars[0], world.ball);
            carBallCollision(world.cars[1], world.ball);
            checkGoal();
          }

          updateBoostPads(dt);
          updateParticles(dt);

          if (mode === 'online' && ts - lastNetworkSend > 33) {
            lastNetworkSend = ts;
            ws.send(JSON.stringify({
              type: 'game-state',
              state: {
                cars: world.cars,
                ball: world.ball,
                scoreBlue: world.scoreBlue,
                scoreOrange: world.scoreOrange,
                timeLeft: matchTimeLeft,
                frozen: world.frozen,
                boostPads: world.boostPads,
                stats: world.stats
              }
            }));
          }
        } else {
          const myInput = readLocalInput();
          ws.send(JSON.stringify({ type: 'input', input: myInput }));
          updateParticles(dt);
        }

        updateHud();
        updateBallSpeedDisplay();
      }

      render();
      animFrameId = requestAnimationFrame(gameLoop);
    }

    animFrameId = requestAnimationFrame(gameLoop);
  }

  function applyRemoteState(state) {
    world.cars[0] = state.cars[0];
    world.cars[1] = state.cars[1];
    world.ball = state.ball;
    world.scoreBlue = state.scoreBlue;
    world.scoreOrange = state.scoreOrange;
    matchTimeLeft = state.timeLeft;
    world.frozen = state.frozen;
    world.boostPads = state.boostPads;
    world.stats = state.stats;
    updateScoreDisplay();
    updateTimerDisplay();
    updateStatsDisplay();
    updatePointsDisplay();
  }

  function stopGameLoop() {
    running = false;
    if (animFrameId) cancelAnimationFrame(animFrameId);
    if (timerInterval) clearInterval(timerInterval);
  }

  /* =====================================================
     RENDU
  ===================================================== */

  function render() {
    ctx.clearRect(0, 0, FIELD.w, FIELD.h);

    ctx.fillStyle = '#0a1c2e';
    ctx.fillRect(0, 0, FIELD.w, FIELD.h);

    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 2;
    ctx.strokeRect(4, 4, FIELD.w - 8, FIELD.h - 8);
    ctx.beginPath();
    ctx.moveTo(FIELD.w / 2, 0);
    ctx.lineTo(FIELD.w / 2, FIELD.h);
    ctx.stroke();

    const goalTop = FIELD.h / 2 - FIELD.goalHeight / 2;
    ctx.strokeStyle = '#43d9ff';
    ctx.strokeRect(0, goalTop, FIELD.goalDepth, FIELD.goalHeight);
    ctx.strokeStyle = '#ff9d2e';
    ctx.strokeRect(FIELD.w - FIELD.goalDepth, goalTop, FIELD.goalDepth, FIELD.goalHeight);

    world.boostPads.forEach(drawBoostPad);

    world.cars.forEach(car => { if (!car.exploded) drawCar(car); });
    drawBall(world.ball);

    world.particles.forEach(drawParticle);
  }

  function drawBoostPad(pad) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(pad.x, pad.y, pad.radius, 0, Math.PI * 2);
    if (pad.active) {
      ctx.fillStyle = 'rgba(255, 220, 80, 0.85)';
      ctx.shadowColor = '#ffdc50';
      ctx.shadowBlur = 18;
    } else {
      ctx.fillStyle = 'rgba(120, 120, 120, 0.3)';
      ctx.shadowBlur = 0;
    }
    ctx.fill();
    ctx.strokeStyle = pad.active ? '#fff3b0' : 'rgba(200,200,200,0.3)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }

  function drawCar(car) {
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);

    const mainColor = car.team === 'blue' ? '#43d9ff' : '#ff9d2e';
    const darkColor = car.team === 'blue' ? '#1f6fa0' : '#a5560f';

    if (car.boosting) {
      ctx.beginPath();
      ctx.moveTo(-CAR_CFG.width / 2, -6);
      ctx.lineTo(-CAR_CFG.width / 2 - 18 - Math.random() * 6, 0);
      ctx.lineTo(-CAR_CFG.width / 2, 6);
      ctx.closePath();
      ctx.fillStyle = '#7cf2ff';
      ctx.shadowColor = '#7cf2ff';
      ctx.shadowBlur = 14;
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    ctx.fillStyle = '#111';
    ctx.fillRect(-CAR_CFG.width / 2 + 3, -CAR_CFG.height / 2 - 3, 10, 4);
    ctx.fillRect(-CAR_CFG.width / 2 + 3, CAR_CFG.height / 2 - 1, 10, 4);
    ctx.fillRect(CAR_CFG.width / 2 - 13, -CAR_CFG.height / 2 - 3, 10, 4);
    ctx.fillRect(CAR_CFG.width / 2 - 13, CAR_CFG.height / 2 - 1, 10, 4);

    ctx.fillStyle = mainColor;
    ctx.shadowColor = mainColor;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.moveTo(-CAR_CFG.width / 2, -CAR_CFG.height / 2 + 4);
    ctx.lineTo(CAR_CFG.width / 2 - 6, -CAR_CFG.height / 2);
    ctx.lineTo(CAR_CFG.width / 2, 0);
    ctx.lineTo(CAR_CFG.width / 2 - 6, CAR_CFG.height / 2);
    ctx.lineTo(-CAR_CFG.width / 2, CAR_CFG.height / 2 - 4);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.fillStyle = darkColor;
    ctx.fillRect(-CAR_CFG.width / 2 + 4, -3, CAR_CFG.width - 14, 6);

    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.ellipse(2, 0, 8, CAR_CFG.height / 2 - 6, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  function drawBall(ball) {
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, BALL_CFG.radius, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = 10;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  function drawParticle(p) {
    const alpha = Math.max(0, p.life / p.maxLife);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fillStyle = p.color;
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 8;
    ctx.fill();
    ctx.restore();
  }

  /* =====================================================
     HUD
  ===================================================== */

  function updateHud() {
    const myCar = world.cars[myPlayerNumber === 2 ? 1 : 0];
    $('boostFill').style.width = myCar.boost + '%';
    $('boostNumber').textContent = Math.round(myCar.boost);
    $('speedNumber').textContent = Math.round(speedToKmh(myCar.speed || 0));
  }

  function updateBallSpeedDisplay() {
    const el = $('ballSpeedNumber');
    if (!el || !world) return;
    const speed = speedToKmh(Math.hypot(world.ball.vx, world.ball.vy));
    el.textContent = 'BALL: ' + Math.round(speed) + ' KM/H';
  }

  function updateScoreDisplay() {
    $('blueScore').textContent = world.scoreBlue;
    $('orangeScore').textContent = world.scoreOrange;
  }

  function updateStatsDisplay() {
    if (!world) return;
    $('statBlueGoals').textContent = world.stats.blue.goals;
    $('statBlueTouches').textContent = world.stats.blue.touches;
    $('statBlueSaves').textContent = world.stats.blue.saves;
    $('statOrangeGoals').textContent = world.stats.orange.goals;
    $('statOrangeTouches').textContent = world.stats.orange.touches;
    $('statOrangeSaves').textContent = world.stats.orange.saves;
  }

  function updatePointsDisplay() {
    if (!world || !myPlayerNumber) return;
    const myTeam = teamOfPlayer(myPlayerNumber);
    $('playerPoints').textContent = world.stats[myTeam].points;
  }

  function updateTimerDisplay() {
    const m = Math.floor(matchTimeLeft / 60);
    const s = matchTimeLeft % 60;
    $('timer').textContent = m + ':' + String(s).padStart(2, '0');
  }

  /* =====================================================
     PAUSE
  ===================================================== */

  function togglePause() {
    paused = !paused;
    if (paused) show($('pauseMenu')); else hide($('pauseMenu'));
  }

  function initPauseMenu() {
    $('resumeButton').onclick = () => { paused = false; hide($('pauseMenu')); };
    $('pauseSettingsButton').onclick = () => openSettings('pauseMenu');
    $('concedeButton').onclick = () => { hide($('pauseMenu')); show($('concedeConfirm')); };
    $('pauseMainMenuButton').onclick = () => { returnToMainMenu(); };

    $('confirmConcedeButton').onclick = () => {
      hide($('concedeConfirm'));
      const winner = myPlayerNumber === 1 ? 'orange' : 'blue';
      endMatch(winner);
    };
    $('cancelConcedeButton').onclick = () => {
      hide($('concedeConfirm'));
      show($('pauseMenu'));
    };
  }

  /* =====================================================
     FIN DE MATCH
  ===================================================== */

  function endMatch() {
    stopGameLoop();
    showResult(null, world.scoreBlue, world.scoreOrange);
  }

  function showResult(reason, scoreBlue, scoreOrange) {
    let winnerText;
    if (scoreBlue > scoreOrange) winnerText = 'BLUE WINS';
    else if (scoreOrange > scoreBlue) winnerText = 'ORANGE WINS';
    else winnerText = 'DRAW';

    $('winnerDisplay').textContent = reason || winnerText;
    $('finalBlueScore').textContent = scoreBlue;
    $('finalOrangeScore').textContent = scoreOrange;
    show($('resultScreen'));
  }

  function initResultScreen() {
    $('playAgainButton').onclick = () => {
      hide($('resultScreen'));
      startMatch(mode);
    };
    $('mainMenuButton').onclick = () => {
      hide($('resultScreen'));
      returnToMainMenu();
    };
  }

  function returnToMainMenu() {
    stopGameLoop();
    if (ws) { ws.close(); ws = null; }
    hide($('pauseMenu'));
    hide($('resultScreen'));
    const mc = $('mobileControls');
    if (mc) mc.remove();
    show($('mainMenu'));
  }

  /* =====================================================
     HOW TO PLAY
  ===================================================== */

  function initHowToPlay() {
    if ($('backButton')) {
      $('backButton').onclick = () => {
        hide($('howToPlayMenu'));
        show($('mainMenu'));
      };
    }
  }

  /* =====================================================
     INITIALISATION
  ===================================================== */

  function init() {
    loadControls();
    injectDynamicStyles();
    injectBallSpeedDisplay();
    injectStatsBar();
    hide($('mainMenu'));
    buildShopMenu();
    buildSearchingOverlay();
    initSettingsMenu();
    initPauseMenu();
    initResultScreen();
    initHowToPlay();
    buildDeviceMenu();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
