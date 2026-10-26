/**
 * The sidebar — where the node's standing elements rest, on the left.
 *
 * "they're still elements. But from now on we say that the tray is for things
 *  that are more temporal. Like individual chats, or an individual User.
 *  While Users, or Integrations, Vault, etc, etc will be leftside"
 *
 * A standing element rests here in Button Form (@teranos/elements buttonFrom),
 * with its symbol and its name. Pressed, the same element becomes its window
 * and leaves a gap in the list; minimized, it goes to the tray as a dot, which
 * is where put-down things rest; a double press on the gap brings it home.
 * The canvas is the one standing element not here: it opens as the workspace,
 * which a button cannot become, so it stays a dot in the tray.
 *
 * At the head, who is looking: the one .who block, taken from the header the
 * way the namespace page took it. At the foot, the door. On a desktop it is a
 * column beside the page, collapsible and remembered. On a phone it is a
 * drawer over the page, holding the system controls and opened by the picture or a swipe in
 * from the left edge, and dismissed by a swipe back, the scrim, or Escape
 * (Apple Human Interface Guidelines, Sidebars; Sheets: "Support swiping to
 * dismiss"). In Safari the left edge is the browser's own back gesture, so the
 * picture is the way that always works; the swipe is the App shell's.
 */

import { tray, buttonFrom, pressFrom, raise, type Element } from '@teranos/elements';
import { getStorageItem, setStorageItem } from './indexeddb-storage.ts';
import { standAtTheDoor } from './signin';
import { log, SEG } from './logger.ts';

const OPEN_KEY = 'sidebar-open';
const PHONE = '(max-width: 768px)';
/** px: on a desktop the column is this wide; the canvas is pushed by it. */
const WIDTH = 240;
/** px: a touch starting this close to the left edge is a swipe in. */
const EDGE = 24;
/** Fraction of the drawer's width that, swiped past, opens or closes it. */
const SWIPE_FRACTION = 1 / 3;
/** px/ms: a release this fast is a flick, and decides from shorter. */
const FLICK_SPEED = 0.5;
/** px: a flick shorter than this is a finger settling, not a flick. */
const FLICK_MIN = 24;

let nav: HTMLElement | null = null;
let list: HTMLElement | null = null;
let scrim: HTMLElement | null = null;
let latch: HTMLButtonElement | null = null;
let phone: MediaQueryList | null = null;
let open = false;
let systemObserver: MutationObserver | null = null;

// The elements resting here, by id: the one DOM element each is.
const elements = new Map<string, HTMLElement>();

function onPhone(): boolean {
    return phone?.matches ?? false;
}

function remembered(): boolean {
    return getStorageItem(OPEN_KEY) !== '0';
}

/** The width the page gives way by: the column's on a desktop, nothing on a phone. */
function pushPage(): void {
    document.documentElement.style.setProperty('--sidebar-width', open && !onPhone() ? `${WIDTH}px` : '0px');
}

function show(next: boolean): void {
    open = next;
    document.body.classList.toggle('sidebar-open', open);
    nav?.setAttribute('aria-hidden', open || !onPhone() ? 'false' : 'true');
    latch?.setAttribute('aria-expanded', String(open));
    if (scrim) scrim.hidden = !(open && onPhone());
    pushPage();
    if (!onPhone()) setStorageItem(OPEN_KEY, open ? '1' : '0');
    if (open && onPhone()) nav?.focus();
}

/** Opens the sidebar. */
export function openSidebar(): void {
    show(true);
}

/** Closes the sidebar. */
export function closeSidebar(): void {
    show(false);
}

/** Open becomes closed and closed becomes open. */
export function toggleSidebar(): void {
    show(!open);
}

/** Whether the sidebar is open. */
export function sidebarOpen(): boolean {
    return open;
}

// ── Where an element rests ──────────────────────────────────────────

/** Whether this element rests in the sidebar or the tray. */
export function hasElement(id: string): boolean {
    return elements.has(id) || tray.has(id);
}

/**
 * Opens an element wherever it rests: a button in the sidebar is pressed, a
 * dot in the tray is opened, a window already open is raised. An id the
 * sidebar does not know is the tray's to answer.
 */
