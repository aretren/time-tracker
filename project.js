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
    const trainingTimeInput = document.getElementById('training-time'); // Inside modal
    const trainingLocationSelect = document.getElementById('training-location-select'); // Inside modal
    const newTrainingLocationInput = document.getElementById('new-training-location-input'); // Inside modal
    const trainingCommentInput = document.getElementById('training-comment'); // Inside modal

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
        const checkDate = date.toDateString();

        for (const projId in allProjectsData) {
            const project = allProjectsData[projId];
            if (project.members && project.members[username] && project.trainings) {
                for (const trainId in project.trainings) {
                    const training = project.trainings[trainId];
                    const trainingDate = new Date(training.time);
                    if (trainingDate.toDateString() === checkDate) {
                        userTrainings.push(trainingDate);
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

                    // Check if this hour is a training hour
                    const isTraining = userTrainingsOnDate.some(trainingDate => {
                        const trainingStartHour = trainingDate.getHours();
                        return hour === trainingStartHour || hour === trainingStartHour + 1;
                    });

                    if (isTraining) {
                        hourCell.classList.add('is-training-hour');
                    }
                    
                    if (statuses.length > 0) {
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
                    recalculateAndSaveAvailableDays(currentCalendarDate); // Trigger recalculation
                } else {
                    // Remove user from project
                    projectRef.child('members').child(selectedUser).remove();
                    recalculateAndSaveAvailableDays(currentCalendarDate); // Trigger recalculation
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
                        recalculateAndSaveAvailableDays(currentCalendarDate); // Trigger recalculation
                    } else {
                        // Если поле очистили, удаляем роль из базы
                        projectRef.child('roles').child(username).remove();
                        recalculateAndSaveAvailableDays(currentCalendarDate); // Trigger recalculation
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
                const d = new Date(training.time);
                 const formattedDate = d.toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' });
                // ISO 8601 format without seconds for datetime-local input
                const isoString = training.time ? new Date(new Date(training.time).getTime() - (new Date().getTimezoneOffset() * 60000)).toISOString().slice(0, 16) : '';                
                
                const locationText = training.location || 'Не указано';
                const commentText = training.comment || 'Нет';

                li.innerHTML = `
                    <div class="training-details">
                        <p>
                            <strong>Дата:</strong> 
                            <span class="training-time-text" data-iso-time="${isoString}">${formattedDate}</span>
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
        const time = trainingTimeInput.value.trim();
        const comment = trainingCommentInput.value.trim();
        let location = trainingLocationSelect.value;

        if (!time) {
            alert('Пожалуйста, укажите время тренировки.');
            return;
        }

        if (location === 'add_new') {
            const newLocation = newTrainingLocationInput.value.trim();
            if (newLocation) {
                // Add to global locations list and use it
                locationsRef.push(newLocation);
                location = newLocation;
            } else {
                alert('Пожалуйста, введите название нового места.');
                return;
            }
        }

        if (time) {
            const newTraining = { time, comment, location };
            if (!location) delete newTraining.location; // Don't save empty location

            projectRef.child('trainings').push().set(newTraining);
            addTrainingForm.reset();
            hideAddTrainingModal(); // Close modal on success
        }
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

        const originalTime = listItem.querySelector('.training-time-text').dataset.isoTime;
        const originalComment = listItem.querySelector('.training-comment-text').textContent;
        const originalLocation = listItem.querySelector('.training-location-text').textContent;
        const originalInnerHTML = detailsContainer.innerHTML; // Save original state

        // --- Create and setup inputs ---
        const timeInput = document.createElement('input');
        timeInput.type = 'datetime-local';
        timeInput.className = 'edit-training-datetime';
        timeInput.value = originalTime;
        
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
        
        // Replace text with inputs
        detailsContainer.innerHTML = '';
        const timeGroup = document.createElement('div');
        timeGroup.className = 'form-group';
        timeGroup.appendChild(timeInput);

        const locationGroup = document.createElement('div');
        locationGroup.className = 'form-group';
        locationGroup.appendChild(locationSelect);
        locationGroup.appendChild(newLocationInput);
        
        const commentGroup = document.createElement('div');
        commentGroup.className = 'form-group';
        commentGroup.appendChild(commentInput);

        detailsContainer.appendChild(timeGroup);
        detailsContainer.appendChild(locationGroup);
        detailsContainer.appendChild(commentGroup);
        
        // --- Create and setup action buttons ---
        const saveBtn = document.createElement('button');
        saveBtn.className = 'save-training-btn';
        saveBtn.innerHTML = '💾'; // Floppy disk icon

        const newDeleteBtn = document.createElement('button');
        newDeleteBtn.className = 'delete-training-btn';
        newDeleteBtn.innerHTML = '🗑️'; // Trash can icon

        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'cancel-training-btn';
        cancelBtn.innerHTML = '&times;'; // Cross icon

        // Add new buttons to the actions container
        actionsContainer.appendChild(saveBtn);
        actionsContainer.appendChild(newDeleteBtn);
        actionsContainer.appendChild(cancelBtn);

        // --- Add event listeners to new buttons ---
        newDeleteBtn.onclick = () => {
            // No need to revert UI, the 'on' listener will remove the item
            deleteTraining(trainingId);
        };

        cancelBtn.onclick = () => {
            // Revert UI to original state
            detailsContainer.innerHTML = originalInnerHTML;
            saveBtn.remove();
            newDeleteBtn.remove();
            cancelBtn.remove();
            event.target.style.display = 'inline-block'; // Show edit button again
        };
        
        saveBtn.onclick = () => {
            const newTime = timeInput.value;
            const newComment = commentInput.value.trim();
            let newLocation = locationSelect.value;

            if (!newTime) {
                alert('Дата и время не могут быть пустыми.');
                return;
            }

            if (newLocation === 'add_new') {
                const newLocationValue = newLocationInput.value.trim();
                if (newLocationValue) {
                    locationsRef.push(newLocationValue);
                    newLocation = newLocationValue;
                } else {
                    newLocation = null; // Or keep original
                }
            }

            const updates = {
                time: newTime,
                location: newLocation || null,
                comment: newComment || null
            };

            saveBtn.textContent = 'Сохранение...';
            saveBtn.disabled = true;

            projectRef.child('trainings').child(trainingId).update(updates)
                .then(() => {
                    // Manually revert the UI for immediate feedback
                    detailsContainer.innerHTML = originalInnerHTML;
                    saveBtn.remove();
                    newDeleteBtn.remove(); // Remove the new delete button
                    cancelBtn.remove();
                    event.target.style.display = 'inline-block'; // Show edit button again
                    // The 'on' listener will still fire and update the data correctly,
                    // but this gives instant UI feedback.
                    renderTrainings(projectData.trainings);
                })
                .catch(error => {
                    console.error("Error updating training: ", error);
                    alert("Не удалось сохранить изменения. Пожалуйста, попробуйте еще раз.");
                    // Revert UI on failure
                    detailsContainer.innerHTML = originalInnerHTML;
                    saveBtn.remove();
                    newDeleteBtn.remove();
                    cancelBtn.remove();
                    event.target.style.display = 'inline-block';
                    saveBtn.textContent = 'Сохранить';
                    saveBtn.disabled = false;
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
        const availabilityPromises = members.map(username =>
            database.ref(`userData/${username}/${year}/${month}/${day}`).once('value')
        );
        const snapshots = await Promise.all(availabilityPromises);
        const memberDayData = new Map(snapshots.map((s, i) => [members[i], s.val() || {}]));

        const memberTrainings = new Map();
        const dateForCheck = new Date(year, month - 1, day);
        members.forEach(username => {
            const trainings = getUserTrainingsForDate(username, dateForCheck);
            memberTrainings.set(username, trainings.map(d => d.getHours()));
        });

        if (members.length === 0) return null;

        const allOverlapHours = new Set();
        let oneBusy = false, oneMaybe = false;

        for (let hour = 9; hour <= 22; hour++) {
            const memberStatusesForHour = members.map(member => {
                if (memberTrainings.get(member).some(th => hour === th || hour === th + 1)) {
                    return 'busy';
                }
                const hourData = memberDayData.get(member)[hour];
                if (!hourData) return 'maybe';
                const statuses = Object.values(hourData);
                if (statuses.includes('busy')) return 'busy';
                if (statuses.includes('maybe')) return 'maybe';
                if (statuses.includes('free')) return 'free';
                return 'maybe';
            });

            const freeCount = memberStatusesForHour.filter(status => status === 'free').length;
            if (freeCount === members.length) {
                allOverlapHours.add(hour);
            } else if (freeCount === members.length - 1) {
                if (memberStatusesForHour.includes('busy')) oneBusy = true;
                if (memberStatusesForHour.includes('maybe')) oneMaybe = true;
            }
        }

        const sortedOverlapHours = [...allOverlapHours].sort((a, b) => a - b);
        for (let i = 0; i < sortedOverlapHours.length - 1; i++) {
            if (sortedOverlapHours[i+1] === sortedOverlapHours[i] + 1) {
                return 'highlight-perfect'; // Two consecutive free hours
            }
        }

        if (sortedOverlapHours.length > 0) return 'highlight-good'; // At least one free hour
        if (oneBusy) return 'highlight-orange'; // One person is busy
        if (oneMaybe) return 'highlight-yellow'; // One person is maybe

        return null;
    };

    const recalculateAndSaveAvailableDays = async (date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const monthOneBased = month + 1;
        const members = projectData.members ? Object.keys(projectData.members) : [];

        if (members.length === 0) {
            // If no members, clear the highlights in DB
            const highlightsPath = `projectHighlights/${projectId}/${year}/${month + 1}`;
            database.ref(highlightsPath).set(null);
            return;
        }

        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const dayPromises = [];

        for (let day = 1; day <= daysInMonth; day++) {
            dayPromises.push(getDayAvailability(members, year, month + 1, day));
        }

        const results = await Promise.all(dayPromises);
        const highlights = {};
        results.forEach((highlightClass, index) => {
            if (highlightClass) {
                const day = index + 1;
                highlights[day] = highlightClass;
            }
        });

        // Save the calculated highlights to a new location in DB
        const highlightsPath = `projectHighlights/${projectId}/${year}/${month + 1}`;
        database.ref(highlightsPath).set(highlights);
    };

    const highlightAvailableDays = async (date) => {
        const calendarEl = document.getElementById('calendar-container');
        
        try {
            const year = date.getFullYear();
            const month = date.getMonth() + 1;
            const highlightsPath = `projectHighlights/${projectId}/${year}/${month}`;
            const snapshot = await database.ref(highlightsPath).once('value');
            const highlights = snapshot.val() || {};
            // Clear previous highlights
            const dayButtons = calendarContainer.querySelectorAll('.vanilla-calendar-day__btn');
            dayButtons.forEach(btn => {
                btn.classList.remove('highlight-perfect', 'highlight-good', 'highlight-orange', 'highlight-yellow');
            });
            // Apply new highlights from pre-calculated data
            Object.entries(highlights).forEach(([day, highlightClass]) => {
                const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const dayEl = calendarContainer.querySelector(`[data-calendar-day="${dateStr}"]`);
                if (dayEl) {
                    dayEl.classList.add(highlightClass);
                }
            });
        } finally { }
    };

    // --- INITIALIZATION & EVENT LISTENERS ---
    // Initialize the calendar first, so the object is available to listeners.
    calendar = new VanillaCalendar('#calendar-container', {
        actions: {
            clickDay: (e, dates) => {
                if (dates[0]) {
                    selectedDate = new Date(dates[0]);
                    renderCombinedSchedule(projectMembers, selectedDate);
                }
                // Re-apply highlights as a fallback, as clickDay might not trigger a full update.
                highlightAvailableDays(new Date(calendar.currentYear, calendar.currentMonth, 1));
            },
            update: (data) => {
                // This hook fires after the calendar DOM is updated (e.g., month/year change)
                highlightAvailableDays(new Date(data.year, data.month, 1));
            },
        },
        settings: { 
            lang: 'ru', 
            selection: { day: 'single' }
        }
    });

    // Set up the main listener for project data.
    projectRef.on('value', (snapshot) => {
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
            
            // On initial load, do a calculation and then render
            recalculateAndSaveAvailableDays(currentCalendarDate).then(() => {
                highlightAvailableDays(currentCalendarDate);
            });

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
    calendar.init();
});
