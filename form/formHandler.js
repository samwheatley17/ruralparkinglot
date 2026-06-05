// // Your web app's Firebase configuration
// // For Firebase JS SDK v7.20.0 and later, measurementId is optional
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
const ref = db.ref("students"); 


ref.on("value", (snapshot) => {
  const list = document.getElementById("nameList");
  list.innerHTML = "";
  snapshot.forEach((child) => {
    const li = document.createElement("li");
    li.textContent = child.val().name;
    list.appendChild(li);
  });
});

document
  .getElementById("parkingForm")
  .addEventListener("submit", function (event) {
    event.preventDefault();
    const fullName = document.getElementById("fullname").value;
    const grade = document.getElementById("grade").value;
    const email = document.getElementById("email").value;
    const phone = document.getElementById("phone").value;
    const average = document.getElementById("average").value;
    const plate = document.getElementById("plate").value;
    const make = document.getElementById("make").value;
    const time = document.getElementById("time").value;
    const attendance = document.getElementById("attendance").value;

    const studentApplication = {
      studentName: fullName,
      grade: grade,
      email: email,
      phone: phone,
      average: average,
      attendance: attendance,

      vehicle: {
        plate: plate.toUpperCase(),
        makeModel: make,
      },
      time: time,
      submittedAt: new Date().toISOString(),
    };

    ref.push(studentApplication);

    window.location.href = "/form/submitted.html";
  });