export function openElement(id: string): void {
    const el = elements.get(id);
    if (!el) {
        tray.open(id);
        return;
    }
    switch (el.dataset.form) {
        case 'button':
            el.click();
            return;
        case 'dot':
            // Put down in the tray: it opens from there, as the gap's locate does.
            tray.open(id);
            return;
        case 'window':
        case 'panel':
            raise(el);
            return;
        default:
            log.debug(SEG.UI, `[Sidebar] ${id} is mid-morph (${el.dataset.form ?? 'no form'}); nothing to open`);
    }
}

/**
 * Rests a standing element in the sidebar, in Button Form. A workspace is
 * refused: a button becomes a window and nothing else, so the canvas rests in
 * the tray (default-elements.ts says which goes where).
 */
export function restInSidebar(item: Element): void {
    if (item.opensAs === 'workspace') {
        throw new Error(`${item.id} opens as the workspace, which a button cannot become; it rests in the tray`);
    }
    if (!list) {
        throw new Error(`the sidebar is not up; ${item.id} has nowhere to rest`);
    }
    if (elements.has(item.id)) return;
    const button = buttonFrom(item, { className: 'sidebar-button' });
    // The symbol is drawn by the stylesheet from this, in button form only: the
    // package puts nothing but the label in a button, and stashes anything else.
    if (item.symbol) button.dataset.symbol = item.symbol;
    elements.set(item.id, button);
    list.appendChild(button);
}

// ── The drawer's swipe, on a phone ──────────────────────────────────

function attachSwipe(doc: Document): void {
    if (!nav) return;
    const drawer = nav;
    let startX = 0;
    let startY = 0;
    let startAt = 0;
    let dx = 0;
    let swiping: 'in' | 'out' | null = null;
    let decided = false;

    const width = () => drawer.getBoundingClientRect().width || WIDTH;

    const settle = () => {
        drawer.style.transition = '';
        drawer.style.transform = '';
        swiping = null;
        decided = false;
        dx = 0;
    };

    doc.addEventListener('touchstart', (e: TouchEvent) => {
        if (!onPhone() || e.touches.length !== 1) return;
        const t = e.touches[0]!;
        if (!open && t.clientX <= EDGE) swiping = 'in';
        else if (open && drawer.contains(e.target as Node)) swiping = 'out';
        else return;
        startX = t.clientX;
        startY = t.clientY;
        startAt = performance.now();
        dx = 0;
        decided = false;
    }, { passive: true });

    doc.addEventListener('touchmove', (e: TouchEvent) => {
        if (!swiping) return;
        if (e.touches.length !== 1) { settle(); return; }
        const t = e.touches[0]!;
        const moveX = t.clientX - startX;
        const moveY = t.clientY - startY;
        if (!decided) {
            if (Math.abs(moveX) < 6 && Math.abs(moveY) < 6) return;
            // More down than across is the list scrolling, not the drawer moving.
            if (Math.abs(moveY) > Math.abs(moveX)) { swiping = null; return; }
            decided = true;
            drawer.style.transition = 'none';
        }
        e.preventDefault();
        dx = swiping === 'in' ? Math.max(0, moveX) : Math.min(0, moveX);
        const at = swiping === 'in' ? -width() + dx : dx;
        drawer.style.transform = `translateX(${Math.min(0, at)}px)`;
    }, { passive: false });

    const end = () => {
        if (!swiping) return;
        const was = swiping;
        const moved = Math.abs(dx);
        const elapsed = Math.max(1, performance.now() - startAt);
        const far = moved >= width() * SWIPE_FRACTION;
        const flick = moved >= FLICK_MIN && moved / elapsed >= FLICK_SPEED;
        settle();
        if (far || flick) show(was === 'in');
    };
    doc.addEventListener('touchend', end);
    doc.addEventListener('touchcancel', end);
}

// ── Mounting ────────────────────────────────────────────────────────

/**
 * Builds the sidebar into the container, before the page, and the latch into
 * the system bar's header. Called once, before any standing element rests.
 */
