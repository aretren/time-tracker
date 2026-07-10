document.addEventListener('DOMContentLoaded', () => {
    // --- AUTH GUARD & SETUP ---
    const loggedInUser = sessionStorage.getItem('loggedInUser');
    const isAdmin = sessionStorage.getItem('isAdmin') === 'true';
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
    const projectsRef = database.ref('projects');
    const projectRef = database.ref(`projects/${projectId}`);

    // --- DOM ELEMENTS ---
    const projectNameHeader = document.getElementById('project-name-header');
    const calendarContainer = document.getElementById('calendar-container');
    const trainingListEl = document.getElementById('training-list');
    const materialsWidget = document.getElementById('materials-widget');
    const editProjectBtn = document.getElementById('edit-project-btn');

    const imageViewerModal = document.getElementById('image-viewer-modal');
    const closeImageViewerBtn = document.getElementById('close-image-viewer-btn');
    const imageViewerContent = document.getElementById('image-viewer-content');
    
    const addMaterialModal = document.getElementById('add-material-modal');
    const closeAddMaterialModalBtn = addMaterialModal.querySelector('.close-btn');
    const showAddMaterialModalBtn = document.getElementById('show-add-material-modal-btn');
    const addMaterialForm = document.getElementById('add-material-form');
    const materialParticipantSelect = document.getElementById('material-participant-select');
    const materialTypeSelect = document.getElementById('material-type-select');
    const materialDynamicFormContent = document.getElementById('material-dynamic-form-content');

    // --- STATE ---
    let calendar;
    let currentProject = {};

    // --- WIDGETS INITIALIZATION ---
    if (materialsWidget) {
        const header = materialsWidget.querySelector('.widget-header');
        const content = document.getElementById('materials-content');
        if (header) {
            header.classList.add('collapsible-header');
            materialsWidget.classList.add('collapsed');
            content.classList.add('hidden');
            header.addEventListener('click', (e) => {
                // Prevent toggle when clicking the add button
                if (e.target.id === 'show-add-material-modal-btn') return;
                materialsWidget.classList.toggle('collapsed');
                content.classList.toggle('hidden');
            });
        }
    }

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
    
    // --- EVENT LISTENERS (outside of data load) ---

    if (materialsWidget) {
        materialsWidget.addEventListener('click', async (e) => {
            const target = e.target;
            const info = getMaterialInfoFromElement(target);

            // USER-EDITABLE ACTIONS (only for their own materials)
            const isEditableAction = ['add-photo-btn', 'toggle-task-status-btn', 'delete-material-btn', 'edit-material-btn'].some(c => target.classList.contains(c));
            if (isEditableAction && (!info || info.username !== loggedInUser)) {
                return;
            }

            if (target.classList.contains('add-photo-btn')) {
                target.closest('.material-item').querySelector('.add-photo-input').click();
            } else if (target.classList.contains('toggle-task-status-btn')) {
                const newStatus = info.itemEl.classList.contains('completed') ? 'incomplete' : 'completed';
                projectRef.child('materials').child(info.username).child('tasks').child(info.itemId).child('status').set(newStatus);
            } else if (target.classList.contains('delete-material-btn')) {
                if (confirm('Вы уверены, что хотите удалить этот элемент?')) {
                    projectRef.child('materials').child(info.username).child(info.materialType).child(info.itemId).remove();
                }
            } else if (target.classList.contains('edit-material-btn')) {
                const { username, materialType, itemId, itemEl } = info;
                const data = currentProject.materials?.[username]?.[materialType]?.[itemId];
                if (!data) return;
                switch (materialType) {
                    case 'parties': renderPartyForm(itemEl, username, itemId, data); break;
                    case 'costumes': renderCostumeForm(itemEl, username, itemId, data); break;
                    case 'tasks': renderTaskForm(itemEl, username, itemId, data); break;
                    case 'notes': renderNoteForm(itemEl, username, itemId, data); break;
                }
            } else if (target.closest('.photo-thumbnail')) {
                // VIEW-ONLY ACTIONS (for anyone)
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
                    deleteBtn.style.display = infoForModal.username === loggedInUser ? 'block' : 'none';
                    imageViewerModal.classList.add('visible');
                }
            }
        });

        materialsWidget.addEventListener('change', async (e) => {
            if (e.target.classList.contains('add-photo-input')) {
                const info = getMaterialInfoFromElement(e.target);
                if (!info || info.username !== loggedInUser) return;
                
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

    // --- MODAL HANDLING ---
    const hideAddMaterialModal = () => {
        addMaterialModal.classList.remove('visible');
        addMaterialForm.reset();
        materialDynamicFormContent.innerHTML = '';
    };

    closeAddMaterialModalBtn.addEventListener('click', hideAddMaterialModal);
    
    showAddMaterialModalBtn.addEventListener('click', () => {
        addMaterialForm.reset();
        materialDynamicFormContent.innerHTML = '';
        document.getElementById('material-participant-group').style.display = 'none';
        addMaterialModal.classList.add('visible');
    });

    materialTypeSelect.addEventListener('change', (e) => {
        const type = e.target.value;
        materialDynamicFormContent.innerHTML = '';
        let fields = '';
        switch (type) {
            case 'party':
            case 'task':
                fields = `<div class="form-group"><input type="text" id="material-name" placeholder="Название" required></div>
                          <div class="form-group"><textarea id="material-description" placeholder="Описание"></textarea></div>`;
                break;
            case 'note':
                fields = `<div class="form-group"><input type="text" id="material-name" placeholder="Название" required></div>
                          <div class="form-group"><textarea id="material-description" placeholder="Описание"></textarea></div>
                          <div class="form-group"><label for="material-photo">Изображение</label><input type="file" id="material-photo" accept="image/*"></div>`;
                break;
            case 'costume':
                fields = `<div class="form-group"><input type="text" id="material-name" placeholder="Название предмета" required></div>
                          <div class="form-group"><input type="text" id="material-link" placeholder="Ссылка"></div>`;
                break;
        }
        materialDynamicFormContent.innerHTML = fields;
    });

    addMaterialForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const type = materialTypeSelect.value;
        const name = document.getElementById('material-name')?.value.trim();
        const photoFile = document.getElementById('material-photo')?.files[0];

        if (!type || !name) {
            alert('Пожалуйста, выберите тип и введите название.');
            return;
        }

        let imageUrl = null;
        if (photoFile) {
            try {
                imageUrl = await uploadImage(photoFile);
            } catch (error) {
                alert('Не удалось загрузить изображение. Попробуйте сохранить без него.');
                return;
            }
        }

        const targetUser = loggedInUser;
        const materialTypePlural = type + 's';
        let data = { name };

        switch (type) {
            case 'party':
            case 'note':
            case 'task':
                data.description = document.getElementById('material-description')?.value.trim() || '';
                if(type === 'task') data.status = 'incomplete';
                break;
            case 'costume':
                data.link = document.getElementById('material-link')?.value.trim() || '';
                break;
        }
        
        if (imageUrl) {
            data.photos = {};
            const newPhotoKey = database.ref().push().key;
            data.photos[newPhotoKey] = imageUrl;
        }

        projectRef.child('materials').child(targetUser).child(materialTypePlural).push().set(data);
        hideAddMaterialModal();
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
        if (e.target === imageViewerModal) imageViewerModal.classList.remove('visible');
        if (e.target === addMaterialModal) hideAddMaterialModal();
    });

    // --- RENDER FUNCTIONS ---

    const renderMaterials = (members, materials = {}) => {
        if (!materialsWidget) return;

        const materialsContent = document.getElementById('materials-content');
        materialsContent.innerHTML = '';
        
        const canAddAnyMaterial = (members && members[loggedInUser]) || isAdmin || (currentProject && currentProject.responsible === loggedInUser);
        showAddMaterialModalBtn.style.display = canAddAnyMaterial ? 'block' : 'none';

        const userSpecificMaterials = Object.keys(materials || {}).filter(u => u !== '__general' && Object.keys(materials[u]).length > 0);
        const generalMaterialsExist = materials?.__general && Object.keys(materials.__general).length > 0;

        if (userSpecificMaterials.length === 0 && !generalMaterialsExist) {
            materialsContent.innerHTML = '<p>Материалов пока нет.</p>';
            return;
        }

        const renderSection = (username) => {
            const userMaterials = materials[username];
            const headerText = username === '__general' ? 'Общие материалы' : username;
            
            // On this page, users can ONLY edit their own materials. General materials are not editable.
            const canEdit = username === loggedInUser;
            
            const userContainer = document.createElement('div');
            userContainer.className = 'material-user-container';
            userContainer.dataset.username = username;
            
            userContainer.innerHTML = `<div class="material-user-header"><h3>${headerText}</h3></div>
                                       <div class="material-items-container" data-username="${username}"></div>`;
            materialsContent.appendChild(userContainer);
            const itemsContainer = userContainer.querySelector('.material-items-container');

            Object.keys(userMaterials).forEach(type => {
                Object.entries(userMaterials[type]).forEach(([id, data]) => {
                    const itemContainer = document.createElement('div');
                    itemsContainer.appendChild(itemContainer);
                    switch(type) {
                        case 'parties': renderPartyItem(itemContainer, username, id, data, canEdit); break;
                        case 'costumes': renderCostumeItem(itemContainer, username, id, data, canEdit); break;
                        case 'tasks': renderTaskItem(itemContainer, username, id, data, canEdit); break;
                        case 'notes': renderNoteItem(itemContainer, username, id, data, canEdit); break;
                    }
                });
            });
        };

        // 1. Render General Materials
        if (generalMaterialsExist) {
            renderSection('__general');
        }

        // 2. Render User-Specific Materials
        userSpecificMaterials.forEach(username => {
            renderSection(username);
        });
    };

    const renderPartyItem = (container, username, partyId, partyData, canEdit) => {
        const photosHTML = partyData.photos ? Object.entries(partyData.photos).map(([photoId, url]) => `<div class="photo-thumbnail" data-photoid="${photoId}"><img src="${url}" alt="Фото"></div>`).join('') : '';
        const actionsHTML = canEdit ? `<div class="material-item-actions"><button class="edit-material-btn" title="Редактировать">✏️</button><button class="delete-material-btn" title="Удалить">🗑️</button></div>` : '';
        const addPhotoBtnHTML = canEdit ? `<button class="add-photo-btn">Добавить фото</button>` : '';

        container.className = 'material-item';
        container.dataset.id = partyId;
        container.dataset.type = 'parties';
        container.innerHTML = `<div class="material-item-header"><h4>Партия: ${partyData.name}</h4>${actionsHTML}</div>
                               <p>${partyData.description || ''}</p>
                               <div class="photo-gallery">${photosHTML}</div>
                               <input type="file" class="add-photo-input" multiple accept="image/*" style="display:none;">
                               ${addPhotoBtnHTML}`;
    };

    const renderCostumeItem = (container, username, costumeId, costumeData, canEdit) => {
        const photosHTML = costumeData.photos ? Object.entries(costumeData.photos).map(([photoId, url]) => `<div class="photo-thumbnail" data-photoid="${photoId}"><img src="${url}" alt="Фото"></div>`).join('') : '';
        const actionsHTML = canEdit ? `<div class="material-item-actions"><button class="edit-material-btn" title="Редактировать">✏️</button><button class="delete-material-btn" title="Удалить">🗑️</button></div>` : '';
        const addPhotoBtnHTML = canEdit ? `<button class="add-photo-btn">Добавить фото</button>` : '';
        const linkHTML = costumeData.link ? `<div class="material-link-container"><a href="${costumeData.link}" target="_blank" rel="noopener noreferrer">🔗 Ссылка на товар</a></div>` : '';

        container.className = 'material-item';
        container.dataset.id = costumeId;
        container.dataset.type = 'costumes';
        container.innerHTML = `<div class="material-item-header"><h4>Костюм: ${costumeData.name}</h4>${actionsHTML}</div>
                               ${linkHTML}
                               <div class="photo-gallery">${photosHTML}</div>
                               <input type="file" class="add-photo-input" multiple accept="image/*" style="display:none;">
                               ${addPhotoBtnHTML}`;
    };

    const renderTaskItem = (container, username, taskId, taskData, canEdit) => {
        const toggleBtnHTML = canEdit ? `<button class="toggle-task-status-btn" title="Изменить статус">${taskData.status === 'completed' ? '✔️' : '⭕'}</button>` : '';
        const actionsHTML = canEdit ? `<div class="material-item-actions">${toggleBtnHTML}<button class="edit-material-btn" title="Редактировать">✏️</button><button class="delete-material-btn" title="Удалить">🗑️</button></div>` : '';

        container.className = `material-item task-item ${taskData.status === 'completed' ? 'completed' : ''}`;
        container.dataset.id = taskId;
        container.dataset.type = 'tasks';
        container.innerHTML = `<div class="material-item-header"><h4>Задача: ${taskData.name}</h4>${actionsHTML}</div>
                               <p>${taskData.description || ''}</p>`;
    };

    const renderNoteItem = (container, username, noteId, noteData, canEdit) => {
        const photosHTML = noteData.photos ? Object.entries(noteData.photos).map(([photoId, url]) => `<div class="photo-thumbnail" data-photoid="${photoId}"><img src="${url}" alt="Фото заметки"></div>`).join('') : '';
        const actionsHTML = canEdit ? `<div class="material-item-actions"><button class="edit-material-btn" title="Редактировать">✏️</button><button class="delete-material-btn" title="Удалить">🗑️</button></div>` : '';
        const addPhotoBtnHTML = canEdit ? `<button class="add-photo-btn">Добавить фото</button>` : '';

        container.className = 'material-item';
        container.dataset.id = noteId;
        container.dataset.type = 'notes';
        container.innerHTML = `<div class="material-item-header"><h4>Заметка: ${noteData.name}</h4>${actionsHTML}</div>
                               <p>${noteData.description || ''}</p>
                               <div class="photo-gallery">${photosHTML}</div>
                               <input type="file" class="add-photo-input" multiple accept="image/*" style="display:none;">
                               ${addPhotoBtnHTML}`;
    };

    const createFormLogic = (container, type, username, itemId, existingData, renderItemFunc) => {
        const isEditing = !!itemId;
        const typeNames = { party: 'партию', costume: 'костюм', task: 'задачу', note: 'заметку' };
        
        let fields = `<div class="form-group"><input type="text" class="name-input" placeholder="Название" value="${existingData.name || ''}"></div>`;
        if (type !== 'task') fields += `<div class="form-group"><textarea class="description-input" placeholder="Описание">${existingData.description || ''}</textarea></div>`;
        if (type === 'costume') fields = `<div class="form-group"><input type="text" class="name-input" placeholder="Название" value="${existingData.name || ''}"></div>
                                           <div class="form-group"><input type="text" class="link-input" placeholder="Ссылка" value="${existingData.link || ''}"></div>`;
        if (type === 'task') fields += `<div class="form-group"><textarea class="description-input" placeholder="Описание">${existingData.description || ''}</textarea></div>`;
        
        container.className = 'material-item add-form';
        container.innerHTML = `<h4>${isEditing ? 'Редактировать' : 'Новая'} ${typeNames[type]}</h4>
                               ${fields}
                               <button class="save-btn">Сохранить</button>
                               <button class="cancel-btn">Отмена</button>`;

        container.querySelector('.save-btn').onclick = () => {
            const name = container.querySelector('.name-input').value.trim();
            if (!name) { alert('Название не может быть пустым.'); return; }
            
            const newData = { name, photos: existingData.photos || null };
            if (type !== 'task') newData.description = container.querySelector('.description-input')?.value.trim() || '';
            if (type === 'costume') newData.link = container.querySelector('.link-input')?.value.trim() || '';
            if (type === 'task') {
                newData.description = container.querySelector('.description-input')?.value.trim() || '';
                newData.status = existingData.status || 'incomplete';
            }

            const ref = isEditing 
                ? projectRef.child('materials').child(username).child(type + 's').child(itemId)
                : projectRef.child('materials').child(username).child(type + 's').push();
            
            ref.set(newData);
            if (!isEditing) container.remove();
        };

        container.querySelector('.cancel-btn').onclick = () => {
            isEditing ? renderItemFunc(container, username, itemId, existingData, true) : container.remove();
        };
    };

    const renderPartyForm = (c, u, i, d) => createFormLogic(c, 'party', u, i, d, renderPartyItem);
    const renderCostumeForm = (c, u, i, d) => createFormLogic(c, 'costume', u, i, d, renderCostumeItem);
    const renderTaskForm = (c, u, i, d) => createFormLogic(c, 'task', u, i, d, renderTaskItem);
    const renderNoteForm = (c, u, i, d) => createFormLogic(c, 'note', u, i, d, renderNoteItem);
    
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

    const toLocalDateString = (date) => {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    };

    const updateProjectColorStyles = (colorHue) => {
        const styleId = 'project-color-styles';
        let styleElement = document.getElementById(styleId);
        if (!styleElement) {
            styleElement = document.createElement('style');
            styleElement.id = styleId;
            document.head.appendChild(styleElement);
        }
        styleElement.innerHTML = colorHue ? `.air-datepicker-cell.highlight-project-training { background-color: hsla(${colorHue}, 80%, 85%, 0.9); }` : '';
    };

    const initializeCalendar = (projectTrainingDates) => {
        if (calendar) calendar.destroy();
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        calendar = new AirDatepicker('#calendar-container', {
            inline: true,
            locale: { days: ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'], daysShort: ['Вос', 'Пон', 'Вто', 'Сре', 'Чет', 'Пят', 'Суб'], daysMin: ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'], months: ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'], monthsShort: ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'], today: 'Сегодня', clear: 'Очистить', dateFormat: 'dd.MM.yyyy', timeFormat: 'HH:mm', firstDay: 1 },
            onRenderCell: ({date, cellType}) => {
                if (cellType === 'day') {
                    const dateStr = toLocalDateString(date);
                    const isPast = date < today;
                    let classes = '';
                    if (projectTrainingDates.has(dateStr)) classes = 'highlight-project-training';
                    if (isPast && projectTrainingDates.has(dateStr)) classes += ' past-training';
                    return { classes };
                }
            }
        });
    };

    // --- MAIN DATA LISTENER ---
    projectsRef.on('value', (snapshot) => {
        const allProjects = snapshot.val();
        if (!allProjects || !allProjects[projectId]) {
            alert('Проект не найден или был удален.');
            window.location.href = 'participant.html';
            return;
        }
        currentProject = allProjects[projectId];
        
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
        renderMaterials(currentProject.members, currentProject.materials);

        if (currentProject.colorHue) {
            const headerEl = projectNameHeader.closest('.app-header');
            if(headerEl) headerEl.style.backgroundColor = `hsla(${currentProject.colorHue}, 80%, 85%, 0.75)`;
            updateProjectColorStyles(currentProject.colorHue);
        } else {
            updateProjectColorStyles(null);
        }

        const projectTrainingDates = new Set();
        if (currentProject.trainings) {
            Object.values(currentProject.trainings).forEach(t => {
                if (t.startTime || t.time) {
                    try {
                        const dateStr = toLocalDateString(new Date(t.startTime || t.time));
                        projectTrainingDates.add(dateStr);
                    } catch (e) { console.error("Skipping invalid date:", t.startTime || t.time); }
                }
            });
        }
        initializeCalendar(projectTrainingDates);
    });

    window.addEventListener('beforeunload', () => {
        projectsRef.off('value');
    });
});
