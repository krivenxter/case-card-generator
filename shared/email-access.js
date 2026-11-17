"use strict";

const DEMO_ACCESS_CONFIG = Object.freeze({
  enabled: true,
  password: "trogai333",
  storageKey: "calltouch-email-access-v1"
});

function setupDemoAccessGate() {
  const gate = document.getElementById("accessGate");
  const form = document.getElementById("accessGateForm");
  const input = document.getElementById("accessGatePassword");
  const error = document.getElementById("accessGateError");
  if (!gate || !form || !input || !error) return;

  const grantAccess = ({ animate = false } = {}) => {
    try {
      localStorage.setItem(DEMO_ACCESS_CONFIG.storageKey, "granted");
    } catch {
      // Если storage недоступен, допуск всё равно действует до обновления страницы.
    }
    document.body.classList.add("is-access-granted");
    if (!animate) {
      gate.hidden = true;
      return;
    }
    gate.classList.add("is-leaving");
    window.setTimeout(() => { gate.hidden = true; }, 440);
  };

  if (!DEMO_ACCESS_CONFIG.enabled) {
    grantAccess();
    return;
  }

  try {
    if (localStorage.getItem(DEMO_ACCESS_CONFIG.storageKey) === "granted") {
      grantAccess();
      return;
    }
  } catch {
    // Продолжаем с экраном ввода.
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (input.value === DEMO_ACCESS_CONFIG.password) {
      error.hidden = true;
      grantAccess({ animate: true });
      return;
    }
    error.hidden = false;
    input.select();
    input.focus();
  });

  window.setTimeout(() => input.focus(), 320);
}

setupDemoAccessGate();
