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

// Initialize Firebase
const app = firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// Global Variables
let currentUser = null;
let userProfile = {};
let todayDiaryDocId = null;
let latestWeightLbs = 0;
let dashboardInitialized = false;

const MET_VALUES = { Walking: 4.0, Running: 9.0, Elliptical: 5.0, Swimming: 6.0, Weightlifting: 4.5 };
const LBS_TO_KG = 0.453592;

// --- UTILITIES ---
const getTodayStr = () => new Date().toISOString().split('T')[0];
const getYesterdayStr = () => {
    let d = new Date(); d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
};

// --- AUTH OBSERVER ---
auth.onAuthStateChanged(user => {
    currentUser = user;
    const path = window.location.pathname;
    const isDashboard = path.includes("dashboard.html");

    if (user) {
        if (!isDashboard) window.location.href = "dashboard.html";
        else initializeDashboard();
    } else {
        if (isDashboard) window.location.href = "index.html";
    }
});

function initializeDashboard() {
    if (dashboardInitialized) return;
    
    const emailEl = document.getElementById('user-email');
    if (emailEl) emailEl.textContent = currentUser.email;

    // Listeners
    document.getElementById('logout-btn')?.addEventListener('click', () => auth.signOut());
    document.getElementById('add-food-btn')?.addEventListener('click', addFood);
    document.getElementById('add-water-btn')?.addEventListener('click', addWater);
    document.getElementById('add-exercise-btn')?.addEventListener('click', addExercise);
    document.getElementById('save-diary-btn')?.addEventListener('click', saveEntry);
    document.getElementById('open-settings-btn')?.addEventListener('click', () => {
        const modal = document.getElementById('settings-modal');
        if (modal) modal.style.display = 'flex';
    });
    
    document.getElementById('record-weight-check')?.addEventListener('change', (e) => {
        const cont = document.getElementById('weight-input-container');
        if (cont) cont.style.display = e.target.checked ? 'block' : 'none';
    });

    loadProfile();
    loadToday();
    dashboardInitialized = true;
}

// --- DATA FETCHING ---
async function loadProfile() {
    try {
        const doc = await db.collection('users').doc(currentUser.uid).get();
        if (doc.exists) {
            userProfile = doc.data();
            // Once profile is loaded, we can calculate stats
            updateDashboardStats();
        }
    } catch (e) { console.error("Profile Load Error:", e); }
}

async function loadToday() {
    try {
        const today = getTodayStr();
        const snap = await db.collection('diary').where('userId', '==', currentUser.uid).where('date', '==', today).get();
        
        // Reset lists before populating
        if (document.getElementById('food-list')) document.getElementById('food-list').innerHTML = '';
        if (document.getElementById('water-list')) document.getElementById('water-list').innerHTML = '';
        if (document.getElementById('exercise-list')) document.getElementById('exercise-list').innerHTML = '';

        if (!snap.empty) {
            const data = snap.docs[0].data();
            todayDiaryDocId = snap.docs[0].id;
            
            if (document.getElementById('mood')) document.getElementById('mood').value = data.mood || '';
            if (document.getElementById('notes')) document.getElementById('notes').value = data.notes || '';
            if (data.weight && document.getElementById('weight')) {
                document.getElementById('record-weight-check').checked = true;
                document.getElementById('weight-input-container').style.display = 'block';
                document.getElementById('weight').value = data.weight;
            }

            data.foods?.forEach(f => renderPill('food', f.name, f.calories));
            data.water?.forEach(w => renderPill('water', w));
            data.exercises?.forEach(e => renderPill('exercise', e.type, `${e.minutes}m`));
            
            updateTotalsUI();
        }
    } catch (e) { console.error("Today Load Error:", e); }
}

// --- UI ACTIONS ---
function addFood() {
    const n = document.getElementById('food-input')?.value;
    const c = document.getElementById('food-calories')?.value;
    if (n) { renderPill('food', n, c); updateTotalsUI(); document.getElementById('food-input').value = ''; document.getElementById('food-calories').value = ''; }
}

function addWater() {
    const w = document.getElementById('water-input')?.value;
    if (w) { renderPill('water', w); updateTotalsUI(); document.getElementById('water-input').value = ''; }
}

function addExercise() {
    const t = document.getElementById('exercise-type')?.value;
    const m = document.getElementById('exercise-minutes')?.value;
    if (m) { renderPill('exercise', t, `${m}m`); updateTotalsUI(); document.getElementById('exercise-minutes').value = ''; }
}

function renderPill(cat, label, extra = null) {
    const container = document.getElementById(`${cat}-list`);
    if (!container) return;
    const pill = document.createElement('div');
    pill.className = `${cat}-pill`;
    pill.dataset.label = label;
    pill.dataset.extra = extra;
    pill.innerHTML = `<span>${label} ${extra ? '(' + extra + ')' : ''}</span> <span class="remove" style="cursor:pointer;margin-left:8px;font-weight:bold;">x</span>`;
    pill.querySelector('.remove').onclick = () => { pill.remove(); updateTotalsUI(); };
    container.appendChild(pill);
}

