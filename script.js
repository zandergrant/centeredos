<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Centered - Your Daily Pulse</title>
    <link rel="stylesheet" href="style.css">
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
</head>
<body>
    <header>
        <h1>Welcome</h1>
        <div class="header-controls">
            <p>Status: <span id="auth-status">Connecting...</span></p>
            <button id="signout-btn" class="hidden">Sign Out</button>
        </div>
    </header>

    <div id="auth-container">
        <form id="login-form"><h3>Login</h3><input type="email" id="login-email" placeholder="Email" required><br><br><input type="password" id="login-password" placeholder="Password" required><br><br><button type="submit">Login</button></form><form id="signup-form" class="hidden"><h3>Sign Up</h3><input type="email" id="signup-email" placeholder="Email" required><br><br><input type="password" id="signup-password" placeholder="Password" required><br><br><button type="submit">Sign Up</button></form><p><a href="#" id="toggle-form-link">Need an account? Sign Up</a></p>
    </div>

    <main id="app-content" class="hidden">
        <div id="dashboard">
            <!-- Tile 1: Centeredness Graph -->
            <div class="tile full-width">
                <div class="tile-header">
                    <h3>Centeredness</h3>
                    <span id="pulse-date"></span>
                </div>
                <div class="tile-content">
                    <canvas id="centeredness-chart"></canvas>
                </div>
                <div class="tile-footer">
                    <button id="pulse-action-btn" class="btn-primary">Do Today's Pulse Check</button>
                </div>
            </div>

            <!-- Tile 2: Daily Reflection -->
            <div class="tile full-width" id="reflection-tile">
                <div class="tile-header">
                    <h3>Daily Reflection</h3>
                </div>
                <div class="tile-content">
                    <p id="ai-prompt-display">Loading your daily prompt...</p>
                    <textarea id="reflection-entry" placeholder="Write your reflection here..."></textarea>
                </div>
                <div class="tile-footer">
                    <button id="submit-reflection-btn">Save Reflection</button>
                </div>
            </div>

            <!-- Tile 3: AI Settings -->
            <div class="tile full-width">
                <div class="tile-header">
                    <h3>AI Prompt Settings</h3>
                </div>
                <div class="tile-content">
                    <p class="settings-description">Use this space to guide the AI. Tell it what kind of prompts you want. (e.g., "Focus on my work-life balance," or "Make the prompts sound like a stoic philosopher.")</p>
                    <textarea id="custom-prompt-input" placeholder="Enter your custom instructions here..."></textarea>
                </div>
                <div class="tile-footer">
                    <button id="save-settings-btn">Save Settings</button>
                </div>
            </div>
        </div>
    </main>
    
    <div id="pulse-modal" class="modal-overlay hidden" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div class="modal-content"><h2 id="modal-title">Daily Pulse Check-in</h2><form id="pulse-form"><div class="slider-group"><label for="steadiness">How steady do you feel right now?</label><input type="range" id="steadiness" name="steadiness" min="0" max="10" value="5"><span class="slider-value">5</span></div><div class="slider-group"><label for="presence">How present were you today?</label><input type="range" id="presence" name="presence" min="0" max="10" value="5"><span class="slider-value">5</span></div><div class="slider-group"><label for="connection">How connected vs. reactive did you feel?</label><input type="range" id="connection" name="connection" min="0" max="10" value="5"><span class="slider-value">5</span></div><div class="button-group"><button type="submit" class="btn-primary">Submit</button><button type="button" id="skip-now-btn">Skip for now</button><button type="button" id="skip-today-btn">Skip for today</button></div></form></div></div>

    <script type="module">
        import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
        import { getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
        import { getFirestore, doc, setDoc, getDoc, collection, query, where, getDocs, orderBy, limit } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

        const firebaseConfig = { apiKey: "AIzaSyAkF3nGHsrotcmT1Fen8Kujdlq5JIrqllk", authDomain: "centeredos.firebaseapp.com", projectId: "centeredos", storageBucket: "centeredos.firebasestorage.app", messagingSenderId: "129785779353", appId: "1:129785779353:web:f0c24b16f5e83e6f5c9408", measurementId: "G-7S84S0NHQV" };

        const app = initializeApp(firebaseConfig);
        const auth = getAuth(app);
        const db = getFirestore(app);

        let currentUserId = null;
        let centerednessChart = null;
        let userCustomPrompt = ''; // Variable to hold the user's custom instructions

        // --- Get all HTML elements ---
        const authContainer = document.getElementById('auth-container');
        const appContent = document.getElementById('app-content');
        const signoutBtn = document.getElementById('signout-btn');
        const authStatus = document.getElementById('auth-status');
        const modal = document.getElementById('pulse-modal');
        const pulseActionBtn = document.getElementById('pulse-action-btn');
        const pulseDateEl = document.getElementById('pulse-date');
        const aiPromptDisplay = document.getElementById('ai-prompt-display');
        const reflectionEntry = document.getElementById('reflection-entry');
        const submitReflectionBtn = document.getElementById('submit-reflection-btn');
        const customPromptInput = document.getElementById('custom-prompt-input');
        const saveSettingsBtn = document.getElementById('save-settings-btn');

        // --- Date Formatting ---
        function getFormattedDate(date = new Date()) {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        }
        pulseDateEl.textContent = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

        // --- Chart Logic ---
        function createOrUpdateChart(chartData) {
            const ctx = document.getElementById('centeredness-chart').getContext('2d');
            const labels = chartData.map(d => new Date(d.dateStr).toLocaleDateString('en-us', {month:'short', day:'numeric'}));
            const steadinessData = chartData.map(d => d.steadiness);
            const presenceData = chartData.map(d => d.presence);
            const connectionData = chartData.map(d => d.connection);
            if (centerednessChart) centerednessChart.destroy();
            centerednessChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels,
                    datasets: [
                        { label: 'Steadiness', data: steadinessData, borderColor: 'rgb(75, 192, 192)', tension: 0.1 },
                        { label: 'Presence', data: presenceData, borderColor: 'rgb(255, 159, 64)', tension: 0.1 },
                        { label: 'Connection', data: connectionData, borderColor: 'rgb(153, 102, 255)', tension: 0.1 }
                    ]
                },
                options: { scales: { y: { beginAtZero: true, max: 10 } } }
            });
        }

        // --- Data Loading ---
        async function loadDashboardData() {
            if (!currentUserId) return;
            loadPulseData();
            loadReflectionData();
            loadUserSettings(); // New function call
        }

        async function loadPulseData() {
            let chartData = [];
            for (let i = 6; i >= 0; i--) {
                const date = new Date(); date.setDate(date.getDate() - i); const dateStr = getFormattedDate(date);
                const docSnap = await getDoc(doc(db, "pulseCheckins", `${currentUserId}_${dateStr}`));
                if (docSnap.exists() && docSnap.data().status === 'completed') chartData.push({ dateStr, ...docSnap.data() });
            }
            createOrUpdateChart(chartData);
            const todayDocSnap = await getDoc(doc(db, "pulseCheckins", `${currentUserId}_${getFormattedDate()}`));
            const isSnoozed = localStorage.getItem('snoozeUntil') && new Date().getTime() < parseInt(localStorage.getItem('snoozeUntil'), 10);
            if (todayDocSnap.exists()) {
                pulseActionBtn.textContent = "Today's Pulse Submitted"; pulseActionBtn.disabled = true;
            } else {
                pulseActionBtn.textContent = "Do Today's Pulse Check"; pulseActionBtn.disabled = false;
                if (!isSnoozed) showModal();
            }
        }

        async function loadReflectionData() {
            const docSnap = await getDoc(doc(db, "reflections", `${currentUserId}_${getFormattedDate()}`));
            if (docSnap.exists()) {
                aiPromptDisplay.textContent = docSnap.data().promptText;
                reflectionEntry.value = docSnap.data().entryText || '';
            } else {
                generateAIPrompt();
            }
        }
        
        // --- User Settings ---
        async function loadUserSettings() {
            const docSnap = await getDoc(doc(db, "userSettings", currentUserId));
            if (docSnap.exists()) {
                userCustomPrompt = docSnap.data().customAIPrompt || '';
                customPromptInput.value = userCustomPrompt;
            }
        }

        saveSettingsBtn.addEventListener('click', async () => {
            if (!currentUserId) return;
            userCustomPrompt = customPromptInput.value;
            await setDoc(doc(db, "userSettings", currentUserId), { customAIPrompt: userCustomPrompt });
            alert("Settings saved! Your new prompt style will be used for tomorrow's reflection.");
        });

        // --- AI Prompt Generation ---
        async function generateAIPrompt() {
            aiPromptDisplay.textContent = "Thinking of a good prompt for you...";
            const q = query(collection(db, "reflections"), where("userId", "==", currentUserId), orderBy("submittedAt", "desc"), limit(5));
            const querySnapshot = await getDocs(q);
            let pastReflections = [];
            querySnapshot.forEach(doc => { if (doc.data().entryText) pastReflections.push(doc.data().entryText); });

            // This is the "Inception" part! We combine our base prompt with the user's custom instructions.
            const baseSystemPrompt = "You are a thoughtful journal assistant. Your goal is to provide a concise (under 180 characters) and insightful CBT-based prompt to encourage self-reflection. If the user has past reflections, base your prompt on their recent themes. If they have no past entries, provide a general but gentle CBT prompt about thoughts, feelings, or behaviors.";
            let finalSystemPrompt = baseSystemPrompt;
            if (userCustomPrompt) {
                finalSystemPrompt += `\n\nAdditionally, follow these special instructions from the user: "${userCustomPrompt}"`;
            }
            
            let userQuery = "Please generate a new journal prompt for me.";
            if (pastReflections.length > 0) userQuery += "\n\nHere are my most recent reflections:\n- " + pastReflections.join('\n- ');
            
            try {
                const apiKey = "";
                const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;
                const payload = { contents: [{ parts: [{ text: userQuery }] }], systemInstruction: { parts: [{ text: finalSystemPrompt }] } };
                const response = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
                const result = await response.json();
                const newPrompt = result.candidates[0].content.parts[0].text;

                aiPromptDisplay.textContent = newPrompt;
                await setDoc(doc(db, "reflections", `${currentUserId}_${getFormattedDate()}`), { promptText: newPrompt, entryText: '', userId: currentUserId, submittedAt: new Date().toISOString() });
            } catch (error) {
                console.error("AI Prompt generation failed:", error);
                aiPromptDisplay.textContent = "What is one thought you've had today that you'd like to look at more closely?";
            }
        }
        
        // --- Auth & Event Listeners ---
        onAuthStateChanged(auth, user => {
            if (user) {
                currentUserId = user.uid; authStatus.textContent = `Connected (${user.email})`;
                authContainer.classList.add('hidden'); appContent.classList.remove('hidden'); signoutBtn.classList.remove('hidden');
                loadDashboardData();
            } else {
                currentUserId = null; authStatus.textContent = 'Not connected';
                authContainer.classList.remove('hidden'); appContent.classList.add('hidden'); signoutBtn.classList.add('hidden');
            }
        });
        document.getElementById('toggle-form-link').addEventListener('click', e => { e.preventDefault(); document.getElementById('signup-form').classList.toggle('hidden'); document.getElementById('login-form').classList.toggle('hidden'); e.target.textContent = document.getElementById('signup-form').classList.contains('hidden') ? 'Need an account? Sign Up' : 'Already have an account? Login'; });
        document.getElementById('signup-form').addEventListener('submit', e => { e.preventDefault(); createUserWithEmailAndPassword(auth, e.target['signup-email'].value, e.target['signup-password'].value).catch(error => alert(error.message)); });
        document.getElementById('login-form').addEventListener('submit', e => { e.preventDefault(); signInWithEmailAndPassword(auth, e.target['login-email'].value, e.target['login-password'].value).catch(error => alert(error.message)); });
        signoutBtn.addEventListener('click', () => signOut(auth));
        function showModal() { modal.classList.remove('hidden'); }
        function hideModal() { modal.classList.add('hidden'); }
        pulseActionBtn.addEventListener('click', showModal);
        document.getElementById('pulse-form').addEventListener('submit', async (event) => { event.preventDefault(); if (!currentUserId) return; const docId = `${currentUserId}_${getFormattedDate()}`; await setDoc(doc(db, "pulseCheckins", docId), { steadiness: parseInt(event.target.steadiness.value, 10), presence: parseInt(event.target.presence.value, 10), connection: parseInt(event.target.connection.value, 10), status: 'completed', submittedAt: new Date().toISOString() }); loadPulseData(); hideModal(); });
        document.getElementById('skip-now-btn').addEventListener('click', () => { localStorage.setItem('snoozeUntil', new Date().getTime() + (10 * 60 * 1000)); hideModal(); });
        document.getElementById('skip-today-btn').addEventListener('click', async () => { if (!currentUserId) return; const docId = `${currentUserId}_${getFormattedDate()}`; await setDoc(doc(db, "pulseCheckins", docId), { status: 'skipped', submittedAt: new Date().toISOString() }); loadPulseData(); hideModal(); });
        submitReflectionBtn.addEventListener('click', async () => { if (!currentUserId) return; await setDoc(doc(db, "reflections", `${currentUserId}_${getFormattedDate()}`), { entryText: reflectionEntry.value, updatedAt: new Date().toISOString() }, { merge: true }); alert("Reflection saved!"); });
        document.querySelectorAll('.slider-group input[type="range"]').forEach(slider => { const valueSpan = slider.nextElementSibling; slider.addEventListener('input', (e) => { valueSpan.textContent = e.target.value; }); valueSpan.textContent = slider.value; });
    </script>
</body>
</html>

