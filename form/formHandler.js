// Import the functions you need from the SDKs you need
import {
  initializeApp,
  getDatabase,
} from "https://www.gstatic.com/firebasejs/12.13.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-analytics.js";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
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

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

// 4. Initialize Realtime Database and get a reference to the service
const database = getDatabase(app);

// 5. Function to push data
async function saveData() {
  // Define the path where you want to store data (e.g., "parking_logs")
  const dbRef = ref(database, "parking_logs");

  const newData = {
    spotNumber: 42,
    isOccupied: true,
    timestamp: Date.now(),
  };

  try {
    // push() automatically generates a unique ID (like -Njkx... )
    const res = await push(dbRef, newData);
    console.log("Data pushed successfully! Document ID:", res.key);
    alert("Data saved with ID: " + res.key);
  } catch (error) {
    console.error("Error pushing data:", error);
  }
}

saveData();
