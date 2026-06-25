document.addEventListener('DOMContentLoaded', () => {
    // Your web app's Firebase configuration
    const firebaseConfig = {
        apiKey: "AIzaSyD2AgCF39T8Zk_kDRF6M9IHiMRz6stp_HA",
        authDomain: "time-tracker-15d2b.firebaseapp.com",
        databaseURL: "https://time-tracker-15d2b-default-rtdb.europe-west1.firebasedatabase.app",
        projectId: "time-tracker-15d2b",
        storageBucket: "time-tracker-15d2b.firebasestorage.app",
        messagingSenderId: "697777625968",
        appId: "1:697777625968:web:fdb1bb780b20051d0ccdb5",
        measurementId: "G-Y877PXDVTY"
    };

    // Initialize Firebase
    firebase.initializeApp(firebaseConfig);

    // Get a reference to the database service
    const database = firebase.database();

    const registerForm = document.getElementById('register-form');
    const successMessage = document.getElementById('success-message');
    const participantListEl = document.getElementById('participant-list');

    // --- Function to display users and attach delete listeners ---
    const fetchAndDisplayUsers = () => {
        const usersRef = database.ref('users');
        usersRef.on('value', (snapshot) => {
            participantListEl.innerHTML = ''; // Clear the list
            const users = snapshot.val();
            if (users) {
                Object.keys(users).forEach(username => {
                    const userItem = document.createElement('div');
                    userItem.className = 'participant-item';

                    const userNameSpan = document.createElement('span');
                    userNameSpan.textContent = username;

                    const deleteBtn = document.createElement('button');
                    deleteBtn.textContent = 'Удалить';
                    deleteBtn.className = 'delete-participant-btn';
                    deleteBtn.setAttribute('data-username', username);

                    userItem.appendChild(userNameSpan);
                    userItem.appendChild(deleteBtn);
                    participantListEl.appendChild(userItem);
                });
            } else {
                participantListEl.innerHTML = '<p>Нет зарегистрированных участников.</p>';
            }
        });
    };
    
    // --- Function to delete a user ---
    const deleteUser = (username) => {
        if (confirm(`Вы уверены, что хотите удалить участника "${username}"?`)) {
            const userRef = database.ref('users/' + username);
            userRef.remove()
                .then(() => {
                    console.log(`User ${username} deleted successfully.`);
                    // The list will update automatically due to the 'on' listener
                })
                .catch((error) => {
                    console.error('Error deleting user: ', error);
                    alert('Не удалось удалить участника.');
                });
        }
    };

    // --- Event listener for registration ---
    registerForm.addEventListener('submit', (e) => {
        e.preventDefault();

        const login = registerForm.login.value;
        const password = registerForm.password.value;

        const userRef = database.ref('users/' + login);

        // Use .set() to create or overwrite user
        userRef.set({
            password: password
        })
        .then(() => {
            console.log('User registered successfully!');
            registerForm.reset();
            successMessage.classList.remove('hidden');
            setTimeout(() => {
                successMessage.classList.add('hidden');
            }, 3000);
            // No need to call fetchAndDisplayUsers here, 'on' listener does it.
        })
        .catch((error) => {
            console.error('Error registering user: ', error);
            alert('Произошла ошибка при регистрации.');
        });
    });

    // --- Event listener for deleting users (using event delegation) ---
    participantListEl.addEventListener('click', (e) => {
        if (e.target && e.target.classList.contains('delete-participant-btn')) {
            const username = e.target.getAttribute('data-username');
            deleteUser(username);
        }
    });

    // --- Initial fetch of users ---
    fetchAndDisplayUsers();
    
    // --- Dynamically add styles for the participant list ---
    const style = document.createElement('style');
    style.textContent = `
        .participant-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 0.75rem;
            border: 1px solid var(--border-color);
            border-radius: 4px;
            margin-bottom: 0.5rem;
            background-color: var(--white);
        }
        .delete-participant-btn {
            background-color: var(--status-busy);
            color: var(--white);
            padding: 0.4rem 0.8rem;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 0.9rem;
            width: auto;
        }
        .delete-participant-btn:hover {
            opacity: 0.9;
        }
    `;
    document.head.appendChild(style);
});
