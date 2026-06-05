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

db.ref("students").on("value", (snap) => {
  currentStudents = [];
  snap.forEach((child) => {
    currentStudents.push({ id: child.key, ...child.val() });
  });
});

async function startCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: "environment",
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
      audio: false,
    });
    video.srcObject = stream;
    showStatus("Camera connection ready.", "success");
  } catch (err) {
    showStatus("Camera access denied. Ensure you are on HTTPS.", "error");
  }
}

async function extractPlateWithPuter(imageDataUrl) {
  const base64 = imageDataUrl.split(",")[1];

  const response = await puter.ai.chat([
    {
      role: "user",
      content: [
        {
          type: "image",
          source: {
            type: "base64",
            media_type: "image/png",
            data: base64,
          },
        },
        {
          type: "text",
          text: "Read the license plate in this image. Reply with ONLY the plate characters, letters and numbers only, no spaces, no punctuation, nothing else. If no license plate is visible, reply with XXXXXX.",
        },
      ],
    },
  ]);

  const raw =
    typeof response === "string"
      ? response
      : response?.message?.content?.[0]?.text ||
        response?.content?.[0]?.text ||
        response?.text ||
        "";

  return raw
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .trim();
}

scanBtn.addEventListener("click", async () => {
  if (isFrozen) {
    resetScanner();
    return;
  }

  if (!video.srcObject || video.videoWidth === 0 || video.videoHeight === 0) {
    showStatus("Camera warming up. Try again in a moment.", "error");
    return;
  }

  freezeFrame();

  scanBtn.disabled = true;
  scanBtn.textContent = "Processing...";
  resultCard.classList.remove("hidden");
  detectedPlateEl.textContent = "Analyzing frame...";
  matchStatus.className = "match-badge checking";
  matchStatus.textContent = "Reading plate with AI...";
  matchDetails.innerHTML = "";

  try {
    const imageDataUrl = canvas.toDataURL("image/png");
    const cleanedPlate = await extractPlateWithPuter(imageDataUrl);

    if (!cleanedPlate) {
      detectedPlateEl.textContent = "???";
      showManualOverrideForm("");
    } else {
      detectedPlateEl.textContent = cleanedPlate;
      lookupPlate(cleanedPlate);
    }
  } catch (err) {
    console.error("Scanning Execution Fault Intercepted:", err);
    console.error("Error message:", err?.message);
    console.error("Error details:", JSON.stringify(err, null, 2));
    detectedPlateEl.textContent = "Error";
    showStatus("AI vision error. Use manual entry below.", "error");
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
  canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
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
      <p>No active applicant records matching this plate were found.</p>
      ${getManualOverrideLink(scannedText)}
    `;
  }
}

function getManualOverrideLink(failedTextStr) {
  return `
    <div style="margin-top:15px;border-top:1px dashed #ccc;padding-top:12px;text-align:center;">
      <button type="button" onclick="window.activateManualInput('${failedTextStr}')" style="background:none;border:none;color:#0066cc;text-decoration:underline;font-size:0.9rem;cursor:pointer;">
        Incorrect match? Type plate manually
      </button>
    </div>
  `;
}

function showManualOverrideForm(initialValue = "") {
  matchStatus.className = "match-badge checking";
  matchStatus.textContent = "Manual Input Mode";
  matchDetails.innerHTML = `
    <div style="padding:5px 0;">
      <p style="margin:0 0 8px 0;font-size:0.9rem;color:#555;">Enter the license plate directly:</p>
      <input type="text" id="manualPlateField" value="${initialValue}" placeholder="E.g. ABC123"
        style="width:100%;box-sizing:border-box;padding:10px;font-size:1.1rem;text-transform:uppercase;border:2px solid #333;border-radius:4px;font-family:monospace;letter-spacing:1px;margin-bottom:10px;" />
      <button id="submitManualBtn"
        style="width:100%;padding:10px;background-color:#222;color:#fff;font-weight:bold;border:none;border-radius:4px;cursor:pointer;font-size:1rem;">
        Verify License Plate
      </button>
    </div>
  `;
  document.getElementById("submitManualBtn").addEventListener("click", () => {
    const val = document
      .getElementById("manualPlateField")
      .value.toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .trim();
    if (!val) {
      showStatus("Please enter a valid plate.", "error");
      return;
    }
    detectedPlateEl.textContent = val;
    lookupPlate(val);
  });
}

window.activateManualInput = (prefill) => showManualOverrideForm(prefill);

function showStatus(msg, type) {
  statusMsg.textContent = msg;
  statusMsg.className = `status-msg ${type}`;
  setTimeout(() => {
    statusMsg.className = "status-msg";
  }, 5000);
}

window.addEventListener("DOMContentLoaded", startCamera);
