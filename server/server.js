const db = require("./db");
let rooms = {};
const express = require("express"); 
const http = require("http"); 
const socketIO = require("socket.io"); 
const path = require("path"); 
const app = express();
const server = http.createServer(app); 
const io = socketIO(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
}); 
 // ================= LOAD ROOMS FROM DB =================
db.query("SELECT * FROM rooms", (err, results) => {
    if (err) {
        console.error("DB load error:", err);
        return;
    }

    results.forEach(room => {
        rooms[room.id] = {
            admin: room.admin,
            password: room.password,
            size: room.size,
            users: [],
            userSocketMap: {},
            video: null,
            chat: []
        };
    });

    console.log("Rooms loaded from DB ✅");
});
 app.use(express.static(path.join(__dirname, "../public"))); app.get("/", (req, res) => {
     res.sendFile(path.join(__dirname, "../public/index.html")); 
    }); // ===== ROOMS ===== 
    
     io.on("connection", (socket) => { 
        console.log("User connected:", socket.id); // ===== WEBRTC =====
        socket.on("webrtc-offer", ({offer, to, user}) => { 
            io.to(to).emit("webrtc-offer", { 
                offer, 
                from: socket.id,
                 user: user // ✅ use passed user
                   }); 
                }); 
                socket.on("webrtc-answer", ({answer, to}) => { 
                    io.to(to).emit("webrtc-answer", { 
                        answer, 
                        from: socket.id });
                     }); 
                     socket.on("webrtc-ice", ({candidate, to}) => { 
                        io.to(to).emit("webrtc-ice", { 
                            candidate, from: socket.id 
                        }); 
                    }); // ===== CREATE ROOM ===== 
 socket.on("create-room", ({ roomId, admin, password, size }) => {

    // 🔥 save to DB first
    db.query(
        "INSERT INTO rooms (id, admin, password, size) VALUES (?, ?, ?, ?)",
        [roomId, admin, password, size],
        (err) => {

            if (err) {
                socket.emit("error-msg", "Room already exists");
                return;
            }

            // ✅ KEEP memory (important for realtime)
            rooms[roomId] = {
                admin,
                password,
                size: parseInt(size),
                users: [],
                userSocketMap: {},
                video: null,
                chat: []
            };

            socket.emit("room-created", roomId);
        }
    );

}); 
                        // ===== JOIN ROOM ===== 
                         socket.on("join-room", ({ roomId, user, password }) => { 
                            const room = rooms[roomId]; 
                            // ===== VALIDATION ===== 
                            // ===== VALIDATION =====
if (!room) {
    return socket.emit("error-msg", "Room not found");
}

if (room.password !== password) {
    return socket.emit("error-msg", "Wrong password");
}

if (room.users.length >= room.size) {
    return socket.emit("error-msg", "Room is full");
}

if (room.users.includes(user)) {
    return socket.emit("error-msg", "Username already taken");
}
                                // ===== JOIN ROOM ===== 
                                socket.join(roomId);
                                 socket.roomId = roomId; 
                                 socket.username = user;
                                  // ===== GET ALL SOCKETS IN ROOM =====
                                  const clients = Array.from(io.sockets.adapter.rooms.get(roomId) || []);
                                 // ===== SEND EXISTING USERS TO NEW USER ===== 
                                 clients.forEach(id => { if (id !== socket.id) {
                                     const existingSocket = io.sockets.sockets.get(id); 
                                     if (existingSocket) { 
                                        socket.emit("user-socket", { 
                                            socketId: id,
                                             user: 
                                             existingSocket.username 
                                            });
                                         } 
                                        } 
                                    }); 
                                    // ===== ADD USER TO ROOM DATA ===== 
                                    room.users.push(user); 
                                    room.userSocketMap[user] = socket.id;
                                    // 🔥 SAVE USER IN DB
db.query(
    "INSERT INTO room_users (room_id, username, socket_id) VALUES (?, ?, ?)",
    [roomId, user, socket.id],
    (err) => {
        if (err) console.error("User insert error:", err);
    }
);
                                    // ===== NOTIFY OTHER USERS =====
                                    io.to(roomId).emit("user-socket", {
                                      user: user,
                                      socketId: socket.id
                                     });
                                
// ===== SYSTEM MESSAGE ===== 
io.to(roomId).emit("chat", {
    msg: `${user} joined the room`,
    sender: "SYSTEM"
});
// ===== SEND CHAT HISTORY =====
// 🔥 LOAD USERS FROM DB
db.query(
    "SELECT username FROM room_users WHERE room_id = ?",
    [roomId],
    (err, users) => {
        if (!err) {
            io.to(roomId).emit("user-list", users.map(u => u.username));
        }
    }
);

// 🔥 LOAD CHAT FROM DB
db.query(
    "SELECT * FROM room_messages WHERE room_id = ? ORDER BY timestamp ASC",
    [roomId],
    (err, messages) => {
        if (!err) {
            socket.emit("chat-history", messages);
        }
    }
);

// 🔥 LOAD VIDEO FROM DB
db.query(
    "SELECT * FROM room_videos WHERE room_id = ?",
    [roomId],
    (err, result) => {
        if (!err && result.length > 0) {
            socket.emit("play", {
                videoId: result[0].video_id,
                time: result[0].time || 0
            });

            if (result[0].state === "paused") {
                socket.emit("pause");
            }

            if (result[0].state === "ended") {
                socket.emit("video-ended");
            }
        }
    }
);
// ===== SEND ROOM INFO =====
socket.emit("room-info", { 
    size: room.size,
    admin: room.admin   // ✅ add here ONLY
});
// ===== SYNC CURRENT VIDEO ===== 
if (room.video) { 
    socket.emit("play", room.video);

    if (room.video.state === "paused") {
        socket.emit("pause");
    }

    if (room.video.state === "ended") {
        socket.emit("video-ended");
    }
}
// ===== CONFIRM ROOM JOINED =====
 socket.emit("room-joined", { 
    roomId: roomId,
     user: user, 
     password: password 
    }); 
}); 
// ===== VIDEO ===== 
// ===== VIDEO SYNC (CLEAN VERSION) =====

socket.on("play", (data) => { 
    const room = rooms[socket.roomId];
    if (!room) return;
    if (socket.username !== room.admin) return;

    room.video = {
        videoId: data.videoId,
        time: data.time,
        state: "playing"
    };

    // ✅ DB SAVE (keep your existing query if you want)

    // ✅ SEND CORRECT EVENT
    socket.to(socket.roomId).emit("play", {
        videoId: data.videoId,
        time: data.time
    });
});

socket.on("pause", () => { 
    const room = rooms[socket.roomId];
    if (!room || !room.video) return;
    if (socket.username !== room.admin) return;

    room.video.state = "paused";

    socket.to(socket.roomId).emit("sync-state", {
        videoId: room.video.videoId,
        time: room.video.time,
        isPlaying: false
    });
});

socket.on("video-ended", () => {
    const room = rooms[socket.roomId];
    if (!room || !room.video) return;
    if (socket.username !== room.admin) return;

    room.video.state = "ended";

    socket.to(socket.roomId).emit("sync-state", {
        videoId: room.video.videoId,
        time: 0,
        isPlaying: false
    });
});

// 🔥 continuous sync (fix delay)
socket.on("sync-time", (data) => { 
    const room = rooms[socket.roomId];
    if (!room || !room.video) return;
    if (socket.username !== room.admin) return;

    room.video.time = data.time;

    // ✅ ONLY send time (NOT sync-state)
    socket.to(socket.roomId).emit("sync-time", {
        videoId: room.video.videoId,
        time: data.time
    });
});
 // ===== CHAT ===== 
socket.on("chat", (data) => {
    const room = rooms[socket.roomId];
    if (!room) return;

    if (!data.id) data.id = Date.now(); // safety

    room.chat.push(data);
    // 🔥 SAVE CHAT TO DB
db.query(
    "INSERT INTO room_messages (room_id, username, message) VALUES (?, ?, ?)",
    [socket.roomId, socket.username, data.msg],
    (err) => {
        if (err) console.error("Chat save error:", err);
    }
);
    io.to(socket.roomId).emit("chat", data);
});
// ===== DELETE MESSAGE =====
socket.on("delete-msg", (id) => {
    const room = rooms[socket.roomId];
    if (!room) return;

    // remove message from history
    room.chat = room.chat.filter(msg => msg.id !== id);

    // send delete event to everyone
    io.to(socket.roomId).emit("delete-msg", id);
});
 // ===== DISCONNECT ===== 
socket.on("disconnect", () => { 
    const room = rooms[socket.roomId]; 
    if (socket.roomId) {
    socket.to(socket.roomId).emit("user-left", socket.id);
}
if (!room) return; if (!socket.username) return; 
room.users = room.users.filter(u => u !== socket.username); 
delete room.userSocketMap[socket.username];
// 🔥 REMOVE USER FROM DB
db.query(
    "DELETE FROM room_users WHERE socket_id = ?",
    [socket.id],
    (err) => {
        if (err) console.error("User delete error:", err);
    }
);
if (socket.username === room.admin) 
{ room.admin = room.users[0] || null; 
io.to(socket.roomId).emit("chat", { 
   msg: `👑 New admin is ${room.admin}`,
     sender: "SYSTEM" 
    });
 }
 io.to(socket.roomId).emit("user-list", room.users); 
io.to(socket.roomId).emit("chat", {
    msg: `${socket.username} left the room`,
    sender: "SYSTEM"
}); 
if (room.users.length === 0) { 
    delete rooms[socket.roomId]; 
    console.log("Room deleted (memory):", socket.roomId); 

    // 🔥 DELETE FROM DATABASE
    db.query(
        "DELETE FROM rooms WHERE id = ?", 
        [socket.roomId], 
        (err) => {
            if (err) {
                console.error("DB delete error:", err);
            } else {
                console.log("Room deleted from DB:", socket.roomId);
            }
        }
    );
}
console.log("User disconnected:", socket.id); 
 }); 
}); 
const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
    console.log("🚀 Server running on port " + PORT);
});