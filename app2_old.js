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
                 else { console.log("Dashboard already initialized, refreshing data only."); loadUserProfile(); loadTodaysDiary(); loadPastEntries(getYesterdayDateString()); }
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
     if (dashboardInitialized) { console.warn("Attempted to re-initialize dashboard. Exiting."); loadUserProfile(); loadTodaysDiary(); loadPastEntries(getYesterdayDateString()); return; }
     console.log("Initializing Dashboard for the first time...");
    if (!currentUser) { console.error("initializeAppDashboard: currentUser is null."); return; }
     console.log("Current user confirmed:", currentUser.uid);
    const userEmailEl = document.getElementById('user-email'); if (!userEmailEl) { console.error("Could not find 'user-email'."); } else { userEmailEl.textContent = currentUser.email || 'No Email'; }
    const logoutBtn = document.getElementById('logout-btn'); if (logoutBtn) logoutBtn.addEventListener('click', () => auth.signOut()); else console.error("Could not find logout-btn");
    const diaryTitleEl = document.getElementById('diary-title'); if(diaryTitleEl) diaryTitleEl.textContent = `Today's Entry (${getTodayDateString()})`; else console.error("Could not find 'diary-title'.");
    console.log("Loading initial data...");
    loadUserProfile(); loadTodaysDiary(); loadPastEntries(getYesterdayDateString());
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
        dashboardInitialized = true; // Mark as initialized AFTER successful listener setup
    } catch (error) {
        console.error("Error attaching event listeners:", error);
        const diaryMsgEl = document.getElementById('diary-message'); if (diaryMsgEl) showMessage(diaryMsgEl, "Error initializing page interactions.", "error");
    }
    console.log("initializeAppDashboard finished.");
};


// --- DATA FUNCTIONS (FIRESTORE) ---
const loadUserProfile = async () => {
    console.log("loadUserProfile: Starting..."); // LP1
    userProfile = {}; // Initialize/reset
    let profileDataFound = false;
    try {
        if (!currentUser) throw new Error("currentUser is not defined");
        console.log("loadUserProfile: Fetching user doc for UID:", currentUser.uid); // LP2
        const userDoc = await db.collection('users').doc(currentUser.uid).get();
        if (userDoc.exists) {
            userProfile = userDoc.data();
            profileDataFound = true;
            console.log("loadUserProfile: User profile FOUND:", userProfile); // LP3
            if (userProfile.joined && typeof userProfile.joined.toDate === 'function') { userProfile.joined = userProfile.joined.toDate(); }
            else { userProfile.joined = null; console.warn("User profile 'joined' field is missing or invalid."); }
            userProfile.startingWeight = userProfile.startingWeight || 0;
            userProfile.goalWeight = userProfile.goalWeight || 0;
            userProfile.desiredWeeklyLoss = userProfile.desiredWeeklyLoss || 0;

            console.log("loadUserProfile: Populating settings form..."); // LP4
            const startWeightInput = document.getElementById('starting-weight');
            const goalWeightInput = document.getElementById('goal-weight');
            const weeklyLossInput = document.getElementById('weekly-loss-goal');
            if(startWeightInput) startWeightInput.value = userProfile.startingWeight; else console.warn("startWeightInput not found");
            if(goalWeightInput) goalWeightInput.value = userProfile.goalWeight; else console.warn("goalWeightInput not found");
            if(weeklyLossInput) weeklyLossInput.value = userProfile.desiredWeeklyLoss; else console.warn("weeklyLossInput not found");
            console.log("loadUserProfile: Settings form populated."); // LP5

        } else {
             console.error("loadUserProfile: User profile document does NOT exist for UID:", currentUser.uid); // LP Error 1
             userProfile = { startingWeight: 0, goalWeight: 0, desiredWeeklyLoss: 0, joined: null };
        }
    } catch (error) {
        console.error("loadUserProfile: CATCH block error:", error); // LP Error 2
         userProfile = { startingWeight: 0, goalWeight: 0, desiredWeeklyLoss: 0, joined: null };
    } finally {
        console.log("loadUserProfile: FINALLY block reached. Calling updateDashboard..."); // LP6
        updateDashboard(); // Always update dashboard after attempting to load profile
        console.log("loadUserProfile: updateDashboard call finished."); // LP7
    }
};