function updateTotalsUI() {
    const foodTotal = Array.from(document.querySelectorAll('.food-pill')).reduce((s, p) => s + (parseFloat(p.dataset.extra) || 0), 0);
    const waterTotal = Array.from(document.querySelectorAll('.water-pill')).reduce((s, p) => s + (parseFloat(p.dataset.label) || 0), 0);
    
    if (document.getElementById('food-total-today')) document.getElementById('food-total-today').textContent = foodTotal;
    if (document.getElementById('water-total-today')) document.getElementById('water-total-today').textContent = waterTotal;
}

// --- DASHBOARD UPDATES (FIXED) ---
async function updateDashboardStats() {
    try {
        const startWeight = parseFloat(userProfile.startingWeight) || 0;
        
        // 1. Fetch the single most recent weight reading from the entire collection
        console.log("Dashboard: Querying for absolute latest weight...");
        const weightSnap = await db.collection('diary')
            .where('userId', '==', currentUser.uid)
            .where('weight', '>', 0)
            .orderBy('weight') // Filtering on a range requires ordering by that field first
            .orderBy('date', 'desc')
            .limit(1).get();

        let current = startWeight; 
        if (!weightSnap.empty) {
            current = weightSnap.docs[0].data().weight;
            console.log("Dashboard: Latest weight found:", current);
        } else {
            console.log("Dashboard: No recorded weights found. Using Starting Weight.");
        }
        
        latestWeightLbs = current; // Global variable for other calculations

        const setStat = (id, val) => { 
            const el = document.getElementById(id);
            if (el) el.textContent = val; 
        };
        
        // 2. Update Main Stats
        setStat('stat-starting-weight', startWeight.toFixed(1) + " lbs");
        setStat('stat-current-weight', current.toFixed(1) + " lbs");
        
        const totalLoss = startWeight - current;
        const totalLossEl = document.getElementById('stat-total-loss');
        if (totalLossEl) {
            totalLossEl.textContent = totalLoss.toFixed(1) + " lbs";
            totalLossEl.style.color = totalLoss >= 0 ? '#28a745' : '#d93025';
        }

        if (document.getElementById('stat-goal-weight')) {
            document.getElementById('stat-goal-weight').textContent = (parseFloat(userProfile.goalWeight) || 0).toFixed(1) + " lbs";
        }

        // 3. Yesterday's Summary Cards
        const yesterday = getYesterdayStr();
        const ySnap = await db.collection('diary')
            .where('userId', '==', currentUser.uid)
            .where('date', '==', yesterday)
            .limit(1).get();
            
        if (!ySnap.empty) {
            const y = ySnap.docs[0].data();
            setStat('stat-yesterday-water', (y.waterTotal || 0) + " oz");
            setStat('stat-yesterday-calories', y.foodCaloriesTotal || 0);
            setStat('stat-yesterday-cal-burned', y.exerciseCaloriesTotal || 0);
            setStat('stat-yesterday-exercise', (y.exerciseMinutesTotal || 0) + " min");
        } else {
            setStat('stat-yesterday-water', "0 oz");
            setStat('stat-yesterday-calories', "0");
            setStat('stat-yesterday-cal-burned', "0");
            setStat('stat-yesterday-exercise', "0 min");
        }
    } catch (e) { 
        console.error("Dashboard Stats Error:", e);
        // Important: If you see "The query requires an index" in the console, click the link provided.
    }
}

async function saveEntry() {
    try {
        const foodData = Array.from(document.querySelectorAll('.food-pill')).map(p => ({ name: p.dataset.label, calories: parseFloat(p.dataset.extra) || 0 }));
        const waterData = Array.from(document.querySelectorAll('.water-pill')).map(p => parseFloat(p.dataset.label));
        
        // Calculate calorie burn based on current weight
        const exerciseData = Array.from(document.querySelectorAll('.exercise-pill')).map(p => {
            const mins = parseFloat(p.dataset.extra.replace('m', '')) || 0;
            const type = p.dataset.label;
            const burn = Math.round((MET_VALUES[type] || 3.0) * (latestWeightLbs * LBS_TO_KG) * (mins / 60));
            return { type: type, minutes: mins, calories: burn };
        });

        const entry = {
            userId: currentUser.uid,
            date: getTodayStr(),
            mood: document.getElementById('mood')?.value || '',
            notes: document.getElementById('notes')?.value || '',
            foods: foodData,
            foodCaloriesTotal: foodData.reduce((s, f) => s + f.calories, 0),
            water: waterData,
            waterTotal: waterData.reduce((s, w) => s + w, 0),
            exercises: exerciseData,
            exerciseCaloriesTotal: exerciseData.reduce((s, e) => s + e.calories, 0),
            exerciseMinutesTotal: exerciseData.reduce((s, e) => s + e.minutes, 0),
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        };

        const weightInput = document.getElementById('weight');
        if (document.getElementById('record-weight-check')?.checked && weightInput?.value) {
            entry.weight = parseFloat(weightInput.value);
        } else {
            entry.weight = firebase.firestore.FieldValue.delete();
        }

        if (todayDiaryDocId) {
            await db.collection('diary').doc(todayDiaryDocId).update(entry);
        } else {
            const newDoc = await db.collection('diary').add(entry);
            todayDiaryDocId = newDoc.id;
        }
        
        alert("Daily Entry Saved!");
        updateDashboardStats(); // Refresh dashboard with potential new weight
    } catch (e) { alert("Error saving: " + e.message); }
}
