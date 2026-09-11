function createOnlineUI() {
  /*
    Les boutons PLAY / 1V1 EN LIGNE /
    JEU HORS LIGNE sont maintenant
    organisés au milieu du menu principal.
  */

  // On cache l'ancien bouton PLAY
  if ($("playButton")) {
    $("playButton").style.display = "none";
  }

  // Conteneur central des deux modes
  let modeContainer =
    document.getElementById(
      "rocketModeButtons"
    );

  if (!modeContainer) {
    modeContainer =
      document.createElement("div");

    modeContainer.id =
      "rocketModeButtons";

    modeContainer.style.display =
      "flex";

    modeContainer.style.flexDirection =
      "column";

    modeContainer.style.alignItems =
      "center";

    modeContainer.style.justifyContent =
      "center";

    modeContainer.style.gap =
      "14px";

    modeContainer.style.width =
      "100%";

    modeContainer.style.margin =
      "20px 0";

    mainMenu?.appendChild(
      modeContainer
    );
  }

  /*
    1V1 EN LIGNE
  */
  let onlineButton =
    document.getElementById(
      "rocketOnlineButton"
    );

  if (!onlineButton) {
    onlineButton =
      document.createElement("button");

    onlineButton.id =
      "rocketOnlineButton";

    onlineButton.textContent =
      "1V1 EN LIGNE";

    modeContainer.appendChild(
      onlineButton
    );
  }

  onlineButton.style.margin =
    "0";

  onlineButton.addEventListener(
    "click",
    openOnlineMenu
  );

  /*
    JEU HORS LIGNE
  */
  let offlineButton =
    document.getElementById(
      "rocketOfflineButton"
    );

  if (!offlineButton) {
    offlineButton =
      document.createElement("button");

    offlineButton.id =
      "rocketOfflineButton";

    offlineButton.textContent =
      "JEU HORS LIGNE";

    modeContainer.appendChild(
      offlineButton
    );
  }

  offlineButton.style.margin =
    "0";

  offlineButton.addEventListener(
    "click",
    () => {
      gameMode =
        "offline";

      startMatch();
    }
  );

  /*
    MENU 1V1 EN LIGNE
  */
  onlineMenu =
    document.createElement(
      "div"
    );

  onlineMenu.id =
    "rocketOnlineMenu";

  onlineMenu.style.position =
    "fixed";

  onlineMenu.style.inset =
    "0";

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