const saveSettings = async () => {
  console.log("saveSettings called");
  const startingWeight = parseFloat(document.getElementById('starting-weight').value) || 0;
  const goalWeight = parseFloat(document.getElementById('goal-weight').value) || 0;
  const weeklyLossGoal = parseFloat(document.getElementById('weekly-loss-goal').value) || 0;
  const settingsMsg = document.getElementById('settings-success');

  try {
      await db.collection('users').doc(currentUser.uid).set({
          startingWeight: startingWeight, goalWeight: goalWeight, desiredWeeklyLoss: weeklyLossGoal
      }, { merge: true });

      userProfile.startingWeight = startingWeight; userProfile.goalWeight = goalWeight; userProfile.desiredWeeklyLoss = weeklyLossGoal;

      showMessage(settingsMsg, 'Settings saved!', 'success');
      updateDashboard();
      setTimeout(closeSettingsModal, 1500);
  } catch (err) { showMessage(settingsMsg, `Error: ${err.message}`, 'error'); }
};

const loadTodaysDiary = async () => {
    console.log("loadTodaysDiary called");
    const today = getTodayDateString();
    try {
        const q = db.collection('diary').where('userId', '==', currentUser.uid).where('date', '==', today).limit(1); const snapshot = await q.get();
        document.getElementById('record-weight-check').checked = false; document.getElementById('weight-input-container').style.display = 'none'; document.getElementById('weight').value = ''; document.getElementById('mood').value = ''; document.getElementById('notes').value = ''; document.getElementById('food-list').innerHTML = ''; document.getElementById('water-list').innerHTML = ''; document.getElementById('exercise-list').innerHTML = ''; todayDiaryDocId = null;
        if (!snapshot.empty) {
            const doc = snapshot.docs[0]; const data = doc.data(); todayDiaryDocId = doc.id;
            if (data.weight) { document.getElementById('record-weight-check').checked = true; document.getElementById('weight-input-container').style.display = 'block'; document.getElementById('weight').value = data.weight; }
            document.getElementById('mood').value = data.mood || ''; document.getElementById('notes').value = data.notes || '';
            if (data.foods && Array.isArray(data.foods)) { data.foods.forEach(food => renderFoodPill(food.name, food.calories)); } // Adjusted call
            if (data.water && Array.isArray(data.water)) { data.water.forEach(ounces => renderWaterPill(ounces)); }
            if (data.exercises && Array.isArray(data.exercises)) { data.exercises.forEach(ex => renderExercisePill(ex.type, ex.minutes)); }
        }
        updateTodayWaterTotal(); updateTodayExerciseTotal(); updateTodayFoodTotal(); // Adjusted call
    } catch (error) { console.error("Error loading today's diary:", error); }
};

const saveDiaryEntry = async () => {
    console.log("saveDiaryEntry called");
    const diaryMsg = document.getElementById('diary-message');
    const isWeightChecked = document.getElementById('record-weight-check').checked;
    const weightVal = parseFloat(document.getElementById('weight').value);

    const foodPills = document.querySelectorAll('#food-list .food-pill');
    const foods = Array.from(foodPills).map(pill => { return { name: pill.dataset.name, calories: parseFloat(pill.dataset.calories) || 0 }; });
    const totalFoodCalories = foods.reduce((sum, food) => sum + food.calories, 0);

    const waterPills = document.querySelectorAll('#water-list .water-pill');
    const waterValues = Array.from(waterPills).map(pill => parseFloat(pill.dataset.ounces));
    const totalWater = waterValues.reduce((sum, val) => sum + val, 0);

    const exercisePills = document.querySelectorAll('#exercise-list .exercise-pill');
    const exercises = Array.from(exercisePills).map(pill => { return { type: pill.dataset.type, minutes: parseFloat(pill.dataset.minutes) }; });
    const totalExercise = exercises.reduce((sum, ex) => sum + ex.minutes, 0);

    const today = getTodayDateString();
    const entryData = {
        userId: currentUser.uid, date: today, timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        mood: document.getElementById('mood').value, notes: document.getElementById('notes').value,
        foods: foods, foodCaloriesTotal: totalFoodCalories,
        weight: (isWeightChecked && !isNaN(weightVal)) ? weightVal : firebase.firestore.FieldValue.delete(), // Default to delete for update case
        water: waterValues, waterTotal: totalWater,
        exercises: exercises, exerciseTotal: totalExercise
    };
    const shouldIncludeWeight = isWeightChecked && !isNaN(weightVal);

    try {
        if (todayDiaryDocId) { // Update
            if (!shouldIncludeWeight) { entryData.weight = firebase.firestore.FieldValue.delete(); } // Only use delete for update
            await db.collection('diary').doc(todayDiaryDocId).update(entryData);
            showMessage(diaryMsg, 'Entry updated successfully!', 'success');
        } else { // Create
            if (!shouldIncludeWeight) { delete entryData.weight; } // Omit field if not needed
            const newDoc = await db.collection('diary').add(entryData);
            todayDiaryDocId = newDoc.id;
            showMessage(diaryMsg, 'Entry saved successfully!', 'success');
        }
        updateDashboard();
        if (!userEntryDates.includes(today)) { userEntryDates.push(today); if (calendarInstance) { calendarInstance.redraw(); } }
    } catch (err) { console.error("Error saving diary entry:", err); showMessage(diaryMsg, `Error: ${err.message}`, 'error'); }
};


