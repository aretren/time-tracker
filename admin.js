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

    // --- MODAL HANDLING ---
    const showModal = () => modal.classList.add('visible');
    const hideModal = () => modal.classList.remove('visible');

    createProjectBtnHeader.addEventListener('click', showModal);
    closeModalBtn.addEventListener('click', hideModal);
    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            hideModal();
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
                    const label = document.createElement('label');
                    label.className = 'user-checkbox-item';
                    const checkbox = document.createElement('input');
                    checkbox.type = 'checkbox';
                    checkbox.value = username;
                    checkbox.id = `user-${username}`;
                    label.appendChild(checkbox);
                    label.append(` ${username}`);
                    userListCheckboxesEl.appendChild(label);
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
            hideModal();
            createProjectForm.reset();
        })
        .catch(error => {
            console.error('Error creating project:', error);
            alert('Не удалось создать проект.');
        });
    };
    
    // --- EVENT LISTENERS ---
    createProjectForm.addEventListener('submit', createProject);

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
