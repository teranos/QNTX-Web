import { sendMessage } from './client';
import { log, SEG } from './logger';
import { escapeHtml } from './html-utils';
import { renderSparkline } from '@teranos/elements';
import { renderSparklines, windowOf, seenOver, type Seen, type Window } from './components/sparkline';
import { DB } from './sym';
import { setDilation } from './watcher-predicates';
import type { Element } from '@teranos/elements';

let dbStatsElement: HTMLElement | null = null;
let dbStats: any = null;

// Section containers (created once, survive re-renders)
let sectionOverview: HTMLElement | null = null;
let sectionPredicates: HTMLElement | null = null;
let sectionPerformance: HTMLElement | null = null;

export function updateDatabaseStats(stats: any): void {
    dbStats = stats;
    if (dbStatsElement) {
        renderDbStats();
    }
}

function createSections(root: HTMLElement): void {
    sectionOverview = document.createElement('div');
    sectionOverview.className = 'db-section-overview';

    // 2-column grid below the overview
    const columns = document.createElement('div');
    columns.style.cssText = 'display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 8px;';

    sectionPredicates = document.createElement('div');
    sectionPredicates.className = 'db-section-predicates';

    sectionPerformance = document.createElement('div');
    sectionPerformance.className = 'db-section-performance';

    columns.appendChild(sectionPredicates);
    columns.appendChild(sectionPerformance);

    root.appendChild(sectionOverview);
    root.appendChild(columns);
}

function renderStatsError(err: any): string {
    if (typeof err === 'string') {
        return `<div class="element-error">${escapeHtml(err)}</div>`;
    }
    const rows = [
        `<div class="element-error"><span class="label">${escapeHtml(err.surface ?? 'database stats')}</span> ${escapeHtml(err.error ?? 'failed')}</div>`,
    ];
    for (const detail of err.details ?? []) {
        rows.push(`<div class="element-error-detail">${escapeHtml(detail)}</div>`);
    }
    for (const hint of err.hints ?? []) {
        rows.push(`<div class="element-error-hint">${escapeHtml(hint)}</div>`);
    }
    if (err.id) {
        rows.push(`<div class="element-error-id">${escapeHtml(err.id)}</div>`);
    }
    return rows.join('');
}

interface Landing {
    namespace: string;
    path: string;
    bytes: number;
    wal_bytes: number;
    attestations: number;
}

// A panel is as wide as the canvas lets it be, and a row laid out across all
// of that puts its last column an arm's length from its first. These are
// tables: fixed columns, and a width a row is read across rather than scanned.
const LANDING_WIDTH = '860px';
const LANDING_COLUMNS = '110px minmax(0, 1fr) 84px 84px 72px';
const SPEND_COLUMNS = '132px 92px 60px 64px';

// A name that opens the way a type does: the same class and data-type the
// wiring below already listens for.
function typeLink(name: string): HTMLElement {
    const link = document.createElement('span');
    link.className = 'element-type-link';
    link.dataset.type = name;
    link.style.cursor = 'pointer';
    link.textContent = name;
    return link;
}

// Named things over time, drawn as markup for the panels that are written as
// markup. "The axis of time is more useful than a tally."
function sparklinesHTML(label: string, rows: Seen[], w: Window): string {
    const into = document.createElement('div');
    renderSparklines(into, label, rows, w, typeLink);
    return into.innerHTML;
}

// One window for everything a list of names draws, from the earliest of them
// to now, so a day sits at the same place on every line.
function windowOfSeen(rows: Seen[], now: number = Date.now()): Window {
    return windowOf(rows.flatMap(one => one.times), now);
}

