let player; 
let playerReady = false;
let localStream = null;
let isSyncing = false; 
let currentVideoId = null; 
let pendingVideo = null; 
let isAdmin = false; 
let cameraReady = false;
let cameraOn = true; 
let micOn = true;
let replyingTo = null;
let currentUsers = [];
let notificationTimeout = null;
let lastProcessedUsers = [];
let peerConnections = {};
const pendingCandidates = {};
const makingOffer = {};
const rtcConfig = {
    iceServers: [
        { urls: "stun:stun.l.google.com:19302" },

        {
            urls: "turn:openrelay.metered.ca:80",
            username: "openrelayproject",
            credential: "openrelayproject"
        },
        {
            urls: "turn:openrelay.metered.ca:443",
            username: "openrelayproject",
            credential: "openrelayproject"
        }
    ]
};
const socket = io(); 
let userSocketMap = {}; 
socket.on("user-socket", ({ user, socketId }) => {
    userSocketMap[user] = socketId;

    if (user !== username && !peerConnections[socketId]) {
        createPeerConnection(socketId, user);
    }
}); 
        // ================= PARAMETERS ================= 
        const params = new URLSearchParams(window.location.search); 
        const camParam = params.get("cam");
        const micParam = params.get("mic");
        const camEnabled = camParam !== "false";  // default true
        const micEnabled = micParam !== "false";
        const roomId = params.get("room"); 
        const username = params.get("user");
         const password = params.get("pass");
document.addEventListener("DOMContentLoaded", async () => {

    currentUsers = [username];

    updateUI(currentUsers);
    
    await startCamera();

    socket.emit("join-room", {
        roomId,
        user: username,
        password: password
        
    });

});
          // ================= ROOM INFO =================
          let shareLink = "";
           document.addEventListener("DOMContentLoaded", () => {
             document.getElementById("roomIdText").innerText = roomId; 
             document.getElementById("roomPassText").innerText = password;
              shareLink = `${window.location.origin}/room.html?room=${roomId}&user=Guest&pass=${password}`;
            }); 
       window.onYouTubeIframeAPIReady = function () {
    player = new YT.Player("player", {
    height: "360",
    width: "640",
    videoId: "",
    playerVars: {
        origin: window.location.origin   // 🔥 ADD THIS
    },
    events: {
        onReady: () => {
            playerReady = true;

            if (pendingVideo) {
                syncVideo(pendingVideo);
                pendingVideo = null;
            }
        },
        onStateChange: onPlayerStateChange
    }
});
};
// ================= JOIN ROOM ================= 
 async function startCamera() { 
    try { 
        localStream = await navigator.mediaDevices.getUserMedia(
            { 
                video: true, 
                audio: true 
            }); 
            // ✅ APPLY USER PREFERENCES
            const videoTrack = localStream.getVideoTracks()[0];
            const audioTrack = localStream.getAudioTracks()[0];

            if (videoTrack) videoTrack.enabled = camEnabled;
            if (audioTrack) audioTrack.enabled = micEnabled;
            cameraReady = !!localStream;
             console.log("✅ Camera ready");
              attachLocalVideo(); 
                setTimeout(() => {
    const camBtn = document.querySelector(".vc-btn.cam");
    const micBtn = document.querySelector(".vc-btn.mic");

    if (camBtn && !camEnabled) {
        camBtn.innerHTML = "🚫";
        camBtn.classList.add("off");
    }

    if (micBtn && !micEnabled) {
        micBtn.innerHTML = "🔇";
        micBtn.classList.add("off");
    }
}, 500);
              // 🔥 IMPORTANT: Add tracks to ALL existing peer connections
               Object.entries(peerConnections)
               .forEach(([socketId, pc]) => {
                 if (!pc) return; 
                if (localStream) {
    localStream.getTracks().forEach(track => {
        if (!pc.getSenders().find(s => s.track === track)) {
            pc.addTrack(track, localStream);
        }
    });
}
            }); 
// 🔥 SMALL DELAY → ensures tracks are added before offer 
 } 
catch (err) { 
    console.error("❌ Camera error:", err);
 if (err.name === "NotAllowedError") {
 showNotification("❌ Camera blocked! Allow it from browser settings", "error", 5000);
 } 
else if (err.name === "NotFoundError") { 
showNotification("❌ No camera found", "error"); 
 } 
else {
     showNotification("❌ Camera error", "error");
     }
 cameraReady = true; updateUI(currentUsers); 
  } 
 }
