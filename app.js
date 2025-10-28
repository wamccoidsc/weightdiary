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
    // Display error to user if Firebase fails fundamentally
    document.addEventListener('DOMContentLoaded', () => {
         document.body.innerHTML = '<h1 style="color: red; text-align: center; margin-top: 50px;">Error initializing application. Please check console and Firebase config.</h1>';
    });
}


// --- STATE VARIABLES ---
let currentUser = null;
let userProfile = {};
let todayDiaryDocId = null;

// CALENDAR STATE
let calendarInstance = null;
let userEntryDates = [];
let calendarModal = null;

// SETTINGS MODAL STATE
let settingsModal = null;

// --- UTILITY FUNCTIONS ---
const getYYYYMMDD = (date) => { const year = date.getFullYear(); const month = (date.getMonth() + 1).toString().padStart(2, '0'); const day = date.getDate().toString().padStart(2, '0'); return `${year}-${month}-${day}`; };
const getTodayDateString = () => getYYYYMMDD(new Date());
const getYesterdayDateString = () => { const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1); return getYYYYMMDD(yesterday); };
const showMessage = (element, message, type = 'success') => { if (element) { element.textContent = message; element.className = type === 'success' ? 'success-message' : 'error-message'; setTimeout(() => { if (element) { element.textContent = ''; } }, 3000); } };

// --- MAIN APP LOGIC ---
const main = () => {
    if (!firebaseInitialized || !auth) {
        console.error("Firebase not initialized correctly. Auth listener not set up.");
        return;
    }
    auth.onAuthStateChanged(user => {
        const path = window.location.pathname;
        currentUser = user;

        if (currentUser) {
            if (path.includes("index.html") || path === "/" || path.endsWith("/weight-loss-diary/")) { window.location.href = "https://wamccoidsc.github.io/weightdiary/dashboard.html"; }
            else if (path.includes("dashboard.html")) {
                if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', initializeAppDashboard); }
                else { initializeAppDashboard(); }
            }
        } else {
            if (path.includes("dashboard.html")) { window.location.href = "https://wamccoidsc.github.io/weightdiaryindex.html"; }
            else {
                 if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', initializeAuthForms); }
                 else { initializeAuthForms(); }
            }
        }
    });
};


const initializeAuthForms = () => {
  const loginBtn = document.getElementById('login-btn'); if (!loginBtn) return;
  const signupBtn = document.getElementById('signup-btn'); const showSignup = document.getElementById('show-signup'); const showLogin = document.getElementById('show-login'); const loginForm = document.getElementById('login-form'); const signupForm = document.getElementById('signup-form'); const loginError = document.getElementById('login-error'); const signupError = document.getElementById('signup-error');
  showSignup.addEventListener('click', (e) => { e.preventDefault(); loginForm.style.display = 'none'; signupForm.style.display = 'block'; }); showLogin.addEventListener('click', (e) => { e.preventDefault(); signupForm.style.display = 'none'; loginForm.style.display = 'block'; });
  loginBtn.addEventListener('click', () => { const email = document.getElementById('login-email').value; const pass = document.getElementById('login-password').value; auth.signInWithEmailAndPassword(email, pass).catch(err => showMessage(loginError, err.message, 'error')); });
  signupBtn.addEventListener('click', () => {
      const email = document.getElementById('signup-email').value; const pass = document.getElementById('signup-password').value;
      auth.createUserWithEmailAndPassword(email, pass)
          .then(userCredential => {
              return db.collection('users').doc(userCredential.user.uid).set({
                  email: userCredential.user.email, startingWeight: 0, goalWeight: 0, desiredWeeklyLoss: 0,
                  joined: firebase.firestore.FieldValue.serverTimestamp()
              });
          })
          .catch(err => showMessage(signupError, err.message, 'error'));
  });
};

