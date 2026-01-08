//
// ⬇️ ⬇️ ⬇️ PASTE YOUR FIREBASE CONFIG OBJECT HERE ⬇️ ⬇️ ⬇️
//
const firebaseConfig = {
  apiKey: "AIzaSyBBybojwNrdzWI0JO15ZhqOGXMpPQhEwkY",
  authDomain: "weight-loss-diary-96069.firebaseapp.com",
  projectId: "weight-loss-diary-96069",
  storageBucket: "weight-loss-diary-96069.firebasestorage.app",
  messagingSenderId: "805999231155",
  appId: "1:805999231155:web:e88cc7cb3febade036f0c6",
  measurementId: "G-J3KXRQEBCW"
};
// ⬆️ ⬆️ ⬆️ END OF FIREBASE CONFIG ⬆️ ⬆️ ⬆️

const app = firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

let currentUser = null;
let userProfile = {};
let todayDiaryDocId = null;
let userEntryDates = [];
let calendarInstance = null;

// --- DATE HELPER (Strict Format) ---
const getFormattedDate = (date) => {
    const d = new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const todayStr = getFormattedDate(new Date());

// --- AUTH OBSERVER ---
auth.onAuthStateChanged(user => {
    currentUser = user;
    if (user) {
        if (!window.location.pathname.includes("dashboard.html")) window.location.href = "dashboard.html";
        else initDashboard();
    } else {
        if (window.location.pathname.includes("dashboard.html")) window.location.href = "index.html";
        else initAuth();
    }
});

function initAuth() {
    document.getElementById('login-btn')?.addEventListener('click', () => {
        const email = document.getElementById('login-email').value;
        const pass = document.getElementById('login-password').value;
        auth.signInWithEmailAndPassword(email, pass).catch(e => alert(e.message));
    });
    document.getElementById('show-signup')?.addEventListener('click', () => {
        document.getElementById('login-form').style.display = 'none';
        document.getElementById('signup-form').style.display = 'block';
    });
}

function initDashboard() {
    document.getElementById('user-email').textContent = currentUser.email;

    // Listeners
    document.getElementById('logout-btn').onclick = () => auth.signOut();
    document.getElementById('add-food-btn').onclick = addFood;
    document.getElementById('add-water-btn').onclick = addWater;
    document.getElementById('save-diary-btn').onclick = saveEntry;
    document.getElementById('open-calendar-btn').onclick = openCalendar;
    document.getElementById('open-settings-btn').onclick = () => document.getElementById('settings-modal').style.display='flex';
    document.getElementById('save-settings-btn').onclick = saveSettings;

    document.querySelectorAll('.modal-close-btn').forEach(b => b.onclick = () => {
        document.querySelectorAll('.modal-overlay').forEach(m => m.style.display='none');
    });

    document.getElementById('record-weight-check').onchange = (e) => {
        document.getElementById('weight-input-container').style.display = e.target.checked ? 'block' : 'none';
    };

    loadProfile();
    loadToday();
    fetchDates();
}

// --- DATA LOADING ---
async function loadProfile() {
    const doc = await db.collection('users').doc(currentUser.uid).get();
    if (doc.exists) {
        userProfile = doc.data();
        updateStats();
    }
}

async function fetchDates() {
    const snap = await db.collection('diary').where('userId', '==', currentUser.uid).get();
    userEntryDates = snap.docs.map(doc => doc.data().date);
}

async function loadToday() {
    const snap = await db.collection('diary').where('userId','==',currentUser.uid).where('date','==',todayStr).get();
    if (!snap.empty) {
        const data = snap.docs[0].data();
        todayDiaryDocId = snap.docs[0].id;
        document.getElementById('notes').value = data.notes || '';
        if (data.weight) {
            document.getElementById('record-weight-check').checked = true;
            document.getElementById('weight-input-container').style.display = 'block';
            document.getElementById('weight').value = data.weight;
        }
        data.foods?.forEach(f => renderPill('food', f.name, f.calories));
        data.water?.forEach(w => renderPill('water', w));
        updateTotals();
    }
}

// --- UI HELPERS ---
function addFood() {
    const n = document.getElementById('food-input').value;
    const c = document.getElementById('food-calories').value;
    if(n) { renderPill('food', n, c); updateTotals(); document.getElementById('food-input').value=''; document.getElementById('food-calories').value=''; }
}

function addWater() {
    const w = document.getElementById('water-input').value;
    if(w) { renderPill('water', w); updateTotals(); document.getElementById('water-input').value=''; }
}

function renderPill(cat, label, extra) {
    const container = document.getElementById(`${cat}-list`);
    const pill = document.createElement('div');
    pill.className = `${cat}-pill`;
    pill.dataset.val = label;
    pill.dataset.extra = extra;
    pill.innerHTML = `${label} ${extra ? '('+extra+')' : ''} <span style="cursor:pointer;margin-left:8px" onclick="this.parentElement.remove();updateTotals();">x</span>`;
    container.appendChild(pill);
}

function updateTotals() {
    const fTotal = Array.from(document.querySelectorAll('.food-pill')).reduce((acc, p) => acc + (parseFloat(p.dataset.extra) || 0), 0);
    const wTotal = Array.from(document.querySelectorAll('.water-pill')).reduce((acc, p) => acc + (parseFloat(p.dataset.val) || 0), 0);
    document.getElementById('food-total-today').textContent = fTotal;
    document.getElementById('water-total-today').textContent = wTotal;
}

// --- PERSISTENCE ---
async function saveEntry() {
    try {
        const foods = Array.from(document.querySelectorAll('.food-pill')).map(p => ({name: p.dataset.val, calories: parseFloat(p.dataset.extra) || 0}));
        const water = Array.from(document.querySelectorAll('.water-pill')).map(p => parseFloat(p.dataset.val));
        
        const entry = {
            userId: currentUser.uid,
            date: todayStr,
            foods: foods,
            foodCaloriesTotal: foods.reduce((s, f) => s + f.calories, 0),
            water: water,
            waterTotal: water.reduce((s, w) => s + w, 0),
            notes: document.getElementById('notes').value,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        };

        if(document.getElementById('record-weight-check').checked) {
            entry.weight = parseFloat(document.getElementById('weight').value);
        }

        if (todayDiaryDocId) await db.collection('diary').doc(todayDiaryDocId).set(entry, {merge: true});
        else {
            const res = await db.collection('diary').add(entry);
            todayDiaryDocId = res.id;
        }
        alert("Saved!");
        fetchDates();
        updateStats();
    } catch (e) { alert("Save failed: " + e.message); }
}

async function updateStats() {
    // 1. Get Latest Weight from History
    const snap = await db.collection('diary').where('userId','==',currentUser.uid).orderBy('date','desc').limit(20).get();
    let current = parseFloat(userProfile.startingWeight) || 0;
    if(!snap.empty) {
        for(let doc of snap.docs) {
            if(doc.data().weight) { current = doc.data().weight; break; }
        }
    }

    const start = parseFloat(userProfile.startingWeight) || 0;
    const goal = parseFloat(userProfile.goalWeight) || 0;
    const weekly = parseFloat(userProfile.desiredWeeklyLoss) || 0;

    // 2. Update Stats Text
    document.getElementById('stat-starting-weight').textContent = start + " lbs";
    document.getElementById('stat-current-weight').textContent = current + " lbs";
    document.getElementById('stat-goal-weight').textContent = goal + " lbs";
    document.getElementById('stat-total-loss').textContent = (start - current).toFixed(1) + " lbs";

    // 3. Calculation for EST GOAL DATE
    const goalDateEl = document.getElementById('stat-goal-date');
    if(goal > 0 && weekly > 0 && current > goal) {
        const diff = current - goal;
        const days = Math.ceil((diff / weekly) * 7);
        const target = new Date();
        target.setDate(target.getDate() + days);
        goalDateEl.textContent = target.toLocaleDateString('en-US', {month:'short', day:'numeric', year:'numeric'});
    } else {
        goalDateEl.textContent = "--";
    }

    // 4. Yesterday's stats logic
    let yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
    const yStr = getFormattedDate(yesterday);
    const ySnap = await db.collection('diary').where('userId','==',currentUser.uid).where('date','==',yStr).get();
    if(!ySnap.empty) {
        document.getElementById('stat-yesterday-water').textContent = (ySnap.docs[0].data().waterTotal || 0) + " oz";
        document.getElementById('stat-yesterday-calories').textContent = ySnap.docs[0].data().foodCaloriesTotal || 0;
    }
}

async function saveSettings() {
    const s = document.getElementById('starting-weight').value;
    const g = document.getElementById('goal-weight').value;
    const w = document.getElementById('weekly-loss-goal').value;
    await db.collection('users').doc(currentUser.uid).set({startingWeight: s, goalWeight: g, desiredWeeklyLoss: w}, {merge:true});
    userProfile = {startingWeight: s, goalWeight: g, desiredWeeklyLoss: w};
    updateStats();
    document.getElementById('settings-success').textContent = "Settings Saved!";
}

function openCalendar() {
    document.getElementById('calendar-modal').style.display = 'flex';
    if (!calendarInstance) {
        calendarInstance = flatpickr("#calendar-container", {
            inline: true,
            onDayCreate: (d, dStr, fp, dayElem) => {
                const date = getFormattedDate(dayElem.dateObj);
                if (userEntryDates.includes(date)) dayElem.classList.add("has-entry");
            },
            onChange: (sel) => {
                const date = getFormattedDate(sel[0]);
                loadPastEntryView(date);
            }
        });
    } else { calendarInstance.redraw(); }
}

async function loadPastEntryView(dateStr) {
    const list = document.getElementById('past-entries-list');
    list.innerHTML = "Loading...";
    const snap = await db.collection('diary').where('userId','==',currentUser.uid).where('date','==',dateStr).get();
    if(snap.empty) list.innerHTML = `<p>No entry for ${dateStr}</p>`;
    else {
        const d = snap.docs[0].data();
        list.innerHTML = `<div class="entry-card"><h3>${d.date}</h3><p>Weight: ${d.weight || '--'} lbs</p><p>${d.notes || ''}</p></div>`;
    }
}