function attachLocalVideo(){

    const video = document.querySelector(`[data-user="${username}"] video`);

    if(!video){
        setTimeout(attachLocalVideo,200);
        return;
    }

    if(localStream){
        video.srcObject = localStream;
        video.muted = true;
        video.play().catch(()=>{});
    }
}
// ================= MEDIA CONTROLS ================= 
function toggleCamera(){ 
    if(!localStream) return;

    const track = localStream.getVideoTracks()[0];
    const btn = document.querySelector(".vc-btn.cam");

    track.enabled = !track.enabled;

    if(track.enabled){
        btn.innerHTML = "📷";
        btn.classList.remove("off");
    } else {
        btn.innerHTML = "🚫";
        btn.classList.add("off");
    }
} 
// ================= YOUTUBE ================= 
function toggleMic(){ 
    if(!localStream) return;

    const track = localStream.getAudioTracks()[0];
    const btn = document.querySelector(".vc-btn.mic");

    track.enabled = !track.enabled;

    if(track.enabled){
        btn.innerHTML = "🎤";
        btn.classList.remove("off");
    } else {
        btn.innerHTML = "🔇";
        btn.classList.add("off");
    }
}
// ================= PLAYER EVENTS ================= 
function startVideo(){
    if(playerReady){
        player.playVideo();
    }

    // hide overlay
  document.getElementById("playOverlay").classList.add("hidden");
}

function onPlayerStateChange(event) {

    if (isSyncing) return; // ❗ only block syncing

    const overlay = document.getElementById("playOverlay");
    if (!overlay) return;

    switch (event.data) {

        case YT.PlayerState.PLAYING:
            overlay.style.display = "none";
            overlay.classList.remove("black", "blur");

            // only admin controls sync
            if (isAdmin) {
                socket.emit("play", {
                    videoId: currentVideoId,
                    time: player.getCurrentTime()
                });
            }
            break;

        case YT.PlayerState.PAUSED:
            // 🔥 ADD THIS CHECK (IMPORTANT)
            if (isSyncing) return;
            overlay.style.display = "flex";
            overlay.classList.remove("black");
            overlay.classList.add("blur");

            if (isAdmin) {
                socket.emit("pause");
            }
            break;

        case YT.PlayerState.ENDED:
            overlay.style.display = "flex";
            overlay.classList.remove("blur");
            overlay.classList.add("black");

            // 🔥 broadcast end to users
            if (isAdmin) {
                socket.emit("video-ended");
            }
            break;
    }
}
 // ================= 
 setInterval(() => {
    if (isAdmin && playerReady && currentVideoId) {
        socket.emit("sync-time", {
            videoId: currentVideoId,
            time: player.getCurrentTime()
        });
    }
}, 1000);
// LOAD VIDEO ================= 
function loadVideo() { 
if (!isAdmin) { 
    showNotification("⚠️ Only admin can control video", "warning"); 
    return;
 }
 let input = document.getElementById("videoId").value.trim();
 let videoId = ""; 
try { 
    if (input.includes("youtube.com") || input.includes("youtu.be"))

{ 
let url = new URL(input); 
videoId = url.hostname === "youtu.be" ? url.pathname.slice(1) : url.searchParams.get("v") || "";
 } 
else {
    videoId = input;
}
     }
 catch {
     videoId = "";

  }
 // Validate final video ID (YouTube IDs are usually 11 chars, letters/numbers/-/_) 
if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) 
{
     showNotification("❌ Invalid YouTube link or ID", "error"); 
     return; 
    } 
currentVideoId = videoId;
 player.loadVideoById(videoId); 
 socket.emit("play", { 
    videoId: videoId, time: 0 
  });
 }
 // ================= SYNC ================= 
