// Same config as your form page
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

const TOTAL_SPOTS = 126;

const tbody = document.getElementById("studentTableBody");
const processBtn = document.getElementById("processBtn");
const statusMsg = document.getElementById("statusMsg");
const statApp = document.getElementById("statApplicants");
const statAssign = document.getElementById("statAssigned");
const statWait = document.getElementById("statWaitlisted");

let currentStudents = [];

// ---- Sort helper ----
function sortByPriority(students) {
  return [...students].sort((a, b) => {
    const gradeA = parseInt(a.grade) || 0;
    const gradeB = parseInt(b.grade) || 0;
    if (gradeB !== gradeA) return gradeB - gradeA; // grade 12 first
    const avgA = parseFloat(a.average) || 0;
    const avgB = parseFloat(b.average) || 0;
    return avgB - avgA; // higher avg first
  });
}

// ---- Render the table ----
function render(students) {
  if (students.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="8" class="empty-row">No applicants yet.</td></tr>';
    statApp.textContent = 0;
    statAssign.textContent = 0;
    statWait.textContent = 0;
    return;
  }

  const sorted = sortByPriority(students);
  const assignedCount = sorted.filter((s) => s.parkingSpot).length;

  statApp.textContent = sorted.length;
  statAssign.textContent = assignedCount;
  statWait.textContent = Math.max(0, sorted.length - TOTAL_SPOTS);

  tbody.innerHTML = sorted
    .map(
      (s, i) => `
      <tr class="${s.parkingSpot ? "assigned" : ""}">
        <td>${i + 1}</td>
        <td>${s.studentName || "—"}</td>
        <td>${s.grade || "—"}</td>
        <td>${s.average || "—"}</td>
        <td>${s.attendance ?? "—"}</td>
        <td>${formatTime(s.time)}</td>
        <td>${s.vehicle.plate || "—"}</td>
        <td>${
          s.parkingSpot
            ? `<span class="spot-badge">${s.parkingSpot}</span>`
            : `<span class="spot-none">Unassigned</span>`
        }</td>
      </tr>
    `
    )
    .join("");
}

function formatTime(t) {
  return { full_day: "Full Day", am: "AM", pm: "PM" }[t] || "—";
}

// ---- Live listener ----
db.ref("students").on("value", (snap) => {
  currentStudents = [];
  snap.forEach((child) => {
    currentStudents.push({ id: child.key, ...child.val() });
  });
  render(currentStudents);
});

// ---- Process & assign ----
processBtn.addEventListener("click", async () => {
  if (currentStudents.length === 0) {
    showStatus("No applicants to process.", "error");
    return;
  }

  processBtn.disabled = true;
  processBtn.textContent = "Processing...";

  try {
    const sorted = sortByPriority(currentStudents);
    const updates = {};
    const assignedIds = new Set();

    // Assign top N students to spots 1..N
    sorted.slice(0, TOTAL_SPOTS).forEach((student, i) => {
      const spotNumber = i + 1;
      updates[`students/${student.id}/parkingSpot`] = spotNumber;
      assignedIds.add(student.id);
    });

    // Clear anyone who previously had a spot but didn't make the cut
    currentStudents.forEach((s) => {
      if (s.parkingSpot && !assignedIds.has(s.id)) {
        updates[`students/${s.id}/parkingSpot`] = null;
      }
    });

    await db.ref().update(updates);

    const waitlisted = Math.max(0, sorted.length - TOTAL_SPOTS);
    showStatus(
      `Assigned ${assignedIds.size} spot${
        assignedIds.size === 1 ? "" : "s"
      }. ` + `${waitlisted} waitlisted.`,
      "success"
    );
  } catch (err) {
    console.error(err);
    showStatus("Error processing assignments: " + err.message, "error");
  } finally {
    processBtn.disabled = false;
    processBtn.textContent = "Process & Assign";
  }
});

function showStatus(msg, type) {
  statusMsg.textContent = msg;
  statusMsg.className = `status-msg ${type}`;
  setTimeout(() => {
    statusMsg.className = "status-msg";
  }, 5000);
}
