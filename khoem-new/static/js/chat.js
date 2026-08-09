const sessionId = "session_" + Math.random().toString(36).substring(2, 10);
const chatBox = document.getElementById("chat-box");
const input = document.getElementById("user-input");
const micBtn = document.getElementById("mic-btn");
const locationStatus = document.getElementById("location-status");
const mapContainer = document.getElementById("map-container");
const routeInfo = document.getElementById("route-info");
const cameraInput = document.getElementById("camera-input");
const imagePreviewRow = document.getElementById("image-preview-row");
const imagePreview = document.getElementById("image-preview");
const imageName = document.getElementById("image-name");
const clearImageBtn = document.getElementById("clear-image-btn");

let pendingImageBase64 = null;
let mapInitialized = false;

function addMessage(role, text) {
  const div = document.createElement("div");
  div.className = "msg " + role;
  div.textContent = (role === "user" ? "anak: " : "KHOEM_AI: ") + text;
  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
}

// អនុញ្ញាតឱ្យ AI និយាយ តែបើកាលណា User បើកមុខងារ Voice និង Auto Read ប៉ុណ្ណោះ
function speakIfEnabled(text) {
  if (window.voiceEnabled && window.autoReadEnabled && typeof KhoemVoice !== 'undefined') {
    KhoemVoice.speak(text);
  }
}

async function sendMessage(text) {
  const message = (text || input.value).trim();
  if (pendingImageBase64) { 
      await sendImageMessage(message || "sorm piponnea roub pheap nis"); 
      return; 
  }
  if (!message) return;
  
  addMessage("user", message);
  input.value = "";
  
  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: sessionId, message: message })
    });
    const data = await res.json();
    if (data.reply) { 
        addMessage("assistant", data.reply); 
        speakIfEnabled(data.reply); 
    } else { 
        addMessage("assistant", "error: " + (data.error || "unknown")); 
    }
  } catch (err) { 
      addMessage("assistant", "error: connection failed"); 
  }
}

async function sendImageMessage(question) {
  addMessage("user", "[roub pheap] " + question);
  input.value = "";
  const imgToSend = pendingImageBase64;
  clearImage();
  try {
    const res = await fetch("/api/vision", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: imgToSend, question: question, mime_type: "image/jpeg" })
    });
    const data = await res.json();
    if (data.answer) { 
        addMessage("assistant", data.answer); 
        speakIfEnabled(data.answer); 
    } else { 
        addMessage("assistant", "error: " + (data.error || "unknown")); 
    }
  } catch (err) { addMessage("assistant", "error: vision analysis failed"); }
}

function clearImage() {
  pendingImageBase64 = null;
  imagePreviewRow.style.display = "none";
  cameraInput.value = "";
}

clearImageBtn.addEventListener("click", clearImage);

cameraInput.addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  pendingImageBase64 = await KhoemCamera.fileToBase64(file);
  imagePreview.src = "data:image/jpeg;base64," + pendingImageBase64;
  imageName.textContent = file.name;
  imagePreviewRow.style.display = "flex";
});

document.getElementById("send-btn").addEventListener("click", () => sendMessage());
input.addEventListener("keyup", (e) => { if (e.key === "Enter") sendMessage(); });

if (typeof KhoemVoice !== 'undefined') {
  const voiceReady = KhoemVoice.initRecognition(
    (transcript) => { micBtn.classList.remove("listening"); sendMessage(transcript); },
    (error) => { micBtn.classList.remove("listening"); addMessage("assistant", "error: " + error); }
  );
  micBtn.addEventListener("click", () => {
    if (!voiceReady) return;
    micBtn.classList.add("listening");
    KhoemVoice.startListening();
  });
}

// គ្រប់គ្រងប៊ូតុង GPS និង Location
document.querySelectorAll(".chip").forEach(btn => {
  btn.addEventListener("click", async () => {
    const action = btn.dataset.action;
    if (action === "location") {
      locationStatus.style.display = "block";
      locationStatus.textContent = "searching...";
      try {
        const pos = await KhoemGPS.getCurrentLocation();
        locationStatus.textContent = "location: " + pos.lat.toFixed(5) + ", " + pos.lng.toFixed(5);
        mapContainer.style.display = "block";
        if (!mapInitialized) { KhoemMap.init("map-container", pos.lat, pos.lng); mapInitialized = true; }
        else { KhoemMap.updateUserLocation(pos.lat, pos.lng); }
      } catch (err) { locationStatus.textContent = "error: " + err; }
    }
    
    if (action === "navigate") {
      const destination = prompt("chang tov ena?");
      if (!destination) return;
      addMessage("user", "nam plov tow " + destination);
      routeInfo.style.display = "block";
      routeInfo.textContent = "komporng svengrok plov...";
      try {
        if (!KhoemGPS.currentPosition) { await KhoemGPS.getCurrentLocation(); }
        mapContainer.style.display = "block";
        if (!mapInitialized) { KhoemMap.init("map-container", KhoemGPS.currentPosition.lat, KhoemGPS.currentPosition.lng); mapInitialized = true; }
        const dest = await KhoemMap.geocodeSearch(destination);
        const route = await KhoemMap.getRoute(KhoemGPS.currentPosition.lat, KhoemGPS.currentPosition.lng, dest.lat, dest.lng);
        KhoemMap.drawRoute(route.coordinates, dest.lat, dest.lng);
        const summary = `chamngay ${route.distanceKm} km, brahael ${route.durationMin} neati`;
        routeInfo.textContent = summary;
        addMessage("assistant", summary);
        speakIfEnabled(summary);
      } catch (err) { 
          routeInfo.textContent = "error: " + err; 
          addMessage("assistant", "error: " + err); 
      }
    }
  });
});
