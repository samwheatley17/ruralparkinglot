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
    showStatus(
      "Camera access denied or unavailable. Ensure you are on HTTPS.",
      "error"
    );
  }
}

// Global click flow
scanBtn.addEventListener("click", async () => {
  // If the view is currently frozen on a scan, tap resets back to live stream
  if (isFrozen) {
    resetScanner();
    return;
  }

  if (!video.srcObject) {
    showStatus("Camera stream is not ready.", "error");
    return;
  }

  // Freeze the frame visually
  freezeFrame();

  scanBtn.disabled = true;
  scanBtn.textContent = "Processing OCR...";
  resultCard.classList.remove("hidden");
  detectedPlateEl.textContent = "Analyzing...";
  matchStatus.className = "match-badge checking";
  matchStatus.textContent = "Isolating target zone...";
  matchDetails.innerHTML = "";

  // Perform precise cropping of the red target box region
  const croppedCanvas = getCroppedTargetZone();
  if (!croppedCanvas) {
    showStatus("Failed to analyze dimensions.", "error");
    resetScanner();
    return;
  }

  try {
    // Send only the cropped target box canvas segment to Tesseract
    const {
      data: { text },
    } = await Tesseract.recognize(croppedCanvas, "eng");
    const cleanedPlate = text
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .trim();

    if (!cleanedPlate) {
      detectedPlateEl.textContent = "???";
      matchStatus.className = "match-badge missing";
      matchStatus.textContent = "No Text Detected";
      matchDetails.innerHTML =
        "<p>Could not isolate plate numbers within the red box. Tap 'Reset Camera' to try again.</p>";
    } else {
      detectedPlateEl.textContent = cleanedPlate;
      lookupPlate(cleanedPlate);
    }
  } catch (err) {
    console.error(err);
    showStatus("OCR Processing failed: " + err.message, "error");
  } finally {
    scanBtn.disabled = false;
    scanBtn.textContent = "Reset Camera";
    isFrozen = true;
  }
});

// Captures a full resolution video frame and matches it to current screen aspect
function freezeFrame() {
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext("2d");

  // Stamp current screen imagery onto canvas
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  // Hide streaming layer elements, show raw frozen display canvas element
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

// Mathematical calculation to isolate text *only* inside the target bounding container
function getCroppedTargetZone() {
  // Read running elements runtime layout sizes
  const containerRect = videoContainer.getBoundingClientRect();
  const boxRect = targetBox.getBoundingClientRect();

  // Find percentage position coordinates inside the container element box layout bounds
  const xPct = (boxRect.left - containerRect.left) / containerRect.width;
  const yPct = (boxRect.top - containerRect.top) / containerRect.height;
  const wPct = boxRect.width / containerRect.width;
  const hPct = boxRect.height / containerRect.height;

  // Translate percentages directly to absolute source video dimensions coordinates
  const sx = canvas.width * xPct;
  const sy = canvas.height * yPct;
  const sw = canvas.width * wPct;
  const sh = canvas.height * hPct;

  // Render crop segment onto a dynamic temporary extraction canvas element runtime
  const cropCanvas = document.createElement("canvas");
  cropCanvas.width = sw;
  cropCanvas.height = sh;
  const cropCtx = cropCanvas.getContext("2d");

  // Source copy execution mapping arguments
  cropCtx.drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh);
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

window.addEventListener("DOMContentLoaded", startCamera);
