#!/usr/bin/env bun
// `bun run z-order`: the z-index stack as the stylesheets and modules declare it now, highest first.

// > this should not exist in the CLAUDE.md
// > instead those values could be computed whenever needed

import { readdirSync, readFileSync, statSync } from "fs";
import { join, relative } from "path";

const roots = ["css", "ts"].map(dir => join(import.meta.dir, dir));

interface Declared {
    file: string;
    line: number;
    value: string;
    order: number;
    where: string;
}

function* files(dir: string): Generator<string> {
    for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) {
            yield* files(path);
        } else if ((name.endsWith(".css") || name.endsWith(".ts")) && !name.endsWith(".test.ts")) {
            yield path;
        }
    }
}

/** The value after `z-index:` (CSS) or `zIndex =`/`zIndex:` (TypeScript), up to the end of the declaration. */
function valueOf(text: string, at: number): string {
    const rest = text.slice(at);
    const colon = rest.indexOf(":");
    const equals = rest.indexOf("=");
    const start = colon >= 0 && (equals < 0 || colon < equals) ? colon : equals;
    if (start < 0) return "";
    let value = rest.slice(start + 1).trim();
    for (const end of [";", ",", "}", "'", '"', "`", ")"]) {
        const i = value.indexOf(end);
        if (i >= 0) value = value.slice(0, i);
    }
    return value.trim();
}

const declared: Declared[] = [];
for (const root of roots) {
    for (const file of files(root)) {
        const lines = readFileSync(file, "utf8").split("\n");
        let where = "";
        lines.forEach((text, i) => {
            const trimmed = text.trim();
            if (trimmed.endsWith("{")) where = trimmed.slice(0, -1).trim();
            const css = text.indexOf("z-index");
            const ts = text.indexOf("zIndex");
            const at = css >= 0 ? css : ts;
            if (at < 0) return;
            const value = valueOf(text, at);
            if (value === "") return;
            const order = Number(value);
            declared.push({ file: relative(import.meta.dir, file), line: i + 1, value, order: Number.isNaN(order) ? -1 : order, where });
        });
    }
}

declared.sort((a, b) => b.order - a.order || a.file.localeCompare(b.file) || a.line - b.line);

const widest = Math.max(...declared.map(d => d.value.length));
for (const d of declared) {
    console.log(`${d.value.padStart(widest)}  ${d.file}:${d.line}  ${d.where}`);
}
console.log(`\n${declared.length} declarations. A value that is not a number is one computed in code or a token; read the line.`);