function syncVideo(data) {
    if (!playerReady) {
        pendingVideo = data;
        return;
    }

    isSyncing = true;

    const overlay = document.getElementById("playOverlay");

    if (data.videoId !== currentVideoId) {

        currentVideoId = data.videoId;
        player.loadVideoById(data.videoId);

        const checkReady = setInterval(() => {
            const state = player.getPlayerState();

            if (state === 5 || state === 1) {
                clearInterval(checkReady);

                player.seekTo(data.time || 0, true);
                player.playVideo();

                // ✅ FIX
                if (overlay) {
                    overlay.style.display = "none";
                    overlay.classList.remove("black", "blur");
                }
            }
        }, 100);

    } else {
        player.seekTo(data.time || 0, true);
        player.playVideo();

        // ✅ FIX (this was missing)
        if (overlay) {
            overlay.style.display = "none";
            overlay.classList.remove("black", "blur");
        }
    }

    setTimeout(() => {
        isSyncing = false;
    }, 300);
}
// ================= SOCKET VIDEO ================= 
socket.on("play", syncVideo);
socket.on("pause", () => { 
    if (playerReady) player.pauseVideo(); 

    const overlay = document.getElementById("playOverlay");
    if (overlay) {
        overlay.style.display = "flex";
        overlay.classList.remove("black");
        overlay.classList.add("blur");
    }
});
socket.on("video-ended", () => {
    const overlay = document.getElementById("playOverlay");
    if (overlay) {
        overlay.style.display = "flex";
        overlay.classList.remove("blur");
        overlay.classList.add("black");
    }
});
socket.on("sync-state", (data) => {

    if (!playerReady) return;

    isSyncing = true;

    const overlay = document.getElementById("playOverlay");

    const applyState = () => {
        player.seekTo(data.time || 0, true);

        if (data.isPlaying) {
            player.playVideo();
        } else {
            player.pauseVideo();
        }

        // UI
        if (overlay) {
            if (data.isPlaying) {
                overlay.style.display = "none";
                overlay.classList.remove("black", "blur");
            } else {
                overlay.style.display = "flex";
                overlay.classList.remove("black");
                overlay.classList.add("blur");
            }
        }

        // 🔥 DELAY RESET (IMPORTANT)
        setTimeout(() => {
            isSyncing = false;
        }, 800); // ⬅️ increased (was too small)
    };

    // NEW VIDEO
    if (data.videoId !== currentVideoId) {
        currentVideoId = data.videoId;
        player.loadVideoById(data.videoId);

        const wait = setInterval(() => {
            const state = player.getPlayerState();
            if (state === 5 || state === 1) {
                clearInterval(wait);
                applyState();
            }
        }, 100);
    } else {
        applyState();
    }
});
socket.on("sync-time", (data) => {
    if (!playerReady) return;
    if (data.videoId !== currentVideoId) return;

    const diff = Math.abs(player.getCurrentTime() - data.time);

    // ✅ only correct if drift is big
    if (diff > 1.5) {
        player.seekTo(data.time, true);
    }
});
function createPeerConnection(socketId, user) {

    if (peerConnections[socketId]) {
        return peerConnections[socketId];
    }

    const pc = new RTCPeerConnection(rtcConfig);
    peerConnections[socketId] = pc;

    // ✅ CONNECTION DEBUG
    pc.oniceconnectionstatechange = () => {
        console.log("ICE STATE:", pc.iceConnectionState);
    };

    pc.onconnectionstatechange = () => {
        if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
    console.log("♻️ Reconnecting...", socketId);

    pc.close();
    delete peerConnections[socketId];

    // 🔥 trigger reconnection
    setTimeout(() => {
        if (userSocketMap[user]) {
            createPeerConnection(userSocketMap[user], user);
        }
    }, 1000);
}
       console.log("CONNECTION STATE:", pc.connectionState);

    };

    // ✅ RECEIVE VIDEO
    pc.ontrack = (event) => {
    const stream = event.streams[0];
    if (!stream) return;

    const attach = () => {
        const video = document.querySelector(`[data-user="${user}"] video`);

        if (!video) {
            setTimeout(attach, 200);
            return;
        }

        if (video.srcObject === stream) return;

        video.srcObject = stream;
video.muted = false; // 🔥 ensure remote audio allowed
        video.onloadedmetadata = () => {
            video.play().catch(() => {});
        };
    };

    attach();
};
    // ✅ ICE
    pc.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit("webrtc-ice", {
                candidate: event.candidate,
                to: socketId
            });
        }
    };

    return pc;
}
 // ========================== 
 // Receive Offer 
 // ==========================
 socket.on("webrtc-offer", async ({ offer, from, user }) => {

    if (!user) {
        user = Object.keys(userSocketMap)
            .find(u => userSocketMap[u] === from);
    }

    const pc = createPeerConnection(from, user);

    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    // ✅ APPLY STORED ICE
if (pendingCandidates[from]) {
    for (const c of pendingCandidates[from]) {
        await pc.addIceCandidate(new RTCIceCandidate(c));
    }
    delete pendingCandidates[from];
}

    // ✅ ADD TRACKS BEFORE ANSWER
while (!localStream) {
    await new Promise(r => setTimeout(r, 100));
}

localStream.getTracks().forEach(track => {
    if (!pc.getSenders().find(s => s.track === track)) {
        pc.addTrack(track, localStream);
    }
});

    console.log("📡 Sending ANSWER to", user);

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    socket.emit("webrtc-answer", {
        answer,
        to: from
    });
});
// ========================== 
// Receive Answer
// ==========================
 socket.on("webrtc-answer", async ({ answer, from }) => {

    const pc = peerConnections[from];
    if (!pc) return;

    await pc.setRemoteDescription(new RTCSessionDescription(answer));

    // ✅ APPLY STORED ICE
    if (pendingCandidates[from]) {
        for (const c of pendingCandidates[from]) {
            await pc.addIceCandidate(new RTCIceCandidate(c));
        }
        delete pendingCandidates[from];
    }
});
// ========================== 
// ICE Candidate Exchange 
// ========================== 
socket.on("webrtc-ice", async ({ candidate, from }) => {

    const pc = peerConnections[from];
    if (!pc) return;

    // ❗ store if remote description not ready
    if (!pc.remoteDescription) {
        if (!pendingCandidates[from]) {
            pendingCandidates[from] = [];
        }
        pendingCandidates[from].push(candidate);
        return;
    }

    try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
        console.error("ICE error:", err);
    }
});
// ================= ROOM INFO =================
 let ROOM_SIZE = 0; 
 socket.on("room-info", (data) => { 
    ROOM_SIZE = parseInt(data.size); 
    isAdmin = (username === data.admin); // ✅ FIX
// store globally
 document.getElementById("roomSizeText").innerText = data.size;
 updateUI(currentUsers); // 🔥 re-render grid after getting size 
}); 
socket.on("user-list", async (users) => {


const previousUsers = [...currentUsers]

// ensure username exists in list
if (!users.includes(username)) users.unshift(username);

// wait until camera ready
while (!cameraReady) {
    await new Promise(r => setTimeout(r, 100));
}

clearTimeout(notificationTimeout);

notificationTimeout = setTimeout(async () => {

    // ignore duplicate updates
    if (JSON.stringify(users) === JSON.stringify(lastProcessedUsers)) {
        return;
    }

   /* // detect joins
    users.forEach(u => {
        if (!previousUsers.includes(u) && u !== username) {
            showNotification(`👤 ${u} joined the room`, "success");
        }
    });

    // detect leaves
    previousUsers.forEach(u => {
if (!users.includes(u) && u !== username) {
            showNotification(`👤 ${u} left the room`, "warning");
        }
    });*/

    // update state
    currentUsers = [...users];
    lastProcessedUsers = [...users];
    isAdmin = (username === users[0]);

    // update UI
    updateUserList(users);
    updateUI(users);

    attachLocalVideo();

    // small delay so video boxes exist
    await new Promise(r => setTimeout(r, 200));

    // create WebRTC connections
    for (const user of users) {

        if (user === username) continue;

        let socketId = null;
        let retries = 0;
while (!socketId && retries < 50) {
    socketId = userSocketMap[user];
    await new Promise(r => setTimeout(r, 150));
    retries++;
}

        if (!socketId) {
            console.log("⚠️ SocketID not found for", user);
            continue;
        }

       if (peerConnections[socketId] && peerConnections[socketId].connectionState === "connected") {
    console.log("Already connected to", user);
    continue;
}
        await new Promise(r => setTimeout(r, 500));


        // only one side sends offer
     
if (socket.id < socketId) {

    // 🔥 PREVENT DUPLICATE OFFERS
    if (makingOffer[socketId]) continue;
    makingOffer[socketId] = true;

    try {
        const pc = createPeerConnection(socketId, user);

        // WAIT camera
        while (!localStream) {
            await new Promise(r => setTimeout(r, 100));
        }

        // ADD TRACKS
        localStream.getTracks().forEach(track => {
            if (!pc.getSenders().find(s => s.track === track)) {
                pc.addTrack(track, localStream);
            }
        });

        console.log("📡 Sending OFFER to", user);

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        socket.emit("webrtc-offer", {
            offer: pc.localDescription,
            to: socketId,
            user: username
        });

    } catch (err) {
        console.error("Offer error:", err);
    } finally {
        // 🔥 RELEASE LOCK
        makingOffer[socketId] = false;
    }
}
    }

}, 200);

});