const initializeAppDashboard = () => {
    if (!currentUser) { console.error("initializeAppDashboard called without a valid currentUser."); window.location.href = "https://wamccoidsc.github.io/weightdiary/index.html"; return; }
    const userEmailEl = document.getElementById('user-email');
    if (!userEmailEl) { console.error("Could not find element with ID 'user-email'."); }
    else { userEmailEl.textContent = currentUser.email || 'No Email'; }

    try { document.getElementById('logout-btn').addEventListener('click', () => auth.signOut()); }
    catch(e) { console.error("Failed to attach logout listener", e); }

    const diaryTitleEl = document.getElementById('diary-title');
    if(diaryTitleEl) diaryTitleEl.textContent = `Today's Entry (${getTodayDateString()})`;
    else console.error("Could not find 'diary-title' element.");

    // Load data sequence: Profile -> Dashboard -> Other async loads
    loadUserProfile(); // This now calls updateDashboard internally
    loadTodaysDiary();
    loadPastEntries(getYesterdayDateString());

    calendarModal = document.getElementById('calendar-modal'); settingsModal = document.getElementById('settings-modal');
    if (!calendarModal || !settingsModal) { console.error("Could not find modal elements!"); }
    initializeCalendar(); // Safe to call now

    // -- Event Listeners --
    try {
        const saveSettingsBtn = document.getElementById('save-settings-btn');
        if (saveSettingsBtn) saveSettingsBtn.addEventListener('click', saveSettings); else console.error("Could not find save-settings-btn");
        const weightCheck = document.getElementById('record-weight-check'); const weightContainer = document.getElementById('weight-input-container');
        if (weightCheck && weightContainer) { weightCheck.addEventListener('change', () => { weightContainer.style.display = weightCheck.checked ? 'block' : 'none'; if (!weightCheck.checked) { document.getElementById('weight').value = ''; } }); } else console.warn("Weight check/container elements missing");
        const addFoodBtn = document.getElementById('add-food-btn'); if(addFoodBtn) addFoodBtn.addEventListener('click', addFoodItemToUI); else console.error("Could not find add-food-btn");
        const foodInput = document.getElementById('food-input'); if(foodInput) foodInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') { e.preventDefault(); addFoodItemToUI(); } }); else console.error("Could not find food-input");
        const addWaterBtn = document.getElementById('add-water-btn'); if(addWaterBtn) addWaterBtn.addEventListener('click', addWaterItemToUI); else console.error("Could not find add-water-btn");
        const waterInput = document.getElementById('water-input'); if(waterInput) waterInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') { e.preventDefault(); addWaterItemToUI(); } }); else console.error("Could not find water-input");
        const addExerciseBtn = document.getElementById('add-exercise-btn'); if(addExerciseBtn) addExerciseBtn.addEventListener('click', addExerciseItemToUI); else console.error("Could not find add-exercise-btn");
        const exerciseMinutesInput = document.getElementById('exercise-minutes'); if(exerciseMinutesInput) exerciseMinutesInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') { e.preventDefault(); addExerciseItemToUI(); } }); else console.error("Could not find exercise-minutes input");
        const saveDiaryBtn = document.getElementById('save-diary-btn'); if(saveDiaryBtn) saveDiaryBtn.addEventListener('click', saveDiaryEntry); else console.error("Could not find save-diary-btn");
        const openCalendarBtn = document.getElementById('open-calendar-btn'); if(openCalendarBtn) openCalendarBtn.addEventListener('click', openCalendarModal); else console.error("Could not find open-calendar-btn");
        const calendarCloseBtn = document.querySelector('#calendar-modal .modal-close-btn'); if(calendarCloseBtn) calendarCloseBtn.addEventListener('click', closeCalendarModal); else console.error("Could not find calendar close button");
        if(calendarModal) calendarModal.addEventListener('click', (event) => { if (event.target === calendarModal) { closeCalendarModal(); } }); else console.error("Calendar modal element not found for click listener");
        const openSettingsBtn = document.getElementById('open-settings-btn'); if(openSettingsBtn) openSettingsBtn.addEventListener('click', openSettingsModal); else console.error("Could not find open-settings-btn");
        const settingsCloseBtn = document.querySelector('#settings-modal .modal-close-btn'); if(settingsCloseBtn) settingsCloseBtn.addEventListener('click', closeSettingsModal); else console.error("Could not find settings close button");
        if(settingsModal) settingsModal.addEventListener('click', (event) => { if (event.target === settingsModal) { closeSettingsModal(); } }); else console.error("Settings modal element not found for click listener");
    } catch (error) {
        console.error("Error attaching event listeners:", error);
        showMessage(document.getElementById('diary-message'), "Error initializing page interactions.", "error");
    }
};


