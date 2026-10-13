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

function createTracker(confirmAnswers = []) {
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

    let nextId = 1;
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

        crypto: {
            randomUUID() {
                return `project-${nextId++}`;
            }
        },

        window: {
            confirm(message) {
                confirmationMessages.push(message);
                return confirmAnswers.shift() ?? false;
            }
        }
    };

    vm.runInNewContext(script, context);

    function addProject(name, status = 'Planned') {
        elements['#name'].value = name;
        elements['#status'].value = status;

        elements['#project-form'].dispatch('submit');
    }

    function getButtons(projectIndex) {
        const item = elements['#project-list'].children[projectIndex];
        const actions = item.children[2];

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

test('deleting one of two projects with the same name deletes only its ID', () => {
    const app = createTracker([true]);

    app.addProject('Smart Dustbin', 'Planned');
    app.addProject('Smart Dustbin', 'Completed');

    const firstDelete = app.getButtons(0).delete;
    const secondDelete = app.getButtons(1).delete;

    assert.notEqual(
        firstDelete.dataset.projectId,
        secondDelete.dataset.projectId
    );

    secondDelete.click();

    const list = app.elements['#project-list'];

    assert.equal(list.children.length, 1);
    assert.equal(list.children[0].children[0].textContent, 'Smart Dustbin');
    assert.equal(list.children[0].children[1].textContent, 'Status: Planned');
});

test('cancelling deletion leaves the project unchanged', () => {
    const app = createTracker([false]);

    app.addProject('Line Following Robot');

    const deleteButton = app.getButtons(0).delete;
    deleteButton.click();

    assert.equal(app.elements['#project-list'].children.length, 1);
    assert.equal(
        app.elements['#project-list'].children[0].children[0].textContent,
        'Line Following Robot'
    );

    assert.equal(app.elements['#empty-state'].hidden, true);
    assert.match(app.confirmationMessages[0], /Line Following Robot/);
});

test('confirming deletion removes the project and shows the empty state', () => {
    const app = createTracker([true]);

    app.addProject('Obstacle Avoiding Robot');

    app.getButtons(0).delete.click();

    assert.equal(app.elements['#project-list'].children.length, 0);
    assert.equal(app.elements['#empty-state'].hidden, false);
});

test('deleting the project being edited resets the form to Add mode', () => {
    const app = createTracker([true]);

    app.addProject('Arduino Weather Station');

    app.getButtons(0).edit.click();

    assert.equal(app.elements['#save-button'].textContent, 'Update Project');
    assert.equal(app.elements['#cancel-button'].hidden, false);

    app.getButtons(0).delete.click();

    assert.equal(app.elements['#name'].value, '');
    assert.equal(app.elements['#save-button'].textContent, 'Save Project');
    assert.equal(app.elements['#cancel-button'].hidden, true);
    assert.equal(app.elements['#project-list'].children.length, 0);
});

test('cancelling an edit preserves the original project', () => {
    const app = createTracker();

    app.addProject('Temperature Monitor', 'Planned');

    app.getButtons(0).edit.click();

    app.elements['#name'].value = 'Changed Name';
    app.elements['#cancel-button'].click();

    const item = app.elements['#project-list'].children[0];

    assert.equal(item.children[0].textContent, 'Temperature Monitor');
    assert.equal(item.children[1].textContent, 'Status: Planned');
    assert.equal(app.elements['#save-button'].textContent, 'Save Project');
});