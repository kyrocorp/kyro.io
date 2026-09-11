const http = require("http");
const WebSocket = require("ws");

const PORT = process.env.PORT || 10000;

const server = http.createServer((req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/plain; charset=utf-8"
  });

  res.end("Rocket League.io Multiplayer Server OK");
});

const wss = new WebSocket.Server({
  server
});

const rooms = new Map();

function send(ws, data) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

function broadcast(room, data, except = null) {
  for (const player of room.players) {
    if (player !== except) {
      send(player.ws, data);
    }
  }
}

function createRoomCode() {
  let code;

  do {
    code = Math.random()
      .toString(36)
      .substring(2, 6)
      .toUpperCase();
  } while (rooms.has(code));

  return code;
}

function removePlayer(player) {
  const room = player.room;

  if (!room) return;

  room.players = room.players.filter(p => p !== player);

  if (room.players.length === 0) {
    rooms.delete(room.code);
    return;
  }

  broadcast(room, {
    type: "player-left"
  });

  player.room = null;
}

wss.on("connection", ws => {
  const player = {
    ws,
    room: null,
    id: Math.random().toString(36).substring(2, 10)
  };

  send(ws, {
    type: "connected",
    playerId: player.id
  });

  ws.on("message", raw => {
    let message;

    try {
      message = JSON.parse(raw.toString());
    } catch {
      return;
    }

    /*
      CREATE ROOM
    */
    if (message.type === "create-room") {
      if (player.room) return;

      const code = createRoomCode();

      const room = {
        code,
        players: []
      };

      rooms.set(code, room);

      player.room = room;
      room.players.push(player);

      send(ws, {
        type: "room-created",
        roomCode: code,
        playerNumber: 1
      });

      return;
    }

    /*
      JOIN ROOM
    */
    if (message.type === "join-room") {
      if (player.room) return;

      const code = String(message.roomCode || "")
        .trim()
        .toUpperCase();

      const room = rooms.get(code);

      if (!room) {
        send(ws, {
          type: "error",
          message: "Partie introuvable."
        });
        return;
      }

      if (room.players.length >= 2) {
        send(ws, {
          type: "error",
          message: "Cette partie est déjà pleine."
        });
        return;
      }

      player.room = room;
      room.players.push(player);

      send(ws, {
        type: "room-joined",
        roomCode: code,
        playerNumber: 2
      });

      broadcast(room, {
        type: "match-ready"
      });

      return;
    }

    /*
      GAME STATE
    */
    if (message.type === "game-state") {
      if (!player.room) return;

      broadcast(
        player.room,
        {
          type: "game-state",
          playerId: player.id,
          state: message.state
        },
        player
      );

      return;
    }

    /*
      GAME EVENT
      But, démolition, boost, etc.
    */
    if (message.type === "game-event") {
      if (!player.room) return;

      broadcast(
        player.room,
        {
          type: "game-event",
          playerId: player.id,
          event: message.event
        },
        player
      );

      return;
    }

    /*
      CHAT / AUTRES MESSAGES
    */
    if (message.type === "custom") {
      if (!player.room) return;

      broadcast(
        player.room,
        {
          type: "custom",
          playerId: player.id,
          data: message.data
        },
        player
      );
    }
  });

  ws.on("close", () => {
    removePlayer(player);
  });

  ws.on("error", () => {
    removePlayer(player);
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Rocket League.io server running on port ${PORT}`);
});