// A read is answered from the database of its namespace and never from the
// record (ADR-037), so there is one of these per namespace and the single
// path this panel used to print was hiding all but one of them.
function landingsHTML(landings: Landing[] | undefined, failed: any, onePath: string): string {
    if (failed) {
        return renderStatsError(failed);
    }
    if (!landings || landings.length === 0) {
        return `<div style="padding: 6px 0;">
            <span class="label">Path:</span> <span class="element-value">${escapeHtml(onePath)}</span>
        </div>`;
    }

    const held = landings.reduce((sum, one) => sum + one.attestations, 0);
    const rows = landings.map(one => `
        <div style="display: grid; grid-template-columns: ${LANDING_COLUMNS}; gap: 8px; padding: 2px 0; max-width: ${LANDING_WIDTH};">
            <span style="color: #e2e8f0; overflow-wrap: anywhere;">${escapeHtml(one.namespace)}</span>
            <span style="color: #475569; overflow-wrap: anywhere;">${escapeHtml(one.path)}</span>
            <span style="color: #64748b; text-align: right;">db ${formatBytes(one.bytes)}</span>
            <span style="color: ${one.wal_bytes > 8 * 1024 * 1024 ? '#f59e0b' : '#64748b'}; text-align: right;">wal ${formatBytes(one.wal_bytes)}</span>
            <span style="color: #94a3b8; text-align: right;">${one.attestations.toLocaleString()}</span>
        </div>`).join('');

    return `
        <div style="padding: 8px 0; border-bottom: 1px solid var(--border-on-dark);">
            <span class="label">Answering reads from ${landings.length} ${landings.length === 1 ? 'database' : 'databases'}:</span>
            <span class="element-value">${held.toLocaleString()} attestations</span>
            <div style="margin-top: 4px;">${rows}</div>
        </div>
    `;
}

interface RichField {
    field: string;
    last?: string;
    over: Record<string, number> | null;
    source_types: string[];
}

interface Spend {
    of: string;
    request: string;
    held_on_node: boolean;
    count: number;
}

// What reading the record has cost, per reader, most spent first. A backend
// holding its record on the node sends none of this and the section is absent
// — nothing left the node, so nothing was spent reading it.
function recordSpendHTML(spend: Spend[] | undefined, failed: any): string {
    if (failed) {
        return renderStatsError(failed);
    }
    if (!spend || spend.length === 0) {
        return '';
    }

    // A reader the node keeps nothing of pays S3 for every read of it
    // (ADR-037). Said on the row, because a large number there is a defect
    // and the same number beside "on the node" is the record doing its job.
    const rows = spend.map(one => `
        <div style="display: grid; grid-template-columns: ${SPEND_COLUMNS}; gap: 8px; padding: 2px 0;">
            <span style="color: ${one.held_on_node ? '#e2e8f0' : '#f59e0b'}; overflow-wrap: anywhere;">${escapeHtml(one.of)}</span>
            <span style="color: ${one.held_on_node ? '#475569' : '#f59e0b'};">${one.held_on_node ? 'on the node' : 'record only'}</span>
            <span style="color: #64748b;">${escapeHtml(one.request)}</span>
            <span style="color: #94a3b8; text-align: right;">${one.count.toLocaleString()}</span>
        </div>`).join('');

    const total = spend.reduce((sum, one) => sum + one.count, 0);
    const offNode = spend.filter(one => !one.held_on_node).reduce((sum, one) => sum + one.count, 0);
    const leaving = offNode > 0
        ? ` <span style="color: #f59e0b;">${offNode.toLocaleString()} of them for things the node keeps no copy of</span>`
        : '';

    return `
        <div style="margin-bottom: 8px;">
            <span class="label">Reading the record has cost:</span>
            <span class="element-value">${total.toLocaleString()} requests</span>${leaving}
            <div style="margin-top: 4px;">${rows}</div>
        </div>
    `;
}

