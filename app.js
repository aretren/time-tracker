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
    let isHighlightingIncomplete = false;
    
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
    const templateFromDateInput = document.getElementById('template-from-date');
    const templateToDateInput = document.getElementById('template-to-date');
    const applyRangeBtn = document.getElementById('apply-range-btn');


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

    // --- SUGGESTION BOX LOGIC ---

    const renderSuggestion = (id, suggestion) => {
        const suggestionItem = document.createElement('div');
        suggestionItem.classList.add('suggestion-item');
        suggestionItem.dataset.id = id;
        if (suggestion.status === 'completed') {
            suggestionItem.classList.add('completed');
        }

        const likesCount = suggestion.likes ? Object.keys(suggestion.likes).length : 0;
        const userHasLiked = suggestion.likes && suggestion.likes[loggedInUser];

        let adminButtons = '';
        if (isAdmin === 'true') {
            adminButtons = `
                <button class="suggestion-action-btn complete-suggestion-btn" title="Исполнено">&#x2714;</button>
                <button class="suggestion-action-btn delete-suggestion-btn" title="Удалить">&#x1F5D1;</button>
            `;
        }

        suggestionItem.innerHTML = `
            <h3 class="suggestion-title">${suggestion.title}</h3>
            <p class="suggestion-text">${suggestion.text}</p>
            <div class="suggestion-meta">
                <span class="suggestion-author">Автор: ${suggestion.author}</span>
                <div class="suggestion-actions">
                    <button class="suggestion-action-btn like-btn ${userHasLiked ? 'liked' : ''}" title="Нравится">
                        &#x2764;
                    </button>
                    <span class="like-count">${likesCount}</span>
                    ${adminButtons}
                </div>
            </div>
        `;

        // Event Listeners for actions
        const likeBtn = suggestionItem.querySelector('.like-btn');
        if (likeBtn) {
            likeBtn.addEventListener('click', () => toggleLike(id));
        }

        const completeBtn = suggestionItem.querySelector('.complete-suggestion-btn');
        if (completeBtn) {
            completeBtn.addEventListener('click', () => {
                const newStatus = suggestion.status === 'completed' ? 'active' : 'completed';
                updateSuggestionStatus(id, newStatus);
            });
        }
        
        const deleteBtn = suggestionItem.querySelector('.delete-suggestion-btn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => {
                if (confirm('Вы уверены, что хотите удалить это предложение?')) {
                    deleteSuggestion(id);
                }
            });
        }


        return suggestionItem;
    };

    const loadAndRenderSuggestions = () => {
        const suggestionsRef = database.ref('suggestions');
        suggestionsRef.on('value', (snapshot) => {
            suggestionListEl.innerHTML = '';
            completedSuggestionListEl.innerHTML = '';
            const suggestions = snapshot.val();
            if (suggestions) {
                Object.entries(suggestions).forEach(([id, suggestion]) => {
                    const suggestionEl = renderSuggestion(id, suggestion);
                    if (suggestion.status === 'completed') {
                        completedSuggestionListEl.appendChild(suggestionEl);
                    } else {
                        suggestionListEl.appendChild(suggestionEl);
                    }
                });
            }
        });
    };

    const handleAddSuggestion = (e) => {
        e.preventDefault();
        const title = suggestionTitleInput.value.trim();
        const text = suggestionTextInput.value.trim();
        if (title && text) {
            const newSuggestionRef = database.ref('suggestions').push();
            newSuggestionRef.set({
                title: title,
                text: text,
                author: loggedInUser,
                createdAt: firebase.database.ServerValue.TIMESTAMP,
                status: 'active',
                likes: {}
            }).then(() => {
                addSuggestionForm.reset();
                addSuggestionModal.classList.remove('visible');
            }).catch(err => {
                console.error("Error adding suggestion:", err);
                alert("Не удалось добавить предложение.");
            });
        }
    };

    const toggleLike = (suggestionId) => {
        const likeRef = database.ref(`suggestions/${suggestionId}/likes/${loggedInUser}`);
        likeRef.once('value', (snapshot) => {
            if (snapshot.exists()) {
                // Unlike
                likeRef.remove();
            } else {
                // Like
                likeRef.set(true);
            }
        });
    };

    const updateSuggestionStatus = (suggestionId, status) => {
        database.ref(`suggestions/${suggestionId}/status`).set(status);
    };

    const deleteSuggestion = (suggestionId) => {
        database.ref(`suggestions/${suggestionId}`).remove();
    };

    // --- Open/Close Modals ---
    if (suggestionFab) {
        suggestionFab.addEventListener('click', () => {
            suggestionModal.classList.add('visible');
            loadAndRenderSuggestions();
        });
    }
    if (closeSuggestionModalBtn) {
        closeSuggestionModalBtn.addEventListener('click', () => suggestionModal.classList.remove('visible'));
    }
    if (showAddSuggestionModalBtn) {
        showAddSuggestionModalBtn.addEventListener('click', () => addSuggestionModal.classList.add('visible'));
    }
    if (closeAddSuggestionModalBtn) {
        closeAddSuggestionModalBtn.addEventListener('click', () => addSuggestionModal.classList.remove('visible'));
    }
    if (addSuggestionForm) {
        addSuggestionForm.addEventListener('submit', handleAddSuggestion);
    }
     window.addEventListener('click', (e) => {
        if (e.target === suggestionModal) suggestionModal.classList.remove('visible');
        if (e.target === addSuggestionModal) addSuggestionModal.classList.remove('visible');
    });

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
            await updateIncompleteDaysHighlights(date);
        });
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
    
    const updateSingleHourDisplay = (hour) => {
        document.querySelectorAll(`.hour-slot-container[data-hour="${hour}"]`).forEach(container => {
            renderHour(container, dayData[hour]);
        });
    };

    const updateDayDisplay = () => {
         document.querySelectorAll('#hourly-schedule .hour-slot-container').forEach(container => {
            const hour = container.dataset.hour;
            renderHour(container, dayData[hour]);
        });
    };
    
     const handleDateChange = (date) => {
        selectedDate = new Date(date);
        loadDayStatus(selectedDate);
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
            if (!isDragging && isMouseDown) { // Check if mouse is still down
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
            document.querySelectorAll('#hourly-schedule .hour-slot-container').forEach(container => {
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
        clearTimeout(longPressTimer);
        
        if (!activeHourContainer && !menuIsActive) {
            isMouseDown = false;
            isDragging = false;
            return;
        }
        
        if (menuIsActive) {
            e.preventDefault();
            if (!activeBrush) {
                 alert('Пожалуйста, сначала выберите кисть.');
                 hideRadialMenu();
                 isMouseDown = false;
                 return;
            }
            const hour = parseInt(activeHourContainer.dataset.hour, 10);
            const newStatus = activeBrush.dataset.status;
            
            // 1. Create the base segments with the selected status
            let segments = Array(NUM_SEGMENTS).fill('clear');
            for (let i = 0; i < selectedSegmentValue; i++) {
                segments[i] = newStatus;
            }

            // 2. Determine the "spillover" status from the next hour
            let spilloverStatus = 'clear';
            const nextHourData = dayData[hour + 1];
            if (nextHourData) {
                const nextHourSegments = Array.isArray(nextHourData) ? nextHourData : Object.values(nextHourData);
                const firstRealStatus = nextHourSegments.find(s => s && s !== 'clear');
                if (firstRealStatus) {
                    spilloverStatus = firstRealStatus;
                }
            }

            // 3. Fill the remainder of the segments with the spillover status
            for (let i = selectedSegmentValue; i < NUM_SEGMENTS; i++) {
                segments[i] = spilloverStatus;
            }

            saveHourStatus(selectedDate, hour, segments);
            updateSingleHourDisplay(hour);
            hideRadialMenu();
        
        } else if (isDragging) {
            updateDayDisplay(); 
        } else { // Click
            if (!activeBrush) {
                alert('Пожалуйста, сначала выберите кисть.');
                isMouseDown = false;
                return;
            }
            const hour = activeHourContainer.dataset.hour;
            const segmentsData = dayData[hour];
            let segments = segmentsData ? (Array.isArray(segmentsData) ? [...segmentsData] : Object.values(segmentsData)) : Array(NUM_SEGMENTS).fill('clear');
            const newStatus = activeBrush.dataset.status;

            const isAlreadyFilled = segments.every(s => s === newStatus);
            const finalStatus = isAlreadyFilled ? 'clear' : newStatus;
            
            saveHourStatus(selectedDate, hour, Array(NUM_SEGMENTS).fill(finalStatus));
            updateSingleHourDisplay(hour);
        }

        isMouseDown = false;
        isDragging = false;
        activeHourContainer = null;
    };
    
    const generateHourlySlots = (containerEl, isTemplate = false) => {
        containerEl.innerHTML = '';
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
            containerEl.appendChild(container);

            if (!isTemplate) {
                 container.addEventListener('mousedown', handleInteractionStart);
                 container.addEventListener('touchstart', handleInteractionStart, { passive: false });
            }
        }
    };
    
    // --- TEMPLATE MODAL LOGIC ---

    const renderTemplateSchedule = () => {
        if (!templateScheduleEl) return;
        document.querySelectorAll('#template-schedule .hour-slot-container').forEach(container => {
            const hour = container.dataset.hour;
            renderHour(container, templateData[hour]);
        });
    };
    
    const renderTemplateMonth = () => {
        if (!templateMonthDisplay) return;
        templateMonthDisplay.textContent = templateDate.toLocaleString('ru-RU', { month: 'long', year: 'numeric' });
    };

    const loadTemplate = async () => {
        const templateRef = database.ref(`users/${loggedInUser}/template`);
        const snapshot = await templateRef.once('value');
        templateData = snapshot.val() || {};
        renderTemplateSchedule();
    };

    const saveTemplate = () => {
        const templateRef = database.ref(`users/${loggedInUser}/template`);
        templateRef.set(templateData);
    };

    const applyTemplateToDays = async (daysOfWeek) => {
        if (Object.keys(templateData).length === 0) {
            alert('Шаблон пуст. Сначала создайте и сохраните шаблон.');
            return;
        }
        
        if (!confirm(`Вы уверены, что хотите применить этот шаблон к выбранным дням в ${templateDate.toLocaleString('ru-RU', { month: 'long' })}? Это перезапишет существующие данные.`)) {
            return;
        }

        const year = templateDate.getFullYear();
        const month = templateDate.getMonth();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        const updates = {};
        for (let day = 1; day <= daysInMonth; day++) {
            const currentDate = new Date(year, month, day);
            if (daysOfWeek.includes(currentDate.getDay())) {
                const path = getDbPathForDate(currentDate);
                updates[path] = templateData;
            }
        }
        
        try {
            await database.ref().update(updates);
            await updateIncompleteDaysHighlights(templateDate);
            if (selectedDate.getMonth() === month) {
                loadDayStatus(selectedDate);
            }
            alert('Шаблон успешно применен!');
        } catch (error) {
            console.error("Error applying template:", error);
            alert('Не удалось применить шаблон.');
        }
    };
    
    const applyTemplateToDateRange = async (startDateStr, endDateStr) => {
        if (Object.keys(templateData).length === 0) {
            alert('Шаблон пуст. Сначала создайте и сохраните шаблон.');
            return;
        }
        if (!startDateStr || !endDateStr) {
            alert('Пожалуйста, выберите начальную и конечную даты.');
            return;
        }

        const startDate = new Date(startDateStr);
        const endDate = new Date(endDateStr);

        if (startDate > endDate) {
            alert('Начальная дата не может быть позже конечной.');
            return;
        }
        
        if (!confirm(`Вы уверены, что хотите применить шаблон на период с ${startDate.toLocaleDateString()} по ${endDate.toLocaleDateString()}? Это перезапишет существующие данные.`)) {
            return;
        }

        const updates = {};
        let currentDate = new Date(startDate);
        while(currentDate <= endDate) {
            const path = getDbPathForDate(new Date(currentDate)); // Use new Date to avoid mutation
            updates[path] = templateData;
            currentDate.setDate(currentDate.getDate() + 1);
        }

        try {
            await database.ref().update(updates);
            await updateIncompleteDaysHighlights(new Date(startDateStr)); // Re-highlight starting month
            if (selectedDate >= new Date(startDateStr) && selectedDate <= new Date(endDateStr)) {
                loadDayStatus(selectedDate);
            }
            alert('Шаблон успешно применен к диапазону!');
        } catch (error) {
            console.error("Error applying template to range:", error);
            alert('Не удалось применить шаблон к диапазону.');
        }
    };

    // --- LISTENERS ---

    if (templateBtn) {
        templateBtn.addEventListener('click', () => {
            generateHourlySlots(templateScheduleEl, true); 
            loadTemplate(); 
            templateDate = new Date(currentCalendarDate);
            renderTemplateMonth();
            templateModal.classList.add('visible');
        });
    }
    if (closeTemplateModalBtn) {
        closeTemplateModalBtn.addEventListener('click', () => templateModal.classList.remove('visible'));
    }
    
    if(templateScheduleEl) {
        templateScheduleEl.addEventListener('click', (e) => {
            const hourContainer = e.target.closest('.hour-slot-container');
            if(hourContainer && activeTemplateBrush) {
                 const hour = hourContainer.dataset.hour;
                 const status = activeTemplateBrush.dataset.status;
                 const isAlreadyFilled = templateData[hour] && templateData[hour].every(s => s === status);
                 
                 templateData[hour] = Array(NUM_SEGMENTS).fill(isAlreadyFilled ? 'clear' : status);
                 renderHour(hourContainer, templateData[hour]);
                 saveTemplate();
            }
        });
    }

    if (templateBrushesEl) {
        templateBrushesEl.addEventListener('click', (e) => {
             const clickedBrush = e.target.closest('.brush');
             if (!clickedBrush) return;
             if (activeTemplateBrush) {
                activeTemplateBrush.classList.remove('active');
             }
             activeTemplateBrush = clickedBrush;
             activeTemplateBrush.classList.add('active');
        });
    }
    
    if (templatePrevMonthBtn) {
        templatePrevMonthBtn.addEventListener('click', () => {
            templateDate.setMonth(templateDate.getMonth() - 1);
            renderTemplateMonth();
        });
    }

    if (templateNextMonthBtn) {
        templateNextMonthBtn.addEventListener('click', () => {
            templateDate.setMonth(templateDate.getMonth() + 1);
            renderTemplateMonth();
        });
    }
    
    if (applyRangeBtn) {
        applyRangeBtn.addEventListener('click', () => {
            applyTemplateToDateRange(templateFromDateInput.value, templateToDateInput.value);
        });
    }

    if (applyWeekdaysBtn) applyWeekdaysBtn.addEventListener('click', () => applyTemplateToDays([1, 2, 3, 4, 5]));
    if (applyWeekendsBtn) applyWeekendsBtn.addEventListener('click', () => applyTemplateToDays([6, 0]));
    if (applyAllDaysBtn) applyAllDaysBtn.addEventListener('click', () => applyTemplateToDays([0, 1, 2, 3, 4, 5, 6]));
    if (applyMondayBtn) applyMondayBtn.addEventListener('click', () => applyTemplateToDays([1]));
    if (applyTuesdayBtn) applyTuesdayBtn.addEventListener('click', () => applyTemplateToDays([2]));
    if (applyWednesdayBtn) applyWednesdayBtn.addEventListener('click', () => applyTemplateToDays([3]));
    if (applyThursdayBtn) applyThursdayBtn.addEventListener('click', () => applyTemplateToDays([4]));
    if (applyFridayBtn) applyFridayBtn.addEventListener('click', () => applyTemplateToDays([5]));
    if (applySaturdayBtn) applySaturdayBtn.addEventListener('click', () => applyTemplateToDays([6]));
    if (applySundayBtn) applySundayBtn.addEventListener('click', () => applyTemplateToDays([0]));

    if (brushesEl) {
        brushesEl.addEventListener('click', (e) => {
            const clickedBrush = e.target.closest('.brush');
            if (!clickedBrush || clickedBrush.id === 'template-btn') return;

            if (activeBrush) {
                activeBrush.classList.remove('active');
            }
            activeBrush = clickedBrush;
            activeBrush.classList.add('active');
        });
    }

    window.addEventListener('click', (e) => {
        if (e.target === templateModal) templateModal.classList.remove('visible');
        if (helpModal && e.target === helpModal) helpModal.classList.remove('visible');
    });
    
    if (helpBtn) helpBtn.addEventListener('click', () => helpModal.classList.add('visible'));
    if (closeHelpModalBtn) closeHelpModalBtn.addEventListener('click', () => helpModal.classList.remove('visible'));

    // --- CALENDAR HIGHLIGHTING ---
    let calendar;
    let highlightsCache = {}; 

    const calculateIncompleteDaysForMonth = async (date) => {
        const year = date.getFullYear();
        const monthOneBased = date.getMonth() + 1;
        const monthPath = `userData/${loggedInUser}/${year}/${monthOneBased}`;
        const snapshot = await database.ref(monthPath).once('value');
        const monthData = snapshot.val() || {};

        const daysInMonth = new Date(year, monthOneBased, 0).getDate();
        const totalSegmentsPerDay = 14 * 6;
        const highlights = {};

        for (let day = 1; day <= daysInMonth; day++) {
            const dayData = monthData[day];
            let filledSegments = 0;
            if (dayData) {
                for (let hour = 9; hour <= 22; hour++) {
                    if (dayData[hour]) {
                        const rawSegments = dayData[hour];
                        const segments = Array.from({length: NUM_SEGMENTS}, (_, i) => rawSegments[i] || 'clear');
                        filledSegments += segments.filter(s => s !== 'clear').length;
                    }
                }
            }
            if (filledSegments < totalSegmentsPerDay) {
                highlights[day] = 'highlight-incomplete';
            }
        }
        return highlights;
    };

    const updateIncompleteDaysHighlights = async (viewDate) => {
        if (isHighlightingIncomplete) return;
        isHighlightingIncomplete = true;

        try {
            const year = viewDate.getFullYear();
            const month = viewDate.getMonth();
    
            const datesToCalc = [
                new Date(year, month - 1, 1),
                new Date(year, month, 1),
                new Date(year, month + 1, 1)
            ];
    
            const newHighlightsCache = {};
    
            for (const date of datesToCalc) {
                const monthHighlights = await calculateIncompleteDaysForMonth(date);
                const y = date.getFullYear();
                const m = date.getMonth() + 1;
                for (const day in monthHighlights) {
                    const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                    newHighlightsCache[dateStr] = monthHighlights[day];
                }
            }
    
            highlightsCache = newHighlightsCache;
    
            if (calendar) {
                calendar.update({
                    onRenderCell: ({date, cellType}) => {
                        if (cellType === 'day') {
                            const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
                            if (highlightsCache[dateStr]) {
                                return { classes: highlightsCache[dateStr] };
                            }
                        }
                    }
                });
            }
        } catch (error) {
            console.error("Error calculating incomplete day highlights:", error);
            highlightsCache = {};
        } finally {
            isHighlightingIncomplete = false;
        }
    };
    
    // --- INITIALIZATION ---
    document.addEventListener('mouseup', handleInteractionEnd);
    document.addEventListener('touchend', handleInteractionEnd);
    document.addEventListener('mousemove', handleInteractionMove);
    document.addEventListener('touchmove', handleInteractionMove, { passive: false });

    calendar = new AirDatepicker('#calendar-container', {
        inline: true,
        locale: {
            days: ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'],
            daysShort: ['Вос', 'Пон', 'Вто', 'Сре', 'Чет', 'Пят', 'Суб'],
            daysMin: ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'],
            months: ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'],
            monthsShort: ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'],
            today: 'Сегодня',
            clear: 'Очистить',
            dateFormat: 'dd.MM.yyyy',
            timeFormat: 'HH:mm',
            firstDay: 1
        },
        onSelect: ({date}) => {
            if (date) {
                handleDateChange(date);
            }
        },
        onChangeView: async (view, date) => {
            currentCalendarDate = new Date(date);
            await updateIncompleteDaysHighlights(currentCalendarDate);
        },
        onRenderCell: ({date, cellType}) => {
            if (cellType === 'day') {
                const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
                if (highlightsCache[dateStr]) {
                    return {
                        classes: highlightsCache[dateStr]
                    };
                }
            }
        }
    });

    const initializePage = async () => {
        generateHourlySlots(hourlyScheduleEl);
        await updateIncompleteDaysHighlights(new Date());
        handleDateChange(new Date());
    };

    initializePage();
});
