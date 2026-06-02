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

// ---- Initialize EmailJS ----
// Replace 'YOUR_PUBLIC_KEY' with your actual EmailJS Public Key from your dashboard
emailjs.init({
  publicKey: "oxPcd7LvTrb_bE76c",
});

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

// ---- Helper function to send notification email ----
async function sendNotificationEmail(student, isAssigned, spotNumber = null) {
  // Check if student object has an email field (assuming it's 'studentEmail' or 'email')
  const emailAddress = student.studentEmail || student.email;
  if (!emailAddress) {
    console.warn(`No email address found for student: ${student.studentName}`);
    return;
  }

  const timeMapping = { full_day: "Full Day", am: "AM", pm: "PM" };
  const formattedTime = timeMapping[student.time] || "—";

  const customMessage = isAssigned
    ? `Congratulations! Your application for a parking permit has been approved. You have been assigned to Spot #${spotNumber}.`
    : `Thank you for your application. Unfortunately, due to high demand and limited capacity, you have been placed on the waitlist. We will notify you if a spot opens up.`;
  const templateParams = {
    to_email: emailAddress, // Used in the "To Email" configuration field of your template
    name: student.studentName, // Maps to your {{name}} placeholder
    time: formattedTime, // Maps to your {{time}} placeholder
    message: customMessage, // Maps to your {{message}} placeholder
  };

  try {
    // Replace 'YOUR_SERVICE_ID' and 'YOUR_TEMPLATE_ID' with your specific EmailJS credentials
    await emailjs.send("service_ydf0qsc", "template_ev647pp", templateParams);
    console.log(`Notification email sent to ${student.studentName}`);
  } catch (error) {
    console.error(`Failed to send email to ${student.studentName}:`, error);
  }
}

// ---- Process & assign ----
processBtn.addEventListener("click", async () => {
  if (currentStudents.length === 0) {
    showStatus("No applicants to process.", "error");
    return;
  }

  processBtn.disabled = true;
  processBtn.textContent = "Processing & Emailing...";

  try {
    const sorted = sortByPriority(currentStudents);
    const updates = {};
    const assignedIds = new Set();
    const emailPromises = []; // Store email tasks so they run simultaneously

    // Assign top N students to spots 1..N
    sorted.slice(0, TOTAL_SPOTS).forEach((student, i) => {
      const spotNumber = i + 1;
      updates[`students/${student.id}/parkingSpot`] = spotNumber;
      assignedIds.add(student.id);

      // Queue an "Approved" email
      emailPromises.push(sendNotificationEmail(student, true, spotNumber));
    });

    // Clear anyone who previously had a spot but didn't make the cut (Waitlisted)
    sorted.slice(TOTAL_SPOTS).forEach((student) => {
      if (student.parkingSpot) {
        updates[`students/${student.id}/parkingSpot`] = null;
      }
      // Queue a "Waitlisted" email
      emailPromises.push(sendNotificationEmail(student, false));
    });

    // 1. Update the Firebase Database
    await db.ref().update(updates);

    // 2. Fire off all emails in parallel
    await Promise.all(emailPromises);

    const waitlisted = Math.max(0, sorted.length - TOTAL_SPOTS);
    showStatus(
      `Assigned ${assignedIds.size} spot${
        assignedIds.size === 1 ? "" : "s"
      }. Emails dispatched. ${waitlisted} waitlisted.`,
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
