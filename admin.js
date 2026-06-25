document.addEventListener('DOMContentLoaded', () => {
    // --- AUTH GUARD ---
    const loggedInUser = sessionStorage.getItem('loggedInUser');
    const isAdmin = sessionStorage.getItem('isAdmin');
    const usernameDisplay = document.getElementById('username-display');

    if (!loggedInUser || !isAdmin) {
        // If not logged in or not an admin, redirect to login
        window.location.href = 'login.html';
        return;
    }
    usernameDisplay.textContent = `Администратор: ${loggedInUser}`;

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
    const projectListEl = document.getElementById('project-list');
    const archivedProjectListEl = document.getElementById('archived-project-list');
    const createProjectBtnHeader = document.getElementById('create-project-btn-header');
    const modal = document.getElementById('create-project-modal');
    const closeModalBtn = modal.querySelector('.close-btn');
    const createProjectForm = document.getElementById('create-project-form');
    const userListCheckboxesEl = document.getElementById('user-list-checkboxes');
    const projectNameInput = document.getElementById('project-name');
    
    // --- DOM ELEMENTS (Register Admin) ---
    const registerAdminBtn = document.getElementById('register-admin-btn');
    const registerAdminModal = document.getElementById('register-admin-modal');
    const closeRegisterAdminModalBtn = registerAdminModal.querySelector('.close-btn');
    const registerAdminForm = document.getElementById('register-admin-form');
    const registerSuccessMessage = document.getElementById('register-success-message');
    const userSelectForAdmin = document.getElementById('user-select-for-admin');
    const currentAdminsListEl = document.getElementById('current-admins-list');
    
    // --- MODAL HANDLING (Create Project) ---
    const showCreateProjectModal = () => modal.classList.add('visible');
    const hideCreateProjectModal = () => modal.classList.remove('visible');

    createProjectBtnHeader.addEventListener('click', showCreateProjectModal);
    closeModalBtn.addEventListener('click', hideCreateProjectModal);

    // --- MODAL HANDLING (Assign Admin) ---
    registerAdminBtn.addEventListener('click', () => {
        showRegisterAdminModal();
    });
    const showRegisterAdminModal = () => registerAdminModal.classList.add('visible');
    const hideRegisterAdminModal = () => {
        registerAdminModal.classList.remove('visible');
        registerSuccessMessage.classList.add('hidden'); // Hide success message on close
        registerAdminForm.reset();
    };
    closeRegisterAdminModalBtn.addEventListener('click', hideRegisterAdminModal);

    window.addEventListener('click', (e) => {
        if (e.target === modal || e.target === registerAdminModal) {
            hideCreateProjectModal();
            hideRegisterAdminModal();
        }
    });

    // --- FIREBASE DATA FUNCTIONS ---
    const fetchUsers = () => {
        const usersRef = database.ref('users');
        usersRef.once('value', (snapshot) => {
            const users = snapshot.val();
            if (users) {
                userListCheckboxesEl.innerHTML = ''; // Clear existing
                Object.keys(users).forEach(username => {
                    const itemContainer = document.createElement('div');
                    itemContainer.className = 'user-checkbox-item';

                    const checkbox = document.createElement('input');
                    checkbox.type = 'checkbox';
                    checkbox.value = username;
                    checkbox.id = `user-${username}`;

                    const label = document.createElement('label');
                    label.htmlFor = `user-${username}`;
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

    const populateUsersForAdminSelection = () => {
        const usersRef = database.ref('users');
        usersRef.on('value', (snapshot) => {
            const users = snapshot.val();
            userSelectForAdmin.innerHTML = '<option value="" disabled selected>Выберите...</option>'; // Clear and add placeholder
            if (users) {
                Object.entries(users).forEach(([username, userData]) => {
                    // Only show users who are not already admins
                    if (!userData.isAdmin) {
                        const option = document.createElement('option');
                        option.value = username;
                        option.textContent = username;
                        userSelectForAdmin.appendChild(option);
                    }
                });
            }
        });
    };

    const populateCurrentAdminsList = () => {
        const usersRef = database.ref('users');
        usersRef.on('value', (snapshot) => {
            const users = snapshot.val();
            currentAdminsListEl.innerHTML = ''; // Clear list
            if (users) {
                Object.entries(users).forEach(([username, userData]) => {
                    // Show only admins, but not the currently logged-in admin
                    if (userData.isAdmin && username !== loggedInUser) {
                        const adminItem = document.createElement('div');
                        adminItem.className = 'participant-item'; // Re-use existing style

                        const adminName = document.createElement('span');
                        adminName.textContent = username;

                        adminItem.appendChild(adminName);

                        // Add remove button only if the user is not 'Leroy'
                        if (username !== 'Leroy') {
                            const removeBtn = document.createElement('button');
                            removeBtn.textContent = 'Снять права';
                            removeBtn.className = 'button-link remove-admin-role-btn';
                            removeBtn.dataset.username = username;
                            adminItem.appendChild(removeBtn);
                        }
                        currentAdminsListEl.appendChild(adminItem);
                    }
                });
            }
            if (currentAdminsListEl.children.length === 0) {
                currentAdminsListEl.innerHTML = '<p>Других администраторов нет.</p>';
            }
        });
    };


    const fetchProjects = () => {
        const projectsRef = database.ref('projects');
        projectsRef.on('value', (snapshot) => {
            const projects = snapshot.val();
            projectListEl.innerHTML = ''; 
            archivedProjectListEl.innerHTML = '';

            if (projects) {
                Object.entries(projects).forEach(([projectId, projectData]) => {
                    if (projectData.isArchived) {
                        // Project is archived
                        const projectElement = createProjectElement(projectId, projectData, true);
                        archivedProjectListEl.appendChild(projectElement);
                    } else {
                        // Project is active
                        const projectElement = createProjectElement(projectId, projectData, false);
                        projectListEl.appendChild(projectElement);
                    }
                });
            }
            if (!projectListEl.hasChildNodes()) {
                projectListEl.innerHTML = '<p>Активных проектов нет.</p>';
            }
            if (!archivedProjectListEl.hasChildNodes()) {
                archivedProjectListEl.innerHTML = '<p>Архив пуст.</p>';
            }
        });
    };

    const createProjectElement = (projectId, projectData, isArchived) => {
        const projectElement = document.createElement('div');
        projectElement.className = 'project';
        projectElement.addEventListener('click', () => {
            window.location.href = `project.html?id=${projectId}`;
        });

        const projectName = document.createElement('span');
        projectName.textContent = projectData.name;

        const actionsContainer = document.createElement('div');
        actionsContainer.className = 'project-actions';

        const deleteButton = document.createElement('button');
        deleteButton.innerHTML = '🗑️'; // Trash icon
        deleteButton.className = 'project-action-btn delete-project-btn';
        deleteButton.title = 'Удалить проект';
        deleteButton.addEventListener('click', (event) => {
            event.stopPropagation();
            deleteProject(projectId);
        });

        if (isArchived) {
            const restoreButton = document.createElement('button');
            restoreButton.innerHTML = '⬆️'; // Up arrow icon
            restoreButton.className = 'project-action-btn restore-project-btn';
            restoreButton.title = 'Восстановить проект';
            restoreButton.addEventListener('click', (event) => {
                event.stopPropagation();
                restoreProject(projectId);
            });
            actionsContainer.appendChild(restoreButton);
        } else {
            const archiveButton = document.createElement('button');
            archiveButton.innerHTML = '📦'; // Box icon
            archiveButton.className = 'project-action-btn archive-project-btn';
            archiveButton.title = 'Архивировать проект';
            archiveButton.addEventListener('click', (event) => {
                event.stopPropagation();
                archiveProject(projectId);
            });
            actionsContainer.appendChild(archiveButton);
        }

        actionsContainer.appendChild(deleteButton);

        projectElement.appendChild(projectName);
        projectElement.appendChild(actionsContainer);
        return projectElement;
    };

    const deleteProject = (projectId) => {
        if (confirm('Вы уверены, что хотите НАВСЕГДА удалить этот проект? Это действие нельзя отменить.')) {
            database.ref('projects/' + projectId).remove();
        }
    };

    const archiveProject = (projectId) => database.ref(`projects/${projectId}`).update({ isArchived: true });
    const restoreProject = (projectId) => database.ref(`projects/${projectId}`).update({ isArchived: false });

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
            isArchived: false
        })
        .then(() => {
            console.log('Project created successfully!');
            hideCreateProjectModal();
            createProjectForm.reset();
        })
        .catch(error => {
            console.error('Error creating project:', error);
            alert('Не удалось создать проект.');
        });
    };
    
    const assignAdminRole = (e) => {
        e.preventDefault();
        const selectedUser = userSelectForAdmin.value;

        if (!selectedUser) {
            alert('Пожалуйста, выберите участника.');
            return;
        }

        const userRef = database.ref('users/' + selectedUser);

        userRef.update({
            isAdmin: true
        })
        .then(() => {
            console.log(`Admin role assigned to ${selectedUser} successfully!`);
            registerAdminForm.reset();
            registerSuccessMessage.classList.remove('hidden');
            setTimeout(hideRegisterAdminModal, 2000);
        })
        .catch((error) => {
            console.error('Error assigning admin role: ', error);
            alert('Произошла ошибка при назначении роли администратора.');
        });
    };

    const removeAdminRole = (username) => {
        // Add a safeguard for the main admin
        if (username === 'Leroy') {
            alert('Нельзя снять права с основного администратора.');
            return;
        }

        if (confirm(`Вы уверены, что хотите снять права администратора с пользователя "${username}"?`)) {
            const userRef = database.ref('users/' + username);
            userRef.update({ isAdmin: false })
                .then(() => {
                    console.log(`Admin role removed from ${username}`);
                    // The list will update automatically via the 'on' listener
                })
                .catch((error) => {
                    console.error('Error removing admin role: ', error);
                    alert('Произошла ошибка при снятии прав администратора.');
                });
        }
    };

    // --- EVENT LISTENERS ---
    createProjectForm.addEventListener('submit', createProject);
    registerAdminForm.addEventListener('submit', assignAdminRole);
    currentAdminsListEl.addEventListener('click', (e) => {
        if (e.target.classList.contains('remove-admin-role-btn')) {
            removeAdminRole(e.target.dataset.username);
        }
    });
    
    // --- INITIALIZATION ---
    fetchUsers();
    populateUsersForAdminSelection(); // Populate the dropdown on load
    populateCurrentAdminsList(); // Populate the list of current admins
    fetchProjects();
});
