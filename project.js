document.addEventListener('DOMContentLoaded', () => {
    // --- AUTH GUARD & SETUP ---
    const loggedInUser = sessionStorage.getItem('loggedInUser');
    const isAdmin = sessionStorage.getItem('isAdmin');
    const usernameDisplay = document.getElementById('username-display');

    if (!loggedInUser) {
        window.location.href = 'login.html';
        return;
    }
    
    const params = new URLSearchParams(window.location.search);
    const projectId = params.get('id');
    if (!projectId) {
        alert('Project ID not found.');
        window.location.href = 'admin.html';
        return;
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
    const projectRef = database.ref(`projects/${projectId}`);

    // --- DOM ELEMENTS ---
    const projectNameHeader = document.getElementById('project-name-header');
    const calendarContainer = document.getElementById('calendar-container');
    const scheduleGridEl = document.getElementById('combined-schedule-grid');
    const participantListEl = document.getElementById('participant-list');
    const roleListEl = document.getElementById('role-list');
    const trainingListEl = document.getElementById('training-list');
    const backToProjectsBtn = document.getElementById('back-to-projects-btn');
    const responsibleUserSelect = document.getElementById('responsible-user-select');
    const locationsRef = database.ref('locations');

    // --- MODAL ELEMENTS ---
    const addTrainingModal = document.getElementById('add-training-modal');
    const showAddTrainingModalBtn = document.getElementById('show-add-training-modal-btn');
    const closeAddTrainingModalBtn = addTrainingModal.querySelector('.close-btn');
    const addTrainingForm = document.getElementById('add-training-form');
    const trainingStartTimeInput = document.getElementById('training-start-time');
    const trainingEndTimeInput = document.getElementById('training-end-time');
    const trainingLocationSelect = document.getElementById('training-location-select'); // Inside modal
    const newTrainingLocationInput = document.getElementById('new-training-location-input'); // Inside modal
    const trainingCommentInput = document.getElementById('training-comment'); // Inside modal

    // --- Project Help Modal Elements ---
    const projectHelpBtn = document.getElementById('project-help-btn');
    const projectHelpModal = document.getElementById('project-help-modal');
    const closeProjectHelpModalBtn = document.getElementById('close-project-help-modal-btn');

    // Add event listener for the back button
    if (backToProjectsBtn) {
        backToProjectsBtn.addEventListener('click', () => {
            window.location.href = 'admin.html';
        });
    }

    // --- STATE ---
    let selectedDate = new Date();
    let projectData = {};
    let allProjectsData = {}; // To store all projects for training checks
    let projectMembers = {};
    let allUsers = [];
    let allLocations = [];
    let calendar; // Declare calendar instance variable
    let currentCalendarDate = new Date();
    let isHighlighting = false;

    // --- UI INTERACTIVITY ---
    const participantsWidget = document.getElementById('participants-widget');
    if (participantsWidget) {
        const header = participantsWidget.querySelector('h2');
        header.classList.add('collapsible-header'); // Add class for styling
        participantsWidget.classList.add('collapsed'); // Start as collapsed

        header.addEventListener('click', () => {
            participantsWidget.classList.toggle('collapsed');
        });
    }

    // --- UI INTERACTIVITY (Roles) ---
    const rolesWidget = document.getElementById('roles-widget');
    if (rolesWidget) {
        const header = rolesWidget.querySelector('h2');
        header.classList.add('collapsible-header'); // Add class for styling
        rolesWidget.classList.add('collapsed'); // Start as collapsed

        header.addEventListener('click', () => {
            rolesWidget.classList.toggle('collapsed');
        });
    }

    // --- DATA FETCHING & RENDERING ---

    const getUserTrainingsForDate = (username, date) => {
        const userTrainings = [];
        const checkDateStr = date.toDateString();

        for (const projId in allProjectsData) {
            const project = allProjectsData[projId];
            if (project.members && project.members[username] && project.trainings) {
                for (const trainId in project.trainings) {
                    const training = project.trainings[trainId];
                    
                    if (training.startTime) { // New format
                        const startDate = new Date(training.startTime);
                        // Check if training starts on the selected day
                        if (startDate.toDateString() === checkDateStr) {
                             userTrainings.push({
                                startTime: startDate,
                                endTime: new Date(training.endTime)
                            });
                        }
                    } else if (training.time) { // Old format
                        const startDate = new Date(training.time);
                        if (startDate.toDateString() === checkDateStr) {
                            userTrainings.push({
                                startTime: startDate,
                                endTime: new Date(startDate.getTime() + 2 * 60 * 60 * 1000) // Assume 2 hours
                            });
                        }
                    }
                }
            }
        }
        return userTrainings;
    };

    const renderCombinedSchedule = (members, date) => {
        scheduleGridEl.innerHTML = ''; // Clear grid

        // Create Header Row
        const header = document.createElement('div');
        header.className = 'user-row-label';
        scheduleGridEl.appendChild(header);
        for (let hour = 9; hour <= 22; hour++) {
            const hourHeader = document.createElement('div');
            hourHeader.className = 'grid-header';
            hourHeader.textContent = `${hour}:00`;
            scheduleGridEl.appendChild(hourHeader);
        }
        
        if (!members) {
             const noMembers = document.createElement('div');
             noMembers.textContent = 'Нет участников в проекте.';
             noMembers.style.gridColumn = 'span 15'; // Adjusted for fewer columns
             noMembers.style.textAlign = 'center';
             noMembers.style.padding = '1rem';
             scheduleGridEl.appendChild(noMembers);
             return;
        }
 
        const memberUsernames = Object.keys(members);
        if (memberUsernames.length === 0) {
            const noMembers = document.createElement('div');
            noMembers.textContent = 'Нет участников для отображения.';
            noMembers.style.gridColumn = 'span 15';
            noMembers.style.textAlign = 'center';
            noMembers.style.padding = '1rem';
            scheduleGridEl.appendChild(noMembers);
            return;
        }
 
        const availabilityPromises = memberUsernames.map(username => {
            const year = date.getFullYear();
            const month = date.getMonth() + 1;
            const day = date.getDate();
            const path = `userData/${username}/${year}/${month}/${day}`;
            return database.ref(path).once('value');
        });

        Promise.all(availabilityPromises).then(snapshots => {
            snapshots.forEach((snapshot, index) => {
                const username = memberUsernames[index];
                const dayData = snapshot.val() || {};
                const userTrainingsOnDate = getUserTrainingsForDate(username, date);

                const userLabel = document.createElement('div');
                userLabel.className = 'user-row-label';
                userLabel.textContent = username;
                scheduleGridEl.appendChild(userLabel);

                for (let hour = 9; hour <= 22; hour++) {
                    const hourCell = document.createElement('div');
                    hourCell.className = 'hour-cell';
                    const segments = dayData[hour] || [];
                    const statuses = Array.isArray(segments) ? segments : Object.values(segments);

                    const isTraining = userTrainingsOnDate.some(training => {
                        const slotStart = new Date(date);
                        slotStart.setHours(hour, 0, 0, 0);

                        // The end of the slot is the beginning of the next hour
                        const slotEnd = new Date(date);
                        slotEnd.setHours(hour + 1, 0, 0, 0);

                        // Overlap check: (StartA < EndB) and (EndA > StartB)
                        return training.startTime < slotEnd && training.endTime > slotStart;
                    });


                    let hasConflict = false;
                    if (isTraining) {
                        const hasBusy = statuses.includes('busy');
                        const hasUndefined = statuses.includes('undefined');

                        if (hasBusy) {
                            hourCell.classList.add('conflict-busy-training');
                            hasConflict = true;
                        } else if (hasUndefined) {
                            hourCell.classList.add('conflict-undefined-training');
                            hasConflict = true;
                        } else {
                            hourCell.classList.add('is-training-hour');
                        }
                    }
                    if (statuses.length > 0 && !hasConflict) {
                        const statusCounts = statuses.reduce((acc, status) => {
                            acc[status] = (acc[status] || 0) + 1;
                            return acc;
                        }, {});

                        Object.entries(statusCounts).forEach(([status, count]) => {
                             if(status !== 'clear') {
                                const bar = document.createElement('div');
                                bar.className = `availability-bar bar-${status}`;
                                bar.style.width = `${(count / 6) * 100}%`;
                                hourCell.appendChild(bar);
                             }
                        });
                    }
                    scheduleGridEl.appendChild(hourCell);
                }
            });
        });
    };
    
    const renderParticipants = (members) => {
        participantListEl.innerHTML = '';
        const memberUsernames = members ? Object.keys(members) : [];

        allUsers.forEach(username => {
            const li = document.createElement('li');
            li.className = 'participant-checkbox-item';

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = `user-checkbox-${username}`;
            checkbox.value = username;
            checkbox.checked = memberUsernames.includes(username);

            checkbox.addEventListener('change', (e) => {
                const selectedUser = e.target.value;
                if (e.target.checked) {
                    // Add user to project
                    projectRef.child('members').child(selectedUser).set(true);
                    
                } else {
                    // Remove user from project
                    projectRef.child('members').child(selectedUser).remove();
                    
                }
            });

            const label = document.createElement('label');
            label.htmlFor = `user-checkbox-${username}`;
            label.textContent = username;

            li.appendChild(checkbox);
            li.appendChild(label);
            participantListEl.appendChild(li);
        });
    };

    const renderRoles = (members, roles = {}) => {
        roleListEl.innerHTML = '';
        const memberUsernames = members ? Object.keys(members) : [];

        if (memberUsernames.length === 0) {
            roleListEl.innerHTML = '<p style="padding: 0.75rem 0;">Сначала добавьте участников в проект.</p>';
            return;
        }

        memberUsernames.forEach(username => {
            const li = document.createElement('li');
            li.className = 'role-item';

            const nameLabel = document.createElement('span');
            nameLabel.className = 'role-item-name';
            nameLabel.textContent = username;

            const roleInput = document.createElement('input');
            roleInput.type = 'text';
            roleInput.className = 'role-item-input';
            roleInput.placeholder = 'Назначить партию...';
            roleInput.value = roles[username] || '';

            let debounceTimer;
            roleInput.addEventListener('input', () => {
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                    const newRole = roleInput.value.trim();
                    if (newRole) {
                        projectRef.child('roles').child(username).set(newRole);
                        
                    } else {
                        // Если поле очистили, удаляем роль из базы
                        projectRef.child('roles').child(username).remove();
                        
                    }
                }, 500); // Сохранение через 500 мс после прекращения ввода
            });

            li.appendChild(nameLabel);
            li.appendChild(roleInput);
            roleListEl.appendChild(li);
        });

    };
    
    const renderResponsibleWidget = (members, responsibleUser) => {
        responsibleUserSelect.innerHTML = ''; // Clear previous options

        // Add a default "not assigned" option
        const defaultOption = document.createElement('option');
        defaultOption.value = "";
        defaultOption.textContent = "Не назначен";
        responsibleUserSelect.appendChild(defaultOption);

        const memberUsernames = members ? Object.keys(members) : [];
        memberUsernames.forEach(username => {
            const option = document.createElement('option');
            option.value = username;
            option.textContent = username;
            if (username === responsibleUser) {
                option.selected = true;
            }
            responsibleUserSelect.appendChild(option);
        });
    };

    responsibleUserSelect.addEventListener('change', (e) => {
        const selectedUser = e.target.value;
        projectRef.child('responsible').set(selectedUser || null);
    });

    const renderTrainings = (trainings) => {
        trainingListEl.innerHTML = '';
        if (trainings) {
            Object.entries(trainings).forEach(([id, training]) => {
                const li = document.createElement('li');
                li.className = 'training-item';

                let formattedDate, isoString, isoEndTimeString;

                if (training.startTime && training.endTime) { // New format
                    const startDate = new Date(training.startTime);
                    const endDate = new Date(training.endTime);
                    
                    const dateOptions = { day: 'numeric', month: 'short' };
                    const timeOptions = { hour: '2-digit', minute: '2-digit' };
                    
                    const formattedStartDate = startDate.toLocaleDateString('ru-RU', dateOptions);
                    const formattedStartTime = startDate.toLocaleTimeString('ru-RU', timeOptions);
                    const formattedEndTime = endDate.toLocaleTimeString('ru-RU', timeOptions);

                    if (startDate.toDateString() === endDate.toDateString()) {
                        formattedDate = `${formattedStartDate}, ${formattedStartTime} - ${formattedEndTime}`;
                    } else {
                        const formattedEndDate = endDate.toLocaleDateString('ru-RU', dateOptions);
                        formattedDate = `${formattedStartDate} ${formattedStartTime} - ${formattedEndDate} ${formattedEndTime}`;
                    }
                    
                    isoString = new Date(startDate.getTime() - (startDate.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
                    isoEndTimeString = new Date(endDate.getTime() - (endDate.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);

                } else if (training.time) { // Old format for backward compatibility
                    const d = new Date(training.time);
                    formattedDate = d.toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' });
                    isoString = new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
                }

                const locationText = training.location || 'Не указано';
                const commentText = training.comment || 'Нет';

                li.innerHTML = `
                    <div class="training-details">
                        <p>
                            <strong>Время:</strong> 
                            <span class="training-time-text" data-iso-time="${isoString || ''}" ${isoEndTimeString ? `data-iso-end-time="${isoEndTimeString}"` : ''}>${formattedDate || 'N/A'}</span>
                        </p>
                        <p>
                            <strong>Место:</strong> 
                            <span class="training-location-text">${locationText}</span>
                        </p>
                        <p>
                            <strong>Комментарий:</strong> 
                            <span class="training-comment-text">${commentText}</span>
                        </p>
                    </div>
                    <div class="training-actions">
                        <button class="edit-training-btn">Редактировать</button>
                    </div>
                `;

                li.querySelector('.edit-training-btn').onclick = (e) => editTraining(id, training, li, e);
                trainingListEl.appendChild(li);
            });
        }
    };


    // --- DATA MODIFICATION ---
    const addTraining = (e) => {
        e.preventDefault();
        const startTime = trainingStartTimeInput.value;
        const endTime = trainingEndTimeInput.value;
        const comment = trainingCommentInput.value.trim();
        let location = trainingLocationSelect.value;

        if (!startTime || !endTime) {
            alert('Пожалуйста, укажите время начала и окончания тренировки.');
            return;
        }

        if (new Date(endTime) <= new Date(startTime)) {
            alert('Время окончания должно быть после времени начала.');
            return;
        }

        if (location === 'add_new') {
            const newLocation = newTrainingLocationInput.value.trim();
            if (newLocation) {
                locationsRef.push(newLocation);
                location = newLocation;
            } else {
                alert('Пожалуйста, введите название нового места.');
                return;
            }
        }

        const newTraining = { 
            startTime, 
            endTime, 
            comment, 
            location 
        };
        if (!location) delete newTraining.location;

        projectRef.child('trainings').push().set(newTraining);
        addTrainingForm.reset();
        hideAddTrainingModal();
    };

    const deleteTraining = (trainingId) => {
        if (confirm('Вы уверены, что хотите удалить эту тренировку?')) {
            projectRef.child('trainings').child(trainingId).remove();
        }
    };

    const editTraining = (trainingId, trainingData, listItem, event) => {
        event.target.style.display = 'none'; // Hide edit button

        const detailsContainer = listItem.querySelector('.training-details');
        const actionsContainer = listItem.querySelector('.training-actions');
        
        const timeSpan = listItem.querySelector('.training-time-text');
        const originalStartTime = timeSpan.dataset.isoTime;
        let originalEndTime = timeSpan.dataset.isoEndTime;

        // Backward compatibility: if no end time, assume 2 hours from start
        if (originalStartTime && !originalEndTime) {
            const startDate = new Date(originalStartTime);
            const endDate = new Date(startDate.getTime() + 2 * 60 * 60 * 1000);
            originalEndTime = new Date(endDate.getTime() - (endDate.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
        }

        const originalComment = listItem.querySelector('.training-comment-text').textContent;
        const originalLocation = listItem.querySelector('.training-location-text').textContent;
        const originalInnerHTML = detailsContainer.innerHTML;

        // --- Create and setup inputs ---
        const startTimeInput = document.createElement('input');
        startTimeInput.type = 'datetime-local';
        startTimeInput.className = 'edit-training-datetime';
        startTimeInput.value = originalStartTime;
        startTimeInput.step = 600;

        const endTimeInput = document.createElement('input');
        endTimeInput.type = 'datetime-local';
        endTimeInput.className = 'edit-training-datetime';
        endTimeInput.value = originalEndTime;
        endTimeInput.step = 600;
        
        const commentInput = document.createElement('input');
        commentInput.type = 'text';
        commentInput.className = 'edit-training-input';
        commentInput.value = originalComment === 'Нет' ? '' : originalComment;

        const locationSelect = document.createElement('select');
        locationSelect.className = 'edit-training-location';
        populateLocationSelect(locationSelect, originalLocation);

        const newLocationInput = document.createElement('input');
        newLocationInput.type = 'text';
        newLocationInput.className = 'edit-training-new-location hidden';
        newLocationInput.placeholder = 'Новое место';

        locationSelect.addEventListener('change', () => {
            newLocationInput.classList.toggle('hidden', locationSelect.value !== 'add_new');
        });
        
        detailsContainer.innerHTML = '';
        const timeGroup = document.createElement('div');
        timeGroup.className = 'form-group';
        timeGroup.innerHTML = '<label>Начало</label>';
        timeGroup.appendChild(startTimeInput);
        
        const endTimeGroup = document.createElement('div');
        endTimeGroup.className = 'form-group';
        endTimeGroup.innerHTML = '<label>Окончание</label>';
        endTimeGroup.appendChild(endTimeInput);

        const locationGroup = document.createElement('div');
        locationGroup.className = 'form-group';
        locationGroup.appendChild(locationSelect);
        locationGroup.appendChild(newLocationInput);
        
        const commentGroup = document.createElement('div');
        commentGroup.className = 'form-group';
        commentGroup.appendChild(commentInput);

        detailsContainer.appendChild(timeGroup);
        detailsContainer.appendChild(endTimeGroup);
        detailsContainer.appendChild(locationGroup);
        detailsContainer.appendChild(commentGroup);
        
        const saveBtn = document.createElement('button');
        saveBtn.className = 'save-training-btn';
        saveBtn.innerHTML = '💾';

        const newDeleteBtn = document.createElement('button');
        newDeleteBtn.className = 'delete-training-btn';
        newDeleteBtn.innerHTML = '🗑️';

        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'cancel-training-btn';
        cancelBtn.innerHTML = '&times;';

        actionsContainer.appendChild(saveBtn);
        actionsContainer.appendChild(newDeleteBtn);
        actionsContainer.appendChild(cancelBtn);

        newDeleteBtn.onclick = () => deleteTraining(trainingId);

        cancelBtn.onclick = () => {
            detailsContainer.innerHTML = originalInnerHTML;
            saveBtn.remove();
            newDeleteBtn.remove();
            cancelBtn.remove();
            event.target.style.display = 'inline-block';
        };
        
        saveBtn.onclick = () => {
            const newStartTime = startTimeInput.value;
            const newEndTime = endTimeInput.value;
            const newComment = commentInput.value.trim();
            let newLocation = locationSelect.value;

            if (!newStartTime || !newEndTime) {
                alert('Время начала и окончания не могут быть пустыми.');
                return;
            }

            if (new Date(newEndTime) <= new Date(newStartTime)) {
                alert('Время окончания должно быть после времени начала.');
                return;
            }

            if (newLocation === 'add_new') {
                const newLocationValue = newLocationInput.value.trim();
                if (newLocationValue) {
                    locationsRef.push(newLocationValue);
                    newLocation = newLocationValue;
                } else {
                    newLocation = null;
                }
            }

            const updates = {
                startTime: newStartTime,
                endTime: newEndTime,
                location: newLocation || null,
                comment: newComment || null,
                time: null // Remove the old 'time' property
            };

            saveBtn.textContent = '...';
            saveBtn.disabled = true;

            projectRef.child('trainings').child(trainingId).update(updates)
                .catch(error => {
                    console.error("Error updating training: ", error);
                    alert("Не удалось сохранить изменения.");
                })
                .finally(() => {
                     // The 'on' listener will handle the UI update automatically
                     // No need for manual revert here, as the listener is the source of truth
                });
        };
    };

    const populateLocationSelect = (selectElement, selectedValue) => {
        selectElement.innerHTML = ''; // Clear
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = 'Не выбрано';
        selectElement.appendChild(defaultOption);

        allLocations.forEach(location => {
            const option = document.createElement('option');
            option.value = location;
            option.textContent = location;
            if (location === selectedValue) option.selected = true;
            selectElement.appendChild(option);
        });

        selectElement.insertAdjacentHTML('beforeend', '<option value="add_new" style="font-weight: bold;">+ Добавить новое место</option>');
    };

    // --- MODAL HANDLING ---
    const showAddTrainingModal = () => addTrainingModal.classList.add('visible');
    const hideAddTrainingModal = () => {
        addTrainingModal.classList.remove('visible');
        addTrainingForm.reset(); // Reset form on close
    };

    const getDayAvailability = async (members, year, month, day) => {
        const memberUsernames = Object.keys(members || {});
        const numMembers = memberUsernames.length;

        if (numMembers === 0) {
            return null;
        }

        const memberDataPromises = memberUsernames.map(username => {
            const path = `userData/${username}/${year}/${month}/${day}`;
            return database.ref(path).once('value').then(snapshot => ({
                username,
                data: snapshot.val() || {}
            }));
        });

        try {
            const membersDayData = await Promise.all(memberDataPromises);

            // Helper to check member status over a 2-hour window
            const getMemberStatusForWindow = (memberData, startHour) => {
                const endHour = startHour + 1;
                let hasBusy = false;
                let hasUndefined = false;
                let allFree = true;

                for (let h = startHour; h <= endHour; h++) {
                    // Ensure we have an array of 6 segments for the hour
                    const hourSegments = memberData[h] || [];
                    const statuses = Array.from({ length: 6 }, (_, i) => hourSegments[i] || 'clear');

                    for (const status of statuses) {
                        if (status === 'busy') hasBusy = true;
                        if (status === 'undefined') hasUndefined = true;
                        if (status !== 'free') allFree = false;
                    }
                }

                if (allFree) return 'free';
                if (hasBusy) return 'busy';
                // If it's not all free and has no busy segments, it must be a mix of undefined/clear/free
                if (hasUndefined) return 'undefined'; 
                
                // If it only contains 'clear' (and not 'free', 'busy', or 'undefined')
                return 'clear';
            };

            // Check for ideal (blue) case first
            for (let hour = 9; hour <= 20; hour++) {
                const isIdeal = membersDayData.every(member => getMemberStatusForWindow(member.data, hour) === 'free');
                if (isIdeal) return 'highlight-perfect';
            }
            
            // No ideal slot found, now check for other cases.
            // If there's only one member, they must be free for the 'perfect' case, which already failed.
            // So any other case is irrelevant.
            if (numMembers <= 1) {
                return null;
            }

            // Check for lime and green cases
            for (let hour = 9; hour <= 20; hour++) {
                const windowStatuses = membersDayData.map(member => getMemberStatusForWindow(member.data, hour));
                
                const freeCount = windowStatuses.filter(s => s === 'free').length;
                const busyCount = windowStatuses.filter(s => s === 'busy').length;
                const undefinedOrClearCount = windowStatuses.filter(s => s === 'undefined' || s === 'clear').length;

                // Lime: N-1 free, 1 busy
                if (freeCount === numMembers - 1 && busyCount === 1) {
                    return 'highlight-yellow'; // Mapped from lime
                }
                // Green: N-1 free, 1 undefined/clear
                if (freeCount === numMembers - 1 && undefinedOrClearCount === 1) {
                    return 'highlight-good';
                }
            }

            return null; // No highlight condition met
        } catch (error) {
            console.error(`Error fetching availability for ${year}-${month}-${day}:`, error);
            return null;
        }
    };

    let highlightsCache = {}; // Cache for multiple months' highlights

    const calculateAvailableDaysForMonth = async (date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const members = projectData.members || {};
        const highlights = {};
    
        if (Object.keys(members).length === 0) {
            return highlights;
        }
    
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const dayPromises = [];
    
        for (let day = 1; day <= daysInMonth; day++) {
            dayPromises.push(getDayAvailability(members, year, month + 1, day));
        }
    
        const results = await Promise.all(dayPromises);
        results.forEach((highlightClass, index) => {
            if (highlightClass) {
                const day = index + 1;
                highlights[day] = highlightClass;
            }
        });
        return highlights;
    };

    const updateCalendarHighlights = async (viewDate) => {
        if (isHighlighting) return;
        isHighlighting = true;

        try {
            const year = viewDate.getFullYear();
            const month = viewDate.getMonth();
    
            const datesToCalc = [
                new Date(year, month - 1, 1), // Previous month
                new Date(year, month, 1),     // Current month
                new Date(year, month + 1, 1)      // Next month
            ];
    
            const newHighlightsCache = {};
    
            for (const date of datesToCalc) {
                const monthHighlights = await calculateAvailableDaysForMonth(date);
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
                                return {
                                    classes: highlightsCache[dateStr]
                                };
                            }
                        }
                    }
                });
            }
        } catch (error) {
            console.error("Error calculating highlights:", error);
            highlightsCache = {}; // Reset on error
        } finally {
            isHighlighting = false;
        }
    };
    
    const initializeCalendar = () => {
        if(calendar) {
            calendar.destroy();
        }
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
                firstDay: 1 // Monday
            },
            onSelect: ({date}) => {
                if (date) {
                    selectedDate = new Date(date);
                    renderCombinedSchedule(projectMembers, selectedDate);
                }
            },
            onChangeView: async (view, date) => {
                currentCalendarDate = new Date(date);
                await updateCalendarHighlights(currentCalendarDate);
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
    }

    // --- INITIALIZATION & EVENT LISTENERS ---
    initializeCalendar();
    
    // Set up the main listener for project data.
    projectRef.on('value', async (snapshot) => {
        projectData = snapshot.val();
        if (projectData) {
            projectMembers = projectData.members || {};
            const titleContainer = document.querySelector('.header-title');
            titleContainer.innerHTML = ''; // Clear the title container

            const projectInfoContainer = document.createElement('div');
            projectInfoContainer.className = 'project-header-info';
            projectInfoContainer.innerHTML = `<h1>${projectData.name}</h1>`;

            // --- AUTHORIZATION CHECK ---
            const isCurrentUserAdmin = isAdmin === 'true';
            const isProjectResponsible = projectData.responsible === loggedInUser;

            if (!isCurrentUserAdmin && !isProjectResponsible) {
                alert('У вас нет доступа к этому проекту.');
                window.location.href = 'app.html'; // Redirect non-authorized users
                return;
            }

            projectInfoContainer.appendChild(usernameDisplay);
            usernameDisplay.classList.remove('hidden'); // Make sure it's visible
            
            titleContainer.appendChild(projectInfoContainer);
            
            const isCurrentUserResponsibleNonAdmin = isProjectResponsible && !isCurrentUserAdmin;

            if (isCurrentUserResponsibleNonAdmin) {
                // Hide elements for the responsible user
                document.getElementById('participants-widget').style.display = 'none';
                document.getElementById('responsible-widget').style.display = 'none';
                backToProjectsBtn.style.display = 'flex';
                backToProjectsBtn.onclick = () => { window.location.href = 'participant.html'; };
            } else {
                // Ensure they are visible for admin
                document.getElementById('participants-widget').style.display = 'block';
                document.getElementById('responsible-widget').style.display = 'block';
                backToProjectsBtn.style.display = 'flex';
                backToProjectsBtn.onclick = () => { window.location.href = 'admin.html'; };
            }

            if (isCurrentUserAdmin) {
                usernameDisplay.textContent = `Администратор: ${loggedInUser}`;
            }

            renderTrainings(projectData.trainings);
            renderRoles(projectMembers, projectData.roles);
            renderCombinedSchedule(projectMembers, selectedDate);
            renderResponsibleWidget(projectMembers, projectData.responsible);
            
            // On initial load or data change, do a calculation and then render
            await updateCalendarHighlights(currentCalendarDate);

            if (allUsers.length > 0) {
                renderParticipants(projectMembers);
            }
        }
    });

    locationsRef.on('value', (snapshot) => {
        const locationsData = snapshot.val();
        allLocations = locationsData ? Object.values(locationsData) : [];
        populateLocationSelect(trainingLocationSelect);
    });

    trainingLocationSelect.addEventListener('change', () => {
        const isAddNew = trainingLocationSelect.value === 'add_new';
        newTrainingLocationInput.classList.toggle('hidden', !isAddNew);
    });

    // Modal event listeners
    showAddTrainingModalBtn.addEventListener('click', showAddTrainingModal);
    closeAddTrainingModalBtn.addEventListener('click', hideAddTrainingModal);
    window.addEventListener('click', (e) => {
        if (e.target === addTrainingModal) hideAddTrainingModal();
    });

    database.ref('projects').on('value', (snapshot) => {
        allProjectsData = snapshot.val() || {};
    });
    database.ref('users').once('value', (snapshot) => {
        const users = snapshot.val();
        if (users) {
            allUsers = Object.keys(users);
            // If project data has already been loaded, render the participants list.
            // This handles cases where user data loads after project data.
            if (projectData.name) { // Check if projectData is populated
                renderParticipants(projectMembers);
            }
        }
    });
    
    addTrainingForm.addEventListener('submit', addTraining);

    // --- Project Help Modal Listeners ---
    if (projectHelpBtn) {
        projectHelpBtn.addEventListener('click', () => projectHelpModal.classList.add('visible'));
    }
    if (closeProjectHelpModalBtn) {
        closeProjectHelpModalBtn.addEventListener('click', () => projectHelpModal.classList.remove('visible'));
    }
    window.addEventListener('click', (e) => {
        if (e.target === projectHelpModal) {
            projectHelpModal.classList.remove('visible');
        }
    });
    
});
