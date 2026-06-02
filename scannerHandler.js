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
const targetBox = document.getElementById("targetBox");
const scannerOverlay = document.getElementById("scannerOverlay");
const resultCard = document.getElementById("resultCard");
const detectedPlateEl = document.getElementById("detectedPlate");
const matchStatus = document.getElementById("matchStatus");
const matchDetails = document.getElementById("matchDetails");
const statusMsg = document.getElementById("statusMsg");

let currentStudents = [];
let isFrozen = false;

// Fetch snapshot of active records
db.ref("students").on("value", (snap) => {
  currentStudents = [];
  snap.forEach((child) => {
    currentStudents.push({ id: child.key, ...child.val() });
  });
});

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
  } catch (err) {
    console.error("Camera access error:", err);
    showStatus("Camera access denied. Ensure you are using HTTPS.", "error");
  }
}

// Main Scan Execution Control
scanBtn.addEventListener("click", async () => {
  if (isFrozen) {
    resetScanner();
    return;
  }

  // Fallback verification check to prevent 0-dimension mathematical issues
  if (!video.srcObject || video.videoWidth === 0 || video.videoHeight === 0) {
    showStatus(
      "Camera feed layout engine is initializing. Try again in a second.",
      "error"
    );
    return;
  }

  // 1. Instantly freeze layout imagery
  freezeFrame();

  scanBtn.disabled = true;
  scanBtn.textContent = "Processing OCR...";
  resultCard.classList.remove("hidden");
  detectedPlateEl.textContent = "Analyzing...";
  matchStatus.className = "match-badge checking";
  matchStatus.textContent = "Processing image...";
  matchDetails.innerHTML = "";

  try {
    // 2. Extract isolated image target payload safely
    const croppedDataUrl = getCroppedTargetZone();

    if (!croppedDataUrl) {
      throw new Error("Target matrix could not be calculated properly.");
    }

    matchStatus.textContent = "Running Character OCR...";

    // 3. Send isolated text capture to Tesseract via DataURL string format
    const {
      data: { text },
    } = await Tesseract.recognize(croppedDataUrl, "eng");
    const cleanedPlate = text
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .trim();

    if (!cleanedPlate) {
      detectedPlateEl.textContent = "???";
      matchStatus.className = "match-badge missing";
      matchStatus.textContent = "No Text Detected";
      matchDetails.innerHTML =
        "<p>Could not read text inside the red box. Ensure lighting is clear and press 'Reset Camera' to try again.</p>";
    } else {
      detectedPlateEl.textContent = cleanedPlate;
      lookupPlate(cleanedPlate);
    }
  } catch (err) {
    console.error("Scanning Error Intercepted:", err);
    showStatus("Scanning failed: " + err.message, "error");
    matchStatus.className = "match-badge missing";
    matchStatus.textContent = "Error Occurred";
    matchDetails.innerHTML = `<p>Error details: ${err.message}</p>`;
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

  // Save frame state data
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  video.classList.add("hidden");
  canvas.classList.remove("hidden");
  scannerOverlay.classList.add("hidden");
}

function resetScanner() {
  video.classList.remove("hidden");
  canvas.classList.add("hidden");
  scannerOverlay.classList.remove("hidden");
  resultCard.classList.add("hidden");
  scanBtn.textContent = "Scan Plate";
  isFrozen = false;
}

// Safe layout extraction tool
function getCroppedTargetZone() {
  const containerRect = videoContainer.getBoundingClientRect();
  const boxRect = targetBox.getBoundingClientRect();

  // Safety boundary configuration validation check
  if (containerRect.width === 0 || containerRect.height === 0) {
    return null;
  }

  // Map percentage position metrics safely
  const xPct = (boxRect.left - containerRect.left) / containerRect.width;
  const yPct = (boxRect.top - containerRect.top) / containerRect.height;
  const wPct = boxRect.width / containerRect.width;
  const hPct = boxRect.height / containerRect.height;

  // Calculate coordinates matching pixel sources
  const sx = canvas.width * xPct;
  const sy = canvas.height * yPct;
  const sw = canvas.width * wPct;
  const sh = canvas.height * hPct;

  // Create isolated canvas drawing instance
  const cropCanvas = document.createElement("canvas");
  cropCanvas.width = sw;
  cropCanvas.height = sh;
  const cropCtx = cropCanvas.getContext("2d");

  // Crop operation slice mechanics implementation
  cropCtx.drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh);

  // Return format altered to raw text string asset payload data string to pass seamlessly
  return cropCanvas.toDataURL("image/png");
}

function lookupPlate(scannedText) {
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
        `;
    } else {
      matchStatus.className = "match-badge waitlisted";
      matchStatus.textContent = "Unassigned / Waitlisted ⚠️";
      matchDetails.innerHTML = `
          <p><strong>Driver:</strong> ${match.studentName || "—"}</p>
          <p><strong>Status:</strong> Applicant is not currently assigned an active spot.</p>
          <p><strong>Registered Plate:</strong> ${match.vehicle.plate}</p>
        `;
    }
  } else {
    matchStatus.className = "match-badge missing";
    matchStatus.textContent = "Not On List ❌";
    matchDetails.innerHTML = `<p>No active applicant records matching this vehicle plate were located.</p>`;
  }
}

function showStatus(msg, type) {
  statusMsg.textContent = msg;
  statusMsg.className = `status-msg ${type}`;
  setTimeout(() => {
    statusMsg.className = "status-msg";
  }, 5000);
}

window.addEventListener("DOMContentLoaded", startCamera);
