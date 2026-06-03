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
    const addParticipantForm = document.getElementById('add-participant-form');
    const userSelectEl = document.getElementById('user-select');
    const trainingListEl = document.getElementById('training-list');
    const addTrainingForm = document.getElementById('add-training-form');
    const trainingTimeInput = document.getElementById('training-time');
    const trainingCommentInput = document.getElementById('training-comment');

    // --- STATE ---
    let selectedDate = new Date();
    let projectData = {};
    let allUsers = [];

    // --- DATA FETCHING & RENDERING ---

    const renderCombinedSchedule = (members, date) => {
        scheduleGridEl.innerHTML = ''; // Clear grid

        // Create Header Row
        const header = document.createElement('div');
        header.className = 'user-row-label';
        scheduleGridEl.appendChild(header);
        for (let hour = 0; hour < 24; hour++) {
            const hourHeader = document.createElement('div');
            hourHeader.className = 'grid-header';
            hourHeader.textContent = `${hour}:00`;
            scheduleGridEl.appendChild(hourHeader);
        }
        
        if (!members) {
             const noMembers = document.createElement('div');
             noMembers.textContent = 'Нет участников в проекте.';
             noMembers.style.gridColumn = 'span 25';
             noMembers.style.textAlign = 'center';
             noMembers.style.padding = '1rem';
             scheduleGridEl.appendChild(noMembers);
             return;
        }

        const memberUsernames = Object.keys(members);
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

                const userLabel = document.createElement('div');
                userLabel.className = 'user-row-label';
                userLabel.textContent = username;
                scheduleGridEl.appendChild(userLabel);

                for (let hour = 0; hour < 24; hour++) {
                    const hourCell = document.createElement('div');
                    hourCell.className = 'hour-cell';
                    const segments = dayData[hour] || [];
                    const statuses = Array.isArray(segments) ? segments : Object.values(segments);
                    
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
        
        memberUsernames.forEach(username => {
            const li = document.createElement('li');
            li.className = 'participant-item';
            li.textContent = username;
            
            const removeBtn = document.createElement('button');
            removeBtn.className = 'remove-participant-btn';
            removeBtn.innerHTML = '&times;';
            removeBtn.onclick = () => removeParticipant(username);

            li.appendChild(removeBtn);
            participantListEl.appendChild(li);
        });

        // Update user select dropdown
        userSelectEl.innerHTML = '<option value="">-- Выберите пользователя --</option>';
        const nonMembers = allUsers.filter(u => !memberUsernames.includes(u));
        nonMembers.forEach(username => {
            const option = document.createElement('option');
            option.value = username;
            option.textContent = username;
            userSelectEl.appendChild(option);
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
    const addParticipant = (e) => {
        e.preventDefault();
        const username = userSelectEl.value;
        if (username) {
            projectRef.child('members').child(username).set(true);
        }
    };

    const removeParticipant = (username) => {
        if (confirm(`Вы уверены что хотите удалить ${username} из проекта?`)) {
            projectRef.child('members').child(username).remove();
        }
    };
    
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

    const getDayAvailability = async (members, year, month, day) => {
        const availabilityPromises = members.map(username =>
            database.ref(`userData/${username}/${year}/${month}/${day}`).once('value')
        );

        const snapshots = await Promise.all(availabilityPromises);
        const freeHoursByUser = {};

        snapshots.forEach((snapshot, index) => {
            const username = members[index];
            const dayData = snapshot.val();
            const userFreeHours = new Set();
            if (dayData) {
                for (const hour in dayData) {
                    const statuses = Array.isArray(dayData[hour]) ? dayData[hour] : Object.values(dayData[hour]);
                    if (statuses.includes('free')) {
                        userFreeHours.add(parseInt(hour, 10));
                    }
                }
            }
            freeHoursByUser[username] = userFreeHours;
        });

        if (members.length === 0) {
            return { allOverlap: [], allButOneOverlap: [] };
        }

        // --- Calculate Overlaps ---

        // 1. Find hours where ALL users are free
        let allOverlap = [];
        if (members.length > 0) {
            const firstUserHours = freeHoursByUser[members[0]] || new Set();
            allOverlap = [...firstUserHours].filter(hour =>
                members.every(username => freeHoursByUser[username] && freeHoursByUser[username].has(hour))
            );
        }

        // 2. Find hours where ALL BUT ONE user is free
        let allButOneOverlap = [];
        if (members.length > 1) {
            // Iterate through each hour of the day
            for (let hour = 0; hour < 24; hour++) {
                let usersNotFreeAtThisHour = 0;
                for (const username of members) {
                    if (!freeHoursByUser[username] || !freeHoursByUser[username].has(hour)) {
                        usersNotFreeAtThisHour++;
                    }
                }
                // If exactly one user is not free, this hour is an "all-but-one" overlap
                if (usersNotFreeAtThisHour === 1) {
                    allButOneOverlap.push(hour);
                }
            }
        }


        return { allOverlap, allButOneOverlap };
    };

    const updateCalendarHighlights = async (year, month) => {
        const members = projectData.members ? Object.keys(projectData.members) : [];
        if (members.length === 0) {
            if (calendar.dates.classes.length > 0) {
                calendar.dates.classes = [];
                calendar.update({ dates: true });
            }
            return;
        }

        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const promises = [];
        const classes = [];

        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const availabilityPromise = getDayAvailability(members, year, month + 1, day).then(availability => {
                const { allOverlap, allButOneOverlap } = availability;

                if (allOverlap.length > 0) {
                    classes.push(`highlight-green:${dateStr}`);
                } else if (allButOneOverlap.length > 0) {
                    classes.push(`highlight-yellow:${dateStr}`);
                }
            });
            promises.push(availabilityPromise);
        }

        await Promise.all(promises);

        const currentClassesStr = JSON.stringify(calendar.dates.classes.sort());
        const newClassesStr = JSON.stringify(classes.sort());

        if (currentClassesStr !== newClassesStr) {
            calendar.dates.classes = classes;
            calendar.update({ dates: true });
        }
    };


    // --- INITIALIZATION & EVENT LISTENERS ---
    let calendar; // Declare calendar instance variable

    projectRef.on('value', (snapshot) => {
        projectData = snapshot.val();
        if (projectData) {
            projectNameHeader.textContent = projectData.name;
            renderParticipants(projectData.members);
            renderTrainings(projectData.trainings);
            renderCombinedSchedule(projectData.members, selectedDate);
            if (calendar && calendar.settings.selected.month !== undefined) {
                const month = calendar.settings.selected.month;
                const year = calendar.settings.selected.year;
                updateCalendarHighlights(year, month);
            }
        }
    });

    database.ref('users').once('value', (snapshot) => {
        const users = snapshot.val();
        if (users) {
            allUsers = Object.keys(users);
            // Initial render of participants needs allUsers to be populated first
            renderParticipants(projectData.members);
        }
    });
    
    addParticipantForm.addEventListener('submit', addParticipant);
    addTrainingForm.addEventListener('submit', addTraining);

    calendar = new VanillaCalendar('#calendar-container', {
        actions: {
            clickDay(e, dates) {
                if (dates[0]) {
                    selectedDate = new Date(dates[0]);
                    renderCombinedSchedule(projectData.members, selectedDate);
                }
            },
            clickMonth(e, month, year) {
                updateCalendarHighlights(year, month);
            },
        },
        settings: { 
            lang: 'ru', 
            selection: { day: 'single' },
        },
       CSSClasses: {
            'highlight-green': 'highlight-green',
            'highlight-yellow': 'highlight-yellow',
        },
        dates: {
            classes: [] // This will be populated dynamically
        }
    });
    
    calendar.init();
    const month = calendar.settings.selected.month;
    const year = calendar.settings.selected.year;
    updateCalendarHighlights(year, month);
});
