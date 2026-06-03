const firebaseConfig = {
  apiKey: "AIzaSyC1iRMXc369MCEaE7bAvWmamVCSX0_bLU8",
  authDomain: "ruralparkinglot.firebaseapp.com",
  databaseURL: "https://ruralparkinglot-default-rtdb.firebaseio.com",
  projectId: "ruralparkinglot",
  storageBucket: "ruralparkinglot.firebasestorage.app",
  messagingSenderId: "585974079211",
  appId: "1:585974079211:web:2ca0c2a2d2f2283afc28ae",
  measurementId: "G-ETF938ED3L",
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// DOM Elements
const video = document.getElementById("cameraStream");
const scanBtn = document.getElementById("scanBtn");
const canvas = document.getElementById("captureCanvas");
const videoContainer = document.getElementById("videoContainer");
const scannerOverlay = document.getElementById("scannerOverlay");
const resultCard = document.getElementById("resultCard");
const detectedPlateEl = document.getElementById("detectedPlate");
const matchStatus = document.getElementById("matchStatus");
const matchDetails = document.getElementById("matchDetails");
const statusMsg = document.getElementById("statusMsg");

let currentStudents = [];
let isFrozen = false;

// Fetch snapshot of active records from Firebase Realtime Database
db.ref("students").on("value", (snap) => {
  currentStudents = [];
  snap.forEach((child) => {
    currentStudents.push({ id: child.key, ...child.val() });
  });
});

// Stream standard environment rear-facing camera configuration
async function startCamera() {
  try {
    const constraints = {
      video: {
        facingMode: "environment",
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
      audio: false,
    };
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    video.srcObject = stream;
    showStatus("Camera connection ready.", "success");
  } catch (err) {
    console.error("Camera access error:", err);
    showStatus(
      "Camera access denied. Ensure you are utilizing an HTTPS portal.",
      "error"
    );
  }
}

// Main Scan Execution Flow Control
scanBtn.addEventListener("click", async () => {
  if (isFrozen) {
    resetScanner();
    return;
  }

  if (!video.srcObject || video.videoWidth === 0 || video.videoHeight === 0) {
    showStatus(
      "Camera engine layout warming up. Try again in a brief second.",
      "error"
    );
    return;
  }

  // 1. Instantly freeze snapshot image data context frame
  freezeFrame();

  scanBtn.disabled = true;
  scanBtn.textContent = "Processing OCR...";
  resultCard.classList.remove("hidden");
  detectedPlateEl.textContent = "Analyzing full frame...";
  matchStatus.className = "match-badge checking";
  matchStatus.textContent = "Processing Character OCR...";
  matchDetails.innerHTML = "";

  try {
    // 2. Extract full base64 data string payload directly from full frozen canvas frame
    const rawFullImageDataUrl = canvas.toDataURL("image/png");

    const text1 = await puter.ai.img2txt(rawFullImageDataUrl)
    console.log(text1)

    // 3. Send image payload straight to Tesseract using basic global processor route
    const {
      data: { text },
    } = await Tesseract.recognize(rawFullImageDataUrl, "eng");
    const cleanedPlate = text
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .trim();

    if (!cleanedPlate) {
      detectedPlateEl.textContent = "???";
      showManualOverrideForm("");
    } else {
      detectedPlateEl.textContent = cleanedPlate;
      lookupPlate(cleanedPlate);
    }
  } catch (err) {
    console.error("Scanning Execution Fault Intercepted:", err);
    detectedPlateEl.textContent = "Error";
    showManualOverrideForm("");
  } finally {
    scanBtn.disabled = false;
    scanBtn.textContent = "Reset Camera";
    isFrozen = true;
  }
});

function freezeFrame() {
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext("2d");

  // Stash direct image pixels from original streaming resolution matrix
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  video.classList.add("hidden");
  canvas.classList.remove("hidden");
  if (scannerOverlay) scannerOverlay.classList.add("hidden");
}

function resetScanner() {
  video.classList.remove("hidden");
  canvas.classList.add("hidden");
  if (scannerOverlay) scannerOverlay.classList.remove("hidden");
  resultCard.classList.add("hidden");
  scanBtn.textContent = "Scan Plate";
  isFrozen = false;
}

// Cross-reference strings and layout results dynamically
function lookupPlate(scannedText) {
  if (!scannedText) return;

  const match = currentStudents.find((student) => {
    if (!student.vehicle || !student.vehicle.plate) return false;
    const studentPlate = student.vehicle.plate
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");
    return (
      studentPlate.includes(scannedText) || scannedText.includes(studentPlate)
    );
  });

  if (match) {
    if (match.parkingSpot) {
      matchStatus.className = "match-badge matched";
      matchStatus.textContent = "Access Approved ✅";
      matchDetails.innerHTML = `
          <p><strong>Driver:</strong> ${match.studentName || "—"}</p>
          <p><strong>Assigned Spot:</strong> <span class="spot-badge">${
            match.parkingSpot
          }</span></p>
          <p><strong>Registered Plate:</strong> ${match.vehicle.plate}</p>
          ${getManualOverrideLink(scannedText)}
        `;
    } else {
      matchStatus.className = "match-badge waitlisted";
      matchStatus.textContent = "Unassigned / Waitlisted ⚠️";
      matchDetails.innerHTML = `
          <p><strong>Driver:</strong> ${match.studentName || "—"}</p>
          <p><strong>Status:</strong> Applicant is not currently assigned an active spot.</p>
          <p><strong>Registered Plate:</strong> ${match.vehicle.plate}</p>
          ${getManualOverrideLink(scannedText)}
        `;
    }
  } else {
    matchStatus.className = "match-badge missing";
    matchStatus.textContent = "Not On List ❌";
    matchDetails.innerHTML = `
        <p>No active applicant records matching this vehicle plate were located.</p>
        ${getManualOverrideLink(scannedText)}
      `;
  }
}

// Generate a clean HTML switch to activate input overlay if text was misread
function getManualOverrideLink(failedTextStr) {
  return `
      <div style="margin-top: 15px; border-top: 1px dashed #ccc; padding-top: 12px; text-align: center;">
        <button type="button" class="fallback-input-btn" onclick="window.activateManualInput('${failedTextStr}')" style="background: none; border: none; color: #0066cc; text-decoration: underline; font-size: 0.9rem; cursor: pointer;">
          Incorrect match? Type plate manually
        </button>
      </div>
    `;
}

// Form element architecture layout renderer injection loop
function showManualOverrideForm(initialValue = "") {
  matchStatus.className = "match-badge checking";
  matchStatus.textContent = "Manual Input Mode";

  matchDetails.innerHTML = `
      <div class="manual-input-container" style="padding: 5px 0;">
        <p style="margin: 0 0 8px 0; font-size: 0.9rem; color: #555;">Enter the license plate character sequence directly:</p>
        <input type="text" id="manualPlateField" value="${initialValue}" placeholder="E.g. ABC123" style="width: 100%; box-sizing: border-box; padding: 10px; font-size: 1.1rem; text-transform: uppercase; border: 2px solid #333; border-radius: 4px; font-family: monospace; letter-spacing: 1px; margin-bottom: 10px;" />
        <button id="submitManualBtn" style="width: 100%; padding: 10px; background-color: #222; color: #fff; font-weight: bold; border: none; border-radius: 4px; cursor: pointer; font-size: 1rem;">Verify License Plate</button>
      </div>
    `;

  // Attach button event listener
  document.getElementById("submitManualBtn").addEventListener("click", () => {
    const fieldVal = document
      .getElementById("manualPlateField")
      .value.toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .trim();
    if (!fieldVal) {
      showStatus("Please input a valid sequence to check records.", "error");
      return;
    }
    detectedPlateEl.textContent = fieldVal;
    lookupPlate(fieldVal);
  });
}

// Expose fallback window scope execution controller link handler explicitly
window.activateManualInput = function (prefill) {
  showManualOverrideForm(prefill);
};

function showStatus(msg, type) {
  statusMsg.textContent = msg;
  statusMsg.className = `status-msg ${type}`;
  setTimeout(() => {
    statusMsg.className = "status-msg";
  }, 5000);
}

window.addEventListener("DOMContentLoaded", startCamera);
