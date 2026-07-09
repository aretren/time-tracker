document.addEventListener('DOMContentLoaded', () => {
    // --- AUTH GUARD & SETUP ---
    const loggedInUser = sessionStorage.getItem('loggedInUser');
    const usernameDisplay = document.getElementById('username-display');

    if (!loggedInUser) {
        window.location.href = 'login.html';
        return;
    }
    usernameDisplay.textContent = `Пользователь: ${loggedInUser}`;

    const params = new URLSearchParams(window.location.search);
    const projectId = params.get('id');
    if (!projectId) {
        alert('Project ID not found.');
        window.location.href = 'participant.html';
        return;
    }

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
    const projectRef = database.ref(`projects/${projectId}`);


    // --- DOM ELEMENTS ---
    const projectNameHeader = document.getElementById('project-name-header');
    const calendarContainer = document.getElementById('calendar-container');
    const trainingListEl = document.getElementById('training-list');
    const materialsWidget = document.getElementById('materials-widget');
    const editProjectBtn = document.getElementById('edit-project-btn');

    // --- MODAL & MENU ELEMENTS ---
    const imageViewerModal = document.getElementById('image-viewer-modal');
    const closeImageViewerBtn = document.getElementById('close-image-viewer-btn');
    const imageViewerContent = document.getElementById('image-viewer-content');
    const addMaterialModal = document.getElementById('add-material-modal');
    const closeAddMaterialModalBtn = addMaterialModal.querySelector('.close-btn');
    const materialTypeSelection = document.getElementById('material-type-selection');

    let calendar;
    let currentProject = {}; // To store project data

    // --- PERMISSIONS ---
    // On this page, the user can always edit their own materials.
    const canEditMaterials = true;

    // --- MATERIALS LOGIC ---

    const getMaterialInfoFromElement = (element) => {
        const item = element.closest('.material-item');
        const userContainer = element.closest('.material-user-container');
        if (!item || !userContainer) return null;

        const username = userContainer.dataset.username;
        const materialType = item.dataset.type;
        const itemId = item.dataset.id;
        
        return { username, materialType, itemId, itemEl: item };
    };

    if (materialsWidget) {
        const header = materialsWidget.querySelector('h2');
        if (header) {
            header.classList.add('collapsible-header');
            header.addEventListener('click', () => {
                materialsWidget.classList.toggle('collapsed');
            });
        }
        
        materialsWidget.addEventListener('click', async (e) => {
            const target = e.target;

            if (target.classList.contains('add-material-btn')) {
                const username = target.dataset.username;
                if (username === loggedInUser) {
                    addMaterialModal.dataset.username = username;
                    addMaterialModal.classList.add('visible');
                }
                return;
            }
            
            const info = getMaterialInfoFromElement(target);

            // --- USER-EDITABLE ACTIONS ---
            if (target.classList.contains('add-photo-btn') || target.classList.contains('toggle-task-status-btn') || target.classList.contains('delete-material-btn') || target.classList.contains('edit-material-btn')) {
                 if (!info || info.username !== loggedInUser) {
                    return;
                }
            }

            if (target.classList.contains('add-material-btn')) {
                showAddMaterialMenu(loggedInUser, target);
                return;
            }
            if (target.classList.contains('add-photo-btn')) {
                target.closest('.material-item').querySelector('.add-photo-input').click();
                return;
            }
            if (target.classList.contains('toggle-task-status-btn')) {
                const currentStatus = info.itemEl.classList.contains('completed') ? 'completed' : 'incomplete';
                const newStatus = currentStatus === 'completed' ? 'incomplete' : 'completed';
                projectRef.child('materials').child(info.username).child('tasks').child(info.itemId).child('status').set(newStatus);
                return;
            }
            if (target.classList.contains('delete-material-btn')) {
                if (confirm('Вы уверены, что хотите удалить этот элемент?')) {
                    projectRef.child('materials').child(info.username).child(info.materialType).child(info.itemId).remove();
                }
                return;
            }
            if (target.classList.contains('edit-material-btn')) {
                const { username, materialType, itemId, itemEl } = info;
                const data = currentProject.materials?.[username]?.[materialType]?.[itemId];
                if (!data) return;
                switch (materialType) {
                    case 'parties': renderPartyForm(itemEl, username, itemId, data); break;
                    case 'costumes': renderCostumeForm(itemEl, username, itemId, data); break;
                    case 'tasks': renderTaskForm(itemEl, username, itemId, data); break;
                }
                return;
            }
            
            // --- VIEW-ONLY ACTIONS (for anyone) ---
            if (target.closest('.photo-thumbnail')) {
                const thumb = target.closest('.photo-thumbnail');
                const infoForModal = getMaterialInfoFromElement(thumb);
                const photoId = thumb.dataset.photoid;
                const imgSrc = thumb.querySelector('img')?.src;
                
                if (imgSrc && infoForModal && photoId) {
                    imageViewerContent.src = imgSrc;
                    const deleteContext = {
                        username: infoForModal.username,
                        materialType: infoForModal.materialType,
                        itemId: infoForModal.itemId,
                        photoId: photoId
                    };
                    imageViewerModal.dataset.deleteContext = JSON.stringify(deleteContext);
                    
                    const deleteBtn = document.getElementById('image-viewer-delete-btn');
                    if (infoForModal.username === loggedInUser) {
                        deleteBtn.classList.remove('hidden');
                    } else {
                        deleteBtn.classList.add('hidden');
                    }

                    imageViewerModal.classList.add('visible');
                }
                return;
            }
        });

        materialsWidget.addEventListener('change', async (e) => {
            if (e.target.classList.contains('add-photo-input')) {
                const info = getMaterialInfoFromElement(e.target);
                if (!info || info.username !== loggedInUser) return; // Security check
                
                const files = e.target.files;
                if (!files.length) return;
                
                const photosRef = projectRef.child('materials').child(info.username).child(info.materialType).child(info.itemId).child('photos');
                for (const file of files) {
                    const imageUrl = await uploadImage(file);
                    if (imageUrl) photosRef.push().set(imageUrl);
                }
            }
        });
    }

    const uploadImage = async (file) => {
        const formData = new FormData();
        formData.append('image', file);
        try {
            const response = await fetch('https://api.imgbb.com/1/upload?key=a29a659a810c0bc31aadb00ea280227b', {
                method: 'POST',
                body: formData,
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP error! status: ${response.status}, ${errorText}`);
            }
            const result = await response.json();
            if (result.success && result.data?.url) {
                return result.data.url;
            } else {
                throw new Error(result.error?.message || 'URL не найден в ответе API.');
            }
        } catch (error) {
            console.error('Ошибка загрузки изображения:', error);
            alert(`Ошибка загрузки изображения: ${error.message}`);
            return null;
        }
    };

    // --- MODAL HANDLING ---
    closeAddMaterialModalBtn.addEventListener('click', () => addMaterialModal.classList.remove('visible'));

    materialTypeSelection.addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON') {
            const type = e.target.dataset.type;
            const username = addMaterialModal.dataset.username;
            const container = document.querySelector(`.material-items-container[data-username="${username}"]`);
            if (!container) return;

            const formContainer = document.createElement('div');
            container.prepend(formContainer);

            switch (type) {
                case 'party': renderPartyForm(formContainer, username); break;
                case 'costume': renderCostumeForm(formContainer, username); break;
                case 'task': renderTaskForm(formContainer, username); break;
            }
            addMaterialModal.classList.remove('visible');
        }
    });

    if(closeImageViewerBtn) closeImageViewerBtn.addEventListener('click', () => imageViewerModal.classList.remove('visible'));
    document.getElementById('image-viewer-delete-btn').addEventListener('click', () => {
        const context = JSON.parse(imageViewerModal.dataset.deleteContext || '{}');
        if (context.username && context.photoId && context.username === loggedInUser && confirm('Удалить это фото?')) {
            projectRef.child('materials').child(context.username).child(context.materialType).child(context.itemId).child('photos').child(context.photoId).remove();
            imageViewerModal.classList.remove('visible');
        }
    });

    window.addEventListener('click', (e) => {
        if (e.target === imageViewerModal) {
            imageViewerModal.classList.remove('visible');
        }
        if (e.target === addMaterialModal) {
            addMaterialModal.classList.remove('visible');
        }
    });

    window.addEventListener('touchend', (e) => {
        if (e.target === imageViewerModal) {
            imageViewerModal.classList.remove('visible');
        }
        if (e.target === addMaterialModal) {
            addMaterialModal.classList.remove('visible');
        }
    });

    // --- MATERIAL DATA RENDERING ---
    const renderMaterials = (members, materials = {}) => {
        if (!materialsWidget) return;
        const materialsContent = document.getElementById('materials-content');
        materialsContent.innerHTML = '';
        const memberUsernames = members ? Object.keys(members) : [];

        if (memberUsernames.length === 0) {
            materialsContent.innerHTML = '<p>В проекте нет участников.</p>';
            return;
        }

        memberUsernames.forEach(username => {
            const userMaterials = materials?.[username] || {};
            const canEdit = username === loggedInUser;

            const userContainer = document.createElement('div');
            userContainer.className = 'material-user-container';
            userContainer.dataset.username = username;
            
            const addButtonHTML = canEdit ? `<button class="add-material-btn" data-username="${username}">+</button>` : '';
            userContainer.innerHTML = `
                <div class="material-user-header">
                    <h3>${username}</h3>
                    ${addButtonHTML}
                </div>
                <div class="material-items-container" data-username="${username}"></div>
            `;
            materialsContent.appendChild(userContainer);
            const itemsContainer = userContainer.querySelector('.material-items-container');

            const renderAllItems = (type, renderFunc) => {
                if (userMaterials[type]) {
                    Object.entries(userMaterials[type]).forEach(([id, data]) => {
                        const itemContainer = document.createElement('div');
                        itemsContainer.appendChild(itemContainer);
                        renderFunc(itemContainer, username, id, data, canEdit);
                    });
                }
            };

            renderAllItems('parties', renderPartyItem);
            renderAllItems('costumes', renderCostumeItem);
            renderAllItems('tasks', renderTaskItem);
        });
    };

    const renderPartyItem = (container, username, partyId, partyData, canEdit) => {
        const photosHTML = partyData.photos ? Object.entries(partyData.photos).map(([photoId, url]) => {
            return `<div class="photo-thumbnail" data-photoid="${photoId}"><img src="${url}" alt="Фото"></div>`;
        }).join('') : '';
        
        const actionsHTML = canEdit ? `<div class="material-item-actions"><button class="edit-material-btn" title="Редактировать">✏️</button><button class="delete-material-btn" title="Удалить">🗑️</button></div>` : '';
        const addPhotoBtnHTML = canEdit ? `<button class="add-photo-btn">Добавить фото</button>` : '';

        container.className = 'material-item';
        container.dataset.id = partyId;
        container.dataset.type = 'parties';
        container.innerHTML = `
            <div class="material-item-header">
                <h4>Партия: ${partyData.name}</h4>
                ${actionsHTML}
            </div>
            <p>${partyData.description || ''}</p>
            <div class="photo-gallery">${photosHTML}</div>
            <input type="file" class="add-photo-input" multiple accept="image/*" style="display:none;">
            ${addPhotoBtnHTML}
        `;
    };

    const renderCostumeItem = (container, username, costumeId, costumeData, canEdit) => {
        const photosHTML = costumeData.photos ? Object.entries(costumeData.photos).map(([photoId, url]) => {
            return `<div class="photo-thumbnail" data-photoid="${photoId}"><img src="${url}" alt="Фото"></div>`;
        }).join('') : '';
        
        const actionsHTML = canEdit ? `<div class="material-item-actions"><button class="edit-material-btn" title="Редактировать">✏️</button><button class="delete-material-btn" title="Удалить">🗑️</button></div>` : '';
        const addPhotoBtnHTML = canEdit ? `<button class="add-photo-btn">Добавить фото</button>` : '';
        const linkHTML = costumeData.link ? `<div class="material-link-container"><a href="${costumeData.link}" target="_blank" rel="noopener noreferrer">🔗 Ссылка на товар</a></div>` : '';

        container.className = 'material-item';
        container.dataset.id = costumeId;
        container.dataset.type = 'costumes';
        container.innerHTML = `
            <div class="material-item-header">
                <h4>Костюм: ${costumeData.name}</h4>
                ${actionsHTML}
            </div>
            ${linkHTML}
            <div class="photo-gallery">${photosHTML}</div>
            <input type="file" class="add-photo-input" multiple accept="image/*" style="display:none;">
            ${addPhotoBtnHTML}
        `;
    };

    const renderTaskItem = (container, username, taskId, taskData, canEdit) => {
        const toggleBtnHTML = canEdit ? `<button class="toggle-task-status-btn" title="Изменить статус">${taskData.status === 'completed' ? '✔️' : '⭕'}</button>` : '';
        const actionsHTML = canEdit ? `<div class="material-item-actions">${toggleBtnHTML}<button class="edit-material-btn" title="Редактировать">✏️</button><button class="delete-material-btn" title="Удалить">🗑️</button></div>` : '';

        container.className = `material-item task-item ${taskData.status === 'completed' ? 'completed' : ''}`;
        container.dataset.id = taskId;
        container.dataset.type = 'tasks';
        container.innerHTML = `
            <div class="material-item-header">
                <h4>Задача: ${taskData.name}</h4>
                ${actionsHTML}
            </div>
            <p>${taskData.description}</p>
        `;
    };

    // --- MATERIAL FORM RENDERING ---
    // These forms are only initiated by actions that are already guarded by canEdit checks.
    const renderPartyForm = (container, username, partyId = null, existingData = {}) => {
        const isEditing = !!partyId;
        container.className = 'material-item add-form';
        container.innerHTML = `<h4>${isEditing ? 'Редактировать' : 'Новая партия'}</h4><div class="form-group"><input type="text" placeholder="Название" value="${existingData.name || ''}"></div><div class="form-group"><textarea placeholder="Описание">${existingData.description || ''}</textarea></div><button class="save-btn">Сохранить</button><button class="cancel-btn">Отмена</button>`;
        container.querySelector('.save-btn').onclick = () => {
            const name = container.querySelector('input').value.trim();
            if (!name) { alert('Название не может быть пустым.'); return; }
            const description = container.querySelector('textarea').value.trim();
            const ref = isEditing ? projectRef.child('materials').child(username).child('parties').child(partyId) : projectRef.child('materials').child(username).child('parties').push();
            ref.set({ name, description, photos: existingData.photos || null });
            if (!isEditing) container.remove();
        };
        container.querySelector('.cancel-btn').onclick = () => { isEditing ? renderPartyItem(container, username, partyId, existingData, true) : container.remove(); };
    };

    const renderCostumeForm = (container, username, costumeId = null, existingData = {}) => {
        const isEditing = !!costumeId;
        container.className = 'material-item add-form';
        container.innerHTML = `<h4>${isEditing ? 'Редактировать' : 'Новый костюм'}</h4><div class="form-group"><input type="text" placeholder="Название" value="${existingData.name || ''}"></div><div class="form-group"><input type="text" placeholder="Ссылка" value="${existingData.link || ''}"></div><button class="save-btn">Сохранить</button><button class="cancel-btn">Отмена</button>`;
        container.querySelector('.save-btn').onclick = () => {
            const name = container.querySelector('input[placeholder="Название"]').value.trim();
            if (!name) { alert('Название не может быть пустым.'); return; }
            const link = container.querySelector('input[placeholder="Ссылка"]').value.trim();
            const ref = isEditing ? projectRef.child('materials').child(username).child('costumes').child(costumeId) : projectRef.child('materials').child(username).child('costumes').push();
            ref.set({ name, link, photos: existingData.photos || null });
            if (!isEditing) container.remove();
        };
        container.querySelector('.cancel-btn').onclick = () => { isEditing ? renderCostumeItem(container, username, costumeId, existingData, true) : container.remove(); };
    };

    const renderTaskForm = (container, username, taskId = null, existingData = {}) => {
        const isEditing = !!taskId;
        container.className = 'material-item add-form';
        container.innerHTML = `<h4>${isEditing ? 'Редактировать' : 'Новая задача'}</h4><div class="form-group"><input type="text" placeholder="Название" value="${existingData.name || ''}"></div><div class="form-group"><textarea placeholder="Описание">${existingData.description || ''}</textarea></div><button class="save-btn">Сохранить</button><button class="cancel-btn">Отмена</button>`;
        container.querySelector('.save-btn').onclick = () => {
            const name = container.querySelector('input').value.trim();
            if (!name) { alert('Название не может быть пустым.'); return; }
            const description = container.querySelector('textarea').value.trim();
            const ref = isEditing ? projectRef.child('materials').child(username).child('tasks').child(taskId) : projectRef.child('materials').child(username).child('tasks').push();
            ref.set({ name, description, status: existingData.status || 'incomplete' });
            if (!isEditing) container.remove();
        };
        container.querySelector('.cancel-btn').onclick = () => { isEditing ? renderTaskItem(container, username, taskId, existingData, true) : container.remove(); };
    };



    // --- ORIGINAL PAGE LOGIC (Trainings, Calendar, etc.) ---
    const renderProjectName = (name) => {
        projectNameHeader.textContent = name;
        document.title = name;
    };

    const renderTrainings = (trainings) => {
        trainingListEl.innerHTML = '';
        if (!trainings) {
            trainingListEl.innerHTML = '<li>Предстоящих тренировок нет.</li>';
            return;
        }
        const now = new Date();
        const upcomingTrainings = Object.values(trainings)
            .map(t => ({...t, date: new Date(t.startTime || t.time)}))
            .filter(t => t.date >= now && !isNaN(t.date))
            .sort((a, b) => a.date - b.date);
        if (upcomingTrainings.length === 0) {
            trainingListEl.innerHTML = '<li>Предстоящих тренировок нет.</li>';
            return;
        }
        upcomingTrainings.forEach(training => {
            const li = document.createElement('li');
            li.className = 'training-item';
            let formattedDate;
            if (training.startTime && training.endTime) {
                const startDate = new Date(training.startTime), endDate = new Date(training.endTime);
                const dateOpts = { day: 'numeric', month: 'short' }, timeOpts = { hour: '2-digit', minute: '2-digit' };
                const fStartDate = startDate.toLocaleDateString('ru-RU', dateOpts), fStartTime = startDate.toLocaleTimeString('ru-RU', timeOpts), fEndTime = endDate.toLocaleTimeString('ru-RU', timeOpts);
                formattedDate = startDate.toDateString() === endDate.toDateString() ? `${fStartDate}, ${fStartTime} - ${fEndTime}` : `${fStartDate} ${fStartTime} - ${endDate.toLocaleDateString('ru-RU', dateOpts)} ${fEndTime}`;
            } else if (training.time) {
                formattedDate = new Date(training.time).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' });
            }
            li.innerHTML = `<div class="training-details"><p><strong>Время:</strong> ${formattedDate || 'N/A'}</p><p><strong>Место:</strong> ${training.location || 'Не указано'}</p><p><strong>Комментарий:</strong> ${training.comment || 'Нет'}</p></div>`;
            trainingListEl.appendChild(li);
        });
    };

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

    const projectsRef = database.ref('projects');
    projectsRef.on('value', (snapshot) => {
        const allProjects = snapshot.val();
        if (!allProjects || !allProjects[projectId]) {
            alert('Проект не найден или был удален.');
            window.location.href = 'participant.html';
            return;
        }
        currentProject = allProjects[projectId];
        
        const isAdmin = sessionStorage.getItem('isAdmin') === 'true';

        // --- ACCESS CONTROL ---
        const isMember = currentProject.members && currentProject.members[loggedInUser];
        if (!isAdmin && !isMember) {
            alert('У вас нет доступа к этому проекту.');
            window.location.href = 'participant.html';
            return;
        }


        const isResponsible = currentProject.responsible === loggedInUser;

        if (isAdmin || isResponsible) {
            editProjectBtn.classList.remove('hidden');
            editProjectBtn.href = `project.html?id=${projectId}`;
        }

        renderProjectName(currentProject.name);
        renderTrainings(currentProject.trainings);
        renderMaterials(currentProject.members, currentProject.materials); // Render materials for all users

        projectTrainingDates.clear();
        otherTrainingDates.clear();
        for (const projId in allProjects) {
            const p = allProjects[projId];
            if (p.members && p.members[loggedInUser] && p.trainings) {
                const isCurrent = projId === projectId;
                Object.values(p.trainings).forEach(t => {
                    if (t.startTime || t.time) {
                        try {
                            const dateStr = toLocalDateString(new Date(t.startTime || t.time));
                            if (isCurrent) projectTrainingDates.add(dateStr); else otherTrainingDates.add(dateStr);
                        } catch (e) { console.error("Skipping invalid date:", t.startTime || t.time); }
                    }
                });
            }
        }
        initializeCalendar();
    });

    window.addEventListener('beforeunload', () => {
        projectsRef.off('value');
    });
});