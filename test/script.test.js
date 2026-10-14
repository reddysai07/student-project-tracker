import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const script = await readFile(
new URL('../public/script.js', import.meta.url),
'utf8'
);

class FakeElement {
constructor(tagName = '') {
this.tagName = tagName;
this.children = [];
this.listeners = {};
this.dataset = {};
this.className = '';
this.textContent = '';
this.value = '';
this.hidden = false;
this.disabled = false;
this.type = '';
}

appendChild(child) {
    this.children.push(child);
    return child;
}

replaceChildren(...children) {
    this.children = children;
}

addEventListener(type, callback) {
    if (!this.listeners[type]) {
        this.listeners[type] = [];
    }

    this.listeners[type].push(callback);
}

dispatch(type, event = {}) {
    for (const callback of this.listeners[type] || []) {
        callback({
            preventDefault() {},
            ...event
        });
    }
}

click() {
    this.dispatch('click');
}

focus() {}

}

// Wait for asynchronous frontend operations to finish.
async function waitFor(condition) {
for (let attempt = 0; attempt < 100; attempt++) {
if (condition()) {
return;
}

    await new Promise(resolve => setTimeout(resolve, 0));
}

throw new Error('Timed out waiting for the frontend operation.');

}

function createApi() {
let nextId = 1;
const projects = [];

function response(data, status = 200) {
    return {
        ok: status >= 200 && status < 300,
        status,
        async json() {
            return data;
        }
    };
}

async function fetchMock(url, options = {}) {
    const method = options.method || 'GET';

    if (url === '/api/projects' && method === 'GET') {
        return response(projects.map(project => ({ ...project })));
    }

    if (url === '/api/projects' && method === 'POST') {
        let body;

        try {
            body = JSON.parse(options.body);
        } catch {
            return response({ error: 'Invalid JSON.' }, 400);
        }

        const project = {
            id: nextId++,
            name: body.name,
            status: body.status
        };

        projects.push(project);

        return response({ ...project }, 201);
    }

    const match = url.match(/^\/api\/projects\/(\d+)$/);

    if (match) {
        const id = Number(match[1]);
        const index = projects.findIndex(project => project.id === id);

        if (index === -1) {
            return response({ error: 'Project not found.' }, 404);
        }

        if (method === 'PUT') {
            const body = JSON.parse(options.body);

            projects[index] = {
                ...projects[index],
                name: body.name,
                status: body.status
            };

            return response({ ...projects[index] });
        }

        if (method === 'DELETE') {
            projects.splice(index, 1);
            return response({ deleted: true });
        }
    }

    return response({ error: 'API route not found.' }, 404);
}

return fetchMock;

}

async function createTracker(confirmAnswers = []) {
const elements = {
'#project-form': new FakeElement('form'),
'#name': new FakeElement('input'),
'#status': new FakeElement('select'),
'#project-list': new FakeElement('ul'),
'#empty-state': new FakeElement('p'),
'#save-button': new FakeElement('button'),
'#cancel-button': new FakeElement('button'),
'#message': new FakeElement('p')
};

elements['#status'].value = 'Planned';

elements['#project-form'].reset = () => {
    elements['#name'].value = '';
    elements['#status'].value = 'Planned';
};

const confirmationMessages = [];

const context = {
    document: {
        querySelector(selector) {
            return elements[selector];
        },

        createElement(tagName) {
            return new FakeElement(tagName);
        }
    },

    fetch: createApi(),

    window: {
        confirm(message) {
            confirmationMessages.push(message);
            return confirmAnswers.shift() ?? false;
        }
    }
};

vm.runInNewContext(script, context);

// Wait for the initial project-list request to finish.
await waitFor(() => !elements['#save-button'].disabled);

async function addProject(name, status = 'Planned') {
    const expectedCount = elements['#project-list'].children.length + 1;

    elements['#name'].value = name;
    elements['#status'].value = status;

    elements['#project-form'].dispatch('submit');

    await waitFor(() =>
        elements['#project-list'].children.length === expectedCount &&
        !elements['#save-button'].disabled
    );
}

function getButtons(projectIndex) {
    const item = elements['#project-list'].children[projectIndex];

    assert.ok(item, `Project at index ${projectIndex} should exist.`);

    const actions = item.children[2];

    assert.ok(actions, 'Project action buttons should exist.');

    return {
        edit: actions.children[0],
        delete: actions.children[1]
    };
}

return {
    elements,
    addProject,
    getButtons,
    confirmationMessages
};

}

test('deleting one of two projects with the same name deletes only its ID', async () => {
const app = await createTracker([true]);

await app.addProject('Smart Dustbin', 'Planned');
await app.addProject('Smart Dustbin', 'Completed');

const firstDelete = app.getButtons(0).delete;
const secondDelete = app.getButtons(1).delete;

assert.notEqual(
    firstDelete.dataset.projectId,
    secondDelete.dataset.projectId
);

secondDelete.click();

await waitFor(() =>
    app.elements['#project-list'].children.length === 1 &&
    !app.elements['#save-button'].disabled
);

const list = app.elements['#project-list'];

assert.equal(list.children.length, 1);
assert.equal(list.children[0].children[0].textContent, 'Smart Dustbin');
assert.equal(list.children[0].children[1].textContent, 'Status: Planned');

});

test('cancelling deletion leaves the project unchanged', async () => {
const app = await createTracker([false]);

await app.addProject('Line Following Robot');

app.getButtons(0).delete.click();

assert.equal(app.elements['#project-list'].children.length, 1);

assert.equal(
    app.elements['#project-list'].children[0].children[0].textContent,
    'Line Following Robot'
);

assert.equal(app.elements['#empty-state'].hidden, true);
assert.match(app.confirmationMessages[0], /Line Following Robot/);

});

test('confirming deletion removes the project and shows the empty state', async () => {
const app = await createTracker([true]);

await app.addProject('Obstacle Avoiding Robot');

app.getButtons(0).delete.click();

await waitFor(() =>
    app.elements['#project-list'].children.length === 0 &&
    !app.elements['#save-button'].disabled
);

assert.equal(app.elements['#project-list'].children.length, 0);
assert.equal(app.elements['#empty-state'].hidden, false);

});

test('deleting the project being edited resets the form to Add mode', async () => {
const app = await createTracker([true]);

await app.addProject('Arduino Weather Station');

app.getButtons(0).edit.click();

assert.equal(app.elements['#save-button'].textContent, 'Update Project');
assert.equal(app.elements['#cancel-button'].hidden, false);

app.getButtons(0).delete.click();

await waitFor(() =>
    app.elements['#project-list'].children.length === 0 &&
    !app.elements['#save-button'].disabled &&
    app.elements['#save-button'].textContent === 'Save Project'
);

assert.equal(app.elements['#name'].value, '');
assert.equal(app.elements['#save-button'].textContent, 'Save Project');
assert.equal(app.elements['#cancel-button'].hidden, true);
assert.equal(app.elements['#project-list'].children.length, 0);

});

test('cancelling an edit preserves the original project', async () => {
const app = await createTracker();

await app.addProject('Temperature Monitor', 'Planned');

app.getButtons(0).edit.click();

app.elements['#name'].value = 'Changed Name';
app.elements['#cancel-button'].click();

const item = app.elements['#project-list'].children[0];

assert.equal(item.children[0].textContent, 'Temperature Monitor');
assert.equal(item.children[1].textContent, 'Status: Planned');
assert.equal(app.elements['#save-button'].textContent, 'Save Project');

});