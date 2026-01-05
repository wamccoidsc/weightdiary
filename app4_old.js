// CONFIG: Paste your Firebase config here
const firebaseConfig = {
  apiKey: "AIzaSyBBybojwNrdzWI0JO15ZhqOGXMpPQhEwkY",
  authDomain: "weight-loss-diary-96069.firebaseapp.com",
  projectId: "weight-loss-diary-96069",
  storageBucket: "weight-loss-diary-96069.firebasestorage.app",
  messagingSenderId: "805999231155",
  appId: "1:805999231155:web:e88cc7cb3febade036f0c6",
  measurementId: "G-J3KXRQEBCW"
};

const app = firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

let currentUser = null;
let todayDiaryDocId = null;
let latestWeightLbs = 0;

// --- UTILITIES ---
const getTodayStr = () => new Date().toISOString().split('T')[0];
const getYesterdayStr = () => {
    let d = new Date(); d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
};

// --- AUTH ---
auth.onAuthStateChanged(user => {
    currentUser = user;
    const path = window.location.pathname;
    if (user) {
        if (!path.includes("dashboard.html")) window.location.href = "dashboard.html";
        else initializeDashboard();
    } else {
        if (path.includes("dashboard.html")) window.location.href = "index.html";
    }
});

function initializeDashboard() {
    document.getElementById('user-email').textContent = currentUser.email;
    document.getElementById('logout-btn').addEventListener('click', () => auth.signOut());

    document.getElementById('add-restroom-btn').addEventListener('click', addRestroom);
    document.getElementById('save-diary-btn').addEventListener('click', saveEntry);
    
    // Add other button listeners as needed (food, water, etc.)

    loadToday();
    updateDashboardStats();
}

// --- RESTROOM TRACKING ---
function addRestroom() {
    const type = document.getElementById('restroom-type').value;
    renderRestroomPill(type);
    updateRestroomTotals();
}

function renderRestroomPill(type) {
    const container = document.getElementById('restroom-list');
    const pill = document.createElement('div');
    pill.className = 'restroom-pill';
    pill.dataset.type = type;
    pill.innerHTML = `<span>${type}</span> <span class="remove-restroom">x</span>`;
    pill.querySelector('.remove-restroom').onclick = () => { pill.remove(); updateRestroomTotals(); };
    container.appendChild(pill);
}

function updateRestroomTotals() {
    const pills = document.querySelectorAll('.restroom-pill');
    let u = 0, s = 0;
    pills.forEach(p => {
        if (p.dataset.type === 'Urine') u++; else s++;
    });
    document.getElementById('urine-count').textContent = u;
    document.getElementById('stool-count').textContent = s;
}

// --- DATA PERSISTENCE ---
async function saveEntry() {
    const restroomData = Array.from(document.querySelectorAll('.restroom-pill')).map(p => p.dataset.type);
    
    const entry = {
        userId: currentUser.uid,
        date: getTodayStr(),
        restroom: restroomData,
        urineTotal: restroomData.filter(t => t === 'Urine').length,
        stoolTotal: restroomData.filter(t => t === 'Stool').length,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    };

    try {
        if (todayDiaryDocId) await db.collection('diary').doc(todayDiaryDocId).update(entry);
        else await db.collection('diary').add(entry);
        alert("Daily Entry Saved!");
        updateDashboardStats();
    } catch (e) { alert(e.message); }
}

async function loadToday() {
    const snap = await db.collection('diary').where('userId','==',currentUser.uid).where('date','==',getTodayStr()).get();
    if (!snap.empty) {
        const data = snap.docs[0].data();
        todayDiaryDocId = snap.docs[0].id;
        data.restroom?.forEach(type => renderRestroomPill(type));
        updateRestroomTotals();
    }
}

async function updateDashboardStats() {
    // Current Weight from Profile or Last Entry
    const userDoc = await db.collection('users').doc(currentUser.uid).get();
    if(userDoc.exists) document.getElementById('stat-current-weight').textContent = (userDoc.data().startingWeight || 0) + " lbs";

    // Yesterday's Restroom Data
    const yesterdaySnap = await db.collection('diary').where('userId','==',currentUser.uid).where('date','==',getYesterdayStr()).get();
    if (!yesterdaySnap.empty) {
        const yData = yesterdaySnap.docs[0].data();
        document.getElementById('stat-yesterday-urine').textContent = yData.urineTotal || 0;
        document.getElementById('stat-yesterday-stool').textContent = yData.stoolTotal || 0;
    }
}