// ================= PANEL SWITCH ================= 
function showPanel(type, event) { 
document.getElementById("chatPanel").classList.remove("active"); 
document.getElementById("usersPanel").classList.remove("active");  
document.getElementById("infoPanel").classList.remove("active");
 document.querySelectorAll(".panel-tabs button") 
.forEach(btn => btn.classList.remove("active"));
 if (type === "chat") {
     document.getElementById("chatPanel").classList.add("active");
     } 
if (type === "users") {
     document.getElementById("usersPanel").classList.add("active");
     } 
if (type === "info")
 {
     document.getElementById("infoPanel").classList.add("active"); 
    } 
event.target.classList.add("active");
 }
 // ================= CHAT ================= 
function sendMsg() { 
    const input = document.getElementById("msg");

    if (!input.value.trim()) return;

    socket.emit("chat", {
            id: Date.now() + Math.floor(Math.random()*1000),     // ✅ ADD THIS
        msg: input.value,
        sender: username,
        reply: replyingTo   // ✅ include reply
    });

    input.value = "";

    // ✅ clear reply after sending
    replyingTo = null;

    const box = document.getElementById("replyBox");
    if (box) box.style.display = "none";
}
function handleEnter(e) { 
    if (e.key === "Enter")
         sendMsg();
         } 
