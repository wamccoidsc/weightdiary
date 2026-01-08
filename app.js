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
let userEntryDates = [];
let calendarInstance = null;

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
    if (dashboardInitialized) return;
    console.log("Dashboard Initializing...");
    
    // Set Email
    if(document.getElementById('user-email')) document.getElementById('user-email').textContent = currentUser.email;

    // Attach Listeners with Safety
    const listen = (id, evt, fn) => document.getElementById(id)?.addEventListener(evt, fn);
    
    listen('logout-btn', 'click', () => auth.signOut());
    listen('add-food-btn', 'click', addFood);
    listen('add-water-btn', 'click', addWater);
    listen('add-exercise-btn', 'click', addExercise);
    listen('save-diary-btn', 'click', saveDiaryEntry);
    listen('open-calendar-btn', 'click', openCalendarModal);
    listen('open-settings-btn', 'click', () => {
        const m = document.getElementById('settings-modal');
        if(m) m.style.display = 'flex';
    });

    // Close Modals
    document.querySelectorAll('.modal-close-btn, .settings-modal-close-btn').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.modal-overlay').forEach(m => m.style.display = 'none');
        };
    });

    listen('record-weight-check', 'change', (e) => {
        const cont = document.getElementById('weight-input-container');
        if (cont) cont.style.display = e.target.checked ? 'block' : 'none';
    });

    loadProfile();
    loadToday();
    fetchUserEntryDates(); // Load calendar dots
    dashboardInitialized = true;
}

// --- DATA FETCHING ---
async function loadProfile() {
    try {
        const doc = await db.collection('users').doc(currentUser.uid).get();
        if (doc.exists) {
            userProfile = doc.data();
            updateDashboardStats();
        }
    } catch (e) { console.error("Profile Error:", e); }
}

async function loadToday() {
    try {
        const today = getTodayStr();
        const snap = await db.collection('diary').where('userId', '==', currentUser.uid).where('date', '==', today).get();
        
        // Clear lists
        ['food-list', 'water-list', 'exercise-list'].forEach(id => {
            const el = document.getElementById(id);
            if(el) el.innerHTML = '';
        });

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

// --- CALENDAR LOGIC ---
async function fetchUserEntryDates() {
    try {
        const snap = await db.collection('diary').where('userId', '==', currentUser.uid).get();
        userEntryDates = snap.docs.map(doc => doc.data().date);
        console.log("Found entries for dates:", userEntryDates);
    } catch (e) { console.error("Calendar Fetch Error:", e); }
}

function openCalendarModal() {
    const modal = document.getElementById('calendar-modal');
    if(modal) modal.style.display = 'flex';
    
    if (typeof flatpickr !== 'undefined') {
        if (!calendarInstance) {
            calendarInstance = flatpickr("#calendar-container", {
                inline: true,
                maxDate: "today",
                onDayCreate: (d, dStr, fp, dayElem) => {
                    // Normalize date for comparison
                    const dateObj = dayElem.dateObj;
                    const dateStr = dateObj.getFullYear() + "-" + 
                                    String(dateObj.getMonth() + 1).padStart(2, '0') + "-" + 
                                    String(dateObj.getDate()).padStart(2, '0');
                    if (userEntryDates.includes(dateStr)) {
                        dayElem.innerHTML += "<span class='calendar-dot'>.</span>";
                        dayElem.classList.add("has-entry");
                    }
                },
                onChange: (selectedDates) => {
                    const dateObj = selectedDates[0];
                    const dateStr = dateObj.getFullYear() + "-" + 
                                    String(dateObj.getMonth() + 1).padStart(2, '0') + "-" + 
                                    String(dateObj.getDate()).padStart(2, '0');
                    loadPastEntry(dateStr);
                }
            });
        } else {
            calendarInstance.redraw();
        }
    }
}

async function loadPastEntry(dateStr) {
    const list = document.getElementById('past-entries-list');
    if(!list) return;
    list.innerHTML = "Loading...";
    const snap = await db.collection('diary').where('userId', '==', currentUser.uid).where('date', '==', dateStr).get();
    if (snap.empty) {
        list.innerHTML = `<p>No entry for ${dateStr}.</p>`;
    } else {
        const data = snap.docs[0].data();
        list.innerHTML = `
            <div class="entry-card">
                <h3>${data.date}</h3>
                <p><strong>Weight:</strong> ${data.weight || '--'} lbs</p>
                <p><strong>Notes:</strong> ${data.notes || 'None'}</p>
            </div>`;
    }
}

// --- DASHBOARD UPDATES ---
async function updateDashboardStats() {
    try {
        const startWeight = parseFloat(userProfile.startingWeight) || 0;
        const goalWeight = parseFloat(userProfile.goalWeight) || 0;
        const weeklyLoss = parseFloat(userProfile.desiredWeeklyLoss) || 0;

        const diarySnap = await db.collection('diary')
            .where('userId', '==', currentUser.uid)
            .orderBy('date', 'desc')
            .limit(50).get();

        let current = startWeight; 
        if (!diarySnap.empty) {
            for (const doc of diarySnap.docs) {
                const d = doc.data();
                if (d.weight && parseFloat(d.weight) > 0) {
                    current = parseFloat(d.weight);
                    break; 
                }
            }
        }
        
        latestWeightLbs = current;

        const setStat = (id, val) => { if (document.getElementById(id)) document.getElementById(id).textContent = val; };
        
        setStat('stat-starting-weight', startWeight.toFixed(1) + " lbs");
        setStat('stat-current-weight', current.toFixed(1) + " lbs");
        setStat('stat-goal-weight', goalWeight.toFixed(1) + " lbs");
        
        const loss = startWeight - current;
        const lossEl = document.getElementById('stat-total-loss');
        if (lossEl) {
            lossEl.textContent = loss.toFixed(1) + " lbs";
            lossEl.style.color = loss >= 0 ? '#28a745' : '#d93025';
        }

        // GOAL DATE CALCULATION
        const goalDateEl = document.getElementById('stat-goal-date');
        if (goalDateEl) {
            if (goalWeight > 0 && weeklyLoss > 0 && current > goalWeight) {
                const lbsToGo = current - goalWeight;
                const daysToGo = Math.ceil((lbsToGo / weeklyLoss) * 7);
                const target = new Date();
                target.setDate(target.getDate() + daysToGo);
                goalDateEl.textContent = target.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
            } else {
                goalDateEl.textContent = "--";
            }
        }

        // Yesterday Summary
        const ySnap = await db.collection('diary').where('userId', '==', currentUser.uid).where('date', '==', getYesterdayStr()).get();
        if (!ySnap.empty) {
            const y = ySnap.docs[0].data();
            setStat('stat-yesterday-water', (y.waterTotal || 0) + " oz");
            setStat('stat-yesterday-calories', y.foodCaloriesTotal || 0);
            setStat('stat-yesterday-cal-burned', y.exerciseCaloriesTotal || 0);
        }
    } catch (e) { console.error("Stats Error:", e); }
}

// --- UI HELPERS ---
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
    pill.innerHTML = `<span>${label} ${extra ? '(' + extra + ')' : ''}</span> <span class="remove-pill" style="cursor:pointer;margin-left:8px;font-weight:bold;">x</span>`;
    pill.querySelector('.remove-pill').onclick = () => { pill.remove(); updateTotalsUI(); };
    container.appendChild(pill);
}

function updateTotalsUI() {
    const foodTotal = Array.from(document.querySelectorAll('.food-pill')).reduce((s, p) => s + (parseFloat(p.dataset.extra) || 0), 0);
    const waterTotal = Array.from(document.querySelectorAll('.water-pill')).reduce((s, p) => s + (parseFloat(p.dataset.label) || 0), 0);
    if (document.getElementById('food-total-today')) document.getElementById('food-total-today').textContent = foodTotal;
    if (document.getElementById('water-total-today')) document.getElementById('water-total-today').textContent = waterTotal;
}

async function saveDiaryEntry() {
    console.log("Save Button Clicked");
    try {
        const foodData = Array.from(document.querySelectorAll('.food-pill')).map(p => ({ name: p.dataset.label, calories: parseFloat(p.dataset.extra) || 0 }));
        const waterData = Array.from(document.querySelectorAll('.water-pill')).map(p => parseFloat(p.dataset.label));
        const exerciseData = Array.from(document.querySelectorAll('.exercise-pill')).map(p => {
            const mins = parseFloat(p.dataset.extra.replace('m', '')) || 0;
            const type = p.dataset.label;
            return { type: type, minutes: mins, calories: Math.round((MET_VALUES[type] || 3.0) * (latestWeightLbs * LBS_TO_KG) * (mins / 60)) };
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
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        };

        const weightInput = document.getElementById('weight');
        if (document.getElementById('record-weight-check')?.checked && weightInput?.value) {
            entry.weight = parseFloat(weightInput.value);
        }

        if (todayDiaryDocId) {
            await db.collection('diary').doc(todayDiaryDocId).set(entry, { merge: true });
        } else {
            const res = await db.collection('diary').add(entry);
            todayDiaryDocId = res.id;
        }
        
        alert("Saved!");
        fetchUserEntryDates(); // Update dots
        updateDashboardStats(); // Update goal date & current weight
    } catch (e) { 
        console.error("Save Error:", e);
        alert("Error saving: " + e.message); 
    }
}
