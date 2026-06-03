document.addEventListener('DOMContentLoaded', () => {
    // --- AUTH GUARD ---
    const loggedInUser = sessionStorage.getItem('loggedInUser');
    const isAdmin = sessionStorage.getItem('isAdmin');
    const usernameDisplay = document.getElementById('username-display');
    const adminPanelLink = document.getElementById('admin-panel-link');

    if (!loggedInUser) {
        window.location.href = 'login.html';
        return; // Stop script execution
    }
    usernameDisplay.textContent = `Пользователь: ${loggedInUser}`;

    if (isAdmin === 'true') {
        adminPanelLink.classList.remove('hidden');
    }

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
    
    // Interaction state
    let isMouseDown = false;
    let isDragging = false;
    let startPosition = { x: 0, y: 0 };


    // --- CONSTANTS ---
    const LONG_PRESS_DURATION = 500; // ms
    const NUM_SEGMENTS = 6;
    const DRAG_THRESHOLD = 5; // pixels

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
        if (!hourContainer) return;
        const fillWrapper = hourContainer.querySelector('.hour-fill-wrapper');
        fillWrapper.innerHTML = ''; // Clear previous fill

        if (!segments) {
            return; // Hour is empty
        }

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
        const fillSegment = document.createElement('div');
        fillSegment.classList.add('fill-segment', `status-${currentStatus}`);
        fillSegment.style.flexGrow = count;
        fillWrapper.appendChild(fillSegment);
    };

    const updateDayDisplay = () => {
        const processedData = JSON.parse(JSON.stringify(dayData)); 

        for (let hour = 20; hour >= 8; hour--) {
            const segmentsRaw = processedData[hour] || [];
            
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
                const nextHourFirstStatus = nextHourSegments.find(s => s !== 'clear') || 'clear';

                if (nextHourFirstStatus !== 'clear') {
                    let wasChanged = false;
                    for (let i = 0; i < NUM_SEGMENTS; i++) {
                        if (currentHourArray[i] === 'clear') {
                           currentHourArray[i] = nextHourFirstStatus;
                           wasChanged = true;
                        }
                    }
                    if (wasChanged) {
                        saveHourStatus(selectedDate, hour, currentHourArray);
                    }
                }
            }
            processedData[hour] = currentHourArray;
        }
        
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
        isMouseDown = false; // Important: Stop other interactions once menu is up
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
        radialMenuEl.classList.remove('visible');
        setTimeout(() => radialMenuEl.classList.add('hidden'), 200);
    };

    // --- INTERACTION HANDLERS ---
    const handleInteractionStart = (e) => {
        e.preventDefault();
        hideRadialMenu();
        
        isMouseDown = true;
        isDragging = false;

        interactionStartTime = performance.now();
        activeHourContainer = e.currentTarget;
        
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        startPosition = { x: clientX, y: clientY };

        longPressTimer = setTimeout(() => {
            if (!isDragging) {
                showRadialMenu(e);
            }
        }, LONG_PRESS_DURATION);
    };

    const paintHour = (hourContainer) => {
        if (!hourContainer) return;

        const hour = hourContainer.dataset.hour;
        const newStatus = activeBrush.dataset.status;
        
        const segments = Array(NUM_SEGMENTS).fill(newStatus);
        saveHourStatus(selectedDate, hour, segments);
        renderHour(hourContainer, segments);
    }

    const handleInteractionMove = (e) => {
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;

        if (menuIsActive) {
            e.preventDefault();
            const segmentValue = getSegmentFromCoordinates(clientX, clientY);
            if (segmentValue !== selectedSegmentValue) {
                updateRadialMenu(segmentValue);
            }
            return;
        }

        if (!isMouseDown) return;

        if (!isDragging) {
            const distance = Math.sqrt(
                Math.pow(clientX - startPosition.x, 2) + 
                Math.pow(clientY - startPosition.y, 2)
            );
            if (distance > DRAG_THRESHOLD) {
                isDragging = true;
                clearTimeout(longPressTimer);
                paintHour(activeHourContainer);
            }
        }

        if (isDragging) {
            let foundContainer = null;
            document.querySelectorAll('.hour-slot-container').forEach(container => {
                const rect = container.getBoundingClientRect();
                if (
                    clientX >= rect.left && clientX <= rect.right &&
                    clientY >= rect.top && clientY <= rect.bottom
                ) {
                    foundContainer = container;
                }
            });
            paintHour(foundContainer);
        }
    };

    const handleInteractionEnd = (e) => {
        const wasLongPress = (performance.now() - interactionStartTime) >= LONG_PRESS_DURATION;
        clearTimeout(longPressTimer);
        
        if (menuIsActive) {
            e.preventDefault();
            const hour = activeHourContainer.dataset.hour;
            const newStatus = activeBrush.dataset.status;
            let segments = Array(NUM_SEGMENTS).fill('clear');
            for (let i = 0; i < selectedSegmentValue; i++) {
                segments[i] = newStatus;
            }
            saveHourStatus(selectedDate, hour, segments);
            updateDayDisplay();
            hideRadialMenu();
        } else if (isDragging) {
            updateDayDisplay();
        } else if (!wasLongPress) { // Click
            const hour = activeHourContainer.dataset.hour;
            const segmentsData = dayData[hour];
            let segments = segmentsData ? (Array.isArray(segmentsData) ? [...segmentsData] : Object.values(segmentsData)) : Array(NUM_SEGMENTS).fill('clear');
            const newStatus = activeBrush.dataset.status;

            const isAlreadyFilled = segments.every(s => s === newStatus);
            const finalStatus = isAlreadyFilled ? 'clear' : newStatus;
            
            saveHourStatus(selectedDate, hour, Array(NUM_SEGMENTS).fill(finalStatus));
            updateDayDisplay();
        }

        isMouseDown = false;
        isDragging = false;
        activeHourContainer = null;

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
            label.textContent = `${hour}:00`;

            const fillWrapper = document.createElement('div');
            fillWrapper.classList.add('hour-fill-wrapper');

            container.appendChild(label);
            container.appendChild(fillWrapper);
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
