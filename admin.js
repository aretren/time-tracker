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

    // --- MODAL HANDLING (Create Project) ---
    const showCreateProjectModal = () => modal.classList.add('visible');
    const hideCreateProjectModal = () => modal.classList.remove('visible');

    createProjectBtnHeader.addEventListener('click', showCreateProjectModal);
    closeModalBtn.addEventListener('click', hideCreateProjectModal);

    // --- MODAL HANDLING (Register Admin) ---
    const showRegisterAdminModal = () => registerAdminModal.classList.add('visible');
    const hideRegisterAdminModal = () => {
        registerAdminModal.classList.remove('visible');
        registerSuccessMessage.classList.add('hidden'); // Hide success message on close
        registerAdminForm.reset();
    };
    registerAdminBtn.addEventListener('click', showRegisterAdminModal);
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

    const fetchProjects = () => {
        const projectsRef = database.ref('projects');
        projectsRef.on('value', (snapshot) => {
            const projects = snapshot.val();
            projectListEl.innerHTML = ''; // Clear existing
            if (projects) {
                Object.entries(projects).forEach(([projectId, projectData]) => {
                    const projectElement = document.createElement('div');
                    projectElement.className = 'project';
                    projectElement.addEventListener('click', () => {
                        window.location.href = `project.html?id=${projectId}`;
                    });

                    const projectName = document.createElement('span');
                    projectName.textContent = projectData.name;

                    const deleteButton = document.createElement('button');
                    deleteButton.textContent = 'Удалить';
                    deleteButton.className = 'button-link delete-project-btn';
                    deleteButton.addEventListener('click', (event) => {
                        event.stopPropagation(); // Prevent navigation when deleting
                        deleteProject(projectId);
                    });

                    projectElement.appendChild(projectName);
                    projectElement.appendChild(deleteButton);
                    projectListEl.appendChild(projectElement);
                });
            }
        });
    };

    const deleteProject = (projectId) => {
        if (confirm('Вы уверены, что хотите удалить этот проект?')) {
            database.ref('projects/' + projectId).remove();
        }
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
            members: selectedUsers
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
    
    const registerAdmin = (e) => {
        e.preventDefault();
        const login = registerAdminForm.querySelector('#admin-login').value;
        const password = registerAdminForm.querySelector('#admin-password').value;

        const userRef = database.ref('users/' + login);

        userRef.set({
            password: password,
            isAdmin: true
        })
        .then(() => {
            console.log('Admin registered successfully!');
            registerAdminForm.reset();
            registerSuccessMessage.classList.remove('hidden');
            setTimeout(() => {
                // Hide message and modal after a delay
                hideRegisterAdminModal();
            }, 2000);
        })
        .catch((error) => {
            console.error('Error registering admin: ', error);
            alert('Произошла ошибка при регистрации администратора.');
        });
    };

    // --- EVENT LISTENERS ---
    createProjectForm.addEventListener('submit', createProject);
    registerAdminForm.addEventListener('submit', registerAdmin);
    
    // --- INITIALIZATION ---
    fetchUsers();
    fetchProjects();
});

const style = document.createElement('style');
style.textContent = `
    .delete-project-btn {
        background-color: var(--status-busy) !important;
    }
`;
document.head.appendChild(style);
