# QNTX Web UI

Web interface for [QNTX](https://github.com/teranos/QNTX), built on [@teranos/elements](https://github.com/teranos/elements). It left QNTX's `web/` with its history:

> web needs to leave the repo

> the reason would be to separate the work better

Three things consume `dist/`: a static host ([deploy-web](.github/workflows/deploy-web.yml), called by a deployment), [QNTX-App](https://github.com/teranos/QNTX-App) as its `frontendDist`, and `bun run dev` against any node. The node serves no page.

"web/README.md is still refferring to Elements as the Glyphs System, which is outdated, and perhaps partly owned by Elements"

## Elements

What an element is, the forms it takes (dot, window, panel, workspace, canvas), the tray, melding and how a press, a table and text are drawn are Elements': its [README](https://github.com/teranos/elements/blob/main/README.md), [VISION](https://github.com/teranos/elements/blob/main/VISION.md) and [AXIOMAS](https://github.com/teranos/elements/blob/main/AXIOMAS.md). QNTX's own elements are in `ts/`, registered in `ts/components/element/element-registry.ts`; what QNTX holds them to is [CLAUDE.md](CLAUDE.md).

## Why Web UI

The web UI is essential for QNTX's vision of Continuous Intelligence:
- **Real-time updates** show intelligence evolving as new attestations arrive
- **Foundation for visions** documented in [time-travel](https://github.com/teranos/QNTX/blob/main/docs/vision/time-travel.md)

## Architecture

### Configuration
Ports come from a node's `am.toml`, named by `QNTX_AM_TOML` (or one in this directory):
- `[server].port` - Backend API port (default: 8770)
- `[server].frontend_port` - Development server port (default: 8820)

### The mock: no node at all

> There needs to be a backendless, ats-less laye-less web ui, that only has mock data

> so its trivial for future sessions to work with it fast.

```bash
bun install
bun run mock      # http://localhost:8830
```

`mock/server.ts` stands in for a node. It answers from `mock/world.ts` (who you are, the canvas) and then from `mock/fixtures/<path>.json`; a path with neither is a 404 that names the file to add. Reach is real: `mock/tablet-of-reach` is QNTX's own development tablet, and a path it does not grant your level is a 403, the same as a node. The two WASM modules are not started.

Who you are is a strip at the foot of the page: ROOT, USER or PUBLIC_REGISTRATION, each standing in `pond`. The canvas opens with a note that says it is the mock.

As ROOT the strip has `shake`: the phone's shake, as the mock feels it (`ts/shake.ts`). The element in front gets its chat from below, a drawn stand-in for the shell's snapshot already in the composer, and the mock's agent answers at once naming the element and the picture (`mock/agents.ts`). The agents and `/api/files` are the mock's only writes.

> the mock seems like a valid place to develop out user stories as well

### Running a branch against a deployed node

Which node this machine points at is a property of the machine, so it lives in
`web/.env.local` — untracked, and loaded by Bun on startup:

```bash
QNTX_BACKEND=https://your-node.example.com
QNTX_TOKEN=<access token minted on that node>
```

The dev server stands in for the node. The browser addresses it, it carries the
credential, and the node answers it as the browser it already trusts.

`QNTX_BACKEND` names the node it stands in for — the API host, which a
deployment may serve on a different host from the page.

`QNTX_ORIGIN` names the origin to present, for a node whose `allowed_origins`
is narrower than the `http://localhost` its defaults carry.

The credential is presented by the dev server, not the browser, because the
browser cannot present one. `qntx_session` is `SameSite=Lax` and is withheld
from cross-site XHR, and a WebAuthn ceremony for the node's `rp_id` cannot be
answered by a page on localhost — no configuration on either side changes that.
One server calling another is neither.

Mint the token in the node's own UI (`/auth/tokens` is gated on a session, so a
token cannot mint another). It carries a DID, a minter, a namespace and a scope,
and revoking it lands without a restart — see [ADR-025](https://github.com/teranos/QNTX/blob/main/docs/adr/ADR-025-access-tokens.md).
`QNTX_SESSION` accepts a copied `qntx_session` cookie instead, for a node where
no token has been minted yet.

### Developing a plugin's module from outside the checkout

```bash
QNTX_DEV_PLUGIN_DIRS=pond=/abs/path/to/pond/web,garden=/abs/path/to/garden/dist
```

Each `name=/abs/dir` is served as built, `.js`, `.css` and `.map`, under
`/api/{name}/`, ahead of the node. The page is told the
names as `window.__DEV_PLUGINS__` and probes each for its `glyph-module.js`.

### Runtime Dependencies
- **No NPM required at runtime** - All TypeScript is bundled into `dist/`
- **No Rust required to develop** - the browser WASM is a dependency, built by QNTX's release
- WebSocket for real-time updates
- CodeMirror 6 for the ATS query editor

### Build System: Bun

This project uses **Bun** as a fast bundler and package manager. Bun is chosen because:
- **Fast builds** - 10x faster than npm/webpack
- **Integrated tooling** - Single tool for dependencies, bundling, and runtime
- **Reproducible builds** - Lock file ensures exact versions

## Development Workflow

### Prerequisites
- **Bun** (v1.3.3 or compatible) - [Install Bun](https://bun.sh)
- No Node.js required (Bun is a standalone runtime)

### Building the Bundle

The web assets are bundled into `dist/`:

```bash
bun install              # Install dependencies, the WASM packages among them
bun run build            # Build bundle to dist/
```

`ats-wasm` and `laye-p2p` in `package.json` point at the tarballs QNTX's release
attached. Moving to a newer QNTX is changing that tag and running `bun install`.

### Understanding Dependencies

The `package.json` locks **exact versions** (no `^` or `~`):

```json
{
  "devDependencies": {
    "@codemirror/autocomplete": "6.18.3",    // Exact version
    "@codemirror/commands": "6.7.1",
    "@codemirror/language": "6.10.3",
    "@codemirror/lint": "6.8.2",             // Error/warning linting
    "@codemirror/state": "6.4.1",
    "@codemirror/view": "6.34.3",
    "@lezer/highlight": "1.2.1",
    "d3": "7.9.0"                             // Graph visualization (Prose relationships)
  }
}
```

**Why exact versions?**
- Infrastructure is sacred - every version change is a build change
- Reproducible builds across all developers and CI/CD
- When upgrading, it's deliberate and documented

### Adding or Updating Dependencies

**If you need a new dependency:**

1. **Identify the exact version** you need (check npm.org or documentation)
2. **Update package.json** with the exact version (no `^` or `~`)
3. **Rebuild:**
   ```bash
   bun install    # Updates bun.lock
   bun run build  # Rebuilds bundle
   ```
4. **Test the bundle works** before committing
5. **Document why** in your commit message

**Example:** Adding a new utility library
```json
{
  "devDependencies": {
    "some-lib": "1.2.3"  // Exact version, not "^1.2.3"
  }
}
```

### The Build Process (build.ts)

`build.ts` orchestrates the bundling:

```typescript
// 1. Clean dist/ directory
// 2. Bundle with Bun's bundler
//    - Resolves all imports
//    - Includes dependencies from package.json
//    - Minifies output
// 3. Copy HTML, CSS, fonts, assets
```

### Testing the Bundle

**After rebuilding, always test:**

```bash
# Serve dist/ against a node, with live reload
QNTX_BACKEND=https://api.q.sbvh.nl bun run dev

# Visit the port it prints in a browser
# Verify:
# - Page loads
# - CodeMirror editor appears
# - Graph visualization loads
# - Search/query works
```

## Key Features Enabled

### CodeMirror 6
- Syntax highlighting (semantic tokens)
- Autocomplete
- Error/warning linting (via `@codemirror/lint`)
- Real-time editing with live updates

## Troubleshooting

### "command not found: bun"
Install Bun: https://bun.sh

### Bundle too large?
Check `js/main.js` size after build. If larger than expected:
- Verify dependencies in package.json are necessary
- Check for duplicate imports across files
- Consider lazy-loading less critical features

### Changes not appearing in app
1. Did you run `bun run build`? (Creates dist/)
2. Is what you are looking at serving this dist/? (`bun run dev` does; a deployment or QNTX-App carries its own build)

### Outdated versions causing issues
Check `bun.lock` - if versions don't match package.json:
```bash
bun install  # Resync package.json and bun.lock
```

## Testing

See [TESTING.md](TESTING.md) for full testing documentation.

### Running Tests
```bash
bun test              # Fast tests only (~1.5s)
USE_JSDOM=1 bun test  # All tests including DOM tests (~9s)
```

### Writing DOM Tests
DOM tests using JSDOM are slow. Gate them behind `USE_JSDOM=1` so they only run in CI:

```typescript
// At top of *.dom.test.ts file
const USE_JSDOM = process.env.USE_JSDOM === '1';

describe('YourComponent', () => {
    if (!USE_JSDOM) {
        test.skip('Skipped locally (run with USE_JSDOM=1 to enable)', () => {});
        return;
    }
    // ... your tests
});
```

See test files for examples.