// --- DATA FUNCTIONS (FIRESTORE) ---
const loadUserProfile = async () => {
    userProfile = {}; // Initialize/reset
    try {
        if (!currentUser) throw new Error("currentUser is not defined");
        const userDoc = await db.collection('users').doc(currentUser.uid).get();
        if (userDoc.exists) {
            userProfile = userDoc.data();
            if (userProfile.joined && typeof userProfile.joined.toDate === 'function') { userProfile.joined = userProfile.joined.toDate(); }
            else { userProfile.joined = null; console.warn("User profile 'joined' field is missing or invalid."); }
            // Ensure defaults
            userProfile.startingWeight = userProfile.startingWeight || 0;
            userProfile.goalWeight = userProfile.goalWeight || 0;
            userProfile.desiredWeeklyLoss = userProfile.desiredWeeklyLoss || 0;

            // Populate settings form safely
            const startWeightInput = document.getElementById('starting-weight');
            const goalWeightInput = document.getElementById('goal-weight');
            const weeklyLossInput = document.getElementById('weekly-loss-goal');
            if(startWeightInput) startWeightInput.value = userProfile.startingWeight;
            if(goalWeightInput) goalWeightInput.value = userProfile.goalWeight;
            if(weeklyLossInput) weeklyLossInput.value = userProfile.desiredWeeklyLoss;

        } else {
             console.error("User profile document does not exist for UID:", currentUser.uid);
             userProfile = { startingWeight: 0, goalWeight: 0, desiredWeeklyLoss: 0, joined: null };
        }
    } catch (error) {
        console.error("Error loading user profile:", error);
         userProfile = { startingWeight: 0, goalWeight: 0, desiredWeeklyLoss: 0, joined: null };
    } finally {
        updateDashboard(); // Call AFTER attempting to load profile
    }
};

const saveSettings = async () => {
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
  const today = getTodayDateString();
  try {
      const q = db.collection('diary').where('userId', '==', currentUser.uid).where('date', '==', today).limit(1); const snapshot = await q.get();
      document.getElementById('record-weight-check').checked = false; document.getElementById('weight-input-container').style.display = 'none'; document.getElementById('weight').value = ''; document.getElementById('mood').value = ''; document.getElementById('notes').value = ''; document.getElementById('food-list').innerHTML = ''; document.getElementById('water-list').innerHTML = ''; document.getElementById('exercise-list').innerHTML = ''; todayDiaryDocId = null;
      if (!snapshot.empty) {
          const doc = snapshot.docs[0]; const data = doc.data(); todayDiaryDocId = doc.id;
          if (data.weight) { document.getElementById('record-weight-check').checked = true; document.getElementById('weight-input-container').style.display = 'block'; document.getElementById('weight').value = data.weight; }
          document.getElementById('mood').value = data.mood || ''; document.getElementById('notes').value = data.notes || '';
          if (data.foods && Array.isArray(data.foods)) { data.foods.forEach(food => renderFoodPill(food)); }
          if (data.water && Array.isArray(data.water)) { data.water.forEach(ounces => renderWaterPill(ounces)); }
          if (data.exercises && Array.isArray(data.exercises)) { data.exercises.forEach(ex => renderExercisePill(ex.type, ex.minutes)); }
      }
      updateTodayWaterTotal(); updateTodayExerciseTotal();
  } catch (error) { console.error("Error loading today's diary:", error); }
};

