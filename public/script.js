const form = document.querySelector('#project-form');
const nameInput = document.querySelector('#name');
const statusInput = document.querySelector('#status');
const projectList = document.querySelector('#project-list');
const emptyState = document.querySelector('#empty-state');
const saveButton = document.querySelector('#save-button');
const cancelButton = document.querySelector('#cancel-button');
const message = document.querySelector('#message');

const API_URL = '/api/projects';

let projects = [];
let editingId = null;
let isBusy = false;
let hasLoaded = false;

// Display a message to the user.
function showMessage(text) {
message.textContent = text;
}

// Disable controls while a request is in progress.
function setBusy(busy) {
isBusy = busy;

nameInput.disabled = busy;
statusInput.disabled = busy;
saveButton.disabled = busy;
cancelButton.disabled = busy;

// Disable project buttons without using querySelectorAll().
for (const item of projectList.children) {
    const actions = item.children[2];

    if (!actions) {
        continue;
    }

    for (const button of actions.children) {
        button.disabled = busy;
    }
}

}

// Send a request and handle HTTP, network and JSON errors.
async function apiRequest(url, options = {}) {
let response;

try {
    response = await fetch(url, options);
} catch {
    throw new Error(
        'Could not connect to the server. Check that it is running and try again.'
    );
}

let data;

try {
    data = await response.json();
} catch {
    data = null;
}

if (!response.ok) {
    throw new Error(
        data?.error || `The server returned HTTP ${response.status}.`
    );
}

if (data === null) {
    throw new Error('The server returned an invalid response.');
}

return data;

}

// Read the project collection from the API.
async function fetchProjects() {
const data = await apiRequest(API_URL);

if (!Array.isArray(data)) {
    throw new Error('The server did not return a valid project list.');
}

return data;

}

// Load projects and display them.
async function loadProjects() {
setBusy(true);
showMessage('Loading projects...');

try {
    projects = await fetchProjects();
    hasLoaded = true;

    renderProjects();

    if (projects.length === 0) {
        showMessage('No projects found. Add your first project.');
    } else {
        showMessage('Projects loaded successfully.');
    }
} catch (error) {
    showMessage(`Could not load projects: ${error.message}`);
} finally {
    setBusy(false);
}

}

// Reset the form and return to Add mode.
function resetForm() {
form.reset();
editingId = null;

saveButton.textContent = 'Save Project';
cancelButton.hidden = true;

if (!isBusy) {
    nameInput.focus();
}

}

// Display all projects returned by the API.
function renderProjects() {
projectList.replaceChildren();

projects.forEach(project => {
    const listItem = document.createElement('li');

    const projectName = document.createElement('h3');
    projectName.textContent = project.name;

    const projectStatus = document.createElement('p');
    projectStatus.textContent = `Status: ${project.status}`;

    const actions = document.createElement('div');
    actions.className = 'card-actions';

    // Edit button.
    const editButton = document.createElement('button');
    editButton.type = 'button';
    editButton.textContent = 'Edit';
    editButton.dataset.projectId = String(project.id);
    editButton.disabled = isBusy;

    editButton.addEventListener('click', () => {
        startEditing(editButton.dataset.projectId);
    });

    // Delete button.
    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.textContent = 'Delete';
    deleteButton.dataset.projectId = String(project.id);
    deleteButton.disabled = isBusy;

    deleteButton.addEventListener('click', () => {
        deleteProject(deleteButton.dataset.projectId);
    });

    actions.appendChild(editButton);
    actions.appendChild(deleteButton);

    listItem.appendChild(projectName);
    listItem.appendChild(projectStatus);
    listItem.appendChild(actions);

    projectList.appendChild(listItem);
});

// Show the empty state only after a successful load.
emptyState.hidden = !hasLoaded || projects.length > 0;

}

// Enter Edit mode for a selected project.
function startEditing(projectId) {
if (isBusy) {
return;
}

const project = projects.find(
    item => String(item.id) === String(projectId)
);

if (!project) {
    showMessage('The selected project could not be found.');
    return;
}

editingId = project.id;

nameInput.value = project.name;
statusInput.value = project.status;

saveButton.textContent = 'Update Project';
cancelButton.hidden = false;

showMessage(`Editing project: ${project.name}`);

nameInput.focus();

}

// Handle Add and Edit form submissions.
form.addEventListener('submit', async event => {
event.preventDefault();

if (isBusy) {
    return;
}

const name = nameInput.value.trim();
const status = statusInput.value;

if (name.length === 0) {
    showMessage('Please enter a project name.');
    nameInput.focus();
    return;
}

if (name.length > 80) {
    showMessage('The project name must not exceed 80 characters.');
    nameInput.focus();
    return;
}

if (!['Planned', 'In Progress', 'Completed'].includes(status)) {
    showMessage('Please select a valid project status.');
    return;
}

const wasEditing = editingId !== null;
const projectId = editingId;

const body = JSON.stringify({ name, status });

const url = wasEditing
    ? `${API_URL}/${encodeURIComponent(projectId)}`
    : API_URL;

const method = wasEditing ? 'PUT' : 'POST';

setBusy(true);
showMessage(
    wasEditing ? 'Saving project changes...' : 'Saving new project...'
);

let savedProject;

try {
    savedProject = await apiRequest(url, {
        method,
        headers: {
            'Content-Type': 'application/json'
        },
        body
    });
} catch (error) {
    showMessage(`Could not save project: ${error.message}`);
    setBusy(false);
    return;
}

resetForm();

try {
    projects = await fetchProjects();
    hasLoaded = true;
    renderProjects();

    showMessage(
        wasEditing
            ? 'Project updated successfully.'
            : `Project "${savedProject.name}" added successfully.`
    );
} catch (error) {
    showMessage(
        `The project was saved successfully, but the list could not be refreshed: ${error.message}`
    );
} finally {
    setBusy(false);
}

});

// Cancel Edit mode without sending an API request.
cancelButton.addEventListener('click', () => {
if (isBusy) {
return;
}

resetForm();
showMessage('Edit cancelled. No changes were saved.');

});

// Delete a project after confirmation.
async function deleteProject(projectId) {
if (isBusy) {
return;
}

const project = projects.find(
    item => String(item.id) === String(projectId)
);

if (!project) {
    showMessage('The selected project could not be found.');
    return;
}

const confirmed = window.confirm(
    `Are you sure you want to delete "${project.name}"?`
);

// Cancellation must not send a DELETE request.
if (!confirmed) {
    return;
}

setBusy(true);
showMessage(`Deleting "${project.name}"...`);

try {
    await apiRequest(
        `${API_URL}/${encodeURIComponent(project.id)}`,
        { method: 'DELETE' }
    );
} catch (error) {
    showMessage(`Could not delete project: ${error.message}`);
    setBusy(false);
    return;
}

// If the deleted project was being edited, reset the form.
if (String(editingId) === String(project.id)) {
    resetForm();
}

// Refresh the collection after successful deletion.
try {
    projects = await fetchProjects();
    hasLoaded = true;
    renderProjects();

    showMessage(`Project "${project.name}" deleted successfully.`);
} catch (error) {
    showMessage(
        `The project was deleted successfully, but the list could not be refreshed: ${error.message}`
    );
} finally {
    setBusy(false);
}

}

// Start with the collection stored by the server.
loadProjects();