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

// Declare variables outside the try block
let app, auth, db;
let firebaseInitialized = false;

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
         document.body.innerHTML = '<h1 style="color: red; text-align: center; margin-top: 50px;">Error initializing application. Please check console and Firebase config.</h1>';
    });
}


// --- STATE VARIABLES ---
let currentUser = null;
let userProfile = {};
let todayDiaryDocId = null;
let calendarInstance = null;
let userEntryDates = [];
let calendarModal = null;
let settingsModal = null;
let dashboardInitialized = false;

// --- UTILITY FUNCTIONS ---
const getYYYYMMDD = (date) => { const year = date.getFullYear(); const month = (date.getMonth() + 1).toString().padStart(2, '0'); const day = date.getDate().toString().padStart(2, '0'); return `${year}-${month}-${day}`; };
const getTodayDateString = () => getYYYYMMDD(new Date());
const getYesterdayDateString = () => { const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1); return getYYYYMMDD(yesterday); };
const showMessage = (element, message, type = 'success') => { if (element) { element.textContent = message; element.className = type === 'success' ? 'success-message' : 'error-message'; setTimeout(() => { if (element) { element.textContent = ''; } }, 3000); } };

// --- MAIN APP LOGIC ---
const main = () => {
    console.log("main() called");
    if (!firebaseInitialized || !auth) {
        console.error("Firebase not initialized correctly. Auth listener not set up.");
        return;
    }

    auth.onAuthStateChanged(user => {
        console.log("onAuthStateChanged triggered. User:", user ? user.uid : 'null');
        currentUser = user;
        const currentPath = window.location.pathname; // Get the full path

        // Define base URLs
        const baseURL = "/weightdiary/"; // Adjust if your repo name changes or it's not at the root of gh-pages
        const dashboardURL = baseURL + "dashboard.html";
        const indexURL = baseURL; // Assuming index.html is the root

        if (currentUser) {
            // If logged in, should be on dashboard
            // Check if NOT already on dashboard (or a subpath if applicable)
            if (!currentPath.endsWith(dashboardURL)) {
                 console.log(`User logged in, redirecting from ${currentPath} to dashboard...`);
                 window.location.href = dashboardURL; // Use full URL for reliability
            } else {
                 // Already on dashboard, initialize it if needed
                 console.log("User logged in on dashboard page.");
                 if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', initializeAppDashboard); }
                 else { initializeAppDashboard(); }
            }
        } else {
            // If logged out, should be on index/auth page
            // Check if NOT already on the index page (or root)
             if (!currentPath.endsWith(indexURL) && !currentPath.endsWith(indexURL + "index.html")) {
                 console.log(`User logged out, redirecting from ${currentPath} to index...`);
                 window.location.href = indexURL; // Use full URL
             } else {
                  // Already on index page, initialize auth forms if needed
                  console.log("User logged out on index page.");
                  dashboardInitialized = false; // Reset dashboard flag on logout
                  calendarInstance = null; // Reset calendar
                  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', initializeAuthForms); }
                  else { initializeAuthForms(); }
             }
        }
    });
    console.log("Auth listener attached.");
};


const initializeAuthForms = () => {
    // ... (rest of function is unchanged) ...
};

const initializeAppDashboard = () => {
    // ... (rest of function is unchanged) ...
};

// --- DATA FUNCTIONS (FIRESTORE) ---
const loadUserProfile = async () => { /* ... unchanged ... */ };
const saveSettings = async () => { /* ... unchanged ... */ };
const loadTodaysDiary = async () => { /* ... unchanged ... */ };
const saveDiaryEntry = async () => { /* ... unchanged ... */ };
const updateDashboard = async () => { /* ... unchanged ... */ };

// --- PAST ENTRIES FUNCTIONS ---
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
const renderFoodPill = (foodName) => { /* ... unchanged ... */ };
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
