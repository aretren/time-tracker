document.addEventListener('DOMContentLoaded', () => {
    // --- AUTH GUARD & SETUP ---
    const loggedInUser = sessionStorage.getItem('loggedInUser');
    const isAdmin = sessionStorage.getItem('isAdmin');
    const usernameDisplay = document.getElementById('username-display');

    if (!loggedInUser) {
        window.location.href = 'login.html';
        return;
    }
    
    const params = new URLSearchParams(window.location.search);
    const projectId = params.get('id');
    if (!projectId) {
        alert('Project ID not found.');
        window.location.href = 'admin.html';
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
    const calendarContainer = document.getElementById('calendar-container');
    const scheduleGridEl = document.getElementById('combined-schedule-grid');
    const participantListEl = document.getElementById('participant-list');
    const trainingListEl = document.getElementById('training-list');
    const backToParticipantBtn = document.getElementById('back-to-participant-btn');
    const backToParticipantProjectBtn = document.getElementById('back-to-participant-project-btn');
    const responsibleUserSelect = document.getElementById('responsible-user-select');
    const locationsRef = database.ref('locations');
    const materialsWidget = document.getElementById('materials-widget');

    // --- MODAL & MENU ELEMENTS ---
    const addTrainingModal = document.getElementById('add-training-modal');
    const showAddTrainingModalBtn = document.getElementById('show-add-training-modal-btn');
    const closeAddTrainingModalBtn = addTrainingModal.querySelector('.close-btn');
    const addTrainingForm = document.getElementById('add-training-form');
    const trainingStartTimeInput = document.getElementById('training-start-time');
    const trainingEndTimeInput = document.getElementById('training-end-time');
    const trainingLocationSelect = document.getElementById('training-location-select');
    const newTrainingLocationInput = document.getElementById('new-training-location-input');
    const trainingCommentInput = document.getElementById('training-comment');

    const projectHelpBtn = document.getElementById('project-help-btn');
    const projectHelpModal = document.getElementById('project-help-modal');
    const closeProjectHelpModalBtn = document.getElementById('close-project-help-modal-btn');
    
    const imageViewerModal = document.getElementById('image-viewer-modal');
    const closeImageViewerBtn = document.getElementById('close-image-viewer-btn');
    const imageViewerContent = document.getElementById('image-viewer-content');
    const addMaterialModal = document.getElementById('add-material-modal');
    const closeAddMaterialModalBtn = addMaterialModal.querySelector('.close-btn');
    const materialTypeSelection = document.getElementById('material-type-selection');
    const projectActionsWidget = document.getElementById('project-actions-widget');
    const archiveProjectBtn = document.getElementById('archive-project-btn');
    const deleteProjectBtn = document.getElementById('delete-project-btn');

    // --- STATE ---
    let selectedDate = new Date();
    let projectData = {};
    let allProjectsData = {};
    let projectMembers = {};
    let allUsers = [];
    let allLocations = [];
    let calendar;
    let currentCalendarDate = new Date();
    let isHighlighting = false;
    let canEditMaterials = false; // Permission flag
    let highlightsCache = {};
    let actionButtonsInitialized = false;

    // --- INITIALIZATION ---
    initializeCalendar();
    
    // --- UI INTERACTIVITY (WIDGETS) ---
    const participantsWidget = document.getElementById('participants-widget');
    if (participantsWidget) {
        const header = participantsWidget.querySelector('h2');
        header.classList.add('collapsible-header');
        participantsWidget.classList.add('collapsed');
        header.addEventListener('click', () => { participantsWidget.classList.toggle('collapsed'); });
    }

    if (materialsWidget) {
        const header = materialsWidget.querySelector('h2');
        header.classList.add('collapsible-header');
        const content = document.getElementById('materials-content');
        header.addEventListener('click', () => {
            const isCollapsed = content.classList.toggle('hidden');
            header.parentElement.classList.toggle('collapsed', isCollapsed);
        });
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

    materialsWidget.addEventListener('click', async (e) => {
        const target = e.target;

        // Show add material modal
        if (target.classList.contains('add-material-btn')) {
            addMaterialModal.dataset.username = target.dataset.username; // Store username
            addMaterialModal.classList.add('visible');
            return;
        }

        // Open file dialog
        if (target.classList.contains('add-photo-btn')) {
            target.closest('.material-item').querySelector('.add-photo-input').click();
            return;
        }
        
        // Open image in modal
        if (target.closest('.photo-thumbnail')) {
            const thumb = target.closest('.photo-thumbnail');
            const info = getMaterialInfoFromElement(thumb);
            const photoId = thumb.dataset.photoid;
            const imgSrc = thumb.querySelector('img')?.src;

            if (imgSrc && info && photoId) {
                imageViewerContent.src = imgSrc;
                const deleteContext = {
                    username: info.username,
                    materialType: info.materialType,
                    itemId: info.itemId,
                    photoId: photoId
                };
                imageViewerModal.dataset.deleteContext = JSON.stringify(deleteContext);
                
                const deleteBtn = document.getElementById('image-viewer-delete-btn');
                if(canEditMaterials) {
                     deleteBtn.classList.remove('hidden');
                } else {
                     deleteBtn.classList.add('hidden');
                }

                imageViewerModal.classList.add('visible');
            }
            return;
        }

        // Toggle task status
        if (target.classList.contains('toggle-task-status-btn')) {
            const info = getMaterialInfoFromElement(target);
            if(info) {
                const currentStatus = info.itemEl.classList.contains('completed') ? 'completed' : 'incomplete';
                const newStatus = currentStatus === 'completed' ? 'incomplete' : 'completed';
                projectRef.child('materials').child(info.username).child('tasks').child(info.itemId).child('status').set(newStatus);
            }
            return;
        }

        // Delete material item
        if (target.classList.contains('delete-material-btn')) {
            const info = getMaterialInfoFromElement(target);
            if (info && confirm('Вы уверены, что хотите удалить этот элемент?')) {
                projectRef.child('materials').child(info.username).child(info.materialType).child(info.itemId).remove();
            }
            return;
        }

        // Edit material item
        if (target.classList.contains('edit-material-btn')) {
            const info = getMaterialInfoFromElement(target);
            if (!info) return;

            const { username, materialType, itemId, itemEl } = info;
            const data = projectData.materials?.[username]?.[materialType]?.[itemId];
            if (!data) return;

            switch (materialType) {
                case 'parties':
                    renderPartyForm(itemEl, username, itemId, data);
                    break;
                case 'costumes':
                    renderCostumeForm(itemEl, username, itemId, data);
                    break;
                case 'tasks':
                    renderTaskForm(itemEl, username, itemId, data);
                    break;
            }
        }
    });

    materialsWidget.addEventListener('change', async (e) => {
        if (e.target.classList.contains('add-photo-input')) {
            const files = e.target.files;
            if (!files.length) return;
            
            const info = getMaterialInfoFromElement(e.target);
            if (!info) return;

            const photosRef = projectRef.child('materials').child(info.username).child(info.materialType).child(info.itemId).child('photos');
            for (const file of files) {
                const imageUrl = await uploadImage(file);
                if (imageUrl) {
                    photosRef.push().set(imageUrl);
                }
            }
        }
    });

    const uploadImage = async (file) => {
        const apiKey = 'a29a659a810c0bc31aadb00ea280227b';
        const formData = new FormData();
        formData.append('image', file);

        try {
            const response = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
            }

            const result = await response.json();

            if (result.success && result.data?.url) {
                return result.data.url;
            } else {
                throw new Error(result.error?.message || 'URL не найден в ответе API ImgBB.');
            }
        } catch (error) {
            console.error('Ошибка загрузки изображения в ImgBB:', error);
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

    closeImageViewerBtn.addEventListener('click', () => imageViewerModal.classList.remove('visible'));
    document.getElementById('image-viewer-delete-btn').addEventListener('click', () => {
        const context = JSON.parse(imageViewerModal.dataset.deleteContext || '{}');
        if (context.username && context.photoId && confirm('Удалить это фото?')) {
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

    // --- DATA RENDERING ---

    const renderMaterials = (members, materials = {}) => {
        const materialsContent = document.getElementById('materials-content');
        materialsContent.innerHTML = '';
        const memberUsernames = members ? Object.keys(members) : [];

        if (memberUsernames.length === 0) {
            materialsContent.innerHTML = '<p style="padding: 0.75rem 0;">Сначала добавьте участников в проект.</p>';
            return;
        }

        memberUsernames.forEach(username => {
            const userMaterials = materials[username] || {};
            const userContainer = document.createElement('div');
            userContainer.className = 'material-user-container';
            userContainer.dataset.username = username;

            const addButtonHTML = canEditMaterials ? `<button class="add-material-btn" data-username="${username}">+</button>` : '';
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
                        renderFunc(itemContainer, username, id, data);
                    });
                }
            };
            
            renderAllItems('parties', renderPartyItem);
            renderAllItems('costumes', renderCostumeItem);
            renderAllItems('tasks', renderTaskItem);
        });
    };

    const renderPartyItem = (container, username, partyId, partyData) => {
        const actionsHTML = canEditMaterials ? `
            <div class="material-item-actions">
                <button class="edit-material-btn" title="Редактировать">✏️</button>
                <button class="delete-material-btn" title="Удалить">🗑️</button>
            </div>` : '';

        const photosHTML = partyData.photos ? Object.entries(partyData.photos).map(([photoId, url]) => `
            <div class="photo-thumbnail" data-photoid="${photoId}"><img src="${url}" alt="Фото партии"></div>`).join('') : '';

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
            <button class="add-photo-btn ${canEditMaterials ? '' : 'hidden'}">Добавить фото</button>
        `;
    };

    const renderCostumeItem = (container, username, costumeId, costumeData) => {
        const actionsHTML = canEditMaterials ? `
            <div class="material-item-actions">
                <button class="edit-material-btn" title="Редактировать">✏️</button>
                <button class="delete-material-btn" title="Удалить">🗑️</button>
            </div>` : '';

        const photosHTML = costumeData.photos ? Object.entries(costumeData.photos).map(([photoId, url]) => `
            <div class="photo-thumbnail" data-photoid="${photoId}"><img src="${url}" alt="Фото костюма"></div>`).join('') : '';
        
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
            <button class="add-photo-btn ${canEditMaterials ? '' : 'hidden'}">Добавить фото</button>
        `;
    };

    const renderTaskItem = (container, username, taskId, taskData) => {
        const toggleBtnHTML = canEditMaterials ? `<button class="toggle-task-status-btn" title="Изменить статус">${taskData.status === 'completed' ? '✔️' : '⭕'}</button>` : '';
        const actionsHTML = canEditMaterials ? `<div class="material-item-actions">${toggleBtnHTML}<button class="edit-material-btn" title="Редактировать">✏️</button><button class="delete-material-btn" title="Удалить">🗑️</button></div>` : '';

        container.className = `material-item task-item ${taskData.status === 'completed' ? 'completed' : ''}`;
        container.dataset.id = taskId;
        container.dataset.type = 'tasks';
        container.innerHTML = `
            <div class="material-item-header">
                <h4>Задача: ${taskData.name}</h4>
                ${actionsHTML}
            </div>
            <p>${taskData.description || ''}</p>
        `;
    };

    // --- FORM RENDERING (for creating and editing) ---

    const renderPartyForm = (container, username, partyId = null, existingData = {}) => {
        const isEditing = !!partyId;
        container.className = 'material-item add-form';
        container.innerHTML = `
            <h4>${isEditing ? 'Редактировать партию' : 'Новая партия'}</h4>
            <div class="form-group"><input type="text" placeholder="Название" value="${existingData.name || ''}"></div>
            <div class="form-group"><textarea placeholder="Описание">${existingData.description || ''}</textarea></div>
            <button class="save-btn">Сохранить</button>
            <button class="cancel-btn">Отмена</button>
        `;
        container.querySelector('.save-btn').onclick = () => {
            const name = container.querySelector('input').value.trim();
            if (!name) { alert('Название не может быть пустым.'); return; }
            const description = container.querySelector('textarea').value.trim();
            
            const ref = isEditing 
                ? projectRef.child('materials').child(username).child('parties').child(partyId)
                : projectRef.child('materials').child(username).child('parties').push();
            
            ref.set({ name, description, photos: existingData.photos || null });
            if (!isEditing) container.remove(); // For new items, listener will re-render. For edits, it updates in place.
        };
        container.querySelector('.cancel-btn').onclick = () => {
            if (isEditing) {
                renderPartyItem(container, username, partyId, existingData); // Restore original view
            } else {
                container.remove(); // Just remove the add form
            }
        };
    };

    const renderCostumeForm = (container, username, costumeId = null, existingData = {}) => {
        const isEditing = !!costumeId;
        container.className = 'material-item add-form';
        container.innerHTML = `
            <h4>${isEditing ? 'Редактировать костюм' : 'Новый костюм'}</h4>
            <div class="form-group"><input type="text" class="costume-name-input" placeholder="Название предмета" value="${existingData.name || ''}"></div>
            <div class="form-group"><input type="text" class="costume-link-input" placeholder="Ссылка" value="${existingData.link || ''}"></div>
            <button class="save-btn">Сохранить</button>
            <button class="cancel-btn">Отмена</button>
        `;
        container.querySelector('.save-btn').onclick = () => {
            const name = container.querySelector('.costume-name-input').value.trim();
            if (!name) { alert('Название не может быть пустым.'); return; }
            const link = container.querySelector('.costume-link-input').value.trim();
            
            const ref = isEditing 
                ? projectRef.child('materials').child(username).child('costumes').child(costumeId)
                : projectRef.child('materials').child(username).child('costumes').push();

            ref.set({ name, link, photos: existingData.photos || null });
            if (!isEditing) container.remove();
        };
        container.querySelector('.cancel-btn').onclick = () => {
            if (isEditing) {
                renderCostumeItem(container, username, costumeId, existingData);
            } else {
                container.remove();
            }
        };
    };

    const renderTaskForm = (container, username, taskId = null, existingData = {}) => {
        const isEditing = !!taskId;
        container.className = 'material-item add-form';
        container.innerHTML = `
            <h4>${isEditing ? 'Редактировать задачу' : 'Новая задача'}</h4>
            <div class="form-group"><input type="text" placeholder="Название задачи" value="${existingData.name || ''}"></div>
            <div class="form-group"><textarea placeholder="Описание">${existingData.description || ''}</textarea></div>
            <button class="save-btn">Сохранить</button>
            <button class="cancel-btn">Отмена</button>
        `;
        container.querySelector('.save-btn').onclick = () => {
            const name = container.querySelector('input').value.trim();
            if (!name) { alert('Название не может быть пустым.'); return; }
            const description = container.querySelector('textarea').value.trim();
            
            const ref = isEditing 
                ? projectRef.child('materials').child(username).child('tasks').child(taskId)
                : projectRef.child('materials').child(username).child('tasks').push();
            
            ref.set({ name, description, status: existingData.status || 'incomplete' });
            if (!isEditing) container.remove();
        };
        container.querySelector('.cancel-btn').onclick = () => {
            if (isEditing) {
                renderTaskItem(container, username, taskId, existingData);
            } else {
                container.remove();
            }
        };
    };

    const renderParticipants = (members) => {
        participantListEl.innerHTML = '';
        const memberUsernames = members ? Object.keys(members) : [];

        allUsers.forEach(username => {
            const li = document.createElement('li');
            li.className = 'participant-checkbox-item';

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = `user-checkbox-${username}`;
            checkbox.value = username;
            checkbox.checked = memberUsernames.includes(username);

            checkbox.addEventListener('change', (e) => {
                const selectedUser = e.target.value;
                if (e.target.checked) {
                    projectRef.child('members').child(selectedUser).set(true);
                } else {
                    if(confirm(`Удалить участника ${selectedUser} из проекта? Все его материалы будут также удалены.`)) {
                       projectRef.child('members').child(selectedUser).remove();
                       projectRef.child('materials').child(selectedUser).remove(); // Also remove materials
                    } else {
                        e.target.checked = true; // Revert checkbox
                    }
                }
            });

            const label = document.createElement('label');
            label.htmlFor = `user-checkbox-${username}`;
            label.textContent = username;

            li.appendChild(checkbox);
            li.appendChild(label);
            participantListEl.appendChild(li);
        });
    };
    
    // --- MAIN DATA LISTENER & AUTHORIZATION ---
    projectRef.on('value', async (snapshot) => {
        projectData = snapshot.val();
        if (projectData) {
            projectMembers = projectData.members || {};
            const titleContainer = document.querySelector('.header-title');
            titleContainer.innerHTML = ''; 

            const projectInfoContainer = document.createElement('div');
            projectInfoContainer.className = 'project-header-info';
            projectInfoContainer.innerHTML = `<h1>${projectData.name}</h1>`;

            // --- AUTHORIZATION CHECK ---
            const isCurrentUserAdmin = isAdmin === 'true';
            const isProjectResponsible = projectData.responsible === loggedInUser;
            canEditMaterials = isCurrentUserAdmin || isProjectResponsible;

            if (!isCurrentUserAdmin && !isProjectResponsible) {
                alert('У вас нет доступа к этому проекту.');
                window.location.href = 'app.html';
                return;
            }

            projectInfoContainer.appendChild(usernameDisplay);
            usernameDisplay.classList.remove('hidden');
            titleContainer.appendChild(projectInfoContainer);

            backToParticipantBtn.onclick = () => { window.location.href = 'participant.html'; };
            backToParticipantProjectBtn.href = `participant_project.html?id=${projectId}`;
            
            const canManageProject = isCurrentUserAdmin || (isProjectResponsible && !isCurrentUserAdmin);
            
            // UI visibility based on role
            document.getElementById('participants-widget').style.display = isCurrentUserAdmin ? 'block' : 'none';
            document.getElementById('responsible-widget').style.display = isCurrentUserAdmin ? 'block' : 'none';
            
            if (isCurrentUserAdmin) {
                usernameDisplay.textContent = `Администратор: ${loggedInUser}`;

                // --- PROJECT ACTIONS (DELETE/ARCHIVE) ---
                projectActionsWidget.classList.remove('hidden');

                // Set button text based on archive status
                archiveProjectBtn.textContent = projectData.isArchived ? 'Разархивировать проект' : 'Архивировать проект';
                archiveProjectBtn.style.backgroundColor = projectData.isArchived ? 'var(--status-free)' : 'var(--status-uncertain)';
                
                if (!actionButtonsInitialized) {
                    archiveProjectBtn.addEventListener('click', () => {
                        const newStatus = !projectData.isArchived;
                        const actionText = newStatus ? 'архивировать' : 'разархивировать';
                        if (confirm(`Вы уверены, что хотите ${actionText} проект "${projectData.name}"?`)) {
                            projectRef.child('isArchived').set(newStatus);
                        }
                    });

                    deleteProjectBtn.addEventListener('click', () => {
                        if (confirm(`ВНИМАНИЕ! Вы уверены, что хотите ПОЛНОСТЬЮ удалить проект "${projectData.name}"? Это действие необратимо.`)) {
                            projectRef.remove().then(() => {
                                alert('Проект удален.');
                                window.location.href = 'participant.html';
                            }).catch(err => {
                                alert('Ошибка при удалении проекта: ' + err.message);
                            });
                        }
                    });
                    actionButtonsInitialized = true;
                }

            } else if (isProjectResponsible) {
                usernameDisplay.textContent = `Ответственный: ${loggedInUser}`;
                projectActionsWidget.classList.add('hidden');
            }

            // Render all components
            renderTrainings(projectData.trainings, canManageProject);
            renderMaterials(projectMembers, projectData.materials);
            renderCombinedSchedule(projectMembers, selectedDate);
            if(isCurrentUserAdmin) renderResponsibleWidget(projectMembers, projectData.responsible);
            
            await updateCalendarHighlights(currentCalendarDate);

            if (allUsers.length > 0 && isCurrentUserAdmin) {
                renderParticipants(projectMembers);
            }
        }
    });

    // Fetch initial data
    database.ref('projects').on('value', (snapshot) => { allProjectsData = snapshot.val() || {}; });
    database.ref('users').once('value', (snapshot) => {
        const users = snapshot.val();
        if (users) {
            allUsers = Object.keys(users);
            if (projectData.name && isAdmin === 'true') {
                renderParticipants(projectMembers);
            }
        }
    });
    locationsRef.on('value', (snapshot) => {
        allLocations = snapshot.val() ? Object.values(snapshot.val()) : [];
        populateLocationSelect(trainingLocationSelect);
    });

    addTrainingForm.addEventListener('submit', addTraining);
    
    // --- (The rest of the file: calendar, schedule, trainings logic is omitted for brevity but should be kept) ---
    // NOTE: The following is a placeholder for the existing logic that should be preserved.
    // Make sure to merge the above changes with the existing functions, not just replace them.

    const renderResponsibleWidget = (members, responsibleUser) => {
        responsibleUserSelect.innerHTML = '';
        const defaultOption = document.createElement('option');
        defaultOption.value = "";
        defaultOption.textContent = "Не назначен";
        responsibleUserSelect.appendChild(defaultOption);
        const memberUsernames = members ? Object.keys(members) : [];
        memberUsernames.forEach(username => {
            const option = document.createElement('option');
            option.value = username;
            option.textContent = username;
            if (username === responsibleUser) option.selected = true;
            responsibleUserSelect.appendChild(option);
        });
    };

    responsibleUserSelect.addEventListener('change', (e) => {
        projectRef.child('responsible').set(e.target.value || null);
    });

    function renderTrainings(trainings, canManage) {
        trainingListEl.innerHTML = '';
        if (trainings) {
            Object.entries(trainings).forEach(([id, training]) => {
                const li = document.createElement('li');
                li.className = 'training-item';
                let formattedDate, isoString, isoEndTimeString;
                if (training.startTime && training.endTime) {
                    const startDate = new Date(training.startTime);
                    const endDate = new Date(training.endTime);
                    const dateOptions = { day: 'numeric', month: 'short' };
                    const timeOptions = { hour: '2-digit', minute: '2-digit' };
                    const formattedStartDate = startDate.toLocaleDateString('ru-RU', dateOptions);
                    const formattedStartTime = startDate.toLocaleTimeString('ru-RU', timeOptions);
                    const formattedEndTime = endDate.toLocaleTimeString('ru-RU', timeOptions);
                    if (startDate.toDateString() === endDate.toDateString()) {
                        formattedDate = `${formattedStartDate}, ${formattedStartTime} - ${formattedEndTime}`;
                    } else {
                        const formattedEndDate = endDate.toLocaleDateString('ru-RU', dateOptions);
                        formattedDate = `${formattedStartDate} ${formattedStartTime} - ${formattedEndDate} ${formattedEndTime}`;
                    }
                    isoString = new Date(startDate.getTime() - (startDate.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
                    isoEndTimeString = new Date(endDate.getTime() - (endDate.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
                } else if (training.time) {
                    const d = new Date(training.time);
                    formattedDate = d.toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' });
                    isoString = new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
                }
                const locationText = training.location || 'Не указано';
                const commentText = training.comment || 'Нет';
                li.innerHTML = `
                    <div class="training-details">
                        <p><strong>Время:</strong> <span class="training-time-text" data-iso-time="${isoString || ''}" ${isoEndTimeString ? `data-iso-end-time="${isoEndTimeString}"` : ''}>${formattedDate || 'N/A'}</span></p>
                        <p><strong>Место:</strong> <span class="training-location-text">${locationText}</span></p>
                        <p><strong>Комментарий:</strong> <span class="training-comment-text">${commentText}</span></p>
                    </div>
                    <div class="training-actions">
                        
                    </div>
                `;
                if(canManage) {
                    
                }
                trainingListEl.appendChild(li);
            });
        }
    }

    function addTraining(e) {
        e.preventDefault();
        const startTime = trainingStartTimeInput.value;
        const endTime = trainingEndTimeInput.value;
        const comment = trainingCommentInput.value.trim();
        let location = trainingLocationSelect.value;
        if (!startTime || !endTime) { alert('Пожалуйста, укажите время начала и окончания тренировки.'); return; }
        if (new Date(endTime) <= new Date(startTime)) { alert('Время окончания должно быть после времени начала.'); return; }
        if (location === 'add_new') {
            const newLocation = newTrainingLocationInput.value.trim();
            if (newLocation) { locationsRef.push(newLocation); location = newLocation; } else { alert('Пожалуйста, введите название нового места.'); return; }
        }
        const newTraining = { startTime, endTime, comment, location };
        if (!location) delete newTraining.location;
        projectRef.child('trainings').push().set(newTraining);
        addTrainingForm.reset();
        hideAddTrainingModal();
    }

    function deleteTraining(trainingId) {
        if (confirm('Вы уверены, что хотите удалить эту тренировку?')) {
            projectRef.child('trainings').child(trainingId).remove();
        }
    }

    function editTraining(trainingId, trainingData, listItem, event) {
        event.target.style.display = 'none';
        const detailsContainer = listItem.querySelector('.training-details');
        const actionsContainer = listItem.querySelector('.training-actions');
        const timeSpan = listItem.querySelector('.training-time-text');
        const originalStartTime = timeSpan.dataset.isoTime;
        let originalEndTime = timeSpan.dataset.isoEndTime;
        if (originalStartTime && !originalEndTime) {
            const startDate = new Date(originalStartTime);
            const endDate = new Date(startDate.getTime() + 2 * 60 * 60 * 1000);
            originalEndTime = new Date(endDate.getTime() - (endDate.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
        }
        const originalComment = listItem.querySelector('.training-comment-text').textContent;
        const originalLocation = listItem.querySelector('.training-location-text').textContent;
        const originalInnerHTML = detailsContainer.innerHTML;
        const startTimeInput = document.createElement('input');
        startTimeInput.type = 'datetime-local';
        startTimeInput.className = 'edit-training-datetime';
        startTimeInput.value = originalStartTime;
        startTimeInput.step = 600;
        const endTimeInput = document.createElement('input');
        endTimeInput.type = 'datetime-local';
        endTimeInput.className = 'edit-training-datetime';
        endTimeInput.value = originalEndTime;
        endTimeInput.step = 600;
        const commentInput = document.createElement('input');
        commentInput.type = 'text';
        commentInput.className = 'edit-training-input';
        commentInput.value = originalComment === 'Нет' ? '' : originalComment;
        const locationSelect = document.createElement('select');
        locationSelect.className = 'edit-training-location';
        populateLocationSelect(locationSelect, originalLocation);
        const newLocationInput = document.createElement('input');
        newLocationInput.type = 'text';
        newLocationInput.className = 'edit-training-new-location hidden';
        newLocationInput.placeholder = 'Новое место';
        locationSelect.addEventListener('change', () => { newLocationInput.classList.toggle('hidden', locationSelect.value !== 'add_new'); });
        detailsContainer.innerHTML = '';
        const timeGroup = document.createElement('div');
        timeGroup.className = 'form-group';
        timeGroup.innerHTML = '<label>Начало</label>';
        timeGroup.appendChild(startTimeInput);
        const endTimeGroup = document.createElement('div');
        endTimeGroup.className = 'form-group';
        endTimeGroup.innerHTML = '<label>Окончание</label>';
        endTimeGroup.appendChild(endTimeInput);
        const locationGroup = document.createElement('div');
        locationGroup.className = 'form-group';
        locationGroup.appendChild(locationSelect);
        locationGroup.appendChild(newLocationInput);
        const commentGroup = document.createElement('div');
        commentGroup.className = 'form-group';
        commentGroup.appendChild(commentInput);
        detailsContainer.appendChild(timeGroup);
        detailsContainer.appendChild(endTimeGroup);
        detailsContainer.appendChild(locationGroup);
        detailsContainer.appendChild(commentGroup);
        const saveBtn = document.createElement('button');
        saveBtn.className = 'save-training-btn';
        saveBtn.innerHTML = '💾';
        const newDeleteBtn = document.createElement('button');
        newDeleteBtn.className = 'delete-training-btn';
        newDeleteBtn.innerHTML = '🗑️';
        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'cancel-training-btn';
        cancelBtn.innerHTML = '&times;';
        actionsContainer.appendChild(saveBtn);
        actionsContainer.appendChild(newDeleteBtn);
        actionsContainer.appendChild(cancelBtn);
        newDeleteBtn.onclick = () => deleteTraining(trainingId);
        cancelBtn.onclick = () => {
            detailsContainer.innerHTML = originalInnerHTML;
            saveBtn.remove();
            newDeleteBtn.remove();
            cancelBtn.remove();
            event.target.style.display = 'inline-block';
        };
        saveBtn.onclick = () => {
            const newStartTime = startTimeInput.value;
            const newEndTime = endTimeInput.value;
            const newComment = commentInput.value.trim();
            let newLocation = locationSelect.value;
            if (!newStartTime || !newEndTime) { alert('Время начала и окончания не могут быть пустыми.'); return; }
            if (new Date(newEndTime) <= new Date(newStartTime)) { alert('Время окончания должно быть после времени начала.'); return; }
            if (newLocation === 'add_new') {
                const newLocationValue = newLocationInput.value.trim();
                if (newLocationValue) { locationsRef.push(newLocationValue); newLocation = newLocationValue; } else { newLocation = null; }
            }
            const updates = { startTime: newStartTime, endTime: newEndTime, location: newLocation || null, comment: newComment || null, time: null };
            saveBtn.textContent = '...';
            saveBtn.disabled = true;
            projectRef.child('trainings').child(trainingId).update(updates).catch(error => { console.error("Error updating training: ", error); alert("Не удалось сохранить изменения."); });
        };
    }

    function populateLocationSelect(selectElement, selectedValue) {
        selectElement.innerHTML = '';
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = 'Не выбрано';
        selectElement.appendChild(defaultOption);
        allLocations.forEach(location => {
            const option = document.createElement('option');
            option.value = location;
            option.textContent = location;
            if (location === selectedValue) option.selected = true;
            selectElement.appendChild(option);
        });
        selectElement.insertAdjacentHTML('beforeend', '<option value="add_new" style="font-weight: bold;">+ Добавить новое место</option>');
    }
    
    const showAddTrainingModal = () => addTrainingModal.classList.add('visible');
    const hideAddTrainingModal = () => { addTrainingModal.classList.remove('visible'); addTrainingForm.reset(); };

    showAddTrainingModalBtn.addEventListener('click', showAddTrainingModal);
    closeAddTrainingModalBtn.addEventListener('click', hideAddTrainingModal);
    trainingLocationSelect.addEventListener('change', () => { newTrainingLocationInput.classList.toggle('hidden', trainingLocationSelect.value !== 'add_new'); });

    // Calendar & Schedule rendering...
    const renderCombinedSchedule = (members, date) => {
        scheduleGridEl.innerHTML = '';
        const header = document.createElement('div');
        header.className = 'user-row-label';
        scheduleGridEl.appendChild(header);
        for (let hour = 9; hour <= 22; hour++) {
            const hourHeader = document.createElement('div');
            hourHeader.className = 'grid-header';
            hourHeader.textContent = `${hour}:00`;
            scheduleGridEl.appendChild(hourHeader);
        }
        if (!members || Object.keys(members).length === 0) {
             const noMembers = document.createElement('div');
             noMembers.textContent = 'Нет участников в проекте.';
             noMembers.style.gridColumn = 'span 15';
             noMembers.style.textAlign = 'center';
             noMembers.style.padding = '1rem';
             scheduleGridEl.appendChild(noMembers);
             return;
        }
        const memberUsernames = Object.keys(members);
        const availabilityPromises = memberUsernames.map(username => {
            const path = `userData/${username}/${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
            return database.ref(path).once('value');
        });
        Promise.all(availabilityPromises).then(snapshots => {
            snapshots.forEach((snapshot, index) => {
                const username = memberUsernames[index];
                const dayData = snapshot.val() || {};
                const userTrainingsOnDate = getUserTrainingsForDate(username, date);
                const userLabel = document.createElement('div');
                userLabel.className = 'user-row-label';
                userLabel.textContent = username;
                scheduleGridEl.appendChild(userLabel);
                for (let hour = 9; hour <= 22; hour++) {
                    const hourCell = document.createElement('div');
                    hourCell.className = 'hour-cell';
                    const segments = dayData[hour] || [];
                    const statuses = Array.isArray(segments) ? segments : Object.values(segments);
                    const isTraining = userTrainingsOnDate.some(t => {
                        const hourStart = new Date(date);
                        hourStart.setHours(hour, 0, 0, 0);
                        const hourEnd = new Date(date);
                        hourEnd.setHours(hour + 1, 0, 0, 0);
                        return t.startTime < hourEnd && t.endTime > hourStart;
                    });
                    if (isTraining) {
                        if (statuses.includes('busy')) {
                            hourCell.style.background = 'linear-gradient(135deg, var(--status-busy) 49%, var(--status-training) 51%)';
                            hasConflict = true;
                        } else if (statuses.includes('undefined')) {
                            hourCell.style.background = 'linear-gradient(135deg, var(--status-uncertain) 49%, var(--status-training) 51%)';
                            hasConflict = true;
                        } else {
                            hourCell.classList.add('is-training-hour');
                        }
                    } else if (statuses.length > 0) {
                        const statusCounts = statuses.reduce((acc, s) => { acc[s] = (acc[s] || 0) + 1; return acc; }, {});
                        Object.entries(statusCounts).forEach(([st, c]) => {
                             if(st !== 'clear') {
                                const bar = document.createElement('div');
                                bar.className = `availability-bar bar-${st}`;
                                bar.style.width = `${(c / 6) * 100}%`;
                                hourCell.appendChild(bar);
                             }
                        });
                    }
                    scheduleGridEl.appendChild(hourCell);
                }
            });
        });
    };

    const getUserTrainingsForDate = (username, date) => {
        const userTrainings = [];
        const checkDateStr = date.toDateString();
        for (const projId in allProjectsData) {
            const project = allProjectsData[projId];
            if (project.members && project.members[username] && project.trainings) {
                for (const trainId in project.trainings) {
                    const training = project.trainings[trainId];
                    let startDate, endTime;

                    if (training.startTime) {
                        startDate = new Date(training.startTime);
                        endTime = training.endTime ? new Date(training.endTime) : new Date(startDate.getTime() + 2 * 60 * 60 * 1000);
                    } else if (training.time) {
                        startDate = new Date(training.time);
                        endTime = new Date(startDate.getTime() + 2 * 60 * 60 * 1000); // Assume 2 hour duration for legacy data
                    }

                    if (startDate && startDate.toDateString() === checkDateStr) {
                        userTrainings.push({ startTime: startDate, endTime: endTime });
                    }
                }
            }
        }
        return userTrainings;
    };
    
    const updateCalendarHighlights = async (viewDate) => {
        if (isHighlighting) return;
        isHighlighting = true;
        try {
            const year = viewDate.getFullYear(), month = viewDate.getMonth();
            const datesToCalc = [new Date(year, month - 1, 1), new Date(year, month, 1), new Date(year, month + 1, 1)];
            const newHighlightsCache = {};
            for (const date of datesToCalc) {
                const monthHighlights = await calculateAvailableDaysForMonth(date);
                const y = date.getFullYear(), m = date.getMonth() + 1;
                for (const day in monthHighlights) {
                    const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                    newHighlightsCache[dateStr] = monthHighlights[day];
                }
            }
            highlightsCache = newHighlightsCache;
            if (calendar) {
                calendar.update({
                    onRenderCell: ({date, cellType}) => {
                        if (cellType === 'day') {
                            const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
                            if (highlightsCache[dateStr]) return { classes: highlightsCache[dateStr] };
                        }
                    }
                });
            }
        } catch (error) { console.error("Error calculating highlights:", error); highlightsCache = {}; }
        finally { isHighlighting = false; }
    };
    
    async function getDayAvailability(members, year, month, day) {
        const memberUsernames = Object.keys(members || {});
        if (memberUsernames.length === 0) return null;
        const memberDataPromises = memberUsernames.map(username => database.ref(`userData/${username}/${year}/${month}/${day}`).once('value').then(snap => ({ username, data: snap.val() || {} })));
        try {
            const membersDayData = await Promise.all(memberDataPromises);
            const getStatus = (data, h) => {
                const s = Array.from({ length: 6 }, (_, i) => (data[h] || [])[i] || 'clear');
                if (s.every(st => st === 'free')) return 'free';
                if (s.includes('busy')) return 'busy';
                if (s.includes('undefined')) return 'undefined';
                return 'clear';
            };
            for (let hour = 9; hour <= 20; hour++) {
                if (membersDayData.every(m => getStatus(m.data, hour) === 'free' && getStatus(m.data, hour + 1) === 'free')) return 'highlight-perfect';
            }
            if (memberUsernames.length <= 1) return null;
            for (let hour = 9; hour <= 20; hour++) {
                const statuses = membersDayData.map(m => (getStatus(m.data, hour) === 'free' && getStatus(m.data, hour+1) === 'free') ? 'free' : getStatus(m.data, hour) === 'busy' || getStatus(m.data, hour+1) === 'busy' ? 'busy' : 'undefined');
                const free = statuses.filter(s => s === 'free').length, busy = statuses.filter(s => s === 'busy').length, undef = statuses.filter(s => s === 'undefined').length;
                if (free === memberUsernames.length - 1 && busy === 1) return 'highlight-yellow';
                if (free === memberUsernames.length - 1 && undef === 1) return 'highlight-good';
            }
            return null;
        } catch (error) { console.error(`Error fetching availability for ${year}-${month}-${day}:`, error); return null; }
    }

    async function calculateAvailableDaysForMonth(date) {
        const year = date.getFullYear(), month = date.getMonth(), members = projectData.members || {};
        const highlights = {};
        if (Object.keys(members).length === 0) return highlights;
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const promises = Array.from({length: daysInMonth}, (_, i) => getDayAvailability(members, year, month + 1, i + 1));
        const results = await Promise.all(promises);
        results.forEach((res, i) => { if (res) highlights[i + 1] = res; });
        return highlights;
    }
    
    function initializeCalendar() {
        if(calendar) calendar.destroy();
        calendar = new AirDatepicker('#calendar-container', {
            inline: true,
            locale: {
                days: ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'],
                daysShort: ['Вос', 'Пон', 'Вто', 'Сре', 'Чет', 'Пят', 'Суб'],
                daysMin: ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'],
                months: ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'],
                monthsShort: ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'],
                today: 'Сегодня', clear: 'Очистить', dateFormat: 'dd.MM.yyyy', timeFormat: 'HH:mm', firstDay: 1
            },
            onSelect: ({date}) => { if (date) { selectedDate = new Date(date); renderCombinedSchedule(projectMembers, selectedDate); }},
            onChangeView: async (view, date) => { currentCalendarDate = new Date(date); await updateCalendarHighlights(currentCalendarDate); },
            onRenderCell: ({date, cellType}) => {
                if (cellType === 'day') {
                    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
                    if (highlightsCache[dateStr]) return { classes: highlightsCache[dateStr] };
                }
            }
        });
    }

    // Help Modal Listeners
    if (projectHelpBtn) projectHelpBtn.addEventListener('click', () => projectHelpModal.classList.add('visible'));
    if (closeProjectHelpModalBtn) closeProjectHelpModalBtn.addEventListener('click', () => projectHelpModal.classList.remove('visible'));
    window.addEventListener('click', (e) => { if (e.target === projectHelpModal) projectHelpModal.classList.remove('visible'); });
});
