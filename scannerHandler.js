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
let ocrWorker = null; // Store persistent background worker instance

// Fetch snapshot of active records
db.ref("students").on("value", (snap) => {
  currentStudents = [];
  snap.forEach((child) => {
    currentStudents.push({ id: child.key, ...child.val() });
  });
});

// Initialize both Camera stream and Tesseract background worker in parallel
async function initializeApp() {
  try {
    // 1. Fire up camera interface
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

    // 2. Pre-initialize structural Tesseract worker to bypass mobile execution delays
    showStatus("Initializing backend recognition components...", "success");
    ocrWorker = await Tesseract.createWorker("eng");
    showStatus("System status: Ready for scanning.", "success");
  } catch (err) {
    console.error("Initialization Error:", err);
    showStatus(
      "App Setup Error: " +
        (err.message || "Camera permission denied or invalid protocol."),
      "error"
    );
  }
}

// Global Main Scan Trigger Loop
scanBtn.addEventListener("click", async () => {
  if (isFrozen) {
    resetScanner();
    return;
  }

  if (!video.srcObject || video.videoWidth === 0 || video.videoHeight === 0) {
    showStatus(
      "Camera matrix stream is not stable yet. Please hold steady.",
      "error"
    );
    return;
  }

  if (!ocrWorker) {
    showStatus(
      "OCR components are compiling background layers. Please wait.",
      "error"
    );
    return;
  }

  // 1. Snapshot layout view instantly
  freezeFrame();

  scanBtn.disabled = true;
  scanBtn.textContent = "Processing OCR...";
  resultCard.classList.remove("hidden");
  detectedPlateEl.textContent = "Analyzing...";
  matchStatus.className = "match-badge checking";
  matchStatus.textContent = "Extracting Matrix Coordinates...";
  matchDetails.innerHTML = "";

  try {
    // 2. Safely crop target boundary
    const croppedCanvas = getCroppedTargetZone();
    if (!croppedCanvas) {
      throw new Error(
        "Target matrix could not be resolved from view dimensions."
      );
    }

    matchStatus.textContent = "Running Character Identification...";

    // 3. Process structural OCR using the initialized background engine
    const {
      data: { text },
    } = await ocrWorker.recognize(croppedCanvas);
    const cleanedPlate = text
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .trim();

    if (!cleanedPlate) {
      detectedPlateEl.textContent = "???";
      matchStatus.className = "match-badge missing";
      matchStatus.textContent = "No Text Located";
      matchDetails.innerHTML =
        "<p>Could not isolate plate numbers within the red box. Tap 'Reset Camera' and try again.</p>";
    } else {
      detectedPlateEl.textContent = cleanedPlate;
      lookupPlate(cleanedPlate);
    }
  } catch (err) {
    console.error("Intercepted Processing Crash Context:", err);

    // Fallback extraction block to read deep object errors securely
    let diagnosticErrorMessage = "Processing pipeline exception encountered.";
    if (err && typeof err === "string") diagnosticErrorMessage = err;
    else if (err && err.message) diagnosticErrorMessage = err.message;
    else if (err && typeof err === "object")
      diagnosticErrorMessage = JSON.stringify(err);

    matchStatus.className = "match-badge missing";
    matchStatus.textContent = "Scan Interrupted";
    matchDetails.innerHTML = `<p>Error details: ${diagnosticErrorMessage}</p>`;
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

  // Stamp video imagery data frame to localized canvas storage
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

// Extracts bounding coordinates cleanly
function getCroppedTargetZone() {
  const containerRect = videoContainer.getBoundingClientRect();
  const boxRect = targetBox.getBoundingClientRect();

  if (containerRect.width === 0 || containerRect.height === 0) return null;

  // Track exact display layout box percentages
  const xPct = (boxRect.left - containerRect.left) / containerRect.width;
  const yPct = (boxRect.top - containerRect.top) / containerRect.height;
  const wPct = boxRect.width / containerRect.width;
  const hPct = boxRect.height / containerRect.height;

  // Map to actual underlying video storage file resolution bounds
  const sx = canvas.width * xPct;
  const sy = canvas.height * yPct;
  const sw = canvas.width * wPct;
  const sh = canvas.height * hPct;

  const cropCanvas = document.createElement("canvas");
  cropCanvas.width = sw;
  cropCanvas.height = sh;
  const cropCtx = cropCanvas.getContext("2d");

  // Crop sliced snapshot directly out of localized stored state
  cropCtx.drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh);

  // Return raw HTML Canvas Element to bypass Safari toDataURL CORS security rules
  return cropCanvas;
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

// Run initial configurations cleanly upon window load sequence termination
window.addEventListener("DOMContentLoaded", initializeApp);