export function initSidebar(doc: Document = document): void {
    if (nav) return;
    const container = doc.getElementById('container');
    if (!container) return;
    phone = typeof doc.defaultView?.matchMedia === 'function' ? doc.defaultView.matchMedia(PHONE) : null;

    scrim = doc.createElement('div');
    scrim.className = 'sidebar-scrim';
    scrim.hidden = true;
    scrim.setAttribute('aria-hidden', 'true');
    scrim.addEventListener('click', () => show(false));

    nav = doc.createElement('nav');
    nav.id = 'sidebar';
    nav.setAttribute('aria-label', 'the node');
    nav.tabIndex = -1;

    // Who is looking, at the head. The block is the header's, moved here: one
    // block for its whole life, as the namespace page kept it.
    const head = doc.createElement('div');
    head.className = 'sidebar-head';
    const who = doc.querySelector<HTMLElement>('#header .who');
    if (who) {
        head.appendChild(who);
        who.addEventListener('click', () => {
            if (hasElement('i-element')) openElement('i-element');
        });
    }

    list = doc.createElement('div');
    list.className = 'sidebar-list';
    // A press on a button opens it over the page; on a phone the drawer gets
    // out of the way. A press on a gap too: what it locates is behind the drawer.
    list.addEventListener('click', () => { if (onPhone()) show(false); });

    // The door at the foot, and the build stamp under it.
    const foot = doc.createElement('div');
    foot.className = 'sidebar-foot';
    const out = pressFrom({ id: 'sidebar-door', title: 'the door', mark: '[<]', does: () => { standAtTheDoor(); } });
    out.element.classList.add('sidebar-door');
    foot.appendChild(out.element);
    const stamp = doc.querySelector<HTMLElement>('#header .build-stamp');
    if (stamp) foot.appendChild(stamp);

    nav.append(head, list, foot);
    container.prepend(scrim, nav);

    // The latch: the person's picture in the system bar, at its left end. On a
    // phone it opens the drawer; on a desktop it folds the column away and back.
    const header = doc.getElementById('system-drawer-header');
    if (header) {
        latch = doc.createElement('button');
        latch.type = 'button';
        latch.id = 'sidebar-latch';
        latch.className = 'sidebar-latch';
        latch.setAttribute('aria-label', 'the sidebar');
        latch.setAttribute('aria-controls', 'sidebar');
        const mirror = doc.createElement('img');
        mirror.alt = '';
        mirror.dataset.whoMirror = '';
        latch.appendChild(mirror);
        // The header's own click opens the drawer on anything but a button; a
        // press on the picture inside is the latch's alone.
        latch.addEventListener('click', (e: Event) => { e.stopPropagation(); toggleSidebar(); });
        header.prepend(latch);
    }

    doc.addEventListener('keydown', (e: KeyboardEvent) => {
        if (e.key === 'Escape' && open && onPhone()) show(false);
    });

    // Move the live system bar, including its input, results and indicators.
    // Keep its original slot for desktop and the full-screen sign-in door.
    const system = doc.getElementById('system-drawer');
    const slot = doc.createComment('system drawer desktop / door slot');
    system?.before(slot);
    const placeSystem = () => {
        if (!system || !nav || !header) return;
        const held = system.classList.contains('door-held');
        if (onPhone() && !held) {
            if (system.parentElement !== nav) nav.insertBefore(system, list);
        } else if (system.previousSibling !== slot) {
            slot.after(system);
        }
        // A tap alternative remains available where Safari owns the edge swipe.
        if (latch) {
            if (onPhone()) {
                if (latch.parentElement !== doc.body) doc.body.appendChild(latch);
                latch.hidden = held;
            } else {
                if (latch.parentElement !== header) header.prepend(latch);
                latch.hidden = false;
            }
        }
    };
    if (system) {
        systemObserver = new MutationObserver(placeSystem);
        systemObserver.observe(system, { attributes: true, attributeFilter: ['class'] });
    }
    header?.addEventListener('click', (event) => {
        if (onPhone() && (event.target as HTMLElement).closest('.status-indicator.clickable')) show(false);
    });
    // Across the breakpoint the drawer is shut, the column is as remembered.
    phone?.addEventListener?.('change', () => {
        placeSystem();
        show(onPhone() ? false : remembered());
    });
    placeSystem();
    attachSwipe(doc);

    show(onPhone() ? false : remembered());
    log.debug(SEG.UI, '[Sidebar] Mounted');
}

/** For tests: forget the sidebar, so the next init builds it again. */
export function resetSidebar(): void {
    systemObserver?.disconnect();
    systemObserver = null;
    nav = null;
    list = null;
    scrim = null;
    latch = null;
    phone = null;
    open = false;
    elements.clear();
}
