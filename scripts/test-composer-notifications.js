import assert from 'node:assert/strict';
import { createComposerNotificationController } from '../assets/js/composer-notifications.js';

class FakeElement {
  constructor(tagName) {
    this.tagName = String(tagName || 'div').toUpperCase();
    this.children = [];
    this.parentNode = null;
    this.attributes = {};
    this.dataset = {};
    this.style = {};
    this.eventListeners = {};
    this.hidden = false;
    this.id = '';
    this.className = '';
    this.textContent = '';
    this.href = '';
    this.target = '';
    this.rel = '';
    this.type = '';
  }

  setAttribute(name, value) {
    this.attributes[name] = String(value);
    if (name === 'id') this.id = String(value);
  }

  getAttribute(name) {
    return this.attributes[name] || null;
  }

  appendChild(child) {
    child.parentNode = this;
    this.children.push(child);
    return child;
  }

  append(...nodes) {
    nodes.forEach((node) => this.appendChild(node));
  }

  addEventListener(type, handler) {
    if (!this.eventListeners[type]) this.eventListeners[type] = new Set();
    this.eventListeners[type].add(handler);
  }

  removeEventListener(type, handler) {
    if (this.eventListeners[type]) this.eventListeners[type].delete(handler);
  }

  click() {
    const event = {
      preventDefault() {},
      stopPropagation() {}
    };
    (this.eventListeners.click || []).forEach((handler) => handler(event));
  }

  remove() {
    if (!this.parentNode) return;
    this.parentNode.children = this.parentNode.children.filter((child) => child !== this);
    this.parentNode = null;
  }

  getBoundingClientRect() {
    return { top: 10, left: 10, right: 210, bottom: 50, width: 200, height: 40 };
  }
}

function findById(root, id) {
  if (!root) return null;
  if (root.id === id) return root;
  for (const child of root.children || []) {
    const found = findById(child, id);
    if (found) return found;
  }
  return null;
}

function createFakeEnvironment() {
  const body = new FakeElement('body');
  const documentRef = {
    body,
    createElement: (tagName) => new FakeElement(tagName),
    getElementById: (id) => findById(body, id)
  };
  const timers = [];
  const openedUrls = [];
  const warnings = [];
  const alerts = [];
  const windowRef = {
    requestAnimationFrame: (fn) => {
      fn();
      return 1;
    },
    setTimeout: (fn, delay) => {
      timers.push({ fn, delay });
      return timers.length;
    },
    clearTimeout: () => {},
    open: (href) => {
      openedUrls.push(href);
      return {
        closed: false,
        opener: {},
        location: {
          replacedWith: '',
          replace(value) {
            this.replacedWith = value;
          }
        },
        close() {
          this.closed = true;
        }
      };
    },
    alert: (message) => {
      alerts.push(message);
    }
  };
  const controller = createComposerNotificationController({
    documentRef,
    windowRef,
    t: (key) => key,
    safeString: (value) => String(value == null ? '' : value),
    alertRef: (message) => alerts.push(message),
    consoleRef: {
      warn: (...args) => warnings.push(args)
    }
  });
  return { controller, documentRef, windowRef, timers, openedUrls, warnings, alerts };
}

{
  const { controller, documentRef, timers } = createFakeEnvironment();
  controller.showToast('success', 'Saved', { duration: 1400 });
  const root = documentRef.getElementById('toast-root');
  assert.ok(root, 'showToast should create the toast root');
  assert.equal(root.attributes.role, 'status');
  assert.equal(root.children.length, 1);
  const toast = root.children[0];
  assert.equal(toast.className, 'toast success');
  assert.equal(toast.children[0].textContent, 'Saved');
  assert.equal(timers.at(-1).delay, 1400);
}

{
  const { controller, documentRef, timers } = createFakeEnvironment();
  let actionClicked = false;
  controller.showToast('warn', 'Open it', {
    action: {
      href: 'https://github.com/EkilyHQ/Press',
      label: 'Open',
      onClick: () => {
        actionClicked = true;
      }
    }
  });
  const toast = documentRef.getElementById('toast-root').children[0];
  const action = toast.children[1];
  assert.equal(action.tagName, 'A');
  assert.equal(action.href, 'https://github.com/EkilyHQ/Press');
  assert.equal(action.textContent, 'Open');
  action.click();
  assert.equal(actionClicked, true);
  assert.equal(timers.length, 0, 'action toasts should not auto-dismiss');
}

{
  const { controller, documentRef, warnings } = createFakeEnvironment();
  controller.handlePopupBlocked('https://github.com/EkilyHQ/Press/pull/1', {
    message: 'Popup blocked',
    actionLabel: 'Open PR',
    onRetry: () => {}
  });
  const toast = documentRef.getElementById('toast-root').children[0];
  assert.equal(toast.className, 'toast warn');
  assert.equal(toast.children[0].textContent, 'Popup blocked');
  assert.equal(toast.children[1].href, 'https://github.com/EkilyHQ/Press/pull/1');
  assert.equal(toast.children[1].textContent, 'Open PR');
  assert.equal(warnings.length, 1);
}

{
  const { controller, openedUrls } = createFakeEnvironment();
  const popup = controller.preparePopupWindow();
  assert.equal(openedUrls[0], '');
  assert.equal(popup.opener, null);
  const finalized = controller.finalizePopupWindow(popup, 'https://github.com/EkilyHQ/Press');
  assert.equal(finalized, popup);
  assert.equal(popup.location.replacedWith, 'https://github.com/EkilyHQ/Press');
  controller.closePopupWindow(popup);
  assert.equal(popup.closed, true);
}

console.log('composer notification tests passed');
