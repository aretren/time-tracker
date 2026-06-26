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
    const calendarContainer = document.getElementById('calendar-container');
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
    let currentCalendarDate = new Date(); // State for the main calendar view
    // --- TEMPLATE MODAL ELEMENTS ---
    const templateBtn = document.getElementById('template-btn');
    const templateModal = document.getElementById('template-modal');
    const closeTemplateModalBtn = templateModal.querySelector('.close-btn');
    const templateScheduleEl = document.getElementById('template-schedule');
    const templateMonthDisplay = document.getElementById('template-month-display');
    const templatePrevMonthBtn = document.getElementById('template-prev-month-btn');
    const templateNextMonthBtn = document.getElementById('template-next-month-btn');
    const applyWeekdaysBtn = document.getElementById('apply-weekdays-btn');
    const applyWeekendsBtn = document.getElementById('apply-weekends-btn');
    const applyAllDaysBtn = document.getElementById('apply-all-days-btn');
    const applyMondayBtn = document.getElementById('apply-monday-btn');
    const applyTuesdayBtn = document.getElementById('apply-tuesday-btn');
    const applyWednesdayBtn = document.getElementById('apply-wednesday-btn');
    const applyThursdayBtn = document.getElementById('apply-thursday-btn');
    const applyFridayBtn = document.getElementById('apply-friday-btn');
    const applySaturdayBtn = document.getElementById('apply-saturday-btn');
    const applySundayBtn = document.getElementById('apply-sunday-btn');
    const templateBrushesEl = document.getElementById('template-brushes');

    // --- HELP MODAL ELEMENTS ---
    const helpBtn = document.getElementById('help-btn'); // Can be null if not in HTML
    const helpModal = document.getElementById('help-modal'); // Can be null
    const closeHelpModalBtn = document.getElementById('close-help-modal-btn'); // Can be null

    // --- SUGGESTION BOX ELEMENTS ---
    const suggestionFab = document.getElementById('suggestion-fab');
    const suggestionModal = document.getElementById('suggestion-modal');
    const closeSuggestionModalBtn = document.getElementById('close-suggestion-modal-btn');
    const suggestionListEl = document.getElementById('suggestion-list');
    const completedSuggestionListEl = document.getElementById('completed-suggestion-list');
    const showAddSuggestionModalBtn = document.getElementById('show-add-suggestion-modal-btn');

    const addSuggestionModal = document.getElementById('add-suggestion-modal');
    const closeAddSuggestionModalBtn = document.getElementById('close-add-suggestion-modal-btn');
    const addSuggestionForm = document.getElementById('add-suggestion-form');
    const suggestionTitleInput = document.getElementById('suggestion-title-input');
    const suggestionTextInput = document.getElementById('suggestion-text-input');


    
    // Interaction state
    let isMouseDown = false;
    let isDragging = false;
    let startPosition = { x: 0, y: 0 };


    // --- TEMPLATE STATE ---
    let templateDate = new Date();
    let templateData = {};
    let activeTemplateBrush = templateBrushesEl.querySelector('.brush.active');

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
        database.ref(dbPath).set(segments).then(async () => {
            // After saving, trigger a recalculation for the current month's highlights.
            // We use await to ensure calculation is done before trying to highlight.
            await recalculateAndSaveIncompleteDays(currentCalendarDate);
            // Now re-render the highlights with the fresh data.
            await highlightIncompleteDays(currentCalendarDate);
        });
    };

    const recalculateAndSaveIncompleteDays = async (date) => {
        const year = date.getFullYear();
        const monthOneBased = date.getMonth() + 1; // Use 1-based month consistently
        const monthPath = `userData/${loggedInUser}/${year}/${monthOneBased}`;
        const snapshot = await database.ref(monthPath).once('value');
        const monthData = snapshot.val() || {};

        const daysInMonth = new Date(year, monthOneBased, 0).getDate();
        const totalSegmentsPerDay = 14 * 6; // 14 hours * 6 segments
        const incompleteDays = {};

        for (let day = 1; day <= daysInMonth; day++) {
            const dayData = monthData[day];
            let filledSegments = 0;
            if (dayData) {
                for (let hour = 9; hour <= 22; hour++) {
                    if (dayData[hour]) {
                        const rawSegments = dayData[hour];
                        // Ensure 'segments' is a dense array with actual values or 'clear'
                        const segments = Array.from({length: NUM_SEGMENTS}, (_, i) => rawSegments[i] || 'clear');
                        filledSegments += segments.filter(s => s !== 'clear').length;
                    }
                }
            }
            // Mark day as incomplete if it's not 100% full
            if (filledSegments < totalSegmentsPerDay) {
                incompleteDays[day] = true; // Mark day as incomplete
            }
        }
        // Save the calculated highlights to a new location in DB
        const highlightsPath = `userHighlights/${loggedInUser}/incompleteDays/${year}/${monthOneBased}`;
        database.ref(highlightsPath).set(incompleteDays);
    };

    const calculateAndSaveIncompleteDaysForMultipleMonths = async () => {
        const today = new Date();
        // Calculate for current, next, and the month after
        const monthsToCalculate = [
            new Date(today.getFullYear(), today.getMonth(), 1),
            new Date(today.getFullYear(), today.getMonth() + 1, 1),
            new Date(today.getFullYear(), today.getMonth() + 2, 1)
        ];
        await Promise.all(monthsToCalculate.map(date => recalculateAndSaveIncompleteDays(date)));
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

        for (let hour = 21; hour >= 9; hour--) {
            const segmentsRaw = processedData[hour] || [];
            
            const currentHourArray = Array(NUM_SEGMENTS).fill('clear');
            const inputSegments = Array.isArray(segmentsRaw) ? segmentsRaw : Object.values(segmentsRaw);
            for(let i=0; i < inputSegments.length; i++) {
                if (inputSegments[i]) currentHourArray[i] = inputSegments[i];
            }
            
            const isPartiallyFilled = currentHourArray.some(s => s !== 'clear') && currentHourArray.some(s => s === 'clear');
            
            if (isPartiallyFilled) {
                const nextHour = hour + 1;
                if (nextHour > 22) continue;

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
        
        if (!activeHourContainer && !menuIsActive) return; // Add guard to prevent error

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
        for (let hour = 9; hour <= 22; hour++) {
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

    const highlightIncompleteDays = async (date) => {
         try {
             const year = date.getFullYear();
             const monthOneBased = date.getMonth() + 1;
             const highlightsPath = `userHighlights/${loggedInUser}/incompleteDays/${year}/${monthOneBased}`;
             const snapshot = await database.ref(highlightsPath).once('value');
             const incompleteDays = snapshot.val() || {};

             // Clear previous highlights
             const dayButtons = calendarContainer.querySelectorAll('.vanilla-calendar-day__btn');
             dayButtons.forEach(btn => {
                btn.classList.remove('highlight-incomplete');
             });

             // Apply new highlights from pre-calculated data
             Object.keys(incompleteDays).forEach(day => {
                 const dateStr = `${year}-${String(monthOneBased).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                 const dayEl = calendarContainer.querySelector(`[data-calendar-day="${dateStr}"]`);
                 if (dayEl) {
                     dayEl.classList.add('highlight-incomplete');
                 }
             });
         } finally { }
    };

    templateBrushesEl.addEventListener('click', (e) => {
        if (e.target.classList.contains('brush')) {
            activeTemplateBrush.classList.remove('active');
            activeTemplateBrush = e.target;
            activeTemplateBrush.classList.add('active');
        }
    });

    // --- TEMPLATE MODAL LOGIC ---
    const showTemplateModal = () => {
        templateDate = new Date(selectedDate); // Sync with main calendar's month
        templateData = {}; // Reset template on open
        generateTemplateSlots();
        updateTemplateMonthDisplay();
        templateModal.classList.add('visible');
    };
    const hideTemplateModal = () => templateModal.classList.remove('visible');

    const generateTemplateSlots = () => {
        // Clear existing content and add a loading state if needed
        templateScheduleEl.innerHTML = '<p>Загрузка слотов...</p>'; 

        // Use a timeout to ensure the loading message renders before the heavy loop
        setTimeout(() => {
        templateScheduleEl.innerHTML = '';
        for (let hour = 9; hour <= 22; hour++) {
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
            templateScheduleEl.appendChild(container);

            // Simplified click-to-fill logic for template
            container.addEventListener('click', () => {
                const hour = container.dataset.hour;
                const newStatus = activeTemplateBrush.dataset.status;
                const isAlreadyFilled = templateData[hour] && templateData[hour].every(s => s === newStatus);
                
                templateData[hour] = Array(NUM_SEGMENTS).fill(isAlreadyFilled ? 'clear' : newStatus);
                renderHour(container, templateData[hour]);
            });
        }
        }, 0);
    };

    const updateTemplateMonthDisplay = () => {
        const monthName = templateDate.toLocaleString('ru-RU', { month: 'long' });
        const capitalizedMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1);
        templateMonthDisplay.textContent = `${capitalizedMonth} ${templateDate.getFullYear()}`;
    };

    const applyTemplate = async (applyTo) => {
        const year = templateDate.getFullYear();
        const month = templateDate.getMonth();
        const monthName = templateDate.toLocaleString('ru-RU', { month: 'long' });

        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const daysToUpdate = [];

        for (let day = 1; day <= daysInMonth; day++) {
            const d = new Date(year, month, day);
            const dayOfWeek = d.getDay(); // 0=Sun, 6=Sat

            if (applyTo === 'weekdays' && dayOfWeek >= 1 && dayOfWeek <= 5) {
                daysToUpdate.push(day);
            } else if (applyTo === 'weekends' && (dayOfWeek === 0 || dayOfWeek === 6)) {
                daysToUpdate.push(day);
            } else if (applyTo === 'monday' && dayOfWeek === 1) { daysToUpdate.push(day);
            } else if (applyTo === 'tuesday' && dayOfWeek === 2) { daysToUpdate.push(day);
            } else if (applyTo === 'wednesday' && dayOfWeek === 3) { daysToUpdate.push(day);
            } else if (applyTo === 'thursday' && dayOfWeek === 4) { daysToUpdate.push(day);
            } else if (applyTo === 'friday' && dayOfWeek === 5) { daysToUpdate.push(day);
            } else if (applyTo === 'saturday' && dayOfWeek === 6) { daysToUpdate.push(day);
            } else if (applyTo === 'sunday' && dayOfWeek === 0) { daysToUpdate.push(day);
            } else if (applyTo === 'all') {
                daysToUpdate.push(day);
            }
        }

        if (daysToUpdate.length === 0) {
            alert(`В месяце ${monthName.toLowerCase()} нет дней для применения шаблона.`);
            return;
        }

        const dayNames = {
            weekdays: 'будние дни',
            weekends: 'выходные',
            all: 'все дни',
            monday: 'понедельники',
            tuesday: 'вторники',
            wednesday: 'среды',
            thursday: 'четверги',
            friday: 'пятницы',
            saturday: 'субботы',
            sunday: 'воскресенья'
        };

        const targetDaysStr = dayNames[applyTo] || 'выбранные дни';

        if (!confirm(`Вы уверены, что хотите применить этот шаблон ко всем ${targetDaysStr} (${daysToUpdate.length} дн.) в месяце ${monthName}? Существующие данные за эти дни будут перезаписаны.`)) {
            return;
        }

        const updates = {};
        daysToUpdate.forEach(day => {
            const path = `userData/${loggedInUser}/${year}/${month + 1}/${day}`;
            updates[path] = templateData;
        });

        // Show loading state
        applyWeekdaysBtn.disabled = true;
        applyWeekendsBtn.disabled = true;
        applyAllDaysBtn.disabled = true;
        applyMondayBtn.disabled = true;
        applyTuesdayBtn.disabled = true;
        applyWednesdayBtn.disabled = true;
        applyThursdayBtn.disabled = true;
        applyFridayBtn.disabled = true;
        applySaturdayBtn.disabled = true;
        applySundayBtn.disabled = true;
        applyWeekdaysBtn.textContent = 'Применение...';

        try {
            await database.ref().update(updates);
            alert('Шаблон успешно применен!');
            hideTemplateModal();
            // Refresh current view
            handleDateChange(selectedDate); // This reloads the day view
            // The recalculation is now triggered by saveHourStatus, so we just need to re-render
            setTimeout(() => highlightIncompleteDays(currentCalendarDate), 500); // Give DB time to update
        } catch (error) {
            console.error("Error applying template:", error);
            alert("Произошла ошибка при применении шаблона.");
        } finally {
            // Reset button state
            applyWeekdaysBtn.disabled = false;
            applyAllDaysBtn.disabled = false;
            applyWeekendsBtn.disabled = false;
            applyMondayBtn.disabled = false;
            applyTuesdayBtn.disabled = false;
            applyWednesdayBtn.disabled = false;
            applyThursdayBtn.disabled = false;
            applyFridayBtn.disabled = false;
            applySaturdayBtn.disabled = false;
            applySundayBtn.disabled = false;
            applyWeekdaysBtn.textContent = 'Применить к будням';
        }
    };

    templateBtn.addEventListener('click', showTemplateModal);
    closeTemplateModalBtn.addEventListener('click', hideTemplateModal);
    templatePrevMonthBtn.addEventListener('click', () => {
        templateDate.setMonth(templateDate.getMonth() - 1);
        updateTemplateMonthDisplay();
    });
    templateNextMonthBtn.addEventListener('click', () => {
        templateDate.setMonth(templateDate.getMonth() + 1);
        updateTemplateMonthDisplay();
    });
    applyWeekdaysBtn.addEventListener('click', () => applyTemplate('weekdays'));
    applyWeekendsBtn.addEventListener('click', () => applyTemplate('weekends'));
    applyAllDaysBtn.addEventListener('click', () => applyTemplate('all'));
    applyMondayBtn.addEventListener('click', () => applyTemplate('monday'));
    applyTuesdayBtn.addEventListener('click', () => applyTemplate('tuesday'));
    applyWednesdayBtn.addEventListener('click', () => applyTemplate('wednesday'));
    applyThursdayBtn.addEventListener('click', () => applyTemplate('thursday'));
    applyFridayBtn.addEventListener('click', () => applyTemplate('friday'));
    applySaturdayBtn.addEventListener('click', () => applyTemplate('saturday'));
    applySundayBtn.addEventListener('click', () => applyTemplate('sunday'));

    // --- HELP MODAL LOGIC ---
    const showHelpModal = () => helpModal.classList.add('visible');
    const hideHelpModal = () => helpModal.classList.remove('visible');

    // --- SUGGESTION BOX LOGIC ---
    const showSuggestionModal = () => suggestionModal.classList.add('visible');
    const hideSuggestionModal = () => suggestionModal.classList.remove('visible');
    const showAddSuggestionModal = () => addSuggestionModal.classList.add('visible');
    const hideAddSuggestionModal = () => {
        addSuggestionModal.classList.remove('visible');
        addSuggestionForm.reset();
    };

    const fetchSuggestions = () => {
        const suggestionsRef = database.ref('suggestions');
        suggestionsRef.on('value', (snapshot) => {
            const suggestions = snapshot.val() || {};
            const activeSuggestions = [];
            const completedSuggestions = [];

            Object.entries(suggestions).forEach(([id, data]) => {
                if (data.isCompleted) {
                    completedSuggestions.push({ id, ...data });
                } else {
                    activeSuggestions.push({ id, ...data });
                }
            });

            // Sort active suggestions by likes
            activeSuggestions.sort((a, b) => (b.likes ? Object.keys(b.likes).length : 0) - (a.likes ? Object.keys(a.likes).length : 0));
            // Sort completed suggestions by timestamp
            completedSuggestions.sort((a, b) => b.timestamp - a.timestamp);

            renderSuggestions(activeSuggestions, suggestionListEl, false);
            renderSuggestions(completedSuggestions, completedSuggestionListEl, true);
        });
    };

    const renderSuggestions = (suggestions, container, isCompletedList) => {
        container.innerHTML = '';
        if (suggestions.length === 0) {
            container.innerHTML = `<p>${isCompletedList ? 'Нет исполненных предложений.' : 'Пока нет предложений. Будьте первым!'}</p>`;
            return;
        }

        suggestions.forEach(suggestion => {
            const item = document.createElement('div');
            item.className = 'suggestion-item';
            if (suggestion.isCompleted) item.classList.add('completed');

            const likeCount = suggestion.likes ? Object.keys(suggestion.likes).length : 0;
            const userHasLiked = suggestion.likes && suggestion.likes[loggedInUser];

            item.innerHTML = `
                <h3 class="suggestion-title">${suggestion.title}</h3>
                <p class="suggestion-text">${suggestion.text}</p>
                <div class="suggestion-meta">
                    <span class="suggestion-author">
                        Автор: 
                        <span class="author-name">${suggestion.author}</span>
                    </span>
                    <div class="suggestion-actions">
                        <button class="suggestion-action-btn like-btn ${userHasLiked ? 'liked' : ''}" data-id="${suggestion.id}" title="Нравится">
                            ❤️ <span class="like-count">${likeCount}</span>
                        </button>
                        ${!isCompletedList && isAdmin === 'true' ? `<button class="suggestion-action-btn complete-suggestion-btn" data-id="${suggestion.id}" title="Отметить как исполненное">✅</button>` : ''}
                        ${(isAdmin === 'true' || suggestion.author === loggedInUser) ? `<button class="suggestion-action-btn delete-suggestion-btn" data-id="${suggestion.id}" title="Удалить">🗑️</button>` : ''}
                    </div>
                </div>
            `;
            container.appendChild(item);
        });
    };

    const handleSuggestionAction = (e) => {
        const target = e.target.closest('.suggestion-action-btn');
        if (!target) return;

        const id = target.dataset.id;
        if (target.classList.contains('like-btn')) {
            const likesRef = database.ref(`suggestions/${id}/likes/${loggedInUser}`);
            likesRef.once('value', (snapshot) => {
                if (snapshot.exists()) {
                    likesRef.remove(); // Unlike
                } else {
                    likesRef.set(true); // Like
                }
            });
        } else if (target.classList.contains('delete-suggestion-btn')) {
            if (confirm('Вы уверены, что хотите удалить это предложение?')) {
                database.ref(`suggestions/${id}`).remove();
            }
        } else if (target.classList.contains('complete-suggestion-btn')) {
            if (confirm('Вы уверены, что хотите переместить это предложение в исполненные?')) {
                database.ref(`suggestions/${id}`).update({ isCompleted: true });
            }
        }
    };

    const handleAddSuggestion = (e) => {
        e.preventDefault();
        const title = suggestionTitleInput.value.trim();
        const text = suggestionTextInput.value.trim();
        if (!text || !title) return;

        database.ref('suggestions').push().set({
            title: title,
            text: text,
            author: loggedInUser,
            timestamp: firebase.database.ServerValue.TIMESTAMP,
            isCompleted: false
        }).then(() => {
            hideAddSuggestionModal();
        }).catch(err => {
            console.error(err);
            alert('Не удалось добавить предложение.');
        });
    };

    suggestionFab.addEventListener('click', showSuggestionModal);
    closeSuggestionModalBtn.addEventListener('click', hideSuggestionModal);
    showAddSuggestionModalBtn.addEventListener('click', showAddSuggestionModal);
    closeAddSuggestionModalBtn.addEventListener('click', hideAddSuggestionModal);
    addSuggestionForm.addEventListener('submit', handleAddSuggestion);
    suggestionModal.addEventListener('click', handleSuggestionAction);

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
    window.addEventListener('click', (e) => {
        if (e.target === templateModal) {
            hideTemplateModal();
        }
        if (e.target === helpModal) {
            hideHelpModal();
        }
        if (e.target === suggestionModal) {
            hideSuggestionModal();
        }
        if (e.target === addSuggestionModal) {
            hideAddSuggestionModal();
        }
    });

    // Help modal listeners
    if (helpBtn && helpModal && closeHelpModalBtn) {
        helpBtn.addEventListener('click', showHelpModal);
        closeHelpModalBtn.addEventListener('click', hideHelpModal);
    }

    let calendar;
    // --- INITIALIZATION ---
    calendar = new VanillaCalendar('#calendar-container', {
        actions: {
            clickDay: (e, dates) => {
                if (dates[0]) {
                    handleDateChange(dates[0]);
                }
                // Re-apply highlights as a fallback, as clickDay might not trigger a full update.
                highlightIncompleteDays(new Date(calendar.currentYear, calendar.currentMonth, 1));
            },
            update: (data) => {
                // This hook fires after the calendar DOM is updated (e.g., month/year change)
                highlightIncompleteDays(new Date(data.year, data.month, 1));
            },
        },
        settings: { lang: 'ru', selection: { day: 'single' } }
    });
    calendar.init();

    const initializePage = async () => {
        // On page load, calculate highlights for the next few months in the background.
        calculateAndSaveIncompleteDaysForMultipleMonths().then(() => {
            highlightIncompleteDays(currentCalendarDate);
        });

        // Load data for today
        handleDateChange(new Date());

        // Загружаем предложения
        fetchSuggestions();
    };

    initializePage();
});
