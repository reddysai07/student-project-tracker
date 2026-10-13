
const form = document.querySelector('#project-form');
const nameInput = document.querySelector('#name');
const statusInput = document.querySelector('#status');
const projectList = document.querySelector('#project-list');
const emptyState = document.querySelector('#empty-state');

// Store projects in memory.
// This array starts empty whenever the page loads.
const projects = [];

// Generate a unique ID for each new project.
function generateProjectId() {
    return crypto.randomUUID();
}

// Display all projects in the project list.
function renderProjects() {
    // Clear the existing list to prevent duplicate items.
    projectList.replaceChildren();

    // Create and display an item for every project.
    projects.forEach(project => {
        const listItem = document.createElement('li');

        const projectName = document.createElement('h3');
        projectName.textContent = project.name;

        const projectStatus = document.createElement('p');
        projectStatus.textContent = `Status: ${project.status}`;

        listItem.appendChild(projectName);
        listItem.appendChild(projectStatus);

        projectList.appendChild(listItem);
    });

    // Update the empty-state message if it exists.
    if (emptyState) {
        emptyState.hidden = projects.length > 0;
    }
}

// Handle form submission.
// There is exactly one submit listener.
form.addEventListener('submit', event => {
    // Prevent the browser's default form submission.
    event.preventDefault();

    // Read the current form values.
    const name = nameInput.value.trim();
    const status = statusInput.value;

    // Reject an empty project name.
    if (name === '') {
        nameInput.value = '';
        nameInput.focus();
        return;
    }

    // Create a new project using the submitted values.
    const project = {
        id: generateProjectId(),
        name: name,
        status: status
    };

    // Add the project to the array.
    projects.push(project);

    // Display the updated project list.
    renderProjects();

    // Clear the form for the next project.
    form.reset();

    // Return keyboard focus to the project name field.
    nameInput.focus();
});

// Display the initial empty state.
renderProjects();
