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

// Declare variables
let app, auth, db;
let firebaseInitialized = false;
let currentUser = null;
let userProfile = {};
let todayDiaryDocId = null;
let calendarInstance = null;
let userEntryDates = [];
let calendarModal = null;
let settingsModal = null;
let dashboardInitialized = false;
let authFormsInitialized = false;
let latestWeightLbs = 0; // Global for calculations

// Initialize Firebase
try {
    app = firebase.initializeApp(firebaseConfig);
    auth = firebase.auth();
    db = firebase.firestore();
    firebaseInitialized = true;
    console.log("Firebase initialized successfully.");
} catch (error) {
    console.error("FATAL ERROR - Firebase initialization failed:", error);
}

// MET Values for Calorie Burn
const MET_VALUES = { Walking: 4.0, Running: 9.0, Elliptical: 5.0, Swimming: 6.0, Weightlifting: 4.5 };
const LBS_TO_KG = 0.453592;

// --- UTILITY FUNCTIONS ---
const getYYYYMMDD = (date) => {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const day = d.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
};
const getTodayDateString = () => getYYYYMMDD(new Date());
const getYesterdayDateString = () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return getYYYYMMDD(yesterday);
};
const showMessage = (element, message, type = 'success') => {
    if (element) {
        element.textContent = message;
        element.className = type === 'success' ? 'success-message' : 'error-message';
        setTimeout(() => { element.textContent = ''; }, 3000);
    }
};

const calculateCaloriesBurned = (exerciseType, minutes, weightLbs) => {
    const met = MET_VALUES[exerciseType] || 3.0;
    const weightKg = weightLbs * LBS_TO_KG;
    const hours = minutes / 60;
    if (weightKg <= 0 || hours <= 0) return 0;
    return Math.round(met * weightKg * hours);
};

// --- MAIN APP LOGIC ---
const main = () => {
    if (!firebaseInitialized || !auth) return;

    auth.onAuthStateChanged(user => {
        currentUser = user;
        const currentPath = window.location.pathname;
        const isDashboard = currentPath.includes("dashboard.html");

        if (currentUser) {
            if (!isDashboard) {
                window.location.href = "dashboard.html";
            } else {
                initializeAppDashboard();
            }
        } else {
            if (isDashboard) window.location.href = "index.html";
            else initializeAuthForms();
        }
    });
};

const initializeAuthForms = () => {
    if (authFormsInitialized) return;
    const loginBtn = document.getElementById('login-btn');
    if (!loginBtn) return;

    loginBtn.addEventListener('click', () => {
        const email = document.getElementById('login-email').value;
        const pass = document.getElementById('login-password').value;
        auth.signInWithEmailAndPassword(email, pass).catch(err => alert(err.message));
    });
    authFormsInitialized = true;
};

const initializeAppDashboard = () => {
    if (dashboardInitialized) return;
    
    document.getElementById('user-email').textContent = currentUser.email;
    document.getElementById('logout-btn').addEventListener('click', () => auth.signOut());

    // UI Listeners
    document.getElementById('add-food-btn').addEventListener('click', addFoodItemToUI);
    document.getElementById('add-water-btn').addEventListener('click', addWaterItemToUI);
    document.getElementById('add-exercise-btn').addEventListener('click', addExerciseItemToUI);
    document.getElementById('add-restroom-btn').addEventListener('click', addRestroomItemToUI);
    document.getElementById('save-diary-btn').addEventListener('click', saveDiaryEntry);
    document.getElementById('open-settings-btn').addEventListener('click', openSettingsModal);
    document.getElementById('open-calendar-btn').addEventListener('click', openCalendarModal);
    
    document.getElementById('record-weight-check').addEventListener('change', (e) => {
        document.getElementById('weight-input-container').style.display = e.target.checked ? 'block' : 'none';
    });

    loadUserProfile();
    loadTodaysDiary();
    dashboardInitialized = true;
};

// --- DATA FUNCTIONS ---
const loadUserProfile = async () => {
    try {
        const userDoc = await db.collection('users').doc(currentUser.uid).get();
        if (userDoc.exists) {
            userProfile = userDoc.data();
            updateDashboard();
        }
    } catch (error) { console.error("Error loading profile:", error); }
};

const loadTodaysDiary = async () => {
    const today = getTodayDateString();
    try {
        const q = db.collection('diary').where('userId', '==', currentUser.uid).where('date', '==', today).limit(1);
        const snapshot = await q.get();
        if (!snapshot.empty) {
            const data = snapshot.docs[0].data();
            todayDiaryDocId = snapshot.docs[0].id;
            if (data.weight) {
                document.getElementById('record-weight-check').checked = true;
                document.getElementById('weight-input-container').style.display = 'block';
                document.getElementById('weight').value = data.weight;
            }
            document.getElementById('mood').value = data.mood || '';
            document.getElementById('notes').value = data.notes || '';
            data.foods?.forEach(f => renderFoodPill(f.name, f.calories));
            data.water?.forEach(w => renderWaterPill(w));
            data.exercises?.forEach(ex => renderExercisePill(ex.type, ex.minutes, ex.calories));
            data.restroom?.forEach(r => renderRestroomPill(r));
            updateAllTotals();
        }
    } catch (error) { console.error("Error loading today:", error); }
};

const updateDashboard = async () => {
    const startWeightEl = document.getElementById('stat-starting-weight');
    const currentWeightEl = document.getElementById('stat-current-weight');
    const totalLossEl = document.getElementById('stat-total-loss');

    const startWeight = parseFloat(userProfile.startingWeight) || 0;
    if (startWeightEl) startWeightEl.textContent = `${startWeight.toFixed(1)} lbs`;

    try {
        // Find most recent weight across all entries
        const weightQuery = db.collection('diary')
            .where('userId', '==', currentUser.uid)
            .where('weight', '>', 0)
            .orderBy('weight') 
            .orderBy('date', 'desc')
            .limit(1);

        const weightSnapshot = await weightQuery.get();
        let currentWeight = startWeight;

        if (!weightSnapshot.empty) {
            currentWeight = weightSnapshot.docs[0].data().weight;
        }

        latestWeightLbs = currentWeight;
        if (currentWeightEl) currentWeightEl.textContent = `${currentWeight.toFixed(1)} lbs`;

        const totalLoss = startWeight - currentWeight;
        if (totalLossEl) {
            totalLossEl.textContent = `${totalLoss.toFixed(1)} lbs`;
            totalLossEl.style.color = totalLoss >= 0 ? '#28a745' : '#d93025';
        }

        // Fetch Yesterday's data
        const yesterday = getYesterdayDateString();
        const ySnap = await db.collection('diary').where('userId', '==', currentUser.uid).where('date', '==', yesterday).limit(1).get();
        if (!ySnap.empty) {
            const yData = ySnap.docs[0].data();
            document.getElementById('stat-yesterday-water').textContent = `${yData.waterTotal || 0} oz`;
            document.getElementById('stat-yesterday-calories').textContent = yData.foodCaloriesTotal || 0;
            document.getElementById('stat-yesterday-cal-burned').textContent = yData.exerciseCaloriesTotal || 0;
        }
    } catch (error) {
        console.error("Dashboard update error (Check if Index is needed):", error);
    }
};

const saveDiaryEntry = async () => {
    const isWeightChecked = document.getElementById('record-weight-check').checked;
    const weightVal = parseFloat(document.getElementById('weight').value);
    
    const foods = Array.from(document.querySelectorAll('#food-list .food-pill')).map(p => ({ name: p.dataset.name, calories: parseFloat(p.dataset.calories) }));
    const water = Array.from(document.querySelectorAll('#water-list .water-pill')).map(p => parseFloat(p.dataset.ounces));
    const exercises = Array.from(document.querySelectorAll('#exercise-list .exercise-pill')).map(p => ({ type: p.dataset.type, minutes: parseFloat(p.dataset.minutes), calories: parseFloat(p.dataset.calories) }));
    const restroom = Array.from(document.querySelectorAll('#restroom-list .restroom-pill')).map(p => p.dataset.type);

    const entryData = {
        userId: currentUser.uid,
        date: getTodayDateString(),
        mood: document.getElementById('mood').value,
        notes: document.getElementById('notes').value,
        foods,
        foodCaloriesTotal: foods.reduce((s, f) => s + f.calories, 0),
        water,
        waterTotal: water.reduce((s, w) => s + w, 0),
        exercises,
        exerciseMinutesTotal: exercises.reduce((s, e) => s + e.minutes, 0),
        exerciseCaloriesTotal: exercises.reduce((s, e) => s + e.calories, 0),
        restroom,
        urineTotal: restroom.filter(r => r === 'Urine').length,
        stoolTotal: restroom.filter(r => r === 'Stool').length,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    };

    if (isWeightChecked && !isNaN(weightVal)) entryData.weight = weightVal;

    try {
        if (todayDiaryDocId) await db.collection('diary').doc(todayDiaryDocId).update(entryData);
        else {
            const newDoc = await db.collection('diary').add(entryData);
            todayDiaryDocId = newDoc.id;
        }
        alert("Saved successfully!");
        updateDashboard();
    } catch (err) { alert("Save error: " + err.message); }
};

// --- UI PILL HELPERS ---
function addFoodItemToUI() {
    const name = document.getElementById('food-input').value;
    const cal = parseFloat(document.getElementById('food-calories').value) || 0;
    if (name) { renderFoodPill(name, cal); updateAllTotals(); document.getElementById('food-input').value = ''; }
}

function renderFoodPill(name, calories) {
    const container = document.getElementById('food-list');
    const pill = document.createElement('div');
    pill.className = 'food-pill'; pill.dataset.name = name; pill.dataset.calories = calories;
    pill.innerHTML = `${name} (${calories} cal) <span onclick="this.parentElement.remove();updateAllTotals()">x</span>`;
    container.appendChild(pill);
}

function addWaterItemToUI() {
    const oz = parseFloat(document.getElementById('water-input').value);
    if (oz) { renderWaterPill(oz); updateAllTotals(); document.getElementById('water-input').value = ''; }
}

function renderWaterPill(oz) {
    const container = document.getElementById('water-list');
    const pill = document.createElement('div');
    pill.className = 'water-pill'; pill.dataset.ounces = oz;
    pill.innerHTML = `${oz} oz <span onclick="this.parentElement.remove();updateAllTotals()">x</span>`;
    container.appendChild(pill);
}

function addExerciseItemToUI() {
    const type = document.getElementById('exercise-type').value;
    const min = parseFloat(document.getElementById('exercise-minutes').value);
    if (min) {
        const cals = calculateCaloriesBurned(type, min, latestWeightLbs);
        renderExercisePill(type, min, cals);
        updateAllTotals();
        document.getElementById('exercise-minutes').value = '';
    }
}

function renderExercisePill(type, min, cals) {
    const container = document.getElementById('exercise-list');
    const pill = document.createElement('div');
    pill.className = 'exercise-pill'; pill.dataset.type = type; pill.dataset.minutes = min; pill.dataset.calories = cals;
    pill.innerHTML = `${type}: ${min}m (~${cals} cal) <span onclick="this.parentElement.remove();updateAllTotals()">x</span>`;
    container.appendChild(pill);
}

function addRestroomItemToUI() {
    const type = document.getElementById('restroom-type').value;
    renderRestroomPill(type);
    updateAllTotals();
}

function renderRestroomPill(type) {
    const container = document.getElementById('restroom-list');
    const pill = document.createElement('div');
    pill.className = 'restroom-pill'; pill.dataset.type = type;
    pill.innerHTML = `${type} <span onclick="this.parentElement.remove();updateAllTotals()">x</span>`;
    container.appendChild(pill);
}

function updateAllTotals() {
    const foods = Array.from(document.querySelectorAll('#food-list .food-pill')).reduce((s, p) => s + parseFloat(p.dataset.calories), 0);
    const water = Array.from(document.querySelectorAll('#water-list .water-pill')).reduce((s, p) => s + parseFloat(p.dataset.ounces), 0);
    const restroom = Array.from(document.querySelectorAll('#restroom-list .restroom-pill'));
    
    document.getElementById('food-total-today').textContent = foods;
    document.getElementById('water-total-today').textContent = water;
    document.getElementById('urine-count').textContent = restroom.filter(p => p.dataset.type === 'Urine').length;
    document.getElementById('stool-count').textContent = restroom.filter(p => p.dataset.type === 'Stool').length;
}

// --- MODALS ---
function openSettingsModal() { 
    document.getElementById('starting-weight').value = userProfile.startingWeight || '';
    document.getElementById('goal-weight').value = userProfile.goalWeight || '';
    document.getElementById('weekly-loss-goal').value = userProfile.desiredWeeklyLoss || '';
    document.getElementById('settings-modal').style.display = 'flex'; 
}

function openCalendarModal() { /* Calendar logic here */ document.getElementById('calendar-modal').style.display = 'flex'; }

// Start
main();
