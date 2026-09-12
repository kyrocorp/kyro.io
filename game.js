(function () {
  'use strict';

  /* =====================================================
     CONFIG (valeurs par défaut, à ajuster selon tes specs)
  ===================================================== */

  const SERVER_URL = 'wss://kyro-io.onrender.com';

  const FIELD = {
    w: 1200,
    h: 700,
    goalHeight: 220,
    goalDepth: 22
  };

  const CAR_CFG = {
    width: 46,
    height: 26,
    accel: 0.35,
    reverseAccel: 0.22,
    maxSpeed: 7.5,
    maxSpeedBoost: 12,
    turnSpeed: 0.045,
    friction: 0.985,
    boostDrain: 35,   // par seconde
    boostRegen: 12    // par seconde
  };

  const BALL_CFG = {
    radius: 16,
    friction: 0.992,
    wallBounce: 0.75,
    maxSpeed: 16
  };

  const MATCH_DURATION = 120; // secondes

  /* =====================================================
     ETAT GLOBAL
  ===================================================== */

  let deviceType = null; // 'pc' | 'mobile'
  let mode = null;       // 'online' | 'offline'
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

  let canvas, ctx;
  let running = false;
  let paused = false;
  let animFrameId = null;
  let lastTimestamp = 0;
  let matchTimeLeft = MATCH_DURATION;
  let timerInterval = null;

  let world = null; // { cars: [car1, car2], ball, scoreBlue, scoreOrange }

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

  /* =====================================================
     STYLES INJECTES (pour les nouveaux éléments de menu)
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
      #mcBack   { bottom: 30px; left: 67px; opacity: 0.001; width:0; height:0; }
      #mcBoost  { bottom: 55px; right: 30px; width: 80px; height: 80px; }
    `;
    document.head.appendChild(style);
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
     MENU PRINCIPAL (2 colonnes)
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

    $('openSettingsBtn').onclick = openSettings;
    $('openShopBtn').onclick = openShop;
    $('play1v1OnlineBtn').onclick = () => startMatch('online');
    $('play1v1OfflineBtn').onclick = () => startMatch('offline');
  }

  /* =====================================================
     SETTINGS (rebind ZQSD) - réutilise le HTML existant
  ===================================================== */

  function refreshSettingsLabels() {
    $('forwardKeyButton').textContent = controls.forward.toUpperCase();
    $('reverseKeyButton').textContent = controls.backward.toUpperCase();
    $('leftKeyButton').textContent = controls.left.toUpperCase();
    $('rightKeyButton').textContent = controls.right.toUpperCase();
    $('boostKeyButton').textContent = controls.boost === ' ' ? 'SPACE' : controls.boost.toUpperCase();
  }

  function openSettings() {
    hide($('mainMenu'));
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
      show($('mainMenu'));
    };
  }

  /* =====================================================
     BOUTIQUE (placeholder)
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
     ECRAN DE RECHERCHE (matchmaking en ligne)
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

    // mode online
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
      if (running) {
        endMatchDueToDisconnect();
      }
    };
  }

  function handleServerMessage(data) {
    switch (data.type) {
      case 'connected':
        break;

      case 'searching':
        break;

      case 'match-found':
        matchId = data.matchId;
        myPlayerNumber = data.playerNumber;
        isHost = data.isHost;
        hide($('searchingOverlay'));
        launchMatchIntro();
        break;

      case 'opponent-input':
        if (isHost && world) {
          applyInputToCar(world.cars[1], data.input);
        }
        break;

      case 'game-state':
        if (!isHost && world) {
          applyRemoteState(data.state);
        }
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
     INTRO DE MATCH + COMPTE A REBOURS
  ===================================================== */

  function launchMatchIntro() {
    show($('matchIntro'));
    setTimeout(() => {
      hide($('matchIntro'));
      setupWorld();
      runCountdown(3, () => {
        beginPlay();
      });
    }, 1800);
  }

  function runCountdown(n, onDone) {
    const el = $('countdown');
    show(el);
    el.textContent = n;
    if (n <= 0) {
      hide(el);
      onDone();
      return;
    }
    setTimeout(() => runCountdown(n - 1, onDone), 800);
  }

  /* =====================================================
     MONDE / OBJETS DU JEU
  ===================================================== */

  function makeCar(x, y, angle, team) {
    return {
      x, y, angle, team,
      vx: 0, vy: 0,
      boost: 100,
      boosting: false
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
      scoreOrange: 0
    };

    matchTimeLeft = MATCH_DURATION;
    updateTimerDisplay();
    updateScoreDisplay();

    if (deviceType === 'mobile') buildMobileControls();
  }

  /* =====================================================
     CONTROLES CLAVIER
  ===================================================== */

  window.addEventListener('keydown', (e) => {
    if (rebindingAction) return;
    keysDown[e.key.toLowerCase() === ' ' ? ' ' : e.key.toLowerCase()] = true;
    if (e.key.toLowerCase() === 'p' && running) togglePause();
  });
  window.addEventListener('keyup', (e) => {
    keysDown[e.key.toLowerCase() === ' ' ? ' ' : e.key.toLowerCase()] = false;
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
     CONTROLES MOBILES (placeholder simple)
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
     PHYSIQUE
  ===================================================== */

  function applyInputToCar(car, input) {
    car._pendingInput = input;
  }

  function simulateCar(car, input, dt) {
    const speed = Math.hypot(car.vx, car.vy);
    const boosting = input.boost && car.boost > 0;
    const maxSpeed = boosting ? CAR_CFG.maxSpeedBoost : CAR_CFG.maxSpeed;

    if (input.left) car.angle -= CAR_CFG.turnSpeed * dt * 60;
    if (input.right) car.angle += CAR_CFG.turnSpeed * dt * 60;

    let thrust = 0;
    if (input.forward) thrust = CAR_CFG.accel * (boosting ? 1.8 : 1);
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
    } else {
      car.boost = Math.min(100, car.boost + CAR_CFG.boostRegen * dt);
    }
    car.boosting = boosting;
    car.speed = newSpeed;
  }

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

  function carBallCollision(car, ball) {
    const dx = ball.x - car.x;
    const dy = ball.y - car.y;
    const dist = Math.hypot(dx, dy);
    const minDist = BALL_CFG.radius + Math.max(CAR_CFG.width, CAR_CFG.height) / 2.2;

    if (dist < minDist && dist > 0) {
      const nx = dx / dist;
      const ny = dy / dist;
      const overlap = minDist - dist;

      ball.x += nx * overlap;
      ball.y += ny * overlap;

      const impactForce = Math.hypot(car.vx, car.vy) * 1.4 + 3;
      ball.vx += nx * impactForce;
      ball.vy += ny * impactForce;
    }
  }

  function checkGoal() {
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

    updateScoreDisplay();
    showGoalMessage(scoringTeam);

    world.ball.x = FIELD.w / 2;
    world.ball.y = FIELD.h / 2;
    world.ball.vx = 0;
    world.ball.vy = 0;
    world.cars[0].x = FIELD.w * 0.25; world.cars[0].y = FIELD.h / 2; world.cars[0].vx = 0; world.cars[0].vy = 0;
    world.cars[1].x = FIELD.w * 0.75; world.cars[1].y = FIELD.h / 2; world.cars[1].vx = 0; world.cars[1].vy = 0;
  }

  function showGoalMessage(team) {
    const msg = $('goalMessage');
    $('goalScorer').textContent = team === 'blue' ? 'BLUE UNIT' : 'ORANGE CREW';
    show(msg);
    setTimeout(() => hide(msg), 1500);
  }

  /* =====================================================
     BOT (mode hors ligne)
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

    animFrameId = requestAnimationFrame(gameLoop);

    let lastNetworkSend = 0;

    function gameLoop(ts) {
      if (!running) return;
      const dt = Math.min(0.033, (ts - lastTimestamp) / 1000);
      lastTimestamp = ts;

      if (!paused) {
        if (isHost) {
          const myInput = readLocalInput();
          simulateCar(world.cars[0], myInput, dt);

          let p2Input;
          if (mode === 'offline') {
            p2Input = botInput(world.cars[1], world.ball);
          } else {
            p2Input = world.cars[1]._pendingInput || { forward: false, backward: false, left: false, right: false, boost: false };
          }
          simulateCar(world.cars[1], p2Input, dt);

          simulateBall(world.ball, dt);
          carBallCollision(world.cars[0], world.ball);
          carBallCollision(world.cars[1], world.ball);
          checkGoal();

          if (mode === 'online' && ts - lastNetworkSend > 33) {
            lastNetworkSend = ts;
            ws.send(JSON.stringify({
              type: 'game-state',
              state: {
                cars: world.cars,
                ball: world.ball,
                scoreBlue: world.scoreBlue,
                scoreOrange: world.scoreOrange,
                timeLeft: matchTimeLeft
              }
            }));
          }
        } else {
          const myInput = readLocalInput();
          ws.send(JSON.stringify({ type: 'input', input: myInput }));
        }

        updateHud();
      }

      render();
      animFrameId = requestAnimationFrame(gameLoop);
    }
  }

  function applyRemoteState(state) {
    world.cars[0] = state.cars[0];
    world.cars[1] = state.cars[1];
    world.ball = state.ball;
    world.scoreBlue = state.scoreBlue;
    world.scoreOrange = state.scoreOrange;
    matchTimeLeft = state.timeLeft;
    updateScoreDisplay();
    updateTimerDisplay();
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

    world.cars.forEach(car => drawCar(car));
    drawBall(world.ball);
  }

  function drawCar(car) {
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    ctx.fillStyle = car.team === 'blue' ? '#43d9ff' : '#ff9d2e';
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = 12;
    ctx.fillRect(-CAR_CFG.width / 2, -CAR_CFG.height / 2, CAR_CFG.width, CAR_CFG.height);
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
  }

  /* =====================================================
     HUD
  ===================================================== */

  function updateHud() {
    const myCar = world.cars[myPlayerNumber === 2 ? 1 : 0];
    $('boostFill').style.width = myCar.boost + '%';
    $('boostNumber').textContent = Math.round(myCar.boost);
    $('speedNumber').textContent = Math.round((myCar.speed || 0) * 20);
  }

  function updateScoreDisplay() {
    $('blueScore').textContent = world.scoreBlue;
    $('orangeScore').textContent = world.scoreOrange;
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
    $('pauseSettingsButton').onclick = () => { hide($('pauseMenu')); show($('settingsMenu')); };
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
     HOW TO PLAY (existant dans le HTML)
  ===================================================== */

  function initHowToPlay() {
    $('howToPlayButton') && ($('howToPlayButton').onclick = () => {});
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