function renderDbStats(): void {
    if (!dbStatsElement || !sectionOverview || !sectionPredicates || !sectionPerformance) return;

    if (!dbStats) {
        sectionOverview.innerHTML = `<div class="element-loading">Loading database statistics...</div>`;
        return;
    }
    if (dbStats.error) {
        sectionOverview.innerHTML = renderStatsError(dbStats.error);
        return;
    }

    // -- Overview: compact stats row --
    const storageBackend = dbStats.storage_optimized
        ? `rust (optimized) v${dbStats.storage_version}`
        : 'go (fallback)';

    // A count is rendered when the payload carries it. Absent means this
    // backend does not answer it; zero is an answer and renders as one.
    const countSpan = (label: string, value: unknown): string =>
        typeof value === 'number'
            ? `<span><span class="label">${label}:</span> <span class="element-value">${value.toLocaleString()}</span></span>`
            : '';

    sectionOverview.innerHTML = `
        <div style="display: flex; flex-wrap: wrap; gap: 16px; padding: 8px 0; border-bottom: 1px solid var(--border-on-dark);">
            <span><span class="label">Backend:</span> <span class="element-value">${storageBackend}</span></span>
            ${countSpan('Attestations', dbStats.total_attestations)}
        </div>
        ${landingsHTML(dbStats.landings, dbStats.landings_error, String(dbStats.path ?? ''))}
    `;

    // -- Predicates: what the record cost, then types --
    let predicatesHTML = recordSpendHTML(dbStats.record_spend, dbStats.record_spend_error);

    // Rich fields / types
    const richFields = dbStats.rich_fields;
    if (richFields && richFields.length > 0) {
        const isEnhanced = typeof richFields[0] === 'object' && 'field' in richFields[0];
        if (isEnhanced) {
            // Each over time, the most recently carried first.
            const seen = (richFields as RichField[]).map(f => seenOver(f.field, f.over, f.last));
            predicatesHTML += `<div style="margin-bottom: 8px;">${sparklinesHTML(`Types (${richFields.length})`, seen, windowOfSeen(seen))}</div>`;
        } else {
            const fieldItems = richFields.sort().map((f: string) => `<span class="element-type-link" data-type="${escapeHtml(f)}" style="cursor: pointer; margin-right: 8px;">${escapeHtml(f)}</span>`).join('');
            predicatesHTML += `
            <div style="margin-bottom: 8px;">
                <span class="label">Types (${richFields.length}):</span>
                <span class="element-value" style="display: flex; flex-wrap: wrap; gap: 4px;">${fieldItems}</span>
            </div>
        `;
        }
    }

    sectionPredicates.innerHTML = predicatesHTML ? `<div style="padding: 8px 0; border-bottom: 1px solid var(--border-on-dark);">${predicatesHTML}</div>` : '';

    // Wire type links. Both sections, because a namespace's own predicates and
    // contexts are drawn beside its database in the overview and they open the
    // same way a type does.
    for (const section of [sectionPredicates, sectionOverview]) {
        section.querySelectorAll('.element-type-link').forEach(el => {
            el.addEventListener('click', () => {
                const typeName = (el as HTMLElement).dataset.type;
                if (typeName) {
                    import('./type-definition-window.js')
                        .then(({ openTypeDefinition }) => openTypeDefinition(typeName))
                        .catch((err: unknown) => log.error(SEG.ELEMENT, `Type definition for ${typeName} failed to open:`, err));
                }
            });
        });
    }

    // -- Performance --
    if (dbStats.performance || dbStats.live) {
        renderPerformanceSection(sectionPerformance, dbStats.performance, dbStats.live);
    } else {
        sectionPerformance.innerHTML = '';
    }
}

interface PerfEntry {
    name: string;
    kind: 'op' | 'mutex';
    count: number;
    min: number;
    max: number;
    avg: number;
}

interface PerfData {
    current: PerfEntry[];
    sparklines: Record<string, (number | null)[]>;
    windows: number;
}

function formatMs(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
}

interface LiveStatus {
    write_lock?: { holder: string; held_ms: number };
    wal_bytes?: number;
    db_bytes?: number;
    dilation?: number;
    mem_pct?: number;
    cpu_pct?: number;
}

function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}K`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)}GB`;
}

function renderLiveStatus(live: LiveStatus): string {
    const lines: string[] = [];

    // Write lock
    const wl = live.write_lock;
    if (wl) {
        const heldSec = wl.held_ms / 1000;
        const color = heldSec > 30 ? '#ef4444' : heldSec > 5 ? '#f59e0b' : '#4ade80';
        lines.push(`<div style="display: flex; align-items: center; gap: 6px;">
            <span style="width: 6px; height: 6px; border-radius: 50%; background: ${color};"></span>
            <span style="color: #e2e8f0;">write: <b>${wl.holder}</b> ${formatMs(wl.held_ms)}</span>
        </div>`);
    } else {
        lines.push(`<div style="display: flex; align-items: center; gap: 6px;">
            <span style="width: 6px; height: 6px; border-radius: 50%; background: #4ade80;"></span>
            <span style="color: #64748b;">write: idle</span>
        </div>`);
    }

    // Dilation + pressure — also feed into watcher eye color
    if (live.dilation != null) {
        setDilation(live.dilation);
        const d = live.dilation;
        const color = d >= 1.0 ? '#4ade80' : d >= 0.5 ? '#f59e0b' : '#ef4444';
        const mem = live.mem_pct != null ? `${live.mem_pct.toFixed(0)}% mem` : '';
        const cpu = live.cpu_pct != null ? `${live.cpu_pct.toFixed(0)}% cpu` : '';
        const pressure = [mem, cpu].filter(Boolean).join(' · ');
        lines.push(`<div style=" color: #94a3b8;">
            dilation <span style="color: ${color};">${d.toFixed(2)}x</span>${pressure ? ` · ${pressure}` : ''}
        </div>`);
    }

    // DB + WAL size
    const sizes: string[] = [];
    if (live.db_bytes != null) sizes.push(`db ${formatBytes(live.db_bytes)}`);
    if (live.wal_bytes != null) sizes.push(`wal ${formatBytes(live.wal_bytes)}`);
    if (sizes.length > 0) {
        lines.push(`<div style=" color: #64748b;">${sizes.join(' · ')}</div>`);
    }

    return lines.join('');
}

