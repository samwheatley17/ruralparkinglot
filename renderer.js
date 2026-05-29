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

const canvas = document.getElementById("parkingCanvas");
const ctx = canvas.getContext("2d");
const statusDisplay = document.getElementById("status-display");

isDragging = false;
let startX, startY;
let scrollX = 0; // Tracks total horizontal scroll offset
let scrollY = 50; // Tracks total vertical scroll offset
let scale = 1.0; // 1.0 is 100% zoom

const MIN_SCALE = 0.5; // 50% size
const MAX_SCALE = 3.0; // 300% size
const ZOOM_SPEED = 0.1;

class LotSpace {
  occupied = false;
  studentName = null;

  constructor(x, y, number, rotated = false) {
    this.x = x;
    this.y = y;
    this.index = number;
    this.rotated = rotated;
  }
}

const parkingLotStrips = [
  {
    origin: [20, 20],
    count: 43,
    startIndex: 1,
  },
  {
    origin: [20, 250],
    count: 6,
    startIndex: 44,
  },

  {
    origin: [20, 350],
    count: 7,
    startIndex: 50,
  },

  {
    origin: [20, 580],
    count: 9,
    startIndex: 57,
  },
  {
    origin: [20, 680],
    count: 11,
    startIndex: 66,
  },

  {
    origin: [790, 730],
    count: 5,
    startIndex: 77,
  },
  {
    origin: [20, 880],
    count: 42,
    startIndex: 82,
  },
];

const spaces = [];

function getLastName(fullname) {
  if (!fullname) return "—";
  const parts = fullname.trim().split(/\s+/);
  return parts.length > 1 ? parts[parts.length - 1] : parts[0];
}

function drawParkingSpace(
  x,
  y,
  sname,
  index,
  occupied,
  width = 60,
  height = 90
) {
  ctx.fillStyle = (occupied && "#FF2222") || "#2ecc71"; // Green

  ctx.fillRect(x, y, width, height);

  // Set the color and thickness for an outline
  ctx.strokeStyle = "#ffffff"; // White
  ctx.lineWidth = 2;
  // Draw just the outline of a rectangle
  ctx.strokeRect(x, y, width, height);

  ctx.fillStyle = "#ffffff";

  ctx.font = "30px sans-serif";
  const text = ctx.measureText(index);
  ctx.fillText(index, x + width / 2 - text.width / 2, y + height * 0.6);

  if (sname) {
    let converted = getLastName(sname);
    ctx.font = "12px sans-serif";
    const stext = ctx.measureText(converted);
    ctx.fillText(converted, x + width / 2 - stext.width / 2, y + height * 0.8);
  }
}

function buildMap() {
  for (strip of parkingLotStrips) {
    for (let i = 0; i < strip.count; i++) {
      const newSpace = new LotSpace(
        strip.origin[0] + i * 70,
        strip.origin[1],
        strip.startIndex + i
      );

      spaces.push(newSpace);
    }
  }

  spaces.push(new LotSpace(650, 610, 124, true));

  spaces.push(new LotSpace(790, 630, 125, false));
  spaces.push(new LotSpace(860, 660, 126, true));
}

function drawMap() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.save();

  ctx.translate(scrollX, scrollY);
  ctx.scale(scale, scale);

  for (space of spaces) {
    if (!space.rotated) {
      drawParkingSpace(
        space.x,
        space.y,
        space.studentName,
        space.index,
        space.occupied
      );
    } else {
      drawParkingSpace(
        space.x,
        space.y,
        space.studentName,
        space.index,
        space.occupied,
        90,
        60
      );
    }
  }

  ctx.restore();
}

canvas.addEventListener("mousedown", (e) => {
  isDragging = true;
  startX = e.clientX - scrollX;
  startY = e.clientY - scrollY;

  console.log("dragging");
});

canvas.addEventListener(
  "wheel",
  (e) => {
    e.preventDefault();

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const worldX = (mouseX - scrollX) / scale;
    const worldY = (mouseY - scrollY) / scale;

    if (e.deltaY < 0) {
      scale = Math.min(scale + ZOOM_SPEED, MAX_SCALE);
    } else {
      scale = Math.max(scale - ZOOM_SPEED, MIN_SCALE);
    }

    scrollX = mouseX - worldX * scale;
    scrollY = mouseY - worldY * scale;

    // Redraw the scene
    drawMap();
  },
  { passive: false }
);

canvas.addEventListener("mousemove", (e) => {
  if (!isDragging) return;

  scrollX = e.clientX - startX;
  scrollY = e.clientY - startY;

  drawMap();
});

canvas.addEventListener("mouseup", () => (isDragging = false));
canvas.addEventListener("mouseleave", () => (isDragging = false));

buildMap();

console.log(spaces);

drawMap();

db.ref("students").on("value", (snap) => {
  snap.forEach((child) => {
    console.log(child.val());
    if (child.val().parkingSpot) {
      for (x of spaces) {
        if (Number(x.index) == Number(child.val().parkingSpot)) {
          x.occupied = true;
          x.studentName = child.val().studentName;
        }
      }
    }
  });
  drawMap();
});
