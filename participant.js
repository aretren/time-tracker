document.addEventListener('DOMContentLoaded', () => {
    // --- AUTH GUARD ---
    const loggedInUser = sessionStorage.getItem('loggedInUser');
    const usernameDisplay = document.getElementById('username-display');

    if (!loggedInUser) {
        window.location.href = 'login.html';
        return; // Stop script execution
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

    // --- FIREBASE DATA FUNCTIONS ---
    const fetchUserProjectsAndTrainings = () => {
        const projectsRef = database.ref('projects');
        projectsRef.on('value', (snapshot) => {
            const allProjects = snapshot.val();
            projectsContainerEl.innerHTML = ''; // Clear existing content

            if (!allProjects) {
                projectsContainerEl.innerHTML = '<p>Проекты еще не созданы.</p>';
                return;
            }

            // 1. Filter for user's projects
            const userProjects = Object.entries(allProjects).filter(([projectId, projectData]) => {
                // Show only if user is a member AND project is not archived
                return projectData.members && projectData.members[loggedInUser] && !projectData.isArchived;
            });

            if (userProjects.length === 0) {
                projectsContainerEl.innerHTML = '<p>Вы еще не участвуете ни в одном проекте.</p>';
                return;
            }

            // 2. Augment projects with the soonest upcoming training date
            const augmentedProjects = userProjects.map(([projectId, projectData]) => {
                let soonestTrainingDate = null;
                if (projectData.trainings) {
                    const upcomingTrainings = Object.values(projectData.trainings)
                        .map(t => new Date(t.time))
                        .filter(d => d >= new Date());

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
                    const url = isResponsible ? `project.html?id=${projectId}` : `participant_project.html?id=${projectId}`;
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
                        .filter(training => new Date(training.time) >= now)
                        .sort((a, b) => new Date(a.time) - new Date(b.time));
                }
                
                if (upcomingTrainings.length > 0) {
                    upcomingTrainings.forEach(training => {
                        const trainingItem = document.createElement('li');
                        const d = new Date(training.time);
                        const formattedDate = d.toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' });
                        const locationText = training.location ? `<strong>Место:</strong> ${training.location} | ` : '';
                        const commentText = training.comment || 'Нет комментария';
                        
                        trainingItem.innerHTML = `<strong>Дата:</strong> ${formattedDate} | ${locationText}<strong>Комментарий:</strong> ${commentText}`;
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
        });
    };

    // --- INITIALIZATION ---
    fetchUserProjectsAndTrainings();

    // --- STYLES ---
    const style = document.createElement('style');
    style.textContent = `
        .project-card {
            background-color: #f9f9f9;
            border: 1px solid #ddd;
            border-radius: 8px;
            padding: 1rem;
            margin-bottom: 1rem;
            transition: box-shadow 0.2s ease-in-out;
            cursor: pointer;
        }
        .project-card.responsible:hover {
            cursor: pointer;
            box-shadow: 0 0 15px var(--primary-color);
        }
        .project-card h2 {
            margin-top: 0;
            border-bottom: 2px solid var(--primary-color);
            padding-bottom: 0.5rem;
        }
        .training-list-participant {
            list-style: none;
            padding-left: 0;
        }
        .training-list-participant li {
            padding: 0.5rem;
            border-bottom: 1px solid #eee;
        }
        .training-list-participant li:last-child {
            border-bottom: none;
        }
    `;
    document.head.appendChild(style);
});
