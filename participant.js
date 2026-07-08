document.addEventListener('DOMContentLoaded', () => {
    // --- AUTH GUARD ---
    const loggedInUser = sessionStorage.getItem('loggedInUser');
    const usernameDisplay = document.getElementById('username-display');

    if (!loggedInUser) {
        window.location.href = 'login.html';
        return; // Stop script execution
    }
    usernameDisplay.textContent = `Пользователь: ${loggedInUser}`;

    const checkAdminStatus = () => {
        const isAdmin = sessionStorage.getItem('isAdmin');
        if (isAdmin === 'true') {
            const adminPanelLink = document.getElementById('admin-panel-link');
            if (adminPanelLink) {
                adminPanelLink.classList.remove('hidden');
            }
        }
    };

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
    const projectsContainerEl = document.getElementById('projects-container');
    const trainingProjectSelect = document.getElementById('training-project-select');

    // --- CALENDAR SETUP ---
    let calendar;
    const projectTrainingDates = new Set();
    const otherTrainingDates = new Set();

    const toLocalDateString = (date) => {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    };

    const initializeCalendar = () => {
        if (calendar) calendar.destroy();
        calendar = new AirDatepicker('#calendar-container', {
            inline: true,
            locale: { days: ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'], daysShort: ['Вос', 'Пон', 'Вто', 'Сре', 'Чет', 'Пят', 'Суб'], daysMin: ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'], months: ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'], monthsShort: ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'], today: 'Сегодня', clear: 'Очистить', dateFormat: 'dd.MM.yyyy', timeFormat: 'HH:mm', firstDay: 1 },
            onRenderCell: ({date, cellType}) => {
                if (cellType === 'day') {
                    const dateStr = toLocalDateString(date);
                    if (projectTrainingDates.has(dateStr)) return { classes: 'highlight-project-training' };
                    if (otherTrainingDates.has(dateStr)) return { classes: 'highlight-other-training' };
                }
            },
            onChangeView: () => {
                if (calendar) calendar.update();
            }
        });
    };
    
    // --- FIREBASE DATA FUNCTIONS ---
    const fetchUserProjectsAndTrainings = () => {
        const projectsRef = database.ref('projects');
        projectsRef.on('value', (snapshot) => {
            const allProjects = snapshot.val();
            projectsContainerEl.innerHTML = ''; // Clear existing content
            
            projectTrainingDates.clear();
            otherTrainingDates.clear();

            if (!allProjects) {
                projectsContainerEl.innerHTML = '<p>Проекты еще не созданы.</p>';
                initializeCalendar();
                return;
            }

            // Populate all training dates for the calendar
            for (const projId in allProjects) {
                const p = allProjects[projId];
                if (p.members && p.members[loggedInUser] && p.trainings && !p.isArchived) {
                    const isCurrent = false; // Never a "current" project on this page
                    Object.values(p.trainings).forEach(t => {
                        const trainingTime = t.startTime || t.time;
                        if (trainingTime) {
                            try {
                                const dateStr = toLocalDateString(new Date(trainingTime));
                                if (isCurrent) { // This branch is never taken, but kept for structural similarity
                                    projectTrainingDates.add(dateStr);
                                } else {
                                    otherTrainingDates.add(dateStr);
                                }
                            } catch (e) { console.error("Skipping invalid date:", trainingTime); }
                        }
                    });
                }
            }

            // 1. Filter for user's projects
            const userProjects = Object.entries(allProjects).filter(([projectId, projectData]) => {
                // Show only if user is a member AND project is not archived
                return projectData.members && projectData.members[loggedInUser] && !projectData.isArchived;
            });
            
            // Populate project select in modal
            if (trainingProjectSelect) {
                trainingProjectSelect.innerHTML = '<option value="">Выберите проект...</option>';
                const isAdmin = sessionStorage.getItem('isAdmin') === 'true';
                userProjects.forEach(([projectId, projectData]) => {
                    const isResponsible = projectData.responsible === loggedInUser;
                    if (isAdmin || isResponsible) {
                        const option = document.createElement('option');
                        option.value = projectId;
                        option.textContent = projectData.name;
                        trainingProjectSelect.appendChild(option);
                    }
                });
            }

            if (userProjects.length === 0) {
                projectsContainerEl.innerHTML = '<p>Вы еще не участвуете ни в одном проекте.</p>';
                initializeCalendar(); // Initialize calendar even if no projects
                return;
            }

            // 2. Augment projects with the soonest upcoming training date
            const augmentedProjects = userProjects.map(([projectId, projectData]) => {
                let soonestTrainingDate = null;
                if (projectData.trainings) {
                    const upcomingTrainings = Object.values(projectData.trainings)
                        .map(t => new Date(t.startTime || t.time))
                        .filter(d => d instanceof Date && !isNaN(d) && d >= new Date());

                    if (upcomingTrainings.length > 0) {
                        soonestTrainingDate = new Date(Math.min.apply(null, upcomingTrainings));
                    }
                }
                return { projectId, projectData, soonestTrainingDate };
            });

            // 3. Sort projects based on the soonest training date
            augmentedProjects.sort((a, b) => {
                if (a.soonestTrainingDate && b.soonestTrainingDate) {
                    return a.soonestTrainingDate - b.soonestTrainingDate;
                }
                if (a.soonestTrainingDate) return -1; // a comes first
                if (b.soonestTrainingDate) return 1;  // b comes first
                return 0; // no change in order
            });

            // 4. Render sorted projects and their sorted, filtered trainings
            augmentedProjects.forEach(({ projectId, projectData }) => {
                const isResponsible = projectData.responsible === loggedInUser;

                const projectElement = document.createElement('div');
                projectElement.classList.add('project-card');
                if (isResponsible) {
                    projectElement.classList.add('responsible'); // Keep style for responsible
                    projectElement.title = 'Нажмите для управления проектом'; 
                }
                projectElement.onclick = () => {
                    const url = `participant_project.html?id=${projectId}`;
                    window.location.href = url;
                };
                const projectName = document.createElement('h2');
                projectName.textContent = projectData.name;
                projectElement.appendChild(projectName);

                const trainingList = document.createElement('ul');
                trainingList.classList.add('training-list-participant');

                let upcomingTrainings = [];
                if (projectData.trainings) {
                    const now = new Date();
                    upcomingTrainings = Object.values(projectData.trainings)
                        .filter(training => {
                            const trainingTime = training.startTime || training.time;
                            if (!trainingTime) return false;
                            const d = new Date(trainingTime);
                            return d instanceof Date && !isNaN(d) && d >= now;
                        })
                        .sort((a, b) => new Date(a.startTime || a.time) - new Date(b.startTime || b.time));
                }
                
                if (upcomingTrainings.length > 0) {
                    upcomingTrainings.forEach(training => {
                        const trainingTime = training.startTime || training.time;
                        const trainingItem = document.createElement('li');
                        const startDateTime = new Date(trainingTime);
                        const endDateTime = training.endTime ? new Date(training.endTime) : null;

                        const day = startDateTime.getDate();
                        const month = startDateTime.toLocaleDateString('ru-RU', { month: 'long' });
                        const weekday = startDateTime.toLocaleDateString('ru-RU', { weekday: 'short' });
                        const startTimeFormatted = startDateTime.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
                        const endTimeFormatted = endDateTime ? endDateTime.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : '';
                        
                        const locationText = training.location ? ` ${training.location}` : '';
                        
                        let timeRange = startTimeFormatted;
                        if (endTimeFormatted && startTimeFormatted !== endTimeFormatted) {
                            timeRange = `${startTimeFormatted}-${endTimeFormatted}`;
                        } else if (endTimeFormatted && startTimeFormatted === endTimeFormatted) {
                            // If start and end time are the same, just show start time
                            timeRange = startTimeFormatted;
                        }
                        
                        trainingItem.innerHTML = `<span class="training-marker"></span> ${day} ${month} (${weekday}) ${timeRange}${locationText}`;
                        trainingList.appendChild(trainingItem);
                    });
                } else {
                    const noTrainingItem = document.createElement('li');
                    noTrainingItem.textContent = 'Предстоящих тренировок для этого проекта нет.';
                    trainingList.appendChild(noTrainingItem);
                }
                
                projectElement.appendChild(trainingList);
                projectsContainerEl.appendChild(projectElement);
            });

            initializeCalendar();
        });
    };

    // --- INITIALIZATION ---
    fetchUserProjectsAndTrainings();
    function populateLocationSelect(selectElement, selectedValue) {
        selectElement.innerHTML = '';
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
    }


});
