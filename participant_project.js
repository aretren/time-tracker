document.addEventListener('DOMContentLoaded', () => {
    // --- AUTH GUARD & SETUP ---
    const loggedInUser = sessionStorage.getItem('loggedInUser');
    const usernameDisplay = document.getElementById('username-display');

    if (!loggedInUser) {
        window.location.href = 'login.html';
        return;
    }
    usernameDisplay.textContent = `Пользователь: ${loggedInUser}`;

    const params = new URLSearchParams(window.location.search);
    const projectId = params.get('id');
    if (!projectId) {
        alert('Project ID not found.');
        window.location.href = 'participant.html';
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

    // --- DOM ELEMENTS ---
    const projectNameHeader = document.getElementById('project-name-header');
    const calendarContainer = document.getElementById('calendar-container');
    const trainingListEl = document.getElementById('training-list');
    const participantRolesListEl = document.getElementById('participant-roles-list');

    let calendar;

    // --- DATA FETCHING & RENDERING ---

    const renderProjectName = (name) => {
        projectNameHeader.textContent = name;
        document.title = name; // Update page title
    };

    const renderTrainings = (trainings) => {
        trainingListEl.innerHTML = '';
        if (!trainings) {
            trainingListEl.innerHTML = '<li>Предстоящих тренировок нет.</li>';
            return;
        }

        const now = new Date();
        const upcomingTrainings = Object.values(trainings)
            .filter(t => new Date(t.time) >= now)
            .sort((a, b) => new Date(a.time) - new Date(b.time));

        if (upcomingTrainings.length === 0) {
            trainingListEl.innerHTML = '<li>Предстоящих тренировок нет.</li>';
            return;
        }

        upcomingTrainings.forEach(training => {
            const li = document.createElement('li');
            li.className = 'training-item';
            const d = new Date(training.time);
            const formattedDate = d.toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' });
            const locationText = training.location || 'Не указано';
            const commentText = training.comment || 'Нет';

            li.innerHTML = `
                <div class="training-details">
                    <p><strong>Дата:</strong> ${formattedDate}</p>
                    <p><strong>Место:</strong> ${locationText}</p>
                    <p><strong>Комментарий:</strong> ${commentText}</p>
                </div>
            `;
            trainingListEl.appendChild(li);
        });
    };

    const renderParticipantAndRoles = (members, roles = {}) => {
        participantRolesListEl.innerHTML = '';
        const memberUsernames = members ? Object.keys(members) : [];

        if (memberUsernames.length === 0) {
            participantRolesListEl.innerHTML = '<li>В проекте нет участников.</li>';
            return;
        }

        memberUsernames.forEach(username => {
            const li = document.createElement('li');
            li.className = 'role-item';
            const role = roles[username] || 'Не назначена';
            li.innerHTML = `<span class="role-item-name">${username}</span><span>${role}</span>`;
            participantRolesListEl.appendChild(li);
        });
    };

    const highlightTrainingDays = (allProjects) => {
        const projectTrainingDates = new Set();
        const otherTrainingDates = new Set();

        for (const projId in allProjects) {
            const project = allProjects[projId];
            // Check if user is a member and project has trainings
            if (project.members && project.members[loggedInUser] && project.trainings) {
                const isCurrentProject = projId === projectId;
                Object.values(project.trainings).forEach(training => {
                    const date = new Date(training.time).toISOString().split('T')[0];
                    if (isCurrentProject) {
                        projectTrainingDates.add(date);
                    } else {
                        otherTrainingDates.add(date);
                    }
                });
            }
        }

        // Other trainings should not override current project trainings
        const datesToHighlight = [];
        otherTrainingDates.forEach(date => {
            if (!projectTrainingDates.has(date)) {
                datesToHighlight.push({
                    date: date,
                    class: 'highlight-other-training'
                });
            }
        });
        projectTrainingDates.forEach(date => {
            datesToHighlight.push({
                date: date,
                class: 'highlight-project-training'
            });
        });

        // Apply classes to calendar
        const calendarDays = calendarContainer.querySelectorAll('.vanilla-calendar-day__btn');
        calendarDays.forEach(dayBtn => {
            dayBtn.classList.remove('highlight-project-training', 'highlight-other-training');
            const date = dayBtn.dataset.calendarDay;
            const highlight = datesToHighlight.find(h => h.date === date);
            if (highlight) {
                dayBtn.classList.add(highlight.class);
            }
        });
    };

    const initializeCalendar = () => {
        calendar = new VanillaCalendar('#calendar-container', {
            settings: {
                lang: 'ru',
                selection: { day: false }, // Disable day selection
            },
            actions: {
                // This function will be called on any calendar navigation
                _reapplyHighlights: () => {
                    // The calendar re-renders, so we need a slight delay
                    // to wait for new day elements to be in the DOM.
                    setTimeout(() => {
                        database.ref('projects').once('value', (snapshot) => {
                            highlightTrainingDays(snapshot.val());
                        });
                    }, 100);
                },
                // Re-apply highlights on day click as well
                clickDay: (e, dates) => {
                    calendar.actions._reapplyHighlights();
                },
                clickMonth: () => calendar.actions._reapplyHighlights(),
                clickYear: () => calendar.actions._reapplyHighlights(),
                clickArrow: () => calendar.actions._reapplyHighlights(),
            }
        });
        calendar.init();
    };

    // --- INITIALIZATION ---

    // 1. Initialize calendar structure
    initializeCalendar();

    // 2. Fetch all data and render content
    const projectsRef = database.ref('projects');
    projectsRef.on('value', (snapshot) => {
        const allProjects = snapshot.val();
        if (!allProjects || !allProjects[projectId]) {
            alert('Проект не найден или был удален.');
            window.location.href = 'participant.html';
            return;
        }

        const currentProject = allProjects[projectId];

        // Check if user is a member of this project
        if (!currentProject.members || !currentProject.members[loggedInUser]) {
            alert('У вас нет доступа к этому проекту.');
            window.location.href = 'participant.html';
            return;
        }

        renderProjectName(currentProject.name);
        renderTrainings(currentProject.trainings);
        renderParticipantAndRoles(currentProject.members, currentProject.roles);
        highlightTrainingDays(allProjects);
    });
});