function renderPerformanceSection(container: HTMLElement, perf: PerfData | null, live?: LiveStatus): void {
    let liveHTML = '';
    if (live) {
        liveHTML = `<div style="margin-bottom: 8px;">${renderLiveStatus(live)}</div>`;
    }

    if (!perf || !perf.current || perf.current.length === 0) {
        if (liveHTML) {
            container.innerHTML = `<div style="padding: 8px 0; border-bottom: 1px solid var(--border-on-dark);">${liveHTML}</div>`;
        }
        return;
    }

    const maxVal = Math.max(...perf.current.map(e => e.max));
    if (maxVal === 0) return;

    const rows = perf.current.map(entry => {
        const barWidth = 200;
        const minPx = (entry.min / maxVal) * barWidth;
        const maxPx = (entry.max / maxVal) * barWidth;
        const avgPx = (entry.avg / maxVal) * barWidth;
        const spread = entry.max - entry.min;
        const relVariance = entry.avg > 0 ? spread / entry.avg : 0;

        let color = '#4ade80';
        if (relVariance > 2) color = '#ef4444';
        else if (relVariance > 0.5) color = '#f59e0b';

        const isMutex = entry.kind === 'mutex';
        const label = isMutex ? `\u23F3 ${entry.name}` : entry.name;
        const sparkKey = isMutex ? `mutex:${entry.name}` : entry.name;
        const sparkData = perf.sparklines[sparkKey];
        const sparkSvg = sparkData ? renderSparkline(sparkData) : '';

        return `<div style="margin-bottom: 6px;">
            <div style="display: flex; justify-content: space-between; color: #e2e8f0; margin-bottom: 2px;">
                <span style="word-break: break-word; overflow-wrap: break-word;">${label} <span style="color: #64748b;">\u00D7${entry.count}</span></span>
                <span style="white-space: nowrap; margin-left: 8px; color: #94a3b8;">${formatMs(entry.avg)}</span>
            </div>
            <div style="position: relative; height: 8px; background: #1e293b; border-radius: 4px; overflow: hidden;">
                <div style="position: absolute; left: ${minPx}px; width: ${Math.max(2, maxPx - minPx)}px; height: 100%; background: ${color}; opacity: 0.3; border-radius: 4px;"></div>
                <div style="position: absolute; left: ${avgPx}px; width: 2px; height: 100%; background: ${color};"></div>
            </div>
            <div style="display: flex; justify-content: space-between; color: #475569;">
                <span>${formatMs(entry.min)}</span>
                <span>${formatMs(entry.max)}</span>
            </div>
            ${sparkSvg ? `<div style="margin-top: 2px;">${sparkSvg}</div>` : ''}
        </div>`;
    }).join('');

    container.innerHTML = `
        <div style="padding: 8px 0; border-bottom: 1px solid var(--border-on-dark);">
            ${liveHTML}
            <span class="label" style="">Performance (5m windows):</span>
            <div style="margin-top: 4px;">${rows}</div>
        </div>
    `;
}

export const needs = ['/ws'] as const;

export function createDbElement(): Element {
    return {
        id: 'database-element',
        title: 'Database',
        symbol: DB,
        opensAs: 'panel' as const,
        renderContent: () => {
            const content = document.createElement('div');
            dbStatsElement = content;
            createSections(content);
            sendMessage({ type: 'get_database_stats' });
            renderDbStats();
            return content;
        },
    };
}
