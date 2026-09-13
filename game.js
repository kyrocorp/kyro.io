(function () {
  'use strict';

  /* =====================================================
     CONFIG
  ===================================================== */

  const SERVER_URL = 'wss://kyro-io.onrender.com';
  let ADMIN_CODE = 'TURBO2026';

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
    boostRegen: 0,
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

  const MOVE_MAX_DRAG = 100;

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
  const touchInput = { throttle: 0, steer: 0, boost: false };

  let rebindingAction = null;
  let settingsOpenedFrom = 'mainMenu';

  let cheatInfiniteBoost = false;

  let canvas, ctx;
  let running = false;
  let paused = false;
  let animFrameId = null;
  let lastTimestamp = 0;
  let matchTimeLeft = MATCH_DURATION;
  let timerInterval = null;

  let world = null;

  let moveTouchId = null;
  let moveStartX = 0;
  let moveStartY = 0;

  // Admin
  let isAdmin = false;
  let shopItems = [];       // { id, name, price, discount, purchases }
  let notifications = [];   // { id, destination: 'notification'|'upcoming', title, body, date, sender }
  let lastSeenNotifCount = 0;
  let mailboxActiveTab = 'notification';
  let adminActiveTab = 'boutique';

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

  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

  function teamOfPlayer(num) { return num === 1 ? 'blue' : 'orange'; }

  function discountedPrice(item) {
    const d = item.discount || 0;
    return Math.round(item.price * (1 - d / 100));
  }

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
      #shopMenu .shop-list {
        display: flex;
        flex-direction: column;
        gap: 10px;
        margin: 20px 0;
        max-height: 340px;
        overflow-y: auto;
      }
      #shopMenu .shop-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px 16px;
        background: rgba(255,255,255,0.04);
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 8px;
        font-size: 12px;
        gap: 12px;
      }
      #shopMenu .shop-item .item-info { text-align: left; }
      #shopMenu .shop-item .item-price {
        color: #baff35;
        font-weight: bold;
        white-space: nowrap;
      }
      #shopMenu .shop-item .item-price .old-price {
        color: #7d8ca0;
        text-decoration: line-through;
        font-weight: normal;
        margin-right: 6px;
        font-size: 10px;
      }
      #shopMenu .shop-item .buy-btn {
        padding: 8px 14px;
        font-size: 10px;
        border-radius: 20px;
        white-space: nowrap;
      }
      #shopMenu .discount-tag {
        background: #ff5b3d;
        color: white;
        font-size: 9px;
        padding: 2px 6px;
        border-radius: 10px;
        margin-left: 6px;
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
      #statsBar .statsColumn b { margin-left: 4px; }
      #statsBar .statsColumn.blue b { color: #43d9ff; }
      #statsBar .statsColumn.orange b { color: #ff9d2e; }
      #statsBar .statsColumn.orange { justify-content: flex-end; margin-left: auto; }

      #mobileControls {
        position: absolute;
        inset: 0;
        z-index: 40;
      }
      #mcMoveArea {
        position: absolute;
        inset: 0;
        touch-action: none;
        pointer-events: auto;
      }
      #mcBoost {
        position: absolute;
        bottom: 55px;
        right: 30px;
        width: 84px;
        height: 84px;
        border-radius: 50%;
        font-size: 11px;
        padding: 0;
        pointer-events: auto;
        z-index: 41;
        background: rgba(0,150,255,0.12);
      }
      #mcBoost.active {
        background: #00bfff;
        box-shadow: 0 0 25px #00bfff;
      }

      #cheatSettingsMenu .cheat-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 20px;
        padding: 16px 0;
        border-bottom: 1px solid rgba(255,255,255,0.08);
      }
      #cheatSettingsMenu .cheat-row span {
        font-size: 12px;
        letter-spacing: 1px;
        color: #dce8f2;
      }
      #cheatSettingsMenu input[type="checkbox"] {
        width: 22px;
        height: 22px;
        accent-color: #00bfff;
        cursor: pointer;
      }

      /* ===== ADMIN BOUTONS FLOTTANTS (bien arrondis) ===== */

      #adminToggleBtn, #mailboxBtn {
        position: fixed;
        top: 14px;
        width: 38px;
        height: 38px;
        border-radius: 50%;
        padding: 0;
        font-size: 15px;
        line-height: 1;
        z-index: 2000;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 1px solid rgba(90, 200, 255, 0.4);
        background: rgba(4, 10, 20, 0.85);
      }
      #adminToggleBtn { right: 14px; }
      #mailboxBtn { left: 14px; }

      #adminPanelBtn {
        position: fixed;
        top: 14px;
        right: 60px;
        height: 38px;
        padding: 0 16px;
        font-size: 9px;
        letter-spacing: 1px;
        border-radius: 20px;
        z-index: 2000;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 1px solid rgba(90, 200, 255, 0.4);
        background: rgba(4, 10, 20, 0.85);
      }

      #mailboxBtn .badge {
        position: absolute;
        top: -4px;
        right: -4px;
        background: #ff5b3d;
        color: white;
        font-size: 9px;
        border-radius: 50%;
        min-width: 16px;
        height: 16px;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0 3px;
      }

      #adminCodeModal, #adminPanelModal, #mailboxModal {
        position: fixed;
        inset: 0;
        z-index: 2100;
        display: flex;
        justify-content: center;
        align-items: center;
        background: rgba(0,0,0,0.75);
        backdrop-filter: blur(6px);
      }

      #adminCodeModal .panel, #adminPanelModal .panel, #mailboxModal .panel {
        width: min(560px, 92vw);
        max-height: 85vh;
        overflow-y: auto;
        padding: 32px;
      }

      .admin-tabs, .mailbox-tabs {
        display: flex;
        gap: 8px;
        justify-content: center;
        margin: 20px 0 10px;
      }
      .admin-tabs button, .mailbox-tabs button {
        padding: 9px 18px;
        font-size: 10px;
        border-radius: 20px;
        letter-spacing: 1px;
      }
      .admin-tabs button.active, .mailbox-tabs button.active {
        background: #00bfff;
        box-shadow: 0 0 20px rgba(0,191,255,0.5);
      }

      .admin-section-content { text-align: left; margin-top: 15px; }
      .admin-section-content h3 {
        color: #42cfff;
        font-size: 13px;
        letter-spacing: 2px;
        margin-bottom: 12px;
      }
      .admin-section-content input,
      .admin-section-content select,
      .admin-section-content textarea {
        width: 100%;
        padding: 10px 12px;
        margin-bottom: 10px;
        background: rgba(255,255,255,0.05);
        border: 1px solid rgba(255,255,255,0.15);
        border-radius: 8px;
        color: white;
        font-family: inherit;
        font-size: 12px;
      }
      .admin-section-content textarea { resize: vertical; min-height: 60px; }
      .admin-section-content button.full { width: 100%; border-radius: 20px; }

      .admin-block {
        margin-bottom: 22px;
        padding-bottom: 18px;
        border-bottom: 1px solid rgba(255,255,255,0.08);
      }
      .admin-block:last-child { border-bottom: none; }

      .admin-shop-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        padding: 10px 12px;
        margin-bottom: 8px;
        background: rgba(255,255,255,0.03);
        border-radius: 8px;
        font-size: 11px;
      }
      .admin-shop-row .row-info { flex: 1; min-width: 0; }
      .admin-shop-row .row-actions {
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .admin-shop-row .row-actions input {
        width: 55px;
        padding: 6px 8px;
        margin: 0;
        font-size: 10px;
        border-radius: 6px;
      }
      .admin-shop-row .row-actions button {
        padding: 6px 10px;
        font-size: 9px;
        border-radius: 14px;
      }
      .admin-shop-row .delete-btn {
        border-color: #ff5b3d;
        color: #ff5b3d;
      }
      .admin-shop-row .stats-mini {
        display: block;
        font-size: 9px;
        color: #7d8ca0;
        margin-top: 3px;
      }

      .admin-msg-row {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 10px;
        padding: 10px 12px;
        margin-bottom: 8px;
        background: rgba(255,255,255,0.03);
        border-left: 3px solid #43d9ff;
        border-radius: 6px;
        font-size: 11px;
      }
      .admin-msg-row.upcoming { border-left-color: #ff9d2e; }
      .admin-msg-row .row-info { flex: 1; min-width: 0; text-align: left; }
      .admin-msg-row .row-info .msg-tag {
        font-size: 9px;
        letter-spacing: 1px;
        color: #7d8ca0;
      }
      .admin-msg-row .row-info .msg-title {
        font-weight: bold;
        color: white;
        margin: 3px 0;
      }
      .admin-msg-row .delete-btn {
        border-color: #ff5b3d;
        color: #ff5b3d;
        padding: 6px 10px;
        font-size: 9px;
        border-radius: 14px;
        white-space: nowrap;
      }

      .live-count-box {
        text-align: center;
        padding: 14px;
        margin-top: 10px;
        background: rgba(0,150,255,0.08);
        border: 1px solid rgba(0,180,255,0.25);
        border-radius: 10px;
      }
      .live-count-box .count {
        font-size: 30px;
        font-weight: 900;
        color: #43d9ff;
      }

      .notif-item {
        text-align: left;
        padding: 14px;
        margin-bottom: 10px;
        background: rgba(255,255,255,0.04);
        border-left: 3px solid #43d9ff;
        border-radius: 6px;
      }
      .notif-item.upcoming { border-left-color: #ff9d2e; }
      .notif-item .notif-meta {
        font-size: 9px;
        color: #7d8ca0;
        letter-spacing: 1px;
        margin-bottom: 5px;
      }
      .notif-item .notif-title {
        font-size: 13px;
        color: white;
        font-weight: bold;
        margin-bottom: 4px;
      }
      .notif-item .notif-body {
        font-size: 11px;
        color: #b9c8d8;
        line-height: 1.5;
      }
      .notif-empty {
        text-align: center;
        color: #7d8ca0;
        font-size: 12px;
        padding: 30px 0;
        letter-spacing: 1px;
      }
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
     ADMIN : chargement/sauvegarde locales
  ===================================================== */

  function loadAdminData() {
    try {
      shopItems = JSON.parse(localStorage.getItem('turboball_shop_items')) || [];
    } catch (e) { shopItems = []; }
    try {
      notifications = JSON.parse(localStorage.getItem('turboball_notifications')) || [];
    } catch (e) { notifications = []; }
    try {
      lastSeenNotifCount = parseInt(localStorage.getItem('turboball_notif_seen') || '0', 10);
    } catch (e) { lastSeenNotifCount = 0; }
    try {
      const savedCode = localStorage.getItem('turboball_admin_code');
      if (savedCode) ADMIN_CODE = savedCode;
    } catch (e) {}
  }

  function saveShopItems() {
    localStorage.setItem('turboball_shop_items', JSON.stringify(shopItems));
  }

  function saveNotifications() {
    localStorage.setItem('turboball_notifications', JSON.stringify(notifications));
  }

  function saveAdminCode() {
    localStorage.setItem('turboball_admin_code', ADMIN_CODE);
  }

  /* =====================================================
     ADMIN : boutons flottants
  ===================================================== */

  function injectAdminUI() {
    const adminBtn = document.createElement('button');
    adminBtn.id = 'adminToggleBtn';
    adminBtn.className = 'secondary-button';
    adminBtn.textContent = '⚙';
    document.body.appendChild(adminBtn);

    const panelBtn = document.createElement('button');
    panelBtn.id = 'adminPanelBtn';
    panelBtn.className = 'secondary-button hidden';
    panelBtn.textContent = 'PANEL ADMIN';
    document.body.appendChild(panelBtn);

    const mailboxBtn = document.createElement('button');
    mailboxBtn.id = 'mailboxBtn';
    mailboxBtn.className = 'secondary-button';
    mailboxBtn.innerHTML = '✉<span class="badge hidden" id="mailboxBadge">0</span>';
    document.body.appendChild(mailboxBtn);

    adminBtn.onclick = () => {
      if (isAdmin) {
        isAdmin = false;
        hide(panelBtn);
        adminBtn.textContent = '⚙';
        return;
      }
      openAdminCodeModal();
    };

    panelBtn.onclick = openAdminPanel;
    mailboxBtn.onclick = openMailbox;

    updateMailboxBadge();
  }

  function openAdminCodeModal() {
    const div = document.createElement('div');
    div.id = 'adminCodeModal';
    div.innerHTML = `
      <div class="panel">
        <h2>ACCÈS ADMIN</h2>
        <div class="admin-section-content" style="margin-top:15px;">
          <input type="password" id="adminCodeInput" placeholder="Entrez le code">
          <button id="adminCodeSubmit" class="main-button full">VALIDER</button>
          <button id="adminCodeCancel" class="secondary-button full" style="margin-top:8px;">ANNULER</button>
        </div>
      </div>
    `;
    document.body.appendChild(div);

    const close = () => div.remove();
    div.querySelector('#adminCodeCancel').onclick = close;

    div.querySelector('#adminCodeSubmit').onclick = () => {
      const val = div.querySelector('#adminCodeInput').value;
      if (val === ADMIN_CODE) {
        isAdmin = true;
        $('adminToggleBtn').textContent = '✓';
        show($('adminPanelBtn'));
        close();
      } else {
        div.querySelector('#adminCodeInput').style.borderColor = '#ff5b3d';
        div.querySelector('#adminCodeInput').value = '';
        div.querySelector('#adminCodeInput').placeholder = 'Code incorrect, réessayez';
      }
    };

    div.querySelector('#adminCodeInput').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') div.querySelector('#adminCodeSubmit').click();
    });
  }

  /* =====================================================
     ADMIN PANEL (3 catégories : Boutique / Général / Annonce)
  ===================================================== */

  function openAdminPanel() {
    const div = document.createElement('div');
    div.id = 'adminPanelModal';
    div.innerHTML = `
      <div class="panel">
        <h2>PANEL ADMIN</h2>
        <div class="admin-tabs">
          <button data-tab="boutique" class="secondary-button">BOUTIQUE</button>
          <button data-tab="general" class="secondary-button">GÉNÉRAL</button>
          <button data-tab="annonce" class="secondary-button">ANNONCE</button>
        </div>
        <div id="adminTabContent"></div>
        <button id="adminPanelCloseBtn" class="secondary-button full" style="margin-top:20px;">FERMER</button>
      </div>
    `;
    document.body.appendChild(div);

    const tabButtons = div.querySelectorAll('.admin-tabs button');
    tabButtons.forEach(btn => {
      btn.onclick = () => {
        adminActiveTab = btn.dataset.tab;
        renderAdminTab(div);
      };
    });

    div.querySelector('#adminPanelCloseBtn').onclick = () => div.remove();

    renderAdminTab(div);
  }

  function renderAdminTab(panelEl) {
    panelEl.querySelectorAll('.admin-tabs button').forEach(b => {
      b.classList.toggle('active', b.dataset.tab === adminActiveTab);
    });

    const content = panelEl.querySelector('#adminTabContent');

    if (adminActiveTab === 'boutique') {
      content.innerHTML = `
        <div class="admin-section-content">
          <div class="admin-block">
            <h3>AJOUTER UN ARTICLE</h3>
            <input type="text" id="shopItemName" placeholder="Nom de l'article">
            <input type="number" id="shopItemPrice" placeholder="Prix (points)">
            <button id="addShopItemBtn" class="main-button full">AJOUTER À LA BOUTIQUE</button>
          </div>
          <div class="admin-block">
            <h3>ARTICLES EN BOUTIQUE</h3>
            <div id="adminShopList"></div>
          </div>
        </div>
      `;

      content.querySelector('#addShopItemBtn').onclick = () => {
        const name = content.querySelector('#shopItemName').value.trim();
        const price = parseInt(content.querySelector('#shopItemPrice').value, 10);
        if (!name || isNaN(price)) return;
        shopItems.push({ id: 'item_' + Date.now(), name, price, discount: 0, purchases: 0 });
        saveShopItems();
        content.querySelector('#shopItemName').value = '';
        content.querySelector('#shopItemPrice').value = '';
        renderAdminShopList(content.querySelector('#adminShopList'));
      };

      renderAdminShopList(content.querySelector('#adminShopList'));

    } else if (adminActiveTab === 'general') {
      content.innerHTML = `
        <div class="admin-section-content">
          <div class="admin-block">
            <h3>CHANGER LE CODE ADMIN</h3>
            <input type="password" id="newAdminCode" placeholder="Nouveau code">
            <button id="changeAdminCodeBtn" class="main-button full">METTRE À JOUR LE CODE</button>
          </div>
          <div class="admin-block">
            <h3>PARTIES EN LIGNE EN DIRECT</h3>
            <div class="live-count-box">
              <div class="count" id="liveMatchCount">...</div>
              <div style="font-size:9px; color:#7d8ca0; letter-spacing:1px; margin-top:5px;">PARTIES ACTIVES</div>
            </div>
            <button id="refreshLiveCountBtn" class="secondary-button full" style="margin-top:10px;">ACTUALISER</button>
          </div>
        </div>
      `;

      content.querySelector('#changeAdminCodeBtn').onclick = () => {
        const val = content.querySelector('#newAdminCode').value.trim();
        if (!val) return;
        ADMIN_CODE = val;
        saveAdminCode();
        content.querySelector('#newAdminCode').value = '';
        content.querySelector('#newAdminCode').placeholder = 'Code mis à jour !';
      };

      content.querySelector('#refreshLiveCountBtn').onclick = () => refreshLiveMatchCount(content);
      refreshLiveMatchCount(content);

    } else if (adminActiveTab === 'annonce') {
      content.innerHTML = `
        <div class="admin-section-content">
          <div class="admin-block">
            <h3>ENVOYER UN MESSAGE</h3>
            <select id="notifDestination">
              <option value="notification">NOTIFICATION</option>
              <option value="upcoming">À VENIR</option>
            </select>
            <input type="text" id="notifTitle" placeholder="Titre">
            <textarea id="notifBody" placeholder="Message"></textarea>
            <button id="sendNotifBtn" class="main-button full">ENVOYER</button>
          </div>
          <div class="admin-block">
            <h3>MESSAGES ENVOYÉS</h3>
            <div id="adminMsgList"></div>
          </div>
        </div>
      `;

      content.querySelector('#sendNotifBtn').onclick = () => {
        const destination = content.querySelector('#notifDestination').value;
        const title = content.querySelector('#notifTitle').value.trim();
        const body = content.querySelector('#notifBody').value.trim();
        if (!title || !body) return;
        notifications.unshift({
          id: 'notif_' + Date.now(),
          destination,
          sender: destination === 'upcoming' ? 'ÉQUIPE TURBOBALL — À VENIR' : 'ÉQUIPE TURBOBALL',
          title,
          body,
          date: new Date().toLocaleString('fr-FR')
        });
        saveNotifications();
        updateMailboxBadge();
        content.querySelector('#notifTitle').value = '';
        content.querySelector('#notifBody').value = '';
        renderAdminMsgList(content.querySelector('#adminMsgList'));
      };

      renderAdminMsgList(content.querySelector('#adminMsgList'));
    }
  }

  function renderAdminShopList(container) {
    if (!container) return;
    if (shopItems.length === 0) {
      container.innerHTML = '<div class="shop-empty">AUCUN ARTICLE POUR L\'INSTANT</div>';
      return;
    }
    container.innerHTML = shopItems.map(item => `
      <div class="admin-shop-row" data-id="${item.id}">
        <div class="row-info">
          <div>${item.name} — <b style="color:#baff35;">${discountedPrice(item)} PTS</b>${item.discount > 0 ? ` <span style="color:#ff9d2e;">(-${item.discount}%)</span>` : ''}</div>
          <span class="stats-mini">${item.purchases} ACHAT(S)</span>
        </div>
        <div class="row-actions">
          <input type="number" class="discount-input" placeholder="%" min="0" max="100" value="${item.discount || ''}">
          <button class="secondary-button apply-discount-btn">APPLIQUER</button>
          <button class="secondary-button delete-btn delete-item-btn">SUPPRIMER</button>
        </div>
      </div>
    `).join('');

    container.querySelectorAll('.admin-shop-row').forEach(row => {
      const id = row.dataset.id;
      row.querySelector('.apply-discount-btn').onclick = () => {
        const val = parseInt(row.querySelector('.discount-input').value, 10);
        const item = shopItems.find(i => i.id === id);
        if (item) {
          item.discount = isNaN(val) ? 0 : clamp(val, 0, 100);
          saveShopItems();
          renderAdminShopList(container);
        }
      };
      row.querySelector('.delete-item-btn').onclick = () => {
        shopItems = shopItems.filter(i => i.id !== id);
        saveShopItems();
        renderAdminShopList(container);
      };
    });
  }

  function renderAdminMsgList(container) {
    if (!container) return;
    if (notifications.length === 0) {
      container.innerHTML = '<div class="shop-empty">AUCUN MESSAGE ENVOYÉ</div>';
      return;
    }
    container.innerHTML = notifications.map(n => `
      <div class="admin-msg-row ${n.destination === 'upcoming' ? 'upcoming' : ''}" data-id="${n.id}">
        <div class="row-info">
          <div class="msg-tag">${n.destination === 'upcoming' ? 'À VENIR' : 'NOTIFICATION'} · ${n.date}</div>
          <div class="msg-title">${n.title}</div>
        </div>
        <button class="secondary-button delete-btn delete-msg-btn">SUPPRIMER</button>
      </div>
    `).join('');

    container.querySelectorAll('.delete-msg-btn').forEach(btn => {
      btn.onclick = () => {
        const id = btn.closest('.admin-msg-row').dataset.id;
        notifications = notifications.filter(n => n.id !== id);
        saveNotifications();
        updateMailboxBadge();
        renderAdminMsgList(container);
      };
    });
  }

  function refreshLiveMatchCount(panelEl) {
    const countEl = panelEl.querySelector('#liveMatchCount');
    if (!countEl) return;
    countEl.textContent = '...';
    fetchLiveMatchCount((count) => {
      countEl.textContent = count === null ? 'N/A' : count;
    });
  }

  function fetchLiveMatchCount(callback) {
    try {
      const statsWs = new WebSocket(SERVER_URL);
      let done = false;

      statsWs.onopen = () => {
        statsWs.send(JSON.stringify({ type: 'admin-stats' }));
      };

      statsWs.onmessage = (event) => {
        let data;
        try { data = JSON.parse(event.data); } catch (e) { return; }
        if (data.type === 'admin-stats') {
          done = true;
          callback(typeof data.matchCount === 'number' ? data.matchCount : null);
          statsWs.close();
        }
      };

      statsWs.onerror = () => {
        if (!done) { done = true; callback(null); }
      };

      setTimeout(() => {
        if (!done) {
          done = true;
          callback(null);
          try { statsWs.close(); } catch (e) {}
        }
      }, 3000);
    } catch (e) {
      callback(null);
    }
  }

  /* =====================================================
     BOÎTE AUX LETTRES (2 onglets : Notifications / À venir)
  ===================================================== */

  function updateMailboxBadge() {
    const badge = $('mailboxBadge');
    if (!badge) return;
    const unread = notifications.length - lastSeenNotifCount;
    if (unread > 0) {
      badge.textContent = unread;
      show(badge);
    } else {
      hide(badge);
    }
  }

  function openMailbox() {
    const div = document.createElement('div');
    div.id = 'mailboxModal';
    div.innerHTML = `
      <div class="panel">
        <h2>BOÎTE AUX LETTRES</h2>
        <div class="mailbox-tabs">
          <button data-tab="notification" class="secondary-button">NOTIFICATIONS</button>
          <button data-tab="upcoming" class="secondary-button">À VENIR</button>
        </div>
        <div id="mailboxContent"></div>
        <button id="mailboxCloseBtn" class="secondary-button full" style="margin-top:20px;">FERMER</button>
      </div>
    `;
    document.body.appendChild(div);

    const tabButtons = div.querySelectorAll('.mailbox-tabs button');
    tabButtons.forEach(btn => {
      btn.onclick = () => {
        mailboxActiveTab = btn.dataset.tab;
        renderMailboxContent(div);
      };
    });

    div.querySelector('#mailboxCloseBtn').onclick = () => {
      div.remove();
      lastSeenNotifCount = notifications.length;
      localStorage.setItem('turboball_notif_seen', String(lastSeenNotifCount));
      updateMailboxBadge();
    };

    renderMailboxContent(div);
  }

  function renderMailboxContent(panelEl) {
    panelEl.querySelectorAll('.mailbox-tabs button').forEach(b => {
      b.classList.toggle('active', b.dataset.tab === mailboxActiveTab);
    });

    const content = panelEl.querySelector('#mailboxContent');
    const filtered = notifications.filter(n => n.destination === mailboxActiveTab);

    if (filtered.length === 0) {
      content.innerHTML = '<div class="notif-empty">AUCUN MESSAGE POUR L\'INSTANT</div>';
      return;
    }

    content.innerHTML = filtered.map(n => `
      <div class="notif-item ${n.destination === 'upcoming' ? 'upcoming' : ''}">
        <div class="notif-meta">${n.sender} · ${n.date}</div>
        <div class="notif-title">${n.title}</div>
        <div class="notif-body">${n.body}</div>
      </div>
    `).join('');
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
          <button id="playFreeplayBtn" class="main-button">JEU LIBRE</button>
        </div>
      </div>

      <div class="menu-footer">ORIGINAL 2D CAR FOOTBALL GAME</div>
    `;

    show(mainMenu);

    $('openSettingsBtn').onclick = () => openSettings('mainMenu');
    $('openShopBtn').onclick = openShop;
    $('play1v1OnlineBtn').onclick = () => startMatch('online');
    $('play1v1OfflineBtn').onclick = () => startMatch('offline');
    $('playFreeplayBtn').onclick = () => startMatch('freeplay');
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
     BOUTIQUE (côté joueur)
  ===================================================== */

  function buildShopMenu() {
    const div = document.createElement('div');
    div.id = 'shopMenu';
    div.className = 'menu-screen hidden';
    div.innerHTML = `
      <div class="panel">
        <h2>BOUTIQUE</h2>
        <div id="shopContent"></div>
        <button id="shopBackButton" class="secondary-button">BACK</button>
      </div>
    `;
    document.body.appendChild(div);
    $('shopBackButton').onclick = () => {
      hide($('shopMenu'));
      show($('mainMenu'));
    };
  }

  function renderShopItems() {
    const content = $('shopContent');
    if (!content) return;
    if (shopItems.length === 0) {
      content.innerHTML = '<div class="shop-empty">RIEN POUR L\'INSTANT</div>';
      return;
    }
    content.innerHTML = '<div class="shop-list">' + shopItems.map(item => `
      <div class="shop-item" data-id="${item.id}">
        <div class="item-info">
          ${item.name}
          ${item.discount > 0 ? `<span class="discount-tag">-${item.discount}%</span>` : ''}
        </div>
        <div class="item-price">
          ${item.discount > 0 ? `<span class="old-price">${item.price} PTS</span>` : ''}${discountedPrice(item)} PTS
        </div>
        <button class="secondary-button buy-btn">ACHETER</button>
      </div>
    `).join('') + '</div>';

    content.querySelectorAll('.buy-btn').forEach(btn => {
      btn.onclick = () => {
        const id = btn.closest('.shop-item').dataset.id;
        const item = shopItems.find(i => i.id === id);
        if (!item) return;
        item.purchases = (item.purchases || 0) + 1;
        saveShopItems();
        btn.textContent = 'ACHETÉ ✓';
        setTimeout(() => { btn.textContent = 'ACHETER'; }, 1200);
      };
    });
  }

  function openShop() {
    renderShopItems();
    hide($('mainMenu'));
    show($('shopMenu'));
  }

  /* =====================================================
     SETTINGS TRICHE (uniquement Free Play)
  ===================================================== */

  function buildCheatSettingsMenu() {
    const div = document.createElement('div');
    div.id = 'cheatSettingsMenu';
    div.className = 'menu-screen hidden';
    div.innerHTML = `
      <div class="panel">
        <h2>SETTINGS TRICHE</h2>
        <div class="cheat-row">
          <span>BOOST ILLIMITÉ</span>
          <input type="checkbox" id="cheatInfiniteBoostCheckbox">
        </div>
        <button id="cheatSettingsBackButton" class="secondary-button" style="margin-top:25px;">BACK</button>
      </div>
    `;
    document.body.appendChild(div);

    $('cheatInfiniteBoostCheckbox').addEventListener('change', (e) => {
      cheatInfiniteBoost = e.target.checked;
    });

    $('cheatSettingsBackButton').onclick = () => {
      hide($('cheatSettingsMenu'));
      show($('pauseMenu'));
    };
  }

  function openCheatSettings() {
    hide($('pauseMenu'));
    $('cheatInfiniteBoostCheckbox').checked = cheatInfiniteBoost;
    show($('cheatSettingsMenu'));
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

    if (mode === 'offline' || mode === 'freeplay') {
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
        if (isHost && world && world.cars[1]) {
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
    if (mode === 'freeplay') {
      setupWorld();
      runCountdown(3, () => { beginPlay(); });
      return;
    }

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

    const cars = [makeCar(FIELD.w * 0.25, FIELD.h / 2, 0, 'blue')];
    if (mode !== 'freeplay') {
      cars.push(makeCar(FIELD.w * 0.75, FIELD.h / 2, Math.PI, 'orange'));
    }

    world = {
      cars,
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
    updatePauseMenuForMode();

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
    if (deviceType === 'mobile') {
      return {
        throttle: touchInput.throttle,
        steer: touchInput.steer,
        boost: touchInput.boost
      };
    }

    let throttle = 0;
    if (keysDown[controls.forward]) throttle += 1;
    if (keysDown[controls.backward]) throttle -= 1;

    let steer = 0;
    if (keysDown[controls.left]) steer -= 1;
    if (keysDown[controls.right]) steer += 1;

    return {
      throttle,
      steer,
      boost: !!keysDown[controls.boost]
    };
  }

  /* =====================================================
     CONTROLES MOBILES : pavé tactile invisible analogique
  ===================================================== */

  function buildMobileControls() {
    if ($('mobileControls')) return;
    const div = document.createElement('div');
    div.id = 'mobileControls';
    div.innerHTML = `
      <div id="mcMoveArea"></div>
      <button id="mcBoost">BOOST</button>
    `;
    $('arenaContainer').appendChild(div);

    const moveArea = $('mcMoveArea');
    const boostBtn = $('mcBoost');

    function resetMoveInput() {
      touchInput.throttle = 0;
      touchInput.steer = 0;
    }

    function updateMoveFromDelta(dx, dy) {
      touchInput.throttle = clamp(-dx / MOVE_MAX_DRAG, -1, 1);
      touchInput.steer = clamp(dy / MOVE_MAX_DRAG, -1, 1);
    }

    moveArea.addEventListener('touchstart', (e) => {
      if (moveTouchId !== null) return;
      const t = e.changedTouches[0];
      moveTouchId = t.identifier;
      moveStartX = t.clientX;
      moveStartY = t.clientY;
      e.preventDefault();
    }, { passive: false });

    moveArea.addEventListener('touchmove', (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === moveTouchId) {
          updateMoveFromDelta(t.clientX - moveStartX, t.clientY - moveStartY);
          e.preventDefault();
        }
      }
    }, { passive: false });

    function endMoveTouch(e) {
      for (const t of e.changedTouches) {
        if (t.identifier === moveTouchId) {
          moveTouchId = null;
          resetMoveInput();
        }
      }
    }

    moveArea.addEventListener('touchend', endMoveTouch, { passive: false });
    moveArea.addEventListener('touchcancel', endMoveTouch, { passive: false });

    let mouseDragging = false;
    moveArea.addEventListener('mousedown', (e) => {
      mouseDragging = true;
      moveStartX = e.clientX;
      moveStartY = e.clientY;
    });
    window.addEventListener('mousemove', (e) => {
      if (!mouseDragging) return;
      updateMoveFromDelta(e.clientX - moveStartX, e.clientY - moveStartY);
    });
    window.addEventListener('mouseup', () => {
      if (!mouseDragging) return;
      mouseDragging = false;
      resetMoveInput();
    });

    const setBoost = (v) => {
      touchInput.boost = v;
      boostBtn.classList.toggle('active', v);
    };
    boostBtn.addEventListener('touchstart', (e) => { e.preventDefault(); setBoost(true); }, { passive: false });
    boostBtn.addEventListener('touchend', (e) => { e.preventDefault(); setBoost(false); }, { passive: false });
    boostBtn.addEventListener('mousedown', () => setBoost(true));
    boostBtn.addEventListener('mouseup', () => setBoost(false));
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

    const infiniteBoost = mode === 'freeplay' && cheatInfiniteBoost;
    if (infiniteBoost) car.boost = 100;

    const boosting = input.boost && car.boost > 0;
    const maxSpeed = boosting ? CAR_CFG.maxSpeedBoost : CAR_CFG.maxSpeed;

    const steer = clamp(input.steer, -1, 1);
    const throttle = clamp(input.throttle, -1, 1);

    car.angle += steer * CAR_CFG.turnSpeed * dt * 60;

    let thrust = 0;
    if (throttle >= 0) {
      thrust = throttle * CAR_CFG.accel * (boosting ? CAR_CFG.boostThrustMult : 1);
    } else {
      thrust = throttle * CAR_CFG.reverseAccel;
    }

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

    if (boosting && !infiniteBoost) {
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
      throttle: 1,
      steer: clamp(diff / 0.3, -1, 1),
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

          if (world.cars[1]) {
            let p2Input;
            if (mode === 'offline') {
              p2Input = botInput(world.cars[1], world.ball);
            } else {
              p2Input = world.cars[1]._pendingInput || { throttle: 0, steer: 0, boost: false };
            }
            updateCar(world.cars[1], p2Input, dt);
          }

          if (!world.frozen) {
            simulateBall(world.ball, dt);
            if (world.cars[1]) checkCarCollision(world.cars[0], world.cars[1]);
            carBallCollision(world.cars[0], world.ball);
            if (world.cars[1]) carBallCollision(world.cars[1], world.ball);
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

  function updatePauseMenuForMode() {
    const concedeBtn = $('concedeButton');
    const mainMenuBtn = $('pauseMainMenuButton');
    const cheatBtn = $('cheatSettingsMenuButton');

    if (mode === 'online') {
      show(concedeBtn);
      hide(mainMenuBtn);
      hide(cheatBtn);
    } else if (mode === 'freeplay') {
      hide(concedeBtn);
      show(mainMenuBtn);
      show(cheatBtn);
    } else {
      show(concedeBtn);
      show(mainMenuBtn);
      hide(cheatBtn);
    }
  }

  function initPauseMenu() {
    const cheatBtn = document.createElement('button');
    cheatBtn.id = 'cheatSettingsMenuButton';
    cheatBtn.className = 'hidden';
    cheatBtn.textContent = 'SETTINGS TRICHE';
    $('concedeButton').insertAdjacentElement('afterend', cheatBtn);
    cheatBtn.onclick = openCheatSettings;

    $('resumeButton').onclick = () => { paused = false; hide($('pauseMenu')); };
    $('pauseSettingsButton').onclick = () => openSettings('pauseMenu');
    $('concedeButton').onclick = () => { hide($('pauseMenu')); show($('concedeConfirm')); };
    $('pauseMainMenuButton').onclick = () => {
      if (mode === 'online') return;
      returnToMainMenu();
    };

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
    loadAdminData();
    injectDynamicStyles();
    injectBallSpeedDisplay();
    injectStatsBar();
    injectAdminUI();
    hide($('mainMenu'));
    buildShopMenu();
    buildCheatSettingsMenu();
    buildSearchingOverlay();
    initSettingsMenu();
    initPauseMenu();
    initResultScreen();
    initHowToPlay();
    buildDeviceMenu();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
