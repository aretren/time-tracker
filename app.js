document.addEventListener('DOMContentLoaded', () => {
    // --- AUTH GUARD ---
    const loggedInUser = sessionStorage.getItem('loggedInUser');
    const usernameDisplay = document.getElementById('username-display');
    if (!loggedInUser) {
        window.location.href = 'login.html';
        return; // Stop script execution
    }
    usernameDisplay.textContent = `Пользователь: ${loggedInUser}`;

    // --- FIREBASE SETUP ---
    const firebaseConfig = {
        apiKey: "AIzaSyD2AgCF39T8Zk_kDRF6M9IHiMRz6stp_HA",
        authDomain: "time-tracker-15d2b.firebaseapp.com",
        databaseURL: "https://time-tracker-15d2b-default-rtdb.europe-west1.firebasedatabase.app",
        projectId: "time-tracker-15d2b",
        storageBucket: "time-tracker-15d2b.appspot.com",
        messagingSenderId: "697777625968",
        appId: "1:697777625968:web:fdb1bb780b20051d0ccdb5",
        measurementId: "G-Y877PXDVTY"
    };
    firebase.initializeApp(firebaseConfig);
    const database = firebase.database();

    // --- DOM ELEMENTS ---
    const hourlyScheduleEl = document.getElementById('hourly-schedule');
    const brushesEl = document.querySelector('.brushes');
    const radialMenuEl = document.getElementById('radial-menu');
    const radialMenuCenterEl = document.getElementById('radial-menu-center');
    const radialSegments = Array.from(radialMenuEl.querySelectorAll('.radial-segment'));

    // --- STATE ---
    let activeBrush = brushesEl.querySelector('.brush.active');
    let selectedDate = new Date();
    let longPressTimer;
    let interactionStartTime;
    let activeHourContainer = null;
    let menuIsActive = false;
    let selectedSegmentValue = 0;
    let dayData = {}; // Cache for the day's data

    // --- CONSTANTS ---
    const LONG_PRESS_DURATION = 700; // ms
    const NUM_SEGMENTS = 6;

    // --- FIREBASE FUNCTIONS ---
    const getDbPathForDate = (date) => {
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        const day = date.getDate();
        return `userData/${loggedInUser}/${year}/${month}/${day}`;
    };

    const saveHourStatus = (date, hour, segments) => {
        dayData[hour] = segments; // Update local cache
        const dbPath = `${getDbPathForDate(date)}/${hour}`;
        database.ref(dbPath).set(segments);
    };

    const loadDayStatus = (date) => {
        const dbPath = getDbPathForDate(date);
        database.ref(dbPath).once('value', (snapshot) => {
            dayData = snapshot.val() || {};
            updateDayDisplay();
        });
    };

    // --- UI RENDERING ---
    const renderHour = (hourContainer, segments) => {
        const fillWrapper = hourContainer.querySelector('.hour-fill-wrapper');
        fillWrapper.innerHTML = ''; // Clear previous fill

        if (!segments) {
            return; // Hour is empty
        }

        // Ensure we have a proper, full-length array to work with
        const segmentsArray = Array(NUM_SEGMENTS).fill('clear');
        const inputSegments = Array.isArray(segments) ? segments : Object.values(segments);
        for (let i = 0; i < inputSegments.length; i++) {
            if (i < NUM_SEGMENTS) {
                segmentsArray[i] = inputSegments[i] || 'clear';
            }
        }

        if (segmentsArray.every(s => s === 'clear')) {
            return; // Hour is fully clear
        }

        let currentStatus = segmentsArray[0];
        let count = 1;
        for (let i = 1; i < NUM_SEGMENTS; i++) {
            if (segmentsArray[i] === currentStatus) {
                count++;
            } else {
                const fillSegment = document.createElement('div');
                fillSegment.classList.add('fill-segment', `status-${currentStatus}`);
                fillSegment.style.flexGrow = count;
                fillWrapper.appendChild(fillSegment);
                
                currentStatus = segmentsArray[i];
                count = 1;
            }
        }
        // Append the last group
        const fillSegment = document.createElement('div');
        fillSegment.classList.add('fill-segment', `status-${currentStatus}`);
        fillSegment.style.flexGrow = count;
        fillWrapper.appendChild(fillSegment);
    };

    const updateDayDisplay = () => {
        const processedData = JSON.parse(JSON.stringify(dayData)); // Deep copy

        // Gap-filling logic - process backwards from the end of the day
        for (let hour = 20; hour >= 8; hour--) {
            const segmentsRaw = processedData[hour] || [];
            
            // ALWAYS normalize to a full array to work with it reliably.
            const currentHourArray = Array(NUM_SEGMENTS).fill('clear');
            const inputSegments = Array.isArray(segmentsRaw) ? segmentsRaw : Object.values(segmentsRaw);
            for(let i=0; i < inputSegments.length; i++) {
                if (inputSegments[i]) currentHourArray[i] = inputSegments[i];
            }
            
            const isPartiallyFilled = currentHourArray.some(s => s !== 'clear') && currentHourArray.some(s => s === 'clear');
            
            if (isPartiallyFilled) {
                const nextHour = hour + 1;
                if (nextHour > 21) continue;

                const nextHourSegmentsRaw = processedData[nextHour] || [];
                const nextHourSegments = Array.isArray(nextHourSegmentsRaw) ? nextHourSegmentsRaw : Object.values(nextHourSegmentsRaw);
                const nextHourFirstStatus = nextHourSegments[0] || 'clear';

                if (nextHourFirstStatus !== 'clear') {
                    let wasChanged = false;
                    // Fill the rest of the array.
                    for (let i = 0; i < NUM_SEGMENTS; i++) {
                        if (currentHourArray[i] === 'clear') {
                           currentHourArray[i] = nextHourFirstStatus;
                           wasChanged = true;
                        }
                    }
                    // If the array was modified, save it.
                    if (wasChanged) {
                        saveHourStatus(selectedDate, hour, currentHourArray);
                    }
                }
            }
             // Store the potentially modified (or just normalized) array back into our processed data
            processedData[hour] = currentHourArray;
        }
        
        // Render all hours from the processed data
        document.querySelectorAll('.hour-slot-container').forEach(container => {
            const hour = container.dataset.hour;
            renderHour(container, processedData[hour]);
        });
    };

    // --- RADIAL MENU FUNCTIONS ---
    const getSegmentFromCoordinates = (x, y) => {
        const rect = radialMenuEl.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const angle = Math.atan2(y - centerY, x - centerX) * (180 / Math.PI) + 90;
        const normalizedAngle = (angle < 0 ? angle + 360 : angle);
        return Math.floor(normalizedAngle / (360 / NUM_SEGMENTS)) + 1;
    };

    const updateRadialMenu = (value) => {
        selectedSegmentValue = value;
        const status = activeBrush.dataset.status;
        const color = status === 'clear' ? 'transparent' : getComputedStyle(activeBrush).backgroundColor;
        radialSegments.forEach((segment, index) => {
            segment.style.backgroundColor = (index < value) ? color : 'transparent';
            segment.classList.toggle('active', index < value);
        });
        radialMenuCenterEl.classList.toggle('has-value', value > 0);
        if (value > 0) radialMenuCenterEl.dataset.text = `${value * 10} мин`;
    };

    const showRadialMenu = (e) => {
        menuIsActive = true;
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        radialMenuEl.style.left = `${clientX}px`;
        radialMenuEl.style.top = `${clientY}px`;
        radialMenuEl.classList.remove('hidden');
        radialMenuEl.classList.add('visible');
        updateRadialMenu(0);
    };

    const hideRadialMenu = () => {
        if (!menuIsActive) return;
        menuIsActive = false;
        activeHourContainer = null;
        radialMenuEl.classList.remove('visible');
        setTimeout(() => radialMenuEl.classList.add('hidden'), 200);
    };

    // --- INTERACTION HANDLERS ---
    const handleInteractionStart = (e) => {
        e.preventDefault();
        hideRadialMenu();
        interactionStartTime = performance.now();
        activeHourContainer = e.currentTarget;
        longPressTimer = setTimeout(() => {
            longPressTimer = null;
            showRadialMenu(e);
        }, LONG_PRESS_DURATION);
    };

    const handleInteractionMove = (e) => {
        if (!menuIsActive || !activeHourContainer) return;
        e.preventDefault();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        const segmentValue = getSegmentFromCoordinates(clientX, clientY);
        if (segmentValue !== selectedSegmentValue) {
            updateRadialMenu(segmentValue);
        }
    };

    const handleInteractionEnd = (e) => {
        clearTimeout(longPressTimer);
        const interactionDuration = performance.now() - interactionStartTime;

        if (menuIsActive) { // Long press ended
            e.preventDefault();
            const hour = activeHourContainer.dataset.hour;
            const newStatus = activeBrush.dataset.status;
            // Create a fresh array of segments. The radial selection overwrites the previous state.
            let segments = Array(NUM_SEGMENTS).fill('clear');

            // Fill based on how many segments were selected in the radial menu.
            for (let i = 0; i < selectedSegmentValue; i++) {
                segments[i] = newStatus;
            }
            
            saveHourStatus(selectedDate, hour, segments);
            updateDayDisplay();
            hideRadialMenu();

        } else if (interactionDuration < LONG_PRESS_DURATION && activeHourContainer) { // Click detected
            const hour = activeHourContainer.dataset.hour;
            const segmentsData = dayData[hour];
            let segments = segmentsData ? (Array.isArray(segmentsData) ? [...segmentsData] : Object.values(segmentsData)) : Array(NUM_SEGMENTS).fill('clear');
            const newStatus = activeBrush.dataset.status;

            // If all segments already have the new status, clear them. Otherwise, fill them.
            const isAlreadyFilled = segments.every(s => s === newStatus);
            const finalStatus = isAlreadyFilled ? 'clear' : newStatus;
            
            saveHourStatus(selectedDate, hour, Array(NUM_SEGMENTS).fill(finalStatus));
            updateDayDisplay();
        }
    };


    // --- UI GENERATION ---
    const generateHourlySlots = () => {
        hourlyScheduleEl.innerHTML = '';
        for (let hour = 8; hour <= 21; hour++) {
            const container = document.createElement('div');
            container.classList.add('hour-slot-container');
            container.dataset.hour = hour;

            const label = document.createElement('div');
            label.classList.add('hour-label');
            label.textContent = `${hour}`; // Changed to just the hour

            const fillWrapper = document.createElement('div');
            fillWrapper.classList.add('hour-fill-wrapper');

            container.appendChild(label);
            container.appendChild(fillWrapper); // The wrapper is now a sibling of the label
            hourlyScheduleEl.appendChild(container);

            container.addEventListener('mousedown', handleInteractionStart);
            container.addEventListener('touchstart', handleInteractionStart, { passive: false });
        }
    };

    const handleDateChange = (date) => {
        selectedDate = new Date(date);
        generateHourlySlots();
        loadDayStatus(selectedDate);
    };

    // --- GLOBAL EVENT LISTENERS ---
    brushesEl.addEventListener('click', (e) => {
        if (e.target.classList.contains('brush')) {
            activeBrush.classList.remove('active');
            activeBrush = e.target;
            activeBrush.classList.add('active');
        }
    });

    document.addEventListener('mousemove', handleInteractionMove);
    document.addEventListener('touchmove', handleInteractionMove, { passive: false });
    document.addEventListener('mouseup', handleInteractionEnd);
    document.addEventListener('touchend', handleInteractionEnd);

    // --- INITIALIZATION ---
    const calendar = new VanillaCalendar('#calendar-container', {
        actions: { clickDay(e, dates) { if (dates[0]) handleDateChange(dates[0]); } },
        settings: { lang: 'ru', selection: { day: 'single' } }
    });
    calendar.init();

    handleDateChange(new Date());
});
