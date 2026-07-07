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
            .map(t => ({...t, date: new Date(t.startTime || t.time)})) // Create a comparable date
            .filter(t => t.date >= now && !isNaN(t.date)) // Filter out past and invalid
            .sort((a, b) => a.date - b.date);

        if (upcomingTrainings.length === 0) {
            trainingListEl.innerHTML = '<li>Предстоящих тренировок нет.</li>';
            return;
        }

        upcomingTrainings.forEach(training => {
            const li = document.createElement('li');
            li.className = 'training-item';
            
            let formattedDate;
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
            } else if (training.time) { // Old format
                const d = new Date(training.time);
                formattedDate = d.toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' });
            }

            const locationText = training.location || 'Не указано';
            const commentText = training.comment || 'Нет';

            li.innerHTML = `
                <div class="training-details">
                    <p><strong>Время:</strong> ${formattedDate || 'N/A'}</p>
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

    const projectTrainingDates = new Set();
    const otherTrainingDates = new Set();

    const initializeCalendar = () => {
        if (calendar) {
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
            onRenderCell: ({date, cellType}) => {
                if (cellType === 'day') {
                    const dateStr = date.toISOString().split('T')[0];
                    if (projectTrainingDates.has(dateStr)) {
                        return {
                            classes: 'highlight-project-training'
                        };
                    }
                    if (otherTrainingDates.has(dateStr)) {
                        return {
                            classes: 'highlight-other-training'
                        };
                    }
                }
            },
            onChangeView: () => {
                if (calendar) {
                    calendar.update({
                        onRenderCell: ({date, cellType}) => {
                            if (cellType === 'day') {
                                const dateStr = date.toISOString().split('T')[0];
                                if (projectTrainingDates.has(dateStr)) {
                                    return { classes: 'highlight-project-training' };
                                }
                                if (otherTrainingDates.has(dateStr)) {
                                    return { classes: 'highlight-other-training' };
                                }
                            }
                        }
                    });
                }
            }
        });
    };

    // --- INITIALIZATION ---

    // 1. Fetch all data and render content
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

        // Recalculate training dates
        projectTrainingDates.clear();
        otherTrainingDates.clear();
        for (const projId in allProjects) {
            const project = allProjects[projId];
            if (project.members && project.members[loggedInUser] && project.trainings) {
                const isCurrentProject = projId === projectId;
                Object.values(project.trainings).forEach(training => {
                    const trainingTime = training.startTime || training.time;
                    if (trainingTime) {
                        try {
                            const date = new Date(trainingTime).toISOString().split('T')[0];
                            if (isCurrentProject) {
                                projectTrainingDates.add(date);
                            } else {
                                otherTrainingDates.add(date);
                            }
                        } catch (e) {
                           console.error("Skipping invalid training date:", trainingTime, e);
                        }
                    }
                });
            }
        }
        
        // Initialize or update calendar
        if (!calendar) {
            initializeCalendar();
        } else {
            calendar.update();
        }
    });
     window.addEventListener('beforeunload', () => {
        projectsRef.off('value');
    });
});