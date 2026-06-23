document.addEventListener('DOMContentLoaded', () => {
    // --- AUTH GUARD & SETUP ---
    const loggedInUser = sessionStorage.getItem('loggedInUser');
    const isAdmin = sessionStorage.getItem('isAdmin');
    const usernameDisplay = document.getElementById('username-display');

    if (!loggedInUser || !isAdmin) {
        window.location.href = 'login.html';
        return;
    }
    usernameDisplay.textContent = `Администратор: ${loggedInUser}`;

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
    const trainingListEl = document.getElementById('training-list');
    const addTrainingForm = document.getElementById('add-training-form');
    const trainingTimeInput = document.getElementById('training-time');
    const trainingCommentInput = document.getElementById('training-comment');
    const backToProjectsBtn = document.getElementById('back-to-projects-btn');
    const suggestedDaysList = document.getElementById('suggested-days-list');
    const suggestedPrevMonthBtn = document.getElementById('suggested-prev-month-btn');
    const suggestedNextMonthBtn = document.getElementById('suggested-next-month-btn');
    const suggestedMonthDisplay = document.getElementById('suggested-month-display');

    // --- STATE ---
    let selectedDate = new Date();
    let suggestedDaysDate = new Date(); // State for the suggestions widget
    let projectData = {};
    let allProjectsData = {}; // To store all projects for training checks
    let projectMembers = {};
    let allUsers = [];
    let calendar; // Declare calendar instance variable

    // Add event listener for the back button
    if (backToProjectsBtn) {
        backToProjectsBtn.addEventListener('click', () => {
            window.location.href = 'admin.html';
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
        for (let hour = 8; hour < 22; hour++) {
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

                for (let hour = 8; hour < 22; hour++) {
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


                const commentText = training.comment || 'Нет';

                li.innerHTML = `
                    <div class="training-details">
                        <p>
                            <strong>Дата:</strong> 
                            <span class="training-time-text" data-iso-time="${isoString}">${formattedDate}</span>
                        </p>
                        <p>
                            <strong>Комментарий:</strong> 
                            <span class="training-comment-text">${commentText}</span>
                        </p>
                    </div>
                    <div class="training-actions">
                        <button class="edit-training-btn">Редактировать</button>
                        <button class="delete-training-btn">&times;</button>
                    </div>
                `;

                li.querySelector('.delete-training-btn').onclick = () => deleteTraining(id);
                li.querySelector('.edit-training-btn').onclick = (e) => editTraining(id, training, li, e);

                trainingListEl.appendChild(li);
            });
        }
    };


    // --- DATA MODIFICATION ---
    const addTraining = (e) => {
        e.preventDefault();
        const time = trainingTimeInput.value;
        const comment = trainingCommentInput.value;
        if(time) {
            projectRef.child('trainings').push().set({
                time: time,
                comment: comment
            });
            addTrainingForm.reset();
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
        const originalInnerHTML = detailsContainer.innerHTML; // Save original state

        // Create and setup inputs
        const timeInput = document.createElement('input');
        timeInput.type = 'datetime-local';
        timeInput.className = 'edit-training-datetime';
        timeInput.value = originalTime;

        const commentInput = document.createElement('input');
        commentInput.type = 'text';
        commentInput.className = 'edit-training-input';
        commentInput.value = originalComment === 'Нет' ? '' : originalComment;
        
        // Replace text with inputs
        detailsContainer.innerHTML = '';
        const timeGroup = document.createElement('div');
        timeGroup.className = 'form-group';
        timeGroup.appendChild(timeInput);
        
        const commentGroup = document.createElement('div');
        commentGroup.className = 'form-group';
        commentGroup.appendChild(commentInput);

        detailsContainer.appendChild(timeGroup);
        detailsContainer.appendChild(commentGroup);
        
        // Add save button
        const saveBtn = document.createElement('button');
        saveBtn.className = 'save-training-btn';
        saveBtn.textContent = 'Сохранить';
        
        const deleteBtn = listItem.querySelector('.delete-training-btn');
        deleteBtn.style.display = 'none'; // Hide delete button during edit

        actionsContainer.insertBefore(saveBtn, actionsContainer.firstChild);

        saveBtn.onclick = () => {
            const newTime = timeInput.value;
            const newComment = commentInput.value.trim();

            if (!newTime) {
                alert('Дата и время не могут быть пустыми.');
                return;
            }

            const updates = {
                time: newTime,
                comment: newComment || null
            };

            saveBtn.textContent = 'Сохранение...';
            saveBtn.disabled = true;

            projectRef.child('trainings').child(trainingId).update(updates)
                .then(() => {
                    // Manually revert the UI for immediate feedback
                    detailsContainer.innerHTML = originalInnerHTML;
                    saveBtn.remove();
                    event.target.style.display = 'inline-block'; // Show edit button
                    deleteBtn.style.display = 'inline-block'; // Show delete button
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
                    event.target.style.display = 'inline-block';
                    deleteBtn.style.display = 'inline-block';
                    saveBtn.textContent = 'Сохранить';
                    saveBtn.disabled = false;
                });
        };
    };

    const getDayAvailability = async (members, year, month, day, adminUser) => {
        const availabilityPromises = members.map(username =>
            database.ref(`userData/${username}/${year}/${month}/${day}`).once('value')
        );

        const snapshots = await Promise.all(availabilityPromises);
        
        const memberDayData = new Map();
        snapshots.forEach((snapshot, index) => {
            const username = members[index];
            memberDayData.set(username, snapshot.val() || {});
        });

        if (members.length === 0) {
            return { allOverlap: [], oneBusy: [], oneMaybe: [] };
        }

        const allOverlapHours = new Set();
        const oneBusyOverlapHours = new Set();
        const oneMaybeOverlapHours = new Set();

        const workingHours = Array.from({ length: 14 }, (_, i) => i + 8); // 8:00 to 21:00

        for (const hour of workingHours) {
            const memberStatusesForHour = members.map(member => {
                const dayData = memberDayData.get(member);
                const hourData = dayData ? dayData[hour] : null;

                if (!hourData) {
                    return 'maybe'; // No data for the hour means 'maybe'
                }

                const statuses = Object.values(hourData);
                if (statuses.includes('busy')) {
                    return 'busy';
                }
                if (statuses.includes('maybe')) {
                    return 'maybe';
                }
                if (statuses.includes('free')) {
                    return 'free';
                }
                return 'maybe'; // Default to maybe if no status is set for the hour
            });

            const freeCount = memberStatusesForHour.filter(status => status === 'free').length;
            
            if (freeCount === members.length) {
                allOverlapHours.add(hour);
            } else if (freeCount === members.length - 1) {
                if (memberStatusesForHour.includes('busy')) oneBusyOverlapHours.add(hour);
                if (memberStatusesForHour.includes('maybe')) oneMaybeOverlapHours.add(hour);
            }
        }
        
        return { allOverlap: [...allOverlapHours], oneBusy: [...oneBusyOverlapHours], oneMaybe: [...oneMaybeOverlapHours] };
    };

    const renderSuggestedDays = async (date) => {
        // Disable buttons to prevent race conditions
        suggestedPrevMonthBtn.disabled = true;
        suggestedNextMonthBtn.disabled = true;

        try {
            const year = date.getFullYear();
            const month = date.getMonth();

            // Update display
            const monthName = date.toLocaleString('ru-RU', { month: 'long' });
            suggestedMonthDisplay.textContent = `${monthName.charAt(0).toUpperCase() + monthName.slice(1)} ${year}`;

            const members = projectData.members ? Object.keys(projectData.members) : [];
            suggestedDaysList.innerHTML = '';
        
            if (members.length === 0) {
                return;
            }
        
            const daysInMonth = new Date(year, month + 1, 0).getDate();
            // Clear the list before starting the check
            suggestedDaysList.innerHTML = '';
            let foundDays = false;

            for (let day = 1; day <= daysInMonth; day++) {
                const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const availability = await getDayAvailability(members, year, month + 1, day, loggedInUser);
                
                let dayElement;
        
                if (availability.allOverlap.length > 0) {
                    dayElement = document.createElement('div');
                    dayElement.className = 'day-suggestion-item highlight-green';
                } else if (availability.oneBusy.length > 0) {
                    dayElement = document.createElement('div');
                    dayElement.className = 'day-suggestion-item highlight-orange';
                } else if (availability.oneMaybe.length > 0) {
                    dayElement = document.createElement('div');
                    dayElement.className = 'day-suggestion-item highlight-yellow';
                }
        
                if (dayElement) {
                    dayElement.textContent = day;
                    foundDays = true;
                    suggestedDaysList.appendChild(dayElement);
                }
            }
            if (!foundDays) {
                suggestedDaysList.innerHTML = '<p style="width: 100%; text-align: center;">Нет подходящих дней в этом месяце.</p>';
            }
        } finally {
            // Re-enable buttons after the operation is complete
            suggestedPrevMonthBtn.disabled = false;
            suggestedNextMonthBtn.disabled = false;
        }
    };


    // --- INITIALIZATION & EVENT LISTENERS ---
    // Initialize the calendar first, so the object is available to listeners.
    calendar = new VanillaCalendar('#calendar-container', {
        actions: {
            clickDay(e, dates) {
                if (dates[0]) {
                    selectedDate = new Date(dates[0]);                    
                    renderCombinedSchedule(projectMembers, selectedDate);
                }
            },
            clickMonth(e, month, year) {
                // Sync the suggestion widget with the calendar's month
                suggestedDaysDate.setFullYear(year, month, 1);
                renderSuggestedDays(suggestedDaysDate);
            },
        },
        settings: { 
            lang: 'ru', 
            selection: { day: 'single' },
        }
    });
    calendar.init();

    // Add listeners for the new suggestion widget controls
    suggestedPrevMonthBtn.addEventListener('click', () => {
        suggestedDaysDate.setMonth(suggestedDaysDate.getMonth() - 1);
        renderSuggestedDays(suggestedDaysDate);
    });

    suggestedNextMonthBtn.addEventListener('click', () => {
        suggestedDaysDate.setMonth(suggestedDaysDate.getMonth() + 1);
        renderSuggestedDays(suggestedDaysDate);
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
            projectInfoContainer.appendChild(usernameDisplay);
            
            titleContainer.appendChild(projectInfoContainer);
            
            renderTrainings(projectData.trainings);
            renderCombinedSchedule(projectMembers, selectedDate);
            
            // This is now the single source of truth for the initial suggestion render.
            // It runs after data is loaded and the calendar exists.
            renderSuggestedDays(suggestedDaysDate);
            
            // Now that project data is loaded, check if allUsers is also loaded.
            // If so, render participants. This handles the initial load case.
            if (allUsers.length > 0) {
                renderParticipants(projectMembers);
            }
        }
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
});
