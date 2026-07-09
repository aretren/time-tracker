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
const database = firebase.database();

const loginForm = document.getElementById('login-form');
const errorMessage = document.getElementById('error-message');

loginForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const login = loginForm.login.value;
    const password = loginForm.password.value;

    const userRef = database.ref('users/' + login);

    userRef.once('value', (snapshot) => {
        if (snapshot.exists()) {
            const userData = snapshot.val();
            if (userData.password === password) {
                // Store user session
                sessionStorage.setItem('loggedInUser', login);
                
                // Set admin flag but redirect all users to the participant page
                if (userData.isAdmin) {
                    sessionStorage.setItem('isAdmin', 'true');
                } else {
                    sessionStorage.removeItem('isAdmin'); // Ensure isAdmin is not set for regular users
                }
                window.location.href = 'participant.html';

            } else {
                errorMessage.textContent = 'Неверный пароль.';
                errorMessage.classList.remove('hidden');
            }
        } else {
            errorMessage.textContent = 'Пользователь с таким логином не найден.';
            errorMessage.classList.remove('hidden');
        }
    }).catch((error) => {
        console.error("Login Error:", error);
        errorMessage.textContent = 'Произошла ошибка при входе.';
        errorMessage.classList.remove('hidden');
    });
});
