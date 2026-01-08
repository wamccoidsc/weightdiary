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

let currentUser = null;
let userProfile = {};
let todayDiaryDocId = null;
let latestWeightLbs = 0;

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
    if (user) {
        if (!path.includes("dashboard.html")) window.location.href = "dashboard.html";
        else initializeDashboard();
    } else {
        if (path.includes("dashboard.html")) window.location.href = "index.html";
    }
});

function initializeDashboard() {
    console.log("Initializing Dashboard...");
    
    // Set Email
    const emailEl = document.getElementById('user-email');
    if (emailEl) emailEl.textContent = currentUser.email;

    // Button Listeners (Using ?. to prevent crashes if ID is missing)
    document.getElementById('logout-btn')?.addEventListener('click', () => auth.signOut());
    document.getElementById('add-food-btn')?.addEventListener('click', addFood);
    document.getElementById('add-water-btn')?.addEventListener('click', addWater);
    document.getElementById('add-exercise-btn')?.addEventListener('click', addExercise);
    document.getElementById('add-restroom-btn')?.addEventListener('click', addRestroom);
    document.getElementById('save-diary-btn')?.addEventListener('click', saveEntry);
    document.getElementById('open-settings-btn')?.addEventListener('click', () => document.getElementById('settings-modal').style.display='flex');
    
    document.getElementById('record-weight-check')?.addEventListener('change', (e) => {
        const cont = document.getElementById('weight-input-container');
        if (cont) cont.style.display = e.target.checked ? 'block' : 'none';
    });

    loadProfile();
    loadToday();
}

async function loadProfile() {
    try {
        const doc = await db.collection('users').doc(currentUser.uid).get();
        if (doc.exists) {
            userProfile = doc.data();
            updateDashboardStats();
        }
    } catch (e) { console.error("Profile Load Error:", e); }
}

async function loadToday() {
    try {
        const today = getTodayStr();
        const snap = await db.collection('diary').where('userId','==',currentUser.uid).where('date','==',today).get();
        if (!snap.empty) {
            const data = snap.docs[0].data();
            todayDiaryDocId = snap.docs[0].id;
            
            // Populate basic fields
            if(document.getElementById('mood')) document.getElementById('mood').value = data.mood || '';
            if(document.getElementById('notes')) document.getElementById('notes').value = data.notes || '';
            
            // Render existing pills
            data.foods?.forEach(f => renderPill('food', f.name, f.calories));
            data.water?.forEach(w => renderPill('water', w));
            data.exercises?.forEach(e => renderPill('exercise', e.type, `${e.minutes}m`));
            data.restroom?.forEach(r => renderPill('restroom', r));
            
            updateTotalsUI();
        }
    } catch (e) { console.error("Today Load Error:", e); }
}

// --- UI ACTIONS ---
function addFood() {
    const n = document.getElementById('food-input').value;
    const c = document.getElementById('food-calories').value;
    if(n) { renderPill('food', n, c); updateTotalsUI(); }
}

function addWater() {
    const w = document.getElementById('water-input').value;
    if(w) { renderPill('water', w); updateTotalsUI(); }
}

function addExercise() {
    const t = document.getElementById('exercise-type').value;
    const m = document.getElementById('exercise-minutes').value;
    if(m) { renderPill('exercise', t, `${m}m`); updateTotalsUI(); }
}

function addRestroom() {
    const t = document.getElementById('restroom-type').value;
    renderPill('restroom', t);
    updateTotalsUI();
}

function renderPill(cat, label, extra = null) {
    const container = document.getElementById(`${cat}-list`);
    if(!container) return;
    const pill = document.createElement('div');
    pill.className = `${cat}-pill`;
    pill.dataset.val = label;
    pill.dataset.extra = extra;
    pill.innerHTML = `<span>${label} ${extra ? '('+extra+')' : ''}</span> <span class="remove" style="cursor:pointer;margin-left:8px">x</span>`;
    pill.querySelector('.remove').onclick = () => { pill.remove(); updateTotalsUI(); };
    container.appendChild(pill);
}

function updateTotalsUI() {
    // Restroom Logic
    const restroomPills = document.querySelectorAll('.restroom-pill');
    let u = 0, s = 0;
    restroomPills.forEach(p => {
        if(p.dataset.val === 'Urine') u++;
        else s++;
    });
    if(document.getElementById('urine-count')) document.getElementById('urine-count').textContent = u;
    if(document.getElementById('stool-count')) document.getElementById('stool-count').textContent = s;
}

async function updateDashboardStats() {
    try {
        // 1. Current Weight (Query absolute latest)
        const weightSnap = await db.collection('diary')
            .where('userId', '==', currentUser.uid)
            .where('weight', '>', 0)
            .orderBy('weight').orderBy('date', 'desc').limit(1).get();

        let current = parseFloat(userProfile.startingWeight) || 0;
        if (!weightSnap.empty) current = weightSnap.docs[0].data().weight;
        latestWeightLbs = current;

        // 2. Update Stats UI
        const setStat = (id, val) => { if(document.getElementById(id)) document.getElementById(id).textContent = val; };
        
        setStat('stat-starting-weight', (parseFloat(userProfile.startingWeight) || 0) + " lbs");
        setStat('stat-current-weight', current + " lbs");
        setStat('stat-total-loss', ((parseFloat(userProfile.startingWeight) || 0) - current).toFixed(1) + " lbs");

        // 3. Yesterday's Stats
        const ySnap = await db.collection('diary').where('userId','==',currentUser.uid).where('date','==',getYesterdayStr()).get();
        if(!ySnap.empty) {
            const y = ySnap.docs[0].data();
            setStat('stat-yesterday-water', (y.waterTotal || 0) + " oz");
            setStat('stat-yesterday-calories', y.foodCaloriesTotal || 0);
            setStat('stat-yesterday-cal-burned', y.exerciseCaloriesTotal || 0);
            setStat('stat-yesterday-urine', y.urineTotal || 0);
            setStat('stat-yesterday-stool', y.stoolTotal || 0);
        }
    } catch (e) { console.error("Dashboard Stat Error:", e); }
}

async function saveEntry() {
    try {
        const restroomData = Array.from(document.querySelectorAll('.restroom-pill')).map(p => p.dataset.val);
        const foodData = Array.from(document.querySelectorAll('.food-pill')).map(p => ({name: p.dataset.val, calories: parseFloat(p.dataset.extra) || 0}));
        
        const entry = {
            userId: currentUser.uid,
            date: getTodayStr(),
            mood: document.getElementById('mood')?.value || '',
            notes: document.getElementById('notes')?.value || '',
            foods: foodData,
            foodCaloriesTotal: foodData.reduce((s, f) => s + f.calories, 0),
            restroom: restroomData,
            urineTotal: restroomData.filter(t => t === 'Urine').length,
            stoolTotal: restroomData.filter(t => t === 'Stool').length,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        };

        if (todayDiaryDocId) await db.collection('diary').doc(todayDiaryDocId).update(entry);
        else await db.collection('diary').add(entry);
        
        alert("Saved!");
        updateDashboardStats();
    } catch (e) { alert("Error saving: " + e.message); }
}
