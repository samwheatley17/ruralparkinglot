// Same configuration as your admin panel
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
const resultCard = document.getElementById("resultCard");
const detectedPlateEl = document.getElementById("detectedPlate");
const matchStatus = document.getElementById("matchStatus");
const matchDetails = document.getElementById("matchDetails");
const statusMsg = document.getElementById("statusMsg");

let currentStudents = [];

// Fetch latest snapshot of active records
db.ref("students").on("value", (snap) => {
  currentStudents = [];
  snap.forEach((child) => {
    currentStudents.push({ id: child.key, ...child.val() });
  });
});

// Initialize Camera Stream on App Launch
async function startCamera() {
  try {
    const constraints = {
      video: {
        facingMode: "environment", // Prioritize back-facing camera
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

// Handle Processing and Image Cropping
scanBtn.addEventListener("click", async () => {
  if (!video.srcObject) {
    showStatus("Camera stream is not ready.", "error");
    return;
  }

  scanBtn.disabled = true;
  scanBtn.textContent = "Processing OCR...";
  resultCard.classList.remove("hidden");
  detectedPlateEl.textContent = "Analyzing...";
  matchStatus.className = "match-badge checking";
  matchStatus.textContent = "Processing image...";
  matchDetails.innerHTML = "";

  // Set sizing parameters for drawing the video frame onto the canvas
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext("2d");

  // Draw current frame onto the canvas
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  try {
    // Process string through Tesseract
    const {
      data: { text },
    } = await Tesseract.recognize(canvas, "eng");

    // Clean string: force uppercase and remove any characters that aren't letters or numbers
    const cleanedPlate = text
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .trim();

    if (!cleanedPlate) {
      detectedPlateEl.textContent = "???";
      matchStatus.className = "match-badge missing";
      matchStatus.textContent = "No Text Detected";
      matchDetails.innerHTML =
        "<p>Could not isolate plate numbers. Center the plate and try again.</p>";
    } else {
      detectedPlateEl.textContent = cleanedPlate;
      lookupPlate(cleanedPlate);
    }
  } catch (err) {
    console.error(err);
    showStatus("OCR Processing failed: " + err.message, "error");
  } finally {
    scanBtn.disabled = false;
    scanBtn.textContent = "Scan Plate";
  }
});

// Look through database cache for plate matches
function lookupPlate(scannedText) {
  // Try to find a student match where stripped database plate matches stripped scanned string
  const match = currentStudents.find((student) => {
    if (!student.vehicle || !student.vehicle.plate) return false;
    const studentPlate = student.vehicle.plate
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");

    // Fuzzy matching check: checks if either contains the other to handle minor partial scans
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

// Startup
window.addEventListener("DOMContentLoaded", startCamera);