const updateDashboard = async () => {
    console.log("updateDashboard: Starting..."); // UD1
    const startWeightEl = document.getElementById('stat-starting-weight'); const currentWeightEl = document.getElementById('stat-current-weight'); const totalLossEl = document.getElementById('stat-total-loss'); const goalDateEl = document.getElementById('stat-goal-date'); const yesterdayWaterEl = document.getElementById('stat-yesterday-water'); const yesterdayExerciseEl = document.getElementById('stat-yesterday-exercise'); const goalWeightEl = document.getElementById('stat-goal-weight'); const yesterdayCaloriesEl = document.getElementById('stat-yesterday-calories');

    // Check if essential elements exist
    if (!startWeightEl || !currentWeightEl || !totalLossEl || !goalDateEl || !yesterdayWaterEl || !yesterdayExerciseEl || !goalWeightEl || !yesterdayCaloriesEl) {
        console.error("updateDashboard: One or more dashboard stat elements are missing! Cannot update."); // UD Error 1
        return; // Stop if elements aren't there
    }
     console.log("updateDashboard: All dashboard elements found."); // UD2

    // Reset UI
    startWeightEl.textContent = '-- lbs'; currentWeightEl.textContent = '-- lbs'; totalLossEl.textContent = '-- lbs'; goalDateEl.textContent = '--'; goalDateEl.style.color = '#007bff'; yesterdayWaterEl.textContent = '-- oz'; yesterdayExerciseEl.textContent = '-- min'; goalWeightEl.textContent = '-- lbs'; yesterdayCaloriesEl.textContent = '--';
     console.log("updateDashboard: UI reset to defaults."); // UD3

    // Check if profile is actually ready
    if (!currentUser || !userProfile || typeof userProfile.startingWeight === 'undefined') {
        console.warn("updateDashboard: User profile not ready or invalid. Displaying defaults."); // UD Warning 1
        goalDateEl.textContent = 'N/A'; yesterdayCaloriesEl.textContent = 'N/A';
        // Keep others at '--'
        return;
    }
     console.log("updateDashboard: User profile seems ready:", userProfile); // UD4

    // --- Proceed with updates ---
    try {
        const startingWeight = userProfile.startingWeight || 0;
        const goalWeight = userProfile.goalWeight || 0;
        const desiredWeeklyLoss = userProfile.desiredWeeklyLoss || 0;
        startWeightEl.textContent = `${startingWeight.toFixed(1)} lbs`;
        goalWeightEl.textContent = `${goalWeight.toFixed(1)} lbs`;
        console.log("updateDashboard: Set start/goal weight text."); // UD5

        // Fetch Current Weight
        let currentWeight = startingWeight; // Default value
        try {
             console.log("updateDashboard: Attempting to fetch current weight..."); // UD6a
            const qWeight = db.collection('diary').where('userId', '==', currentUser.uid).where('weight', '>', 0).orderBy('weight').orderBy('date', 'desc').limit(1);
            const weightSnapshot = await qWeight.get();
            if (!weightSnapshot.empty) {
                 currentWeight = weightSnapshot.docs[0].data().weight;
                 console.log("updateDashboard: Current weight fetched successfully:", currentWeight); // UD7a
             } else {
                 console.log("updateDashboard: No weight entries found, using starting weight."); // UD7b
             }
        } catch (error) {
             console.error("updateDashboard: Error fetching current weight:", error); // UD Error 2
             // Continue with default currentWeight = startingWeight
        }

        // Update Current Weight and Total Loss UI
        currentWeightEl.textContent = `${currentWeight.toFixed(1)} lbs`;
        const totalLoss = startingWeight - currentWeight;
        totalLossEl.textContent = `${totalLoss.toFixed(1)} lbs`;
        if (totalLoss > 0) { totalLossEl.style.color = '#28a745'; } else if (totalLoss < 0) { totalLossEl.style.color = '#d93025'; } else { totalLossEl.style.color = '#555'; }
         console.log("updateDashboard: Set current weight and total loss text."); // UD8

        // Goal Date Calculation
         console.log("updateDashboard: Calculating goal date..."); // UD9
        if (goalWeight <= 0) { goalDateEl.textContent = 'Set Goal'; }
        else if (startingWeight <= goalWeight) { goalDateEl.textContent = 'New Goal?'; }
        else if (currentWeight <= goalWeight) { goalDateEl.textContent = 'Reached!'; goalDateEl.style.color = '#28a745'; }
        else if (desiredWeeklyLoss > 0) { const weightRemaining = currentWeight - goalWeight; const weeksToGoal = weightRemaining / desiredWeeklyLoss; const daysToGoal = Math.round(weeksToGoal * 7); const today = new Date(); const estDate = new Date(); estDate.setDate(today.getDate() + daysToGoal); goalDateEl.textContent = estDate.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); console.log("updateDashboard: Goal date calculated using desired rate:", goalDateEl.textContent); } // UD10a
        else { /* Fallback using average */ const joinDate = userProfile.joined; if (!joinDate) { goalDateEl.textContent = 'Set Rate'; console.log("updateDashboard: Goal date N/A (missing join date)."); } else { const today = new Date(); const msPerDay = 1000 * 60 * 60 * 24; const daysElapsed = (today.getTime() - joinDate.getTime()) / msPerDay; if (totalLoss <= 0 || daysElapsed < 1) { goalDateEl.textContent = 'Set Rate'; console.log("updateDashboard: Goal date N/A (no loss or < 1 day)."); } else { const avgLossPerDay = totalLoss / daysElapsed; const weightRemaining = currentWeight - goalWeight; const daysToGoal = Math.round(weightRemaining / avgLossPerDay); const estDate = new Date(); estDate.setDate(today.getDate() + daysToGoal); goalDateEl.textContent = estDate.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); console.log("updateDashboard: Goal date calculated using average rate:", goalDateEl.textContent); } } } // UD10b,c,d
         console.log("updateDashboard: Finished goal date calculation. Result:", goalDateEl.textContent); // UD10 End


        // Yesterday's Stats
         console.log("updateDashboard: Attempting to fetch yesterday's stats..."); // UD11a
        let waterTotal = 0, exerciseTotal = 0, caloriesTotal = 0; // Initialize defaults
        try {
             const yesterday = getYesterdayDateString();
             const qYesterday = db.collection('diary').where('userId', '==', currentUser.uid).where('date', '==', yesterday).limit(1);
             const yesterdaySnapshot = await qYesterday.get();
             if (!yesterdaySnapshot.empty) {
                 const data = yesterdaySnapshot.docs[0].data();
                 waterTotal = data.waterTotal || 0;
                 exerciseTotal = data.exerciseTotal || 0;
                 caloriesTotal = data.foodCaloriesTotal || 0;
                 console.log("updateDashboard: Yesterday's stats fetched successfully:", { water: waterTotal, exercise: exerciseTotal, calories: caloriesTotal }); // UD12a
             } else {
                  console.log("updateDashboard: No entry found for yesterday."); // UD12b
             }
        } catch (error) {
             console.error("updateDashboard: Error fetching yesterday's data:", error); // UD Error 3
             waterTotal = 'Err'; exerciseTotal = 'Err'; caloriesTotal = 'Err'; // Indicate error in UI
        }
        // Update UI for yesterday's stats
        yesterdayWaterEl.textContent = `${waterTotal} ${waterTotal === 'Err' ? '' : 'oz'}`;
        yesterdayExerciseEl.textContent = `${exerciseTotal} ${exerciseTotal === 'Err' ? '' : 'min'}`;
        yesterdayCaloriesEl.textContent = `${caloriesTotal}`;
         console.log("updateDashboard: Yesterday's stats UI updated."); // UD12c


    } catch (outerError) {
         // Catch errors happening during UI updates after data fetching
         console.error("updateDashboard: CATCH block error during UI update logic:", outerError); // UD Error 4
         if(startWeightEl) startWeightEl.textContent = 'Err'; if(currentWeightEl) currentWeightEl.textContent = 'Err';
         if(goalWeightEl) goalWeightEl.textContent = 'Err';
         if(totalLossEl) totalLossEl.textContent = 'Err';
         if(goalDateEl) goalDateEl.textContent = 'Err';
         if(yesterdayWaterEl) yesterdayWaterEl.textContent = 'Err';
         if(yesterdayExerciseEl) yesterdayExerciseEl.textContent = 'Err';
         if(yesterdayCaloriesEl) yesterdayCaloriesEl.textContent = 'Err';

    } finally {
        console.log("updateDashboard: FINISHED."); // UD13
    }
};

// --- PAST ENTRIES FUNCTIONS ---
const loadPastEntries = async (dateString) => { const listContainer = document.getElementById('past-entries-list'); if (!listContainer) return; listContainer.innerHTML = `<p>Loading entry for ${dateString}...</p>`; try { const q = db.collection('diary').where('userId', '==', currentUser.uid).where('date', '==', dateString).limit(1); const snapshot = await q.get(); if (snapshot.empty) { listContainer.innerHTML = `<p>No entry found for ${dateString}.</p>`; return; } listContainer.innerHTML = ''; renderPastEntry(snapshot.docs[0].data()); } catch (err) { console.error("Error loading past entry:", err); listContainer.innerHTML = '<p class="error-message">Could not load entry.</p>'; } };
const renderPastEntry = (data) => { const listContainer = document.getElementById('past-entries-list'); const entryDiv = document.createElement('div'); entryDiv.className = 'entry-card'; const title = document.createElement('h3'); title.textContent = data.date; const meta = document.createElement('div'); meta.className = 'entry-meta'; let metaHTML = `<span>Mood: <strong>${data.mood || 'N/A'}</strong></span>`; if (data.weight) { metaHTML += `<span>Weight: <strong>${data.weight} lbs</strong></span>`; } if (data.waterTotal) { metaHTML += `<span>Water: <strong>${data.waterTotal} oz</strong></span>`; } if (data.exerciseTotal) { metaHTML += `<span>Exercise: <strong>${data.exerciseTotal} min</strong></span>`; } if (typeof data.foodCaloriesTotal !== 'undefined') { metaHTML += `<span>Calories: <strong>${data.foodCaloriesTotal}</strong></span>`; } meta.innerHTML = metaHTML; const notes = document.createElement('p'); notes.className = 'entry-notes'; notes.textContent = data.notes || 'No notes for this day.'; const foodListContainer = document.createElement('div'); foodListContainer.className = 'food-list-container'; if (data.foods && Array.isArray(data.foods)) { data.foods.forEach(food => { const pill = document.createElement('div'); pill.className = 'food-pill'; const name = document.createElement('span'); name.textContent = food.name || 'Unknown Food'; pill.appendChild(name); if (typeof food.calories !== 'undefined' && food.calories > 0) { const cals = document.createElement('span'); cals.className = 'food-calories'; cals.textContent = `(${food.calories} cal)`; pill.appendChild(cals); } foodListContainer.appendChild(pill); }); } const waterListContainer = document.createElement('div'); waterListContainer.className = 'water-list-container'; if (data.water && data.water.length > 0) { data.water.forEach(ounces => { const pill = document.createElement('div'); pill.className = 'water-pill'; const name = document.createElement('span'); name.textContent = `${ounces} oz`; pill.appendChild(name); waterListContainer.appendChild(pill); }); } const exerciseListContainer = document.createElement('div'); exerciseListContainer.className = 'exercise-list-container'; if (data.exercises && data.exercises.length > 0) { data.exercises.forEach(ex => { const pill = document.createElement('div'); pill.className = 'exercise-pill'; const name = document.createElement('span'); name.textContent = `${ex.type}: ${ex.minutes} min`; pill.appendChild(name); exerciseListContainer.appendChild(pill); }); } entryDiv.appendChild(title); entryDiv.appendChild(meta); entryDiv.appendChild(notes); entryDiv.appendChild(foodListContainer); entryDiv.appendChild(waterListContainer); entryDiv.appendChild(exerciseListContainer); listContainer.appendChild(entryDiv); };

// --- CALENDAR & MODAL FUNCTIONS ---
const fetchUserEntryDatesAndUpdateCalendar = async () => { if (!currentUser) return; try { console.log("Fetching entry dates for calendar..."); const q = db.collection('diary').where('userId', '==', currentUser.uid).select('date'); const snapshot = await q.get(); userEntryDates = snapshot.docs.map(doc => doc.data().date); console.log("Entry dates fetched:", userEntryDates.length); if (calendarInstance) { calendarInstance.set("onDayCreate", (d, dStr, fp, dayElem) => { const dateString = getYYYYMMDD(dayElem.dateObj); dayElem.classList.toggle("has-entry", userEntryDates.includes(dateString)); }); calendarInstance.redraw(); console.log("Calendar redrawn with updated dates."); } } catch (err) { console.error("Error fetching entry dates for calendar:", err); } };
const openCalendarModal = async () => {
    console.log("openCalendarModal called");
    if (!calendarModal) { console.error("Cannot open calendar modal: element not found"); return; }
    calendarModal.style.display = "flex";
    console.log("Calendar modal displayed.");
    await fetchUserEntryDatesAndUpdateCalendar(); // Fetch/refresh dates
    if (!calendarInstance) {
        console.log("Initializing Flatpickr instance for the first time...");
        const calendarContainer = document.getElementById('calendar-container');
        if (!calendarContainer) { console.error("Cannot initialize calendar: #calendar-container not found."); closeCalendarModal(); return; }
        setTimeout(() => { // Delay initialization
            try {
                calendarInstance = flatpickr("#calendar-container", {
                    inline: true, maxDate: "today",
                    onDayCreate: (d, dStr, fp, dayElem) => { const dateString = getYYYYMMDD(dayElem.dateObj); dayElem.classList.toggle("has-entry", userEntryDates.includes(dateString)); },
                    onChange: (selectedDates) => { if (selectedDates.length > 0) { const dateString = getYYYYMMDD(selectedDates[0]); loadPastEntries(dateString); closeCalendarModal(); } }
                });
                console.log("Flatpickr instance created successfully.");
            } catch (error) {
                console.error("Error creating Flatpickr instance:", error); closeCalendarModal();
                const diaryMsgEl = document.getElementById('diary-message'); if (diaryMsgEl) showMessage(diaryMsgEl, "Error opening calendar.", "error");
            }
        }, 0);
    } else {
        console.log("Flatpickr instance exists, redrawing.");
        calendarInstance.redraw(); // Just redraw
    }
};
const closeCalendarModal = () => { if (calendarModal) { calendarModal.style.display = "none"; } };
const openSettingsModal = () => { const startWeightInput = document.getElementById('starting-weight'); const goalWeightInput = document.getElementById('goal-weight'); const weeklyLossInput = document.getElementById('weekly-loss-goal'); if(startWeightInput) startWeightInput.value = userProfile.startingWeight || ''; if(goalWeightInput) goalWeightInput.value = userProfile.goalWeight || ''; if(weeklyLossInput) weeklyLossInput.value = userProfile.desiredWeeklyLoss || ''; document.getElementById('settings-success').textContent = ''; if (settingsModal) { settingsModal.style.display = "flex"; } };
const closeSettingsModal = () => { if (settingsModal) { settingsModal.style.display = "none"; } };

// --- UI HELPER FUNCTIONS ---
const addFoodItemToUI = () => { const foodInput = document.getElementById('food-input'); const calorieInput = document.getElementById('food-calories'); const foodName = foodInput.value.trim(); const calories = parseFloat(calorieInput.value) || 0; if (foodName) { renderFoodPill(foodName, calories); foodInput.value = ''; calorieInput.value = ''; updateTodayFoodTotal(); } };
const renderFoodPill = (foodName, calories) => { const foodList = document.getElementById('food-list'); const pill = document.createElement('div'); pill.className = 'food-pill'; pill.dataset.name = foodName; pill.dataset.calories = calories; const name = document.createElement('span'); name.textContent = foodName; pill.appendChild(name); if (calories > 0) { const cals = document.createElement('span'); cals.className = 'food-calories'; cals.textContent = `(${calories} cal)`; pill.appendChild(cals); } const removeBtn = document.createElement('a'); removeBtn.className = 'remove-food'; removeBtn.textContent = 'x'; removeBtn.title = 'Remove'; removeBtn.addEventListener('click', () => { pill.remove(); updateTodayFoodTotal(); }); pill.appendChild(removeBtn); foodList.appendChild(pill); };
const updateTodayFoodTotal = () => { const foodTotalEl = document.getElementById('food-total-today'); const foodPills = document.querySelectorAll('#food-list .food-pill'); let total = 0; foodPills.forEach(pill => { total += parseFloat(pill.dataset.calories) || 0; }); if(foodTotalEl) foodTotalEl.textContent = total; };
const addWaterItemToUI = () => { const waterInput = document.getElementById('water-input'); const ounces = parseFloat(waterInput.value); if (ounces && ounces > 0) { renderWaterPill(ounces); waterInput.value = ''; updateTodayWaterTotal(); } };
const renderWaterPill = (ounces) => { const waterList = document.getElementById('water-list'); const pill = document.createElement('div'); pill.className = 'water-pill'; pill.dataset.ounces = ounces; const name = document.createElement('span'); name.textContent = `${ounces} oz`; const removeBtn = document.createElement('a'); removeBtn.className = 'remove-water'; removeBtn.textContent = 'x'; removeBtn.title = 'Remove'; removeBtn.addEventListener('click', () => { pill.remove(); updateTodayWaterTotal(); }); pill.appendChild(name); pill.appendChild(removeBtn); waterList.appendChild(pill); };
const updateTodayWaterTotal = () => { const waterTotalEl = document.getElementById('water-total-today'); const waterPills = document.querySelectorAll('#water-list .water-pill'); let total = 0; waterPills.forEach(pill => { total += parseFloat(pill.dataset.ounces); }); if(waterTotalEl) waterTotalEl.textContent = total; };
const addExerciseItemToUI = () => { const typeInput = document.getElementById('exercise-type'); const minutesInput = document.getElementById('exercise-minutes'); const type = typeInput.value; const minutes = parseFloat(minutesInput.value); if (minutes && minutes > 0) { renderExercisePill(type, minutes); minutesInput.value = ''; updateTodayExerciseTotal(); } };
const renderExercisePill = (type, minutes) => { const exerciseList = document.getElementById('exercise-list'); const pill = document.createElement('div'); pill.className = 'exercise-pill'; pill.dataset.type = type; pill.dataset.minutes = minutes; const name = document.createElement('span'); name.textContent = `${type}: ${minutes} min`; const removeBtn = document.createElement('a'); removeBtn.className = 'remove-exercise'; removeBtn.textContent = 'x'; removeBtn.title = 'Remove'; removeBtn.addEventListener('click', () => { pill.remove(); updateTodayExerciseTotal(); }); pill.appendChild(name); pill.appendChild(removeBtn); exerciseList.appendChild(pill); };
const updateTodayExerciseTotal = () => { const exerciseTotalEl = document.getElementById('exercise-total-today'); const exercisePills = document.querySelectorAll('#exercise-list .exercise-pill'); let total = 0; exercisePills.forEach(pill => { total += parseFloat(pill.dataset.minutes); }); if(exerciseTotalEl) exerciseTotalEl.textContent = total; };

// --- RUN THE APP ---
if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', main); }
else { main(); }
console.log("Initial script setup finished, waiting for DOM/Auth...");
