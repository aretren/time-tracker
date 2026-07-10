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
        
        const wrapper = document.createElement('div');
        wrapper.className = 'color-picker-wrapper';

        const wheelContainer = document.createElement('div');
        wheelContainer.className = 'color-picker-wheel';

        const resetButton = document.createElement('button');
        resetButton.textContent = 'Сбросить';
        resetButton.className = 'color-picker-reset-btn';

        wrapper.append(wheelContainer, resetButton);
        colorPickerContainer.append(backdrop, wrapper);

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

        resetButton.addEventListener('click', () => {
            database.ref(`projects/${projectId}/colorHue`).remove();
            hidePicker();
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

    // --- MANAGE PARTICIPANTS MODAL ---
    const manageParticipantsModal = document.getElementById('manage-participants-modal');
    const manageParticipantsBtn = document.getElementById('manage-participants-btn');
    const closeManageParticipantsModalBtn = manageParticipantsModal.querySelector('.close-btn');
    const createParticipantForm = document.getElementById('create-participant-form');
    const newParticipantLoginInput = document.getElementById('new-participant-login');
    const newParticipantPasswordInput = document.getElementById('new-participant-password');
    const participantListEl = document.getElementById('participant-list');

    const showManageParticipantsModal = () => {
        manageParticipantsModal.classList.add('visible');
        fetchParticipants();
    };
    const hideManageParticipantsModal = () => manageParticipantsModal.classList.remove('visible');

    // Close any open context menus
    const closeContextMenu = () => {
        const existingMenu = document.querySelector('.participant-context-menu');
        if (existingMenu) {
            existingMenu.remove();
        }
    };

    // Global listener to close context menu
    window.addEventListener('click', (e) => {
        if (!e.target.closest('.participant-context-menu') && !e.target.matches('.context-menu-btn')) {
            closeContextMenu();
        }
        if (e.target === manageParticipantsModal) {
            hideManageParticipantsModal();
        }
    });
     window.addEventListener('scroll', closeContextMenu, true); // Close on scroll


    if (manageParticipantsBtn) {
        manageParticipantsBtn.addEventListener('click', showManageParticipantsModal);
    }
    if (closeManageParticipantsModalBtn) {
        closeManageParticipantsModalBtn.addEventListener('click', hideManageParticipantsModal);
    }

    const showContextMenu = (username, userData, buttonEl) => {
        closeContextMenu(); // Close any old menus

        const menu = document.createElement('div');
        menu.className = 'participant-context-menu';

        const rect = buttonEl.getBoundingClientRect();

        // Create menu items
        const actions = [
            { label: 'Сменить пароль', action: () => changeParticipantPassword(username), disabled: false },
            { label: userData.isAdmin ? 'Снять админа' : 'Назначить админом', action: () => toggleAdminStatus(username, userData.isAdmin), disabled: username === 'Leroy' },
            { label: 'Удалить', action: () => deleteParticipant(username), disabled: username === 'Leroy', isDelete: true }
        ];

        actions.forEach(({ label, action, disabled, isDelete }) => {
            const item = document.createElement('div');
            item.className = 'context-menu-item';
            if (isDelete) item.classList.add('delete');
            item.textContent = label;

            if (disabled) {
                item.classList.add('disabled');
            } else {
                item.addEventListener('click', () => {
                    action();
                    closeContextMenu();
                });
            }
            menu.appendChild(item);
        });

        document.body.appendChild(menu);

        // Position the menu
        const menuRect = menu.getBoundingClientRect();
        let top = rect.bottom + window.scrollY;
        let left = rect.right - menuRect.width + window.scrollX;

        // Adjust if it goes off-screen
        if (left < 0) {
            left = rect.left + window.scrollX;
        }
        if (top + menuRect.height > window.innerHeight + window.scrollY) {
            top = rect.top - menuRect.height + window.scrollY;
        }

        menu.style.top = `${top}px`;
        menu.style.left = `${left}px`;
    };


    const fetchParticipants = () => {
        const usersRef = database.ref('users');
        // Use 'once' to avoid issues with open context menus when data changes
        usersRef.once('value', (snapshot) => {
            const users = snapshot.val();
            participantListEl.innerHTML = '';
            if (users) {
                Object.entries(users).forEach(([username, userData]) => {
                    const userItem = document.createElement('div');
                    userItem.className = 'participant-item';

                    const userInfo = document.createElement('div');
                    userInfo.className = 'participant-info';
                    userInfo.textContent = `${username} ${userData.isAdmin ? '(Admin)' : ''}`;

                    const userControls = document.createElement('div');
                    userControls.className = 'participant-controls';

                    const contextMenuBtn = document.createElement('button');
                    contextMenuBtn.className = 'context-menu-btn';
                    contextMenuBtn.innerHTML = '&#8943;'; // Vertical ellipsis
                    contextMenuBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        showContextMenu(username, userData, contextMenuBtn);
                    });

                    userControls.appendChild(contextMenuBtn);
                    userItem.append(userInfo, userControls);
                    participantListEl.appendChild(userItem);
                });
            }
        });
    };

    const createParticipant = (e) => {
        e.preventDefault();
        const login = newParticipantLoginInput.value.trim();
        const password = newParticipantPasswordInput.value.trim();

        if (!login || !password) {
            alert('Пожалуйста, введите логин и пароль.');
            return;
        }

        database.ref(`users/${login}`).set({
            password: password,
            isAdmin: false
        }).then(() => {
            createParticipantForm.reset();
            fetchParticipants(); // Manually refresh list
        }).catch(error => {
            alert('Не удалось создать участника: ' + error.message);
        });
    };

    const deleteParticipant = (username) => {
        if (confirm(`Вы уверены, что хотите удалить участника ${username}?`)) {
            database.ref(`users/${username}`).remove()
                .then(() => fetchParticipants()) // Manually refresh list
                .catch(error => alert('Не удалось удалить участника: ' + error.message));
        }
    };

    const changeParticipantPassword = (username) => {
        const newPassword = prompt(`Введите новый пароль для ${username}:`);
        if (newPassword && newPassword.trim() !== '') {
            database.ref(`users/${username}/password`).set(newPassword)
                .then(() => {
                    alert(`Пароль для ${username} успешно изменен.`);
                    fetchParticipants(); // Refresh might be good for visual feedback if we add it
                })
                .catch(error => alert('Не удалось сменить пароль: ' + error.message));
        }
    };

    const toggleAdminStatus = (username, isAdmin) => {
        if (username === 'Leroy') {
            alert('Статус администратора для Leroy изменить нельзя.');
            return;
        }
        database.ref(`users/${username}/isAdmin`).set(!isAdmin)
            .then(() => fetchParticipants()) // Manually refresh list
            .catch(error => alert('Не удалось изменить статус администратора: ' + error.message));
    };

    if (createParticipantForm) {
        createParticipantForm.addEventListener('submit', createParticipant);
    }



    // --- CALENDAR SETUP ---
    let calendar;
    const trainingDates = {};

    const toLocalDateString = (date) => {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    };

    const updateProjectColorStyles = (trainingDates) => {
        const styleId = 'project-color-styles';
        let styleElement = document.getElementById(styleId);
        if (!styleElement) {
            styleElement = document.createElement('style');
            styleElement.id = styleId;
            document.head.appendChild(styleElement);
        }

        const hues = new Set(Object.values(trainingDates).filter(h => h));
        let css = '';
        hues.forEach(hue => {
            css += `.air-datepicker-cell.training-day-hue-${hue} { background-color: hsla(${hue}, 80%, 85%, 0.9); }\n`;
        });
        
        styleElement.innerHTML = css;
    };

    const initializeCalendar = () => {
        if (calendar) calendar.destroy();
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        calendar = new AirDatepicker('#calendar-container', {
            inline: true,
            locale: { days: ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'], daysShort: ['Вос', 'Пон', 'Вто', 'Сре', 'Чет', 'Пят', 'Суб'], daysMin: ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'], months: ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'], monthsShort: ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'], today: 'Сегодня', clear: 'Очистить', dateFormat: 'dd.MM.yyyy', timeFormat: 'HH:mm', firstDay: 1 },
            onRenderCell: ({date, cellType}) => {
                if (cellType === 'day') {
                    const dateStr = toLocalDateString(date);
                    if (trainingDates.hasOwnProperty(dateStr)) {
                        const colorHue = trainingDates[dateStr];
                        const isPast = date < today;
                        
                        let classes = 'training-day';

                        if (colorHue) {
                            classes += ` training-day-hue-${colorHue}`;
                        } else {
                            classes += ' training-day-no-color';
                        }

                        if (isPast) {
                            classes += ' past-training';
                        }

                        return {
                            classes: classes
                        };
                    }
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
            
            for (const key in trainingDates) {
                delete trainingDates[key];
            }

            if (!allProjects) {
                projectsContainerEl.innerHTML = '<p>Проекты еще не созданы.</p>';
                updateProjectColorStyles(trainingDates);
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
                                const dateStr = toLocalDateString(new Date(trainingTime));
                                if (!trainingDates[dateStr] || p.colorHue) { 
                                    trainingDates[dateStr] = p.colorHue;
                                }
                            } catch (e) { console.error("Skipping invalid date:", trainingTime); }
                        }
                    });
                }
            }

            const isAdmin = sessionStorage.getItem('isAdmin') === 'true';
            let projectsToDisplay = [];

            if (isAdmin) {
                manageParticipantsBtn.classList.remove('hidden');
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

            // --- ARCHIVED PROJECTS LOGIC ---
            if (isAdmin) {
                const archivedProjectsSection = document.getElementById('archived-projects-section');
                const archivedProjectsList = document.getElementById('archived-projects-list');
                const archivedProjects = Object.entries(allProjects).filter(([_, p]) => p.isArchived);

                if (archivedProjects.length > 0) {
                    archivedProjectsSection.classList.remove('hidden');
                    archivedProjectsList.innerHTML = '';

                    const header = archivedProjectsSection.querySelector('h2');
                    if (header && !header.classList.contains('collapsible-header-initialized')) {
                        header.classList.add('collapsible-header-initialized');
                        archivedProjectsSection.classList.add('collapsed'); // Collapse by default
                        header.addEventListener('click', () => {
                            archivedProjectsSection.classList.toggle('collapsed');
                        });
                    }

                    archivedProjects.forEach(([projectId, projectData]) => {
                        const projectElement = document.createElement('div');
                        projectElement.className = 'project';
                        projectElement.style.cursor = 'pointer';
                        projectElement.innerHTML = `
                            <div class="project-info" style="opacity: 0.7;">
                                <span>${projectData.name}</span>
                            </div>
                        `;

                        projectElement.addEventListener('click', (e) => {
                            e.stopPropagation();
                            window.location.href = `participant_project.html?id=${projectId}`;
                        });

                        archivedProjectsList.appendChild(projectElement);
                    });
                } else {
                    archivedProjectsSection.classList.add('hidden');
                }
            }

            updateProjectColorStyles(trainingDates);
            initializeCalendar();
        });
    };

    // --- INITIALIZATION ---
    fetchUserProjectsAndTrainings();
});
