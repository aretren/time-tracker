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

registerForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const login = registerForm.login.value;
    const password = registerForm.password.value;

    // Use the login as the key
    const userRef = database.ref('users/' + login);

    userRef.set({
        password: password,
        isAdmin: true // Set the admin flag
    })
    .then(() => {
        console.log('Admin registered successfully!');
        registerForm.reset();
        successMessage.classList.remove('hidden');
        setTimeout(() => {
            successMessage.classList.add('hidden');
        }, 3000);
    })
    .catch((error) => {
        console.error('Error registering admin: ', error);
        alert('Произошла ошибка при регистрации администратора. Пожалуйста, посмотрите в консоль для деталей.');
    });
});
