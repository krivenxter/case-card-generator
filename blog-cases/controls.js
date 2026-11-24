export function setupSelects() {
  for (const select of document.querySelectorAll('.blog-editor select')) {
    const button = document.createElement('button');
    const menu = document.createElement('div');
    const name = select.labels[0].textContent.replace(select.textContent, '').trim();
    menu.id = (select.id || select.dataset.field) + '-options';
    menu.className = 'blog-options';
    menu.setAttribute('popover', 'auto');
    menu.setAttribute('role', 'listbox');
    menu.setAttribute('aria-label', name);
    button.type = 'button';
    button.className = 'blog-select';
    button.setAttribute('popovertarget', menu.id);
    button.setAttribute('aria-haspopup', 'listbox');
    select.hidden = true;
    select.after(button, menu);
    function sync() {
      button.textContent = select.selectedOptions[0]?.label ?? '';
      button.setAttribute('aria-label', name + ', ' + button.textContent);
      for (const item of menu.children) item.setAttribute('aria-selected', item.dataset.value === select.value);
    }
    function rebuild() {
      menu.replaceChildren(...[...select.options].map((option) => {
        const item = document.createElement('button');
        item.type = 'button';
        item.dataset.value = option.value;
        item.textContent = option.label;
        item.setAttribute('role', 'option');
        item.addEventListener('click', () => {
          select.value = option.value;
          select.dispatchEvent(new Event('input'));
          menu.hidePopover();
          button.focus();
        });
        return item;
      }));
      sync();
    }
    menu.addEventListener('beforetoggle', (event) => {
      if (event.newState !== 'open') return;
      sync();
      const rect = button.getBoundingClientRect();
      menu.style.setProperty('--menu-width', Math.min(innerWidth - 16, Math.max(rect.width, 120)) + 'px');
      menu.style.left = Math.max(8, Math.min(rect.left, innerWidth - Math.max(rect.width, 120) - 8)) + 'px';
      const below = innerHeight - rect.bottom - 10;
      const above = rect.top - 10;
      const openAbove = below < 220 && above > below;
      menu.style.top = openAbove ? 'auto' : rect.bottom + 5 + 'px';
      menu.style.bottom = openAbove ? innerHeight - rect.top + 5 + 'px' : 'auto';
      menu.style.maxHeight = Math.max(36, Math.min(270, openAbove ? above : below)) + 'px';
      requestAnimationFrame(() => menu.querySelector('[aria-selected="true"]')?.focus());
    });
    menu.addEventListener('keydown', (event) => {
      const items = [...menu.children];
      const index = items.indexOf(document.activeElement);
      const offsets = { ArrowDown: Math.min(index + 1, items.length - 1), ArrowUp: Math.max(index - 1, 0), Home: 0, End: items.length - 1 };
      if (!(event.key in offsets)) return;
      event.preventDefault();
      items[offsets[event.key]]?.focus();
    });
    select.addEventListener('input', sync);
    select.addEventListener('blog-sync', sync);
    new MutationObserver(rebuild).observe(select, { childList: true });
    rebuild();
  }
}

export function setupDialogs() {
  for (const trigger of document.querySelectorAll('[data-dialog]')) {
    trigger.addEventListener('click', () => document.getElementById(trigger.dataset.dialog).showModal());
  }
  for (const dialog of document.querySelectorAll('.blog-dialog')) {
    dialog.querySelector('[data-close]').addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) {
        const rect = dialog.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right ||
            event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
      }
    });
  }
}

export function setupColors() {
  const dialog = document.getElementById('color-dialog');
  const value = document.getElementById('color-value');
  let active;
  for (const input of document.querySelectorAll('.blog-colors input')) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'blog-color';
    input.hidden = true;
    input.after(button);
    function sync() {
      button.textContent = input.value.toUpperCase();
      button.style.setProperty('--swatch', input.value);
    }
    button.addEventListener('click', () => {
      active = input;
      value.value = input.value;
      dialog.querySelector('h2').textContent = input.labels[0].firstChild.textContent.trim();
      dialog.showModal();
      value.select();
    });
    input.addEventListener('input', sync);
    input.addEventListener('blog-sync', sync);
    sync();
  }
  for (const hex of ['#5141c9', '#242142', '#171a2e', '#ffffff', '#cdd4ff', '#00b6e4', '#784cdb', '#ffd895']) {
    const swatch = document.createElement('button');
    swatch.type = 'button';
    swatch.title = hex;
    swatch.setAttribute('aria-label', hex);
    swatch.style.background = hex;
    swatch.addEventListener('click', () => { value.value = hex; });
    dialog.querySelector('.blog-swatches').append(swatch);
  }
  document.getElementById('color-form').addEventListener('submit', (event) => {
    event.preventDefault();
    active.value = '#' + value.value.replace(/^#/, '');
    active.dispatchEvent(new Event('input'));
    dialog.close();
  });
}

export function setupUpload(input, apply) {
  const zone = input.parentElement;
  input.addEventListener('change', () => {
    if (input.files[0]) apply(input.files[0]);
    input.value = '';
  });
  zone.addEventListener('dragover', (event) => {
    if (!event.dataTransfer.types.includes('Files')) return;
    event.preventDefault();
    zone.classList.add('blog-dragover');
  });
  zone.addEventListener('dragleave', (event) => {
    if (!zone.contains(event.relatedTarget)) zone.classList.remove('blog-dragover');
  });
  zone.addEventListener('drop', (event) => {
    event.preventDefault();
    zone.classList.remove('blog-dragover');
    if (event.dataTransfer.files[0]) apply(event.dataTransfer.files[0]);
  });
}