// ================= POPUP =================
 function showNotification(message, type = "info", duration = 3000) { 
const container = document.getElementById("popupContainer"); 
if (!container) 
    return; 
const popup = document.createElement("div"); 
popup.classList.add("popup");  
// Make sure your CSS has .popup style 
popup.innerText = message; 
// Optional: border color based on type 
if(type === "success") 
popup.style.borderLeft = "5px solid green"; 
else if(type === "error") 
popup.style.borderLeft = "5px solid red"; 
else if(type === "warning") 
popup.style.borderLeft = "5px solid orange"; 
else 
    popup.style.borderLeft = "5px solid blue"; 
container.appendChild(popup); 
setTimeout(() => { 
    popup.remove(); 
 }, duration); } 
// ================= CHAT RECEIVE ================= 
socket.on("chat", (data) => { 

    // SYSTEM → popup only 
    if (data.sender === "SYSTEM") { 
        showNotification(data.msg);
        return;
    } 

    const chatBox = document.getElementById("chatBox"); 
    const div = document.createElement("div"); 
    div.classList.add("message");  
     
    div.setAttribute("data-id", data.id);

    if (data.sender === username) {
        div.classList.add("me"); 
    } else { 
        div.classList.add("other");
    }

    // ✅ ONLY THIS (keep bubble UI)
  div.innerHTML = `
    <div class="bubble">
        ${data.reply ? `<div class="reply">${data.reply}</div>` : ""}
        <div class="meta">${data.sender}</div>
        <div class="text">${data.msg}</div>
    </div>
`;
    // ✅ ADD HERE (right-click reply)
div.oncontextmenu = (e) => {
    e.preventDefault();

    replyingTo = data.msg;

    const box = document.getElementById("replyBox");
    box.innerText = "Replying: " + data.msg;
    box.style.display = "block";
};
if (data.sender === username) {
    div.ondblclick = () => {
        socket.emit("delete-msg", data.id);
    };
}

    chatBox.appendChild(div); 
    while(chatBox.children.length > 100){
   chatBox.removeChild(chatBox.firstChild);
}

    // smooth scroll (better)
    chatBox.scrollTo({
        top: chatBox.scrollHeight,
        behavior: "smooth"
    });
});
socket.on("delete-msg", (id) => {
    const msg = document.querySelector(`[data-id="${id}"]`);
    if (msg) msg.remove();
});
// ================= CHAT HISTORY ================= 
socket.on("chat-history", (messages = []) => { 
    const chatBox = document.getElementById("chatBox");
    chatBox.innerHTML = ""; 

    messages.forEach((data) => {

        if (data.sender === "SYSTEM") return; 

        const div = document.createElement("div"); 
        div.classList.add("message");

        // ✅ ADD THIS (IMPORTANT)
        div.setAttribute("data-id", data.id);

        if (data.sender === username) {
            div.classList.add("me"); 
        } else { 
            div.classList.add("other");
        }

        div.innerHTML = `
            <div class="bubble">
                ${data.reply ? `<div class="reply">${data.reply}</div>` : ""}
                <div class="meta">${data.sender}</div>
                <div class="text">${data.msg}</div>
            </div>
        `;

        // right-click reply
        div.oncontextmenu = (e) => {
            e.preventDefault();

            replyingTo = data.msg;

            const box = document.getElementById("replyBox");
            box.innerText = "Replying: " + data.msg;
            box.style.display = "block";
        };

        // ✅ ADD DELETE HERE
        if (data.sender === username) {
            div.ondblclick = () => {
                socket.emit("delete-msg", data.id);
            };
        }

        chatBox.appendChild(div); 
    }); 

    chatBox.scrollTop = chatBox.scrollHeight;
});
// ================= EMOJI ================= 
function toggleEmoji() { 
    const box = document.getElementById("emojiBox"); 
if (!box) 
    return; 
box.classList.toggle("active");
 } 
document.addEventListener("DOMContentLoaded", () => { 
const emojiBox = document.getElementById("emojiBox"); 
const input = document.getElementById("msg"); 
if (!emojiBox) 
    return; 
emojiBox.addEventListener("click", (e) => { 
    if (e.target.tagName === "SPAN") 
        { 
// 🔥 SAFE CHECK (prevents crash) 
if (!input) {  
console.warn("msg input not found"); 
 return;
 } 
input.value += e.target.innerText; input.focus();
  } 
 }); 
}); 
function getInviteMessage(){
return `🎬 You're Invited to PlayPal!

📺 Watch videos together in sync
💬 Chat live with friends
⏱ Real-time synced playback

🔑 Room ID: ${roomId}
🔒 Password: ${password}

👉 Join now: ${shareLink}

🚀 Don't miss out — join fast!`;
}
function openInvite(){ 
    document.getElementById("invitePopup").style.display="block"; 
}
 function closeInvite(){
     document.getElementById("invitePopup").style.display="none"; 
    } 
function shareWhatsApp() {

const inviteText = `You're Invited to PlayPal!

Watch videos together in sync
Chat live with friends
Real-time synced playback

Room ID: ${roomId}
Password: ${password}

Join now: ${shareLink}

Don't miss out — join fast!`;

const encodedText = encodeURIComponent(inviteText);

window.open(`https://wa.me/?text=${encodedText}`, "_blank");

}
            
function shareTelegram(){
     const msg = encodeURIComponent(getInviteMessage()); 
   window.open(`https://t.me/share/url?text=${msg}`, "_blank");
         } 
function shareX(){
const msg = encodeURIComponent(getInviteMessage());
window.open(`https://twitter.com/intent/tweet?text=${msg}`, "_blank");
}
 function shareInstagram() { 
    showNotification("⚠️ Instagram does not support direct sharing via URL. Copy the link instead!", "warning");
 }
 function shareReddit() { 
    const url = `https://www.reddit.com/submit?url=${encodeURIComponent(shareLink)}&title=${encodeURIComponent("Join my PlayPal room!")}`;
    
    window.open(url, "_blank");
}
function shareGmail() {

const subject = encodeURIComponent("Join PlayPal!");

const body = encodeURIComponent(`You're Invited to PlayPal!

Watch videos together in sync
Chat live with friends
Real-time synced playback

Room ID: ${roomId}
Password: ${password}

Join now: ${shareLink}

Don't miss out — join fast!`);

// Open Gmail compose in new tab
const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&su=${subject}&body=${body}`;

const newTab = window.open(gmailUrl, "_blank");

// Fallback if popup blocked
if (!newTab) {
    showNotification("Popup blocked! Opening default email client instead.", "warning");
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
}

} 
function copyInvite(){ 
navigator.clipboard.writeText(getInviteMessage()); 
showNotification("✅ Invite copied! 🚀", "success"); 
} 
function showTab(tab) 
{ document.querySelectorAll(".tab-content") 
    .forEach(t => t.classList.remove("active")); 
document.getElementById(tab + "Tab").classList.add("active");
 } 
function togglePanel(){ 
    const container = document.querySelector(".main-container"); 
container.classList.toggle("panel-closed"); 
} 
function updateUserList(users) { 
    const list = document.getElementById("users");
list.innerHTML = ""; 
users.forEach((u, i) => 
    { const div = document.createElement("div"); 
div.innerText = (i === 0 ? "👑 " : "👤 ") + u; 
if (i === 0) div.style.color = "gold"; 
list.appendChild(div); 
 });
 } 
function updateUI(users) { 
const grid = document.getElementById("videoGrid"); 
if (!grid) return;
const existingBoxes = Array.from(grid.children) 
.map(box => box.getAttribute("data-user")); 
// ADD new users 
users.forEach(user => 
    { if(!existingBoxes.includes(user))
        { 
const box = document.createElement("div"); 
box.classList.add("video-box"); 
box.setAttribute("data-user", user); 
const video = document.createElement("video"); 
video.autoplay = true; 
video.playsInline = true; 
video.muted = (user === username);
video.controls = false; 
// 🔥 ADD HERE (only once) 
 if(user === username && !localStream){ 
video.style.background = "#000"; 
} 
const name = document.createElement("div");
name.classList.add("video-name"); 
name.innerText = user; 
box.appendChild(video);
 box.appendChild(name); 
// ⭐ Add controls only for your own video 
if(user === username)
{
     const controls = document.createElement("div"); 
controls.classList.add("video-controls");
 const micBtn = document.createElement("button"); 
micBtn.classList.add("vc-btn","mic"); 
micBtn.innerText = "🎤"; micBtn.onclick = toggleMic; 
const camBtn = document.createElement("button"); 
camBtn.classList.add("vc-btn","cam"); 
camBtn.innerText = "📷";
camBtn.onclick = toggleCamera; 
controls.appendChild(micBtn); 
controls.appendChild(camBtn); 
box.appendChild(controls); 
}
 grid.appendChild(box); 
}
 }); 
// REMOVE users who left 
existingBoxes.forEach(user => { if(!users.includes(user))
{ 
  const box = document.querySelector(`[data-user="${user}"]`);
if(box) box.remove(); 
  }
 });
 } 
// ================= ERROR ================= 
socket.on("error-msg", (msg) => { showNotification(msg, "error", 4000); 
// show as red error popup 
setTimeout(() => { window.location.href = "/"; }, 4000); 
// wait 4s so user can see the popup 
}); 
 // =============================== //
 // CHAT PANEL RESIZE //
 // =============================== //
const resizer = document.querySelector(".resize-bar");
 const chat = document.querySelector(".chat-section"); 
if(resizer){ let x = 0; let chatWidth = 0; 
resizer.addEventListener("mousedown", function(e){ x = e.clientX; chatWidth = chat.offsetWidth; 
document.addEventListener("mousemove", resize); document.addEventListener("mouseup", stopResize); }); 
function resize(e){ 
    const dx = e.clientX - x; 
    chat.style.width = chatWidth - dx + "px";
} 
function stopResize()
{ document.removeEventListener("mousemove", resize); 

} } 
function leaveRoom(){ 
    socket.disconnect();
     window.location.href = "/"; 
    }