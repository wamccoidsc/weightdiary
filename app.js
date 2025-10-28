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
//

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

// Initialize Firebase
try {
    app = firebase.initializeApp(firebaseConfig);
    auth = firebase.auth();
    db = firebase.firestore();
    firebaseInitialized = true;
    console.log("Firebase initialized successfully.");
} catch (error) {
    console.error("FATAL ERROR - Firebase initialization failed:", error);
    document.addEventListener('DOMContentLoaded', () => {
         if(document.body) { document.body.innerHTML = '<h1 style="color: red; text-align: center; margin-top: 50px;">Error initializing application. Please check console and Firebase config.</h1>'; }
    });
}

// --- UTILITY FUNCTIONS ---
const getYYYYMMDD = (date) => { const year = date.getFullYear(); const month = (date.getMonth() + 1).toString().padStart(2, '0'); const day = date.getDate().toString().padStart(2, '0'); return `${year}-${month}-${day}`; };
const getTodayDateString = () => getYYYYMMDD(new Date());
const getYesterdayDateString = () => { const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1); return getYYYYMMDD(yesterday); };
const showMessage = (element, message, type = 'success') => { if (element) { element.textContent = message; element.className = type === 'success' ? 'success-message' : 'error-message'; setTimeout(() => { if (element) { element.textContent = ''; } }, 3000); } };

// --- MAIN APP LOGIC ---
const main = () => {
    console.log("main() called");
    if (!firebaseInitialized || !auth) { console.error("Firebase not initialized correctly. Cannot proceed."); return; }

    auth.onAuthStateChanged(user => {
        console.log("onAuthStateChanged triggered. User:", user ? user.uid : 'null');
        currentUser = user;
        const currentPath = window.location.pathname;
        const baseURL = "/weightdiary/"; // Adjust if needed
        const dashboardURL = baseURL + "dashboard.html";
        const indexURLBase = baseURL;
        const indexURLExplicit = baseURL + "index.html";

        if (currentUser) {
            authFormsInitialized = false;
            if (!currentPath.endsWith(dashboardURL)) {
                 console.log(`User logged in, redirecting from ${currentPath} to dashboard...`);
                 window.location.href = dashboardURL;
            } else {
                 console.log("User on dashboard page.");
                 if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', initializeAppDashboard); }
                 else if (!dashboardInitialized) { console.log("DOM ready, initializing dashboard."); initializeAppDashboard(); }
                 else { console.log("Dashboard already initialized, refreshing data only."); loadUserProfile(); loadTodaysDiary(); /* loadPastEntries(getYesterdayDateString()); */ } // Also commented out refresh here for now
            }
        } else {
            dashboardInitialized = false; calendarInstance = null;
            if (!currentPath.endsWith(indexURLBase) && !currentPath.endsWith(indexURLExplicit)) {
                 console.log(`User logged out, redirecting from ${currentPath} to index...`);
                 window.location.href = indexURLBase;
             } else {
                  console.log("User on index/auth page.");
                  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', initializeAuthForms); }
                  else if (!authFormsInitialized) { console.log("DOM ready, initializing auth forms."); initializeAuthForms(); }
                  else { console.log("Auth forms already initialized for this state."); }
             }
        }
    });
    console.log("Auth listener attached.");
};

const initializeAuthForms = () => {
    console.log("Attempting to initialize Auth Forms...");
    if (authFormsInitialized) { console.log("Auth forms already initialized for this view state."); return; }
    const loginBtn = document.getElementById('login-btn'); const signupBtn = document.getElementById('signup-btn'); const showSignup = document.getElementById('show-signup'); const showLogin = document.getElementById('show-login'); const loginForm = document.getElementById('login-form'); const signupForm = document.getElementById('signup-form'); const loginError = document.getElementById('login-error'); const signupError = document.getElementById('signup-error');
    if(!loginBtn || !signupBtn || !showSignup || !showLogin || !loginForm || !signupForm || !loginError || !signupError) { console.error("One or more auth form elements missing during init. Cannot attach listeners."); return; }
    console.log("All auth form elements found.");
    try {
        showSignup.addEventListener('click', (e) => { e.preventDefault(); loginForm.style.display = 'none'; signupForm.style.display = 'block'; });
        showLogin.addEventListener('click', (e) => { e.preventDefault(); signupForm.style.display = 'none'; loginForm.style.display = 'block'; });
        loginBtn.addEventListener('click', () => { console.log("Login button clicked!"); const email = document.getElementById('login-email').value; const pass = document.getElementById('login-password').value; if (!email || !pass) { showMessage(loginError, "Please enter email and password.", 'error'); return; } console.log("Attempting login for:", email); auth.signInWithEmailAndPassword(email, pass) .then((userCredential) => { console.log("Login successful:", userCredential.user.uid); }).catch(err => { console.error("Login failed:", err); showMessage(loginError, err.message, 'error'); }); });
        signupBtn.addEventListener('click', () => { console.log("Signup button clicked!"); const email = document.getElementById('signup-email').value; const pass = document.getElementById('signup-password').value; if (!email || !pass) { showMessage(signupError, "Please enter email and password.", 'error'); return; } console.log("Attempting signup for:", email); auth.createUserWithEmailAndPassword(email, pass) .then(userCredential => { console.log("Signup successful:", userCredential.user.uid); return db.collection('users').doc(userCredential.user.uid).set({ email: userCredential.user.email, startingWeight: 0, goalWeight: 0, desiredWeeklyLoss: 0, joined: firebase.firestore.FieldValue.serverTimestamp() }); }).catch(err => { console.error("Signup failed:", err); showMessage(signupError, err.message, 'error'); }); });
        authFormsInitialized = true;
        console.log("Auth form listeners attached successfully.");
    } catch (error) { console.error("Error attaching auth form listeners:", error); }
};

const initializeAppDashboard = () => {
     if (dashboardInitialized) { console.warn("Attempted to re-initialize dashboard. Exiting."); loadUserProfile(); loadTodaysDiary(); /* loadPastEntries(getYesterdayDateString()); */ return; } // Also commented out refresh here for now
     console.log("Initializing Dashboard for the first time...");
    if (!currentUser) { console.error("initializeAppDashboard: currentUser is null."); return; }
     console.log("Current user confirmed:", currentUser.uid);
    const userEmailEl = document.getElementById('user-email'); if (!userEmailEl) { console.error("Could not find 'user-email'."); } else { userEmailEl.textContent = currentUser.email || 'No Email'; }
    const logoutBtn = document.getElementById('logout-btn'); if (logoutBtn) logoutBtn.addEventListener('click', () => auth.signOut()); else console.error("Could not find logout-btn");
    const diaryTitleEl = document.getElementById('diary-title'); if(diaryTitleEl) diaryTitleEl.textContent = `Today's Entry (${getTodayDateString()})`; else console.error("Could not find 'diary-title'.");
    console.log("Loading initial data (excluding past entries for now)...");
    loadUserProfile();
    loadTodaysDiary();
    // loadPastEntries(getYesterdayDateString()); // <--- TEMPORARILY COMMENTED OUT
    console.log("Getting modal elements...");
    calendarModal = document.getElementById('calendar-modal'); settingsModal = document.getElementById('settings-modal');
    if (!calendarModal || !settingsModal) { console.error("Could not find modal elements!"); } else { console.log("Modal elements found."); }
     console.log("Attaching event listeners...");
     try {
        // Attach listeners...
        const saveSettingsBtn = document.getElementById('save-settings-btn'); if (saveSettingsBtn) saveSettingsBtn.addEventListener('click', saveSettings); else console.error("Could not find save-settings-btn");
        const weightCheck = document.getElementById('record-weight-check'); const weightContainer = document.getElementById('weight-input-container'); if (weightCheck && weightContainer) { weightCheck.addEventListener('change', () => { weightContainer.style.display = weightCheck.checked ? 'block' : 'none'; if (!weightCheck.checked) { document.getElementById('weight').value = ''; } }); } else console.warn("Weight check/container elements missing");
        const addFoodBtn = document.getElementById('add-food-btn'); if(addFoodBtn) addFoodBtn.addEventListener('click', addFoodItemToUI); else console.error("Could not find add-food-btn");
        const foodInput = document.getElementById('food-input'); if(foodInput) foodInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') { e.preventDefault(); addFoodItemToUI(); } }); else console.error("Could not find food-input");
        const addWaterBtn = document.getElementById('add-water-btn'); if(addWaterBtn) addWaterBtn.addEventListener('click', addWaterItemToUI); else console.error("Could not find add-water-btn");
        const waterInput = document.getElementById('water-input'); if(waterInput) waterInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') { e.preventDefault(); addWaterItemToUI(); } }); else console.error("Could not find water-input");
        const addExerciseBtn = document.getElementById('add-exercise-btn'); if(addExerciseBtn) addExerciseBtn.addEventListener('click', addExerciseItemToUI); else console.error("Could not find add-exercise-btn");
        const exerciseMinutesInput = document.getElementById('exercise-minutes'); if(exerciseMinutesInput) exerciseMinutesInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') { e.preventDefault(); addExerciseItemToUI(); } }); else console.error("Could not find exercise-minutes input");
        const saveDiaryBtn = document.getElementById('save-diary-btn'); if(saveDiaryBtn) saveDiaryBtn.addEventListener('click', saveDiaryEntry); else console.error("Could not find save-diary-btn");
        const openCalendarBtn = document.getElementById('open-calendar-btn'); if(openCalendarBtn) openCalendarBtn.addEventListener('click', openCalendarModal); else console.error("Could not find open-calendar-btn");
        const calendarCloseBtn = document.querySelector('#calendar-modal .modal-close-btn'); if(calendarCloseBtn) calendarCloseBtn.addEventListener('click', closeCalendarModal); else console.error("Could not find calendar close button");
        if(calendarModal) calendarModal.addEventListener('click', (event) => { if (event.target === calendarModal) { closeCalendarModal(); } });
        const openSettingsBtn = document.getElementById('open-settings-btn'); if(openSettingsBtn) openSettingsBtn.addEventListener('click', openSettingsModal); else console.error("Could not find open-settings-btn");
        const settingsCloseBtn = document.querySelector('#settings-modal .modal-close-btn'); if(settingsCloseBtn) settingsCloseBtn.addEventListener('click', closeSettingsModal); else console.error("Could not find settings close button");
        if(settingsModal) settingsModal.addEventListener('click', (event) => { if (event.target === settingsModal) { closeSettingsModal(); } });
        console.log("Event listeners attached.");

        // *** Calendar is initialized lazily in openCalendarModal ***

        dashboardInitialized = true; // Mark as initialized AFTER successful listener setup

    } catch (error) {
        console.error("Error attaching event listeners:", error);
        const diaryMsgEl = document.getElementById('diary-message');
        if (diaryMsgEl) showMessage(diaryMsgEl, "Error initializing page interactions.", "error");
    }
    console.log("initializeAppDashboard finished.");
};


// --- DATA FUNCTIONS (FIRESTORE) ---
const loadUserProfile = async () => {
    console.log("loadUserProfile: Starting...");
    userProfile = {}; // Initialize/reset
    try {
        if (!currentUser) throw new Error("currentUser is not defined");
        console.log("loadUserProfile: Fetching user doc for UID:", currentUser.uid);
        const userDoc = await db.collection('users').doc(currentUser.uid).get();
        if (userDoc.exists) {
            userProfile = userDoc.data();
            console.log("loadUserProfile: User profile FOUND:", userProfile);
            if (userProfile.joined && typeof userProfile.joined.toDate === 'function') { userProfile.joined = userProfile.joined.toDate(); }
            else { userProfile.joined = null; console.warn("User profile 'joined' field is missing or invalid."); }
            userProfile.startingWeight = userProfile.startingWeight || 0;
            userProfile.goalWeight = userProfile.goalWeight || 0;
            userProfile.desiredWeeklyLoss = userProfile.desiredWeeklyLoss || 0;

            console.log("loadUserProfile: Populating settings form...");
            const startWeightInput = document.getElementById('starting-weight');
            const goalWeightInput = document.getElementById('goal-weight');
            const weeklyLossInput = document.getElementById('weekly-loss-goal');
            if(startWeightInput) startWeightInput.value = userProfile.startingWeight; else console.warn("startWeightInput not found");
            if(goalWeightInput) goalWeightInput.value = userProfile.goalWeight; else console.warn("goalWeightInput not found");
            if(weeklyLossInput) weeklyLossInput.value = userProfile.desiredWeeklyLoss; else console.warn("weeklyLossInput not found");
            console.log("loadUserProfile: Settings form populated.");

        } else {
             console.error("loadUserProfile: User profile document does NOT exist for UID:", currentUser.uid);
             userProfile = { startingWeight: 0, goalWeight: 0, desiredWeeklyLoss: 0, joined: null };
        }
    } catch (error) {
        console.error("loadUserProfile: CATCH block error:", error);
         userProfile = { startingWeight: 0, goalWeight: 0, desiredWeeklyLoss: 0, joined: null };
    } finally {
        console.log("loadUserProfile: FINALLY block reached. Calling updateDashboard...");
        updateDashboard(); // Always update dashboard after attempting to load profile
        console.log("loadUserProfile: updateDashboard call finished.");
    }
};

const saveSettings = async () => { /* ... unchanged ... */ };
const loadTodaysDiary = async () => { /* ... unchanged ... */ };
const saveDiaryEntry = async () => { /* ... unchanged ... */ };
const updateDashboard = async () => { /* ... unchanged ... */ };
const loadPastEntries = async (dateString) => { /* ... unchanged ... */ };
const renderPastEntry = (data) => { /* ... unchanged ... */ };

// --- CALENDAR & MODAL FUNCTIONS ---
const fetchUserEntryDatesAndUpdateCalendar = async () => { /* ... unchanged ... */ };
const openCalendarModal = async () => { /* ... unchanged ... */ };
const closeCalendarModal = () => { /* ... unchanged ... */ };
const openSettingsModal = () => { /* ... unchanged ... */ };
const closeSettingsModal = () => { /* ... unchanged ... */ };

// --- UI HELPER FUNCTIONS ---
const addFoodItemToUI = () => { /* ... unchanged ... */ };
const renderFoodPill = (foodName, calories) => { /* ... unchanged ... */ };
const updateTodayFoodTotal = () => { /* ... unchanged ... */ };
const addWaterItemToUI = () => { /* ... unchanged ... */ };
const renderWaterPill = (ounces) => { /* ... unchanged ... */ };
const updateTodayWaterTotal = () => { /* ... unchanged ... */ };
const addExerciseItemToUI = () => { /* ... unchanged ... */ };
const renderExercisePill = (type, minutes) => { /* ... unchanged ... */ };
const updateTodayExerciseTotal = () => { /* ... unchanged ... */ };

// --- RUN THE APP ---
if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', main); }
else { main(); }
console.log("Initial script setup finished, waiting for DOM/Auth...");
