// The small parts the standing elements (Mail, GitHub, Users, Tokens…) are
// each built from. One copy here, not one per element.

/** A failure said in the node's words. Pressing it copies the words. */
export function errorBox(message: string): HTMLDivElement {
    const box = document.createElement('div');
    box.className = 'element-error';
    box.textContent = message;
    box.style.cursor = 'pointer';
    box.title = 'press to copy';
    box.addEventListener('click', () => {
        void navigator.clipboard.writeText(message).then(
            () => { box.textContent = 'copied'; setTimeout(() => { box.textContent = message; }, 1200); },
            () => { box.textContent = 'refused'; setTimeout(() => { box.textContent = message; }, 1200); },
        );
    });
    return box;
}

/** A label beside its value. */
export function row(label: string, value: string | HTMLElement): HTMLDivElement {
    const div = document.createElement('div');
    div.className = 'element-row';
    const l = document.createElement('span');
    l.className = 'label';
    l.textContent = label;
    const v = document.createElement('span');
    v.className = 'element-value';
    if (typeof value === 'string') {
        v.textContent = value;
    } else {
        v.appendChild(value);
    }
    div.appendChild(l);
    div.appendChild(v);
    return div;
}

export function section(title: string): HTMLDivElement {
    const div = document.createElement('div');
    div.className = 'element-section';
    const h = document.createElement('h3');
    h.className = 'element-section-title';
    h.textContent = title;
    div.appendChild(h);
    return div;
}

export function cell(text: string, className = ''): HTMLTableCellElement {
    const td = document.createElement('td');
    td.className = className;
    td.textContent = text;
    return td;
}

/** A line of what the element is doing or has been told. */
export function said(text: string): HTMLDivElement {
    const div = document.createElement('div');
    div.className = 'element-loading';
    div.textContent = text;
    return div;
}

/** A form field as the dark elements draw it. */
export function styled<T extends HTMLElement>(field: T): T {
    field.style.padding = '6px 8px';
    field.style.fontFamily = 'var(--font-mono)';
    field.style.color = 'var(--text-on-dark)';
    field.style.background = 'var(--bg-dark-light)';
    field.style.border = '1px solid var(--border-on-dark)';
    field.style.borderRadius = 'var(--border-radius)';
    return field;
}

// A label activates its first control when anything inside it is pressed, so
// a group of buttons is captioned in a div: in a label, pressing GitHub also
// pressed Google.
export function labelled(text: string, field: HTMLElement, tag: 'label' | 'div' = 'label'): HTMLElement {
    const wrap = document.createElement(tag);
    wrap.style.display = 'flex';
    wrap.style.flexDirection = 'column';
    wrap.style.gap = '4px';
    const caption = document.createElement('span');
    caption.style.color = 'var(--text-on-dark-tertiary)';
    caption.textContent = text;
    wrap.append(caption, field);
    return wrap;
}