const saveDiaryEntry = async () => {
    const diaryMsg = document.getElementById('diary-message');
    const isWeightChecked = document.getElementById('record-weight-check').checked;
    const weightVal = parseFloat(document.getElementById('weight').value);

    const foodPills = document.querySelectorAll('#food-list .food-pill span');
    const foods = Array.from(foodPills).map(pill => pill.textContent);

    const waterPills = document.querySelectorAll('#water-list .water-pill');
    const waterValues = Array.from(waterPills).map(pill => parseFloat(pill.dataset.ounces));
    const totalWater = waterValues.reduce((sum, val) => sum + val, 0);

    const exercisePills = document.querySelectorAll('#exercise-list .exercise-pill');
    const exercises = Array.from(exercisePills).map(pill => {
        return { type: pill.dataset.type, minutes: parseFloat(pill.dataset.minutes) };
    });
    const totalExercise = exercises.reduce((sum, ex) => sum + ex.minutes, 0);

    const today = getTodayDateString();

    // Create base data object WITHOUT weight initially
    const entryData = {
        userId: currentUser.uid, date: today, timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        mood: document.getElementById('mood').value, notes: document.getElementById('notes').value,
        foods: foods, water: waterValues, waterTotal: totalWater,
        exercises: exercises, exerciseTotal: totalExercise
    };

    // Determine if weight should be included
    const shouldIncludeWeight = isWeightChecked && !isNaN(weightVal);

    try {
        if (todayDiaryDocId) { // Update existing entry
            if (shouldIncludeWeight) { entryData.weight = weightVal; }
            else { entryData.weight = firebase.firestore.FieldValue.delete(); } // Use delete for update
            await db.collection('diary').doc(todayDiaryDocId).update(entryData);
            showMessage(diaryMsg, 'Entry updated successfully!', 'success');
        } else { // Create new entry
            if (shouldIncludeWeight) { entryData.weight = weightVal; } // Add field only if needed
            const newDoc = await db.collection('diary').add(entryData);
            todayDiaryDocId = newDoc.id;
            showMessage(diaryMsg, 'Entry saved successfully!', 'success');
        }
        updateDashboard();
        if (!userEntryDates.includes(today)) { userEntryDates.push(today); if (calendarInstance) { calendarInstance.redraw(); } }
    } catch (err) { console.error("Error saving diary entry:", err); showMessage(diaryMsg, `Error: ${err.message}`, 'error'); }
};


const updateDashboard = async () => {
    const startWeightEl = document.getElementById('stat-starting-weight'); const currentWeightEl = document.getElementById('stat-current-weight'); const totalLossEl = document.getElementById('stat-total-loss'); const goalDateEl = document.getElementById('stat-goal-date'); const yesterdayWaterEl = document.getElementById('stat-yesterday-water'); const yesterdayExerciseEl = document.getElementById('stat-yesterday-exercise'); const goalWeightEl = document.getElementById('stat-goal-weight');
    if (!startWeightEl || !currentWeightEl || !totalLossEl || !goalDateEl || !yesterdayWaterEl || !yesterdayExerciseEl || !goalWeightEl) { console.error("Dashboard stat elements missing!"); return; }
    startWeightEl.textContent = '-- lbs'; currentWeightEl.textContent = '-- lbs'; totalLossEl.textContent = '-- lbs'; goalDateEl.textContent = '--'; goalDateEl.style.color = '#007bff'; yesterdayWaterEl.textContent = '-- oz'; yesterdayExerciseEl.textContent = '-- min'; goalWeightEl.textContent = '-- lbs';
    if (!currentUser || !userProfile || typeof userProfile.startingWeight === 'undefined' || typeof userProfile.goalWeight === 'undefined') { console.warn("Dashboard update skipped: User profile not ready."); goalDateEl.textContent = 'N/A'; return; }

    const startingWeight = userProfile.startingWeight || 0;
    const goalWeight = userProfile.goalWeight || 0;
    const desiredWeeklyLoss = userProfile.desiredWeeklyLoss || 0;
    startWeightEl.textContent = `${startingWeight.toFixed(1)} lbs`;
    goalWeightEl.textContent = `${goalWeight.toFixed(1)} lbs`;

    let currentWeight = startingWeight;
    try { const q = db.collection('diary').where('userId', '==', currentUser.uid).where('weight', '>', 0).orderBy('weight').orderBy('date', 'desc').limit(1); const snapshot = await q.get(); if (!snapshot.empty) { currentWeight = snapshot.docs[0].data().weight; } } catch (error) { console.error("Error fetching current weight:", error); }
    currentWeightEl.textContent = `${currentWeight.toFixed(1)} lbs`;
    const totalLoss = startingWeight - currentWeight;
    totalLossEl.textContent = `${totalLoss.toFixed(1)} lbs`;
    if (totalLoss > 0) { totalLossEl.style.color = '#28a745'; } else if (totalLoss < 0) { totalLossEl.style.color = '#d93025'; } else { totalLossEl.style.color = '#555'; }

    // Goal Date Calculation
    if (goalWeight <= 0) { goalDateEl.textContent = 'Set Goal'; }
    else if (startingWeight <= goalWeight) { goalDateEl.textContent = 'New Goal?'; }
    else if (currentWeight <= goalWeight) { goalDateEl.textContent = 'Reached!'; goalDateEl.style.color = '#28a745'; }
    else if (desiredWeeklyLoss > 0) { const weightRemaining = currentWeight - goalWeight; const weeksToGoal = weightRemaining / desiredWeeklyLoss; const daysToGoal = Math.round(weeksToGoal * 7); const today = new Date(); const estDate = new Date(); estDate.setDate(today.getDate() + daysToGoal); goalDateEl.textContent = estDate.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
    else {
        const joinDate = userProfile.joined;
        if (!joinDate) { goalDateEl.textContent = 'Set Rate'; }
        else { const today = new Date(); const msPerDay = 1000 * 60 * 60 * 24; const daysElapsed = (today.getTime() - joinDate.getTime()) / msPerDay; if (totalLoss <= 0 || daysElapsed < 1) { goalDateEl.textContent = 'Set Rate'; } else { const avgLossPerDay = totalLoss / daysElapsed; const weightRemaining = currentWeight - goalWeight; const daysToGoal = Math.round(weightRemaining / avgLossPerDay); const estDate = new Date(); estDate.setDate(today.getDate() + daysToGoal); goalDateEl.textContent = estDate.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); } }
    }
    // Yesterday's Water & Exercise
    try { const yesterday = getYesterdayDateString(); const q = db.collection('diary').where('userId', '==', currentUser.uid).where('date', '==', yesterday).limit(1); const snapshot = await q.get(); let waterTotal = 0, exerciseTotal = 0; if (!snapshot.empty) { const data = snapshot.docs[0].data(); waterTotal = data.waterTotal || 0; exerciseTotal = data.exerciseTotal || 0; } yesterdayWaterEl.textContent = `${waterTotal} oz`; yesterdayExerciseEl.textContent = `${exerciseTotal} min`; } catch (error) { console.error("Error fetching yesterday's data:", error); yesterdayWaterEl.textContent = 'Error'; yesterdayExerciseEl.textContent = 'Error'; }
};

// --- PAST ENTRIES FUNCTIONS ---
const loadPastEntries = async (dateString) => { const listContainer = document.getElementById('past-entries-list'); if (!listContainer) return; listContainer.innerHTML = `<p>Loading entry for ${dateString}...</p>`; try { const q = db.collection('diary').where('userId', '==', currentUser.uid).where('date', '==', dateString).limit(1); const snapshot = await q.get(); if (snapshot.empty) { listContainer.innerHTML = `<p>No entry found for ${dateString}.</p>`; return; } listContainer.innerHTML = ''; renderPastEntry(snapshot.docs[0].data()); } catch (err) { console.error("Error loading past entry:", err); listContainer.innerHTML = '<p class="error-message">Could not load entry.</p>'; } };
const renderPastEntry = (data) => { const listContainer = document.getElementById('past-entries-list'); const entryDiv = document.createElement('div'); entryDiv.className = 'entry-card'; const title = document.createElement('h3'); title.textContent = data.date; const meta = document.createElement('div'); meta.className = 'entry-meta'; let metaHTML = `<span>Mood: <strong>${data.mood || 'N/A'}</strong></span>`; if (data.weight) { metaHTML += `<span>Weight: <strong>${data.weight} lbs</strong></span>`; } if (data.waterTotal) { metaHTML += `<span>Water: <strong>${data.waterTotal} oz</strong></span>`; } if (data.exerciseTotal) { metaHTML += `<span>Exercise: <strong>${data.exerciseTotal} min</strong></span>`; } meta.innerHTML = metaHTML; const notes = document.createElement('p'); notes.className = 'entry-notes'; notes.textContent = data.notes || 'No notes for this day.'; const foodListContainer = document.createElement('div'); foodListContainer.className = 'food-list-container'; if (data.foods && data.foods.length > 0) { data.foods.forEach(foodName => { const pill = document.createElement('div'); pill.className = 'food-pill'; const name = document.createElement('span'); name.textContent = foodName; pill.appendChild(name); foodListContainer.appendChild(pill); }); } const waterListContainer = document.createElement('div'); waterListContainer.className = 'water-list-container'; if (data.water && data.water.length > 0) { data.water.forEach(ounces => { const pill = document.createElement('div'); pill.className = 'water-pill'; const name = document.createElement('span'); name.textContent = `${ounces} oz`; pill.appendChild(name); waterListContainer.appendChild(pill); }); } const exerciseListContainer = document.createElement('div'); exerciseListContainer.className = 'exercise-list-container'; if (data.exercises && data.exercises.length > 0) { data.exercises.forEach(ex => { const pill = document.createElement('div'); pill.className = 'exercise-pill'; const name = document.createElement('span'); name.textContent = `${ex.type}: ${ex.minutes} min`; pill.appendChild(name); exerciseListContainer.appendChild(pill); }); } entryDiv.appendChild(title); entryDiv.appendChild(meta); entryDiv.appendChild(notes); entryDiv.appendChild(foodListContainer); entryDiv.appendChild(waterListContainer); entryDiv.appendChild(exerciseListContainer); listContainer.appendChild(entryDiv); };

// --- CALENDAR & MODAL FUNCTIONS ---
const initializeCalendar = async () => { try { /* Fetch dates initially */ await fetchUserEntryDatesAndUpdateCalendar(); } catch(err) { console.error("Initial fetch for calendar failed:", err); } calendarInstance = flatpickr("#calendar-container", { inline: true, maxDate: "today", onDayCreate: (d, dStr, fp, dayElem) => { const dateString = getYYYYMMDD(dayElem.dateObj); if (userEntryDates.includes(dateString)) { dayElem.classList.add("has-entry"); } }, onChange: (selectedDates) => { if (selectedDates.length > 0) { const dateString = getYYYYMMDD(selectedDates[0]); loadPastEntries(dateString); closeCalendarModal(); } } }); };
const fetchUserEntryDatesAndUpdateCalendar = async () => { if (!currentUser) return; try { const q = db.collection('diary').where('userId', '==', currentUser.uid).select('date'); const snapshot = await q.get(); userEntryDates = snapshot.docs.map(doc => doc.data().date); if (calendarInstance) { calendarInstance.redraw(); } } catch (err) { console.error("Error fetching entry dates for calendar:", err); } }
const openCalendarModal = () => { fetchUserEntryDatesAndUpdateCalendar(); if (calendarModal) { calendarModal.style.display = "flex"; } }; const closeCalendarModal = () => { if (calendarModal) { calendarModal.style.display = "none"; } };
const openSettingsModal = () => { const startWeightInput = document.getElementById('starting-weight'); const goalWeightInput = document.getElementById('goal-weight'); const weeklyLossInput = document.getElementById('weekly-loss-goal'); if(startWeightInput) startWeightInput.value = userProfile.startingWeight || ''; if(goalWeightInput) goalWeightInput.value = userProfile.goalWeight || ''; if(weeklyLossInput) weeklyLossInput.value = userProfile.desiredWeeklyLoss || ''; document.getElementById('settings-success').textContent = ''; if (settingsModal) { settingsModal.style.display = "flex"; } }; const closeSettingsModal = () => { if (settingsModal) { settingsModal.style.display = "none"; } };

// --- UI HELPER FUNCTIONS ---
const addFoodItemToUI = () => { const foodInput = document.getElementById('food-input'); const foodName = foodInput.value.trim(); if (foodName) { renderFoodPill(foodName); foodInput.value = ''; } };
const renderFoodPill = (foodName) => { const foodList = document.getElementById('food-list'); const pill = document.createElement('div'); pill.className = 'food-pill'; const name = document.createElement('span'); name.textContent = foodName; const removeBtn = document.createElement('a'); removeBtn.className = 'remove-food'; removeBtn.textContent = 'x'; removeBtn.title = 'Remove'; removeBtn.addEventListener('click', () => { pill.remove(); }); pill.appendChild(name); pill.appendChild(removeBtn); foodList.appendChild(pill); };
const addWaterItemToUI = () => { const waterInput = document.getElementById('water-input'); const ounces = parseFloat(waterInput.value); if (ounces && ounces > 0) { renderWaterPill(ounces); waterInput.value = ''; updateTodayWaterTotal(); } };
const renderWaterPill = (ounces) => { const waterList = document.getElementById('water-list'); const pill = document.createElement('div'); pill.className = 'water-pill'; pill.dataset.ounces = ounces; const name = document.createElement('span'); name.textContent = `${ounces} oz`; const removeBtn = document.createElement('a'); removeBtn.className = 'remove-water'; removeBtn.textContent = 'x'; removeBtn.title = 'Remove'; removeBtn.addEventListener('click', () => { pill.remove(); updateTodayWaterTotal(); }); pill.appendChild(name); pill.appendChild(removeBtn); waterList.appendChild(pill); };
const updateTodayWaterTotal = () => { const waterTotalEl = document.getElementById('water-total-today'); const waterPills = document.querySelectorAll('#water-list .water-pill'); let total = 0; waterPills.forEach(pill => { total += parseFloat(pill.dataset.ounces); }); if(waterTotalEl) waterTotalEl.textContent = total; };
const addExerciseItemToUI = () => { const typeInput = document.getElementById('exercise-type'); const minutesInput = document.getElementById('exercise-minutes'); const type = typeInput.value; const minutes = parseFloat(minutesInput.value); if (minutes && minutes > 0) { renderExercisePill(type, minutes); minutesInput.value = ''; updateTodayExerciseTotal(); } };
const renderExercisePill = (type, minutes) => { const exerciseList = document.getElementById('exercise-list'); const pill = document.createElement('div'); pill.className = 'exercise-pill'; pill.dataset.type = type; pill.dataset.minutes = minutes; const name = document.createElement('span'); name.textContent = `${type}: ${minutes} min`; const removeBtn = document.createElement('a'); removeBtn.className = 'remove-exercise'; removeBtn.textContent = 'x'; removeBtn.title = 'Remove'; removeBtn.addEventListener('click', () => { pill.remove(); updateTodayExerciseTotal(); }); pill.appendChild(name); pill.appendChild(removeBtn); exerciseList.appendChild(pill); };
const updateTodayExerciseTotal = () => { const exerciseTotalEl = document.getElementById('exercise-total-today'); const exercisePills = document.querySelectorAll('#exercise-list .exercise-pill'); let total = 0; exercisePills.forEach(pill => { total += parseFloat(pill.dataset.minutes); }); if(exerciseTotalEl) exerciseTotalEl.textContent = total; };

// --- RUN THE APP ---
main();
