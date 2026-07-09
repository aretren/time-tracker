document.addEventListener('DOMContentLoaded', () => {
    // --- AUTH GUARD ---
    const loggedInUser = sessionStorage.getItem('loggedInUser');
    const usernameDisplay = document.getElementById('username-display');

    if (!loggedInUser) {
        window.location.href = 'login.html';
        return;
    }
    usernameDisplay.textContent = `Пользователь: ${loggedInUser}`;

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
    const calendarWidgetHeader = document.querySelector('.widget h2');

    // --- CREATE PROJECT MODAL ELEMENTS ---
    const createProjectModal = document.getElementById('create-project-modal');
    const closeCreateProjectModalBtn = createProjectModal.querySelector('.close-btn');
    const createProjectForm = document.getElementById('create-project-form');
    const userListCheckboxesEl = document.getElementById('user-list-checkboxes');
    const projectNameInput = document.getElementById('project-name');

    // --- COLOR PICKER ---
    let colorPicker;
    const colorPickerContainer = document.getElementById('color-picker-container');

    const showColorPicker = (projectId, initialHue) => {
        colorPickerContainer.innerHTML = ''; // Clear previous
        colorPickerContainer.classList.add('visible');

        const backdrop = document.createElement('div');
        backdrop.className = 'color-picker-backdrop';
        
        const wheelContainer = document.createElement('div');
        wheelContainer.className = 'color-picker-wheel';

        colorPickerContainer.append(backdrop, wheelContainer);

        colorPicker = new iro.ColorPicker(wheelContainer, {
            width: 250,
            layout: [{ component: iro.ui.Wheel }],
            color: `hsl(${initialHue || 0}, 80, 85)`
        });

        const hidePicker = () => {
            colorPickerContainer.classList.remove('visible');
            if (colorPicker) {
                // Clean up listeners if any were attached to the instance directly
            }
            colorPickerContainer.innerHTML = '';
        };

        colorPicker.on('color:change', (color) => {
            const hue = color.hue;
            database.ref(`projects/${projectId}/colorHue`).set(hue);
        });

        backdrop.addEventListener('click', hidePicker);
    };


    // --- CREATE PROJECT MODAL LOGIC ---
    const showCreateProjectModal = () => createProjectModal.classList.add('visible');
    const hideCreateProjectModal = () => createProjectModal.classList.remove('visible');

    if (closeCreateProjectModalBtn) {
        closeCreateProjectModalBtn.addEventListener('click', hideCreateProjectModal);
    }
    
    window.addEventListener('click', (e) => {
        if (e.target === createProjectModal) {
            hideCreateProjectModal();
        }
    });

    const fetchUsersForModal = () => {
        const usersRef = database.ref('users');
        usersRef.once('value', (snapshot) => {
            const users = snapshot.val();
            if (users) {
                userListCheckboxesEl.innerHTML = '';
                Object.keys(users).forEach(username => {
                    const itemContainer = document.createElement('div');
                    itemContainer.className = 'user-checkbox-item';

                    const checkbox = document.createElement('input');
                    checkbox.type = 'checkbox';
                    checkbox.value = username;
                    checkbox.id = `user-modal-${username}`;

                    const label = document.createElement('label');
                    label.htmlFor = `user-modal-${username}`;
                    label.textContent = username;
                    
                    const nameWrapper = document.createElement('div');
                    nameWrapper.className = 'user-item-name-wrapper';
                    nameWrapper.appendChild(label);

                    const checkboxWrapper = document.createElement('div');
                    checkboxWrapper.className = 'user-item-checkbox-wrapper';
                    checkboxWrapper.appendChild(checkbox);

                    itemContainer.append(nameWrapper, checkboxWrapper);
                    userListCheckboxesEl.appendChild(itemContainer);
                });
            }
        });
    };

    const createProject = (e) => {
        e.preventDefault();
        const projectName = projectNameInput.value.trim();
        if (!projectName) {
            alert('Пожалуйста, введите название проекта.');
            return;
        }

        const selectedUsers = {};
        const checkboxes = userListCheckboxesEl.querySelectorAll('input[type="checkbox"]:checked');
        checkboxes.forEach(checkbox => {
            selectedUsers[checkbox.value] = true;
        });

        const newProjectRef = database.ref('projects').push();
        newProjectRef.set({
            name: projectName,
            members: selectedUsers,
            responsible: loggedInUser, // Creator is responsible
            isArchived: false
        })
        .then(() => {
            hideCreateProjectModal();
            createProjectForm.reset();
        })
        .catch(error => {
            alert('Не удалось создать проект: ' + error.message);
        });
    };
    
    if (createProjectForm) {
        createProjectForm.addEventListener('submit', createProject);
    }


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

    // --- MAIN DATA FETCH & RENDER ---
    const fetchUserProjectsAndTrainings = () => {
        const projectsRef = database.ref('projects');
        projectsRef.on('value', (snapshot) => {
            const allProjects = snapshot.val();
            projectsContainerEl.innerHTML = '';
            
            projectTrainingDates.clear();
            otherTrainingDates.clear();

            if (!allProjects) {
                projectsContainerEl.innerHTML = '<p>Проекты еще не созданы.</p>';
                initializeCalendar();
                return;
            }

            for (const projId in allProjects) {
                const p = allProjects[projId];
                if (p.members && p.members[loggedInUser] && p.trainings && !p.isArchived) {
                    Object.values(p.trainings).forEach(t => {
                        const trainingTime = t.startTime || t.time;
                        if (trainingTime) {
                            try {
                                otherTrainingDates.add(toLocalDateString(new Date(trainingTime)));
                            } catch (e) { console.error("Skipping invalid date:", trainingTime); }
                        }
                    });
                }
            }

            const isAdmin = sessionStorage.getItem('isAdmin') === 'true';
            let projectsToDisplay = [];

            if (isAdmin) {
                const allProjectEntries = Object.entries(allProjects).filter(([_, p]) => !p.isArchived);

                const memberProjects = allProjectEntries.filter(([_, p]) => p.members && p.members[loggedInUser]);
                const otherProjects = allProjectEntries.filter(([_, p]) => !p.members || !p.members[loggedInUser]);

                const augmentAndSort = (projects, withDate) => {
                    const augmented = projects.map(([projectId, projectData]) => {
                        let soonestTrainingDate = null;
                        if (withDate && projectData.trainings) {
                            const upcomingTrainings = Object.values(projectData.trainings)
                                .map(t => new Date(t.startTime || t.time))
                                .filter(d => d instanceof Date && !isNaN(d) && d >= new Date());
                            if (upcomingTrainings.length > 0) {
                                soonestTrainingDate = new Date(Math.min.apply(null, upcomingTrainings));
                            }
                        }
                        return { projectId, projectData, soonestTrainingDate };
                    });

                    augmented.sort((a, b) => {
                        if (a.soonestTrainingDate && b.soonestTrainingDate) return a.soonestTrainingDate - b.soonestTrainingDate;
                        if (a.soonestTrainingDate) return -1;
                        if (b.soonestTrainingDate) return 1;
                        return a.projectData.name.localeCompare(b.projectData.name);
                    });
                    return augmented;
                };
                
                const sortedMemberProjects = augmentAndSort(memberProjects, true);
                const sortedOtherProjects = augmentAndSort(otherProjects, false);

                projectsToDisplay = [...sortedMemberProjects, ...sortedOtherProjects];

            } else {
                // Non-admin logic remains the same
                const userProjects = Object.entries(allProjects).filter(([_, projectData]) => {
                    return projectData.members && projectData.members[loggedInUser] && !projectData.isArchived;
                });
                 const augmented = userProjects.map(([projectId, projectData]) => {
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

                augmented.sort((a, b) => {
                    if (a.soonestTrainingDate && b.soonestTrainingDate) return a.soonestTrainingDate - b.soonestTrainingDate;
                    if (a.soonestTrainingDate) return -1;
                    if (b.soonestTrainingDate) return 1;
                    return 0;
                });
                projectsToDisplay = augmented;
            }

            if (projectsToDisplay.length === 0) {
                projectsContainerEl.innerHTML = '<p>Вы еще не участвуете ни в одном проекте.</p>';
            }
            
            projectsToDisplay.forEach(({ projectId, projectData }) => {
                const isResponsible = projectData.responsible === loggedInUser;
                const isMember = projectData.members && projectData.members[loggedInUser];

                const projectElement = document.createElement('div');
                projectElement.classList.add('project-card');
                if (!isMember && isAdmin) projectElement.classList.add('not-member');
                if (isResponsible) projectElement.classList.add('responsible');

                if (projectData.colorHue) {
                    projectElement.style.backgroundColor = `hsla(${projectData.colorHue}, 80%, 85%, 0.75)`;
                }

                const titleContainer = document.createElement('div');
                titleContainer.className = 'project-title-container';

                const projectName = document.createElement('h2');
                projectName.textContent = projectData.name;
                
                titleContainer.appendChild(projectName);

                if (isAdmin || isResponsible) {
                    const colorButton = document.createElement('button');
                    colorButton.className = 'color-picker-btn';
                    colorButton.innerHTML = '🎨';
                    colorButton.title = 'Выбрать цвет проекта';
                    colorButton.addEventListener('click', (e) => {
                        e.stopPropagation();
                        showColorPicker(projectId, projectData.colorHue);
                    });
                    titleContainer.appendChild(colorButton);
                }

                projectElement.appendChild(titleContainer);
                
                projectElement.addEventListener('click', (e) => {
                    if (e.target.classList.contains('color-picker-btn')) return;
                    window.location.href = `participant_project.html?id=${projectId}`;
                });

                const trainingList = document.createElement('ul');
                trainingList.classList.add('training-list-participant');

                let upcomingTrainings = [];
                if (projectData.trainings) {
                    const now = new Date();
                    upcomingTrainings = Object.values(projectData.trainings)
                        .filter(t => new Date(t.startTime || t.time) >= now)
                        .sort((a, b) => new Date(a.startTime || a.time) - new Date(b.startTime || b.time));
                }

                if (upcomingTrainings.length > 0) {
                    upcomingTrainings.forEach(training => {
                         const trainingItem = document.createElement('li');
                        const startDateTime = new Date(training.startTime || training.time);
                        const endDateTime = training.endTime ? new Date(training.endTime) : null;
                        
                        const day = startDateTime.getDate();
                        const month = startDateTime.toLocaleDateString('ru-RU', { month: 'long' });
                        const weekday = startDateTime.toLocaleDateString('ru-RU', { weekday: 'short' });
                        const startTimeFormatted = startDateTime.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
                        const endTimeFormatted = endDateTime ? endDateTime.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : '';
                        
                        const timeRange = endTimeFormatted && startTimeFormatted !== endTimeFormatted ? `${startTimeFormatted}-${endTimeFormatted}` : startTimeFormatted;
                        const locationText = training.location ? ` ${training.location}` : '';
                        
                        trainingItem.innerHTML = `<span class="training-marker"></span> ${day} ${month} (${weekday}) ${timeRange}${locationText}`;
                        trainingList.appendChild(trainingItem);
                    });
                } else {
                    const noTrainingItem = document.createElement('li');
                    noTrainingItem.textContent = 'Предстоящих тренировок нет.';
                    trainingList.appendChild(noTrainingItem);
                }
                
                projectElement.appendChild(trainingList);
                projectsContainerEl.appendChild(projectElement);
            });

            // Add "+" button for admins
            if (isAdmin) {
                const existingBtn = document.getElementById('create-project-btn-header');
                if (!existingBtn && calendarWidgetHeader) {
                    const headerContainer = document.createElement('div');
                    headerContainer.className = 'widget-header-container';

                    const addProjectBtn = document.createElement('button');
                    addProjectBtn.id = 'create-project-btn-header';
                    addProjectBtn.className = 'header-btn'; // Use consistent button styling
                    addProjectBtn.title = 'Добавить проект';
                    addProjectBtn.textContent = '+';
                    addProjectBtn.addEventListener('click', showCreateProjectModal);
                    
                    // Move the original h2 into the new container
                    headerContainer.appendChild(calendarWidgetHeader); 
                    headerContainer.appendChild(addProjectBtn);

                    // Find the original parent of the h2 and insert the new container before the next sibling
                    const widgetContent = document.querySelector('.widget #calendar-container').parentNode;
                    widgetContent.insertBefore(headerContainer, document.querySelector('.widget #calendar-container'));

                }
                fetchUsersForModal();
            }

            initializeCalendar();
        });
    };

    // --- INITIALIZATION ---
    fetchUserProjectsAndTrainings();
});
