const form = document.querySelector('#project-form');
const nameInput = document.querySelector('#name');
const statusInput = document.querySelector('#status');
const projectList = document.querySelector('#project-list');
const emptyState = document.querySelector('#empty-state');
const saveButton = document.querySelector('#save-button');
const cancelButton = document.querySelector('#cancel-button');
const message = document.querySelector('#message');

// The exact localStorage key used by this workshop.
const STORAGE_KEY = 'workshop-projects-v1';

// Track whether stored data could be loaded safely.
// If stored data is malformed, do not overwrite it automatically.
let storageBlocked = false;

// Display a message to the user.
function showMessage(text) {
if (message) {
message.textContent = text;
}
}

// Check whether a stored project has the expected structure.
function isValidProject(project) {
return (
project !== null &&
typeof project === 'object' &&
!Array.isArray(project) &&
typeof project.id === 'string' &&
project.id.trim() !== '' &&
typeof project.name === 'string' &&
project.name.trim() !== '' &&
project.name.length <= 80 &&
['Planned', 'In Progress', 'Completed'].includes(project.status)
);
}

// Load projects from localStorage when the page starts.
function loadProjects() {
try {
const storedText = localStorage.getItem(STORAGE_KEY);

    // A missing key means this is a new or empty tracker.
    if (storedText === null) {
        return [];
    }

    // JSON.parse converts stored text back into JavaScript data.
    const storedProjects = JSON.parse(storedText);

    // The stored value must be an array of valid project records.
    if (
        !Array.isArray(storedProjects) ||
        !storedProjects.every(isValidProject)
    ) {
        throw new Error('Invalid project data.');
    }

    // IDs must be unique, even when project names are identical.
    const projectIds = storedProjects.map(project => project.id);

    if (new Set(projectIds).size !== projectIds.length) {
        throw new Error('Duplicate project IDs.');
    }

    return storedProjects;
} catch {
    // Preserve malformed or unreadable stored data.
    storageBlocked = true;

    showMessage(
        'Saved project data is missing a valid format or could not be read. ' +
        'It has not been overwritten. Changes cannot be saved until ' +
        'the stored data issue is resolved.'
    );

    return [];
}

}

// Save a proposed collection of projects.
function saveProjects(updatedProjects) {
// Do not overwrite stored data that failed validation or reading.
if (storageBlocked) {
showMessage(
'Changes could not be saved because the existing saved data ' +
'could not be read safely. Your stored data has not been overwritten.'
);

    return false;
}

try {
    // JSON.stringify converts our project collection into text.
    const projectsText = JSON.stringify(updatedProjects);

    // Store the text under the exact workshop key.
    localStorage.setItem(STORAGE_KEY, projectsText);

    return true;
} catch {
    // This can happen if browser storage is unavailable or full.
    showMessage(
        'Changes could not be saved to this browser. ' +
        'Your previous saved records have been left unchanged.'
    );

    return false;
}

}

// Restore the collection from browser storage.
const projects = loadProjects();

// Track the ID of the project currently being edited.
let editingId = null;

// Generate a unique ID for each new project.
function generateProjectId() {
return crypto.randomUUID();
}

// Reset the form and return to Add mode.
function resetForm() {
form.reset();
editingId = null;

saveButton.textContent = 'Save Project';
cancelButton.hidden = true;

nameInput.focus();

}

// Display all projects.
function renderProjects() {
projectList.replaceChildren();

projects.forEach(project => {
    const listItem = document.createElement('li');

    const projectName = document.createElement('h3');
    projectName.textContent = project.name;

    const projectStatus = document.createElement('p');
    projectStatus.textContent = `Status: ${project.status}`;

    // Container for the Edit and Delete buttons.
    const actions = document.createElement('div');
    actions.className = 'card-actions';

    // Edit button.
    const editButton = document.createElement('button');
    editButton.type = 'button';
    editButton.textContent = 'Edit';
    editButton.dataset.projectId = project.id;

    editButton.addEventListener('click', () => {
        startEditing(editButton.dataset.projectId);
    });

    // Delete button.
    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.textContent = 'Delete';
    deleteButton.dataset.projectId = project.id;

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

// Show the empty-state message when no projects remain.
if (emptyState) {
    emptyState.hidden = projects.length > 0;
}

}

// Enter Edit mode for the selected project.
function startEditing(projectId) {
const project = projects.find(item => item.id === projectId);

if (!project) {
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

// Delete a project after confirmation.
function deleteProject(projectId) {
const project = projects.find(item => item.id === projectId);

if (!project) {
    return;
}

// Ask for confirmation before deleting.
const confirmed = window.confirm(
    `Are you sure you want to delete "${project.name}"?`
);

// Cancelling must not change the collection or saved records.
if (!confirmed) {
    return;
}

// Build the proposed collection without the selected project.
const updatedProjects = projects.filter(
    item => item.id !== projectId
);

if (updatedProjects.length === projects.length) {
    return;
}

// Save first. If saving fails, keep the current collection unchanged.
if (!saveProjects(updatedProjects)) {
    return;
}

// Apply the deletion only after storage succeeds.
const projectIndex = projects.findIndex(
    item => item.id === projectId
);

projects.splice(projectIndex, 1);

// If the deleted project was being edited, reset the form.
if (editingId === projectId) {
    resetForm();
}

// Redraw the list and update the empty state.
renderProjects();

showMessage(`Project "${project.name}" deleted.`);

}

// Handle Add and Edit form submissions.
form.addEventListener('submit', event => {
event.preventDefault();

const name = nameInput.value.trim();
const status = statusInput.value;

// Do not accept an empty project name.
if (name === '') {
    nameInput.value = '';
    nameInput.focus();
    return;
}

// Add a new project.
if (editingId === null) {
    const project = {
        id: generateProjectId(),
        name: name,
        status: status
    };

    // Save the proposed collection before changing the current one.
    const updatedProjects = [...projects, project];

    if (!saveProjects(updatedProjects)) {
        return;
    }

    projects.push(project);

    resetForm();
    renderProjects();

    showMessage('Project added successfully.');
    return;
}

// Find the existing project by its stable ID.
const project = projects.find(
    item => item.id === editingId
);

if (!project) {
    resetForm();
    renderProjects();
    showMessage('The project being edited could not be found.');
    return;
}

// Build the proposed collection with the edited values.
const updatedProjects = projects.map(item => {
    if (item.id === editingId) {
        return {
            ...item,
            name: name,
            status: status
        };
    }

    return item;
});

// Save before applying the edit to the current collection.
if (!saveProjects(updatedProjects)) {
    return;
}

project.name = name;
project.status = status;

resetForm();
renderProjects();

showMessage('Project updated successfully.');

});

// Cancel Edit mode without changing saved records.
cancelButton.addEventListener('click', () => {
resetForm();
showMessage('Edit cancelled. No saved changes were made.');
});

// Display the initial project list restored from storage.
renderProjects();