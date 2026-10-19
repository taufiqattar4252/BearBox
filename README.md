# BearBox Chrome Extension 🐻📦

> **BearBox** is a modern, modular, script-based Chrome Extension (Manifest V3) that empowers users to create, manage, and run custom scripts matched to target websites. When matching enabled scripts exist for a visited page, a floating, draggable BearBox icon appears on the webpage, granting one-click access to script actions and execution controls.

---

## Table of Contents
- [Product Vision](#product-vision)
- [Key Features](#key-features)
- [Architecture & Security](#architecture--security)
  - [Manifest V3 Compliance](#manifest-v3-compliance)
  - [Shadow DOM Style Isolation](#shadow-dom-style-isolation)
  - [Modular Execution Framework](#modular-execution-framework)
- [Project Structure](#project-structure)
- [Data Schema Documentation](#data-schema-documentation)
- [Website Matching Rule Syntax](#website-matching-rule-syntax)
- [Installation Guide (Chrome Unpacked)](#installation-guide-chrome-unpacked)
- [Development & Build Commands](#development--build-commands)
- [Testing & Quality Verification](#testing--quality-verification)
- [Future Extensibility Guide](#future-extensibility-guide)

---

## Product Vision

BearBox provides a generic, extensible foundation for user scripts:
- **Rule-Driven**: Scripts only appear and execute on the websites configured by the user.
- **Unobtrusive Web UI**: Instead of cluttering page contents, a compact floating BearBox icon appears in the viewport, which users can drag to any position they like.
- **Isolated & Safe**: All injected elements exist inside an open **Shadow DOM**, preventing website styles (resets, Tailwind, Bootstrap) from leaking in or out.
- **Fast Access**: Click the icon to view matching scripts, check status, or trigger manual script runs with instant feedback.
- **Multi-View Experience**: Full Script Manager page, compact Toolbar Popup, and on-page floating UI all synchronize automatically in real time.

---

## Key Features

### 1. Draggable Floating Page Icon
- **Visual Design**: High-contrast, friendly BearBox badge with indicator showing the count of matching active scripts.
- **Pointer Events Dragging**: Drag smoothly with mouse or touch. Clamped inside viewport boundaries so it cannot get lost off-screen.
- **Drag vs. Click**: Distinguishes intentional drags (>5px) from clicks, preventing accidental panel toggling during movement.
- **Position Persistence**: Remembers saved coordinates in `chrome.storage.local` and scales gracefully with viewport resizing.
- **SPA Awareness**: Automatically tracks Single Page Application route changes (`pushState`, `replaceState`, `popstate`), ensuring no duplicate icons appear and rules re-evaluate dynamically.

### 2. Attached Quick-Action Panel
- Opens beside the floating icon with a single click.
- Lists all active scripts matching the current website.
- Displays script names, descriptions, and execution modes (`Manual` vs `Automatic`).
- Instant **"Run"** action for manual execution with live execution feedback.
- Quick enable/disable toggle per script.
- Link to the full Script Manager.

### 3. Extension Toolbar Popup
- Displays active website hostname (e.g. `github.com`, `example.com`).
- One-click site pause toggle (`Active on this website` / `Disabled on this site`).
- List of matching scripts for the active tab with quick toggles.
- Direct entry point to create new scripts pre-filled with the current website's URL pattern.
- Navigation button to the full Script Manager.

### 4. Full Script Manager (`manager.html`)
- Dedicated full-page tab interface (`options_ui`).
- **Dashboard Metrics**: Total scripts, enabled scripts, and active website rules.
- **Live Search & Filter**: Search by name, description, or URL rule, and filter by status (`All`, `Enabled`, `Disabled`).
- **Create & Edit Modal**:
  - Script name and optional description.
  - Website matching rules editor with live pattern validation.
  - JavaScript code editor with line numbers, Tab key indentation, and syntax error checking.
  - Configurable execution mode (`Manual` vs `Automatic`).
  - Extensible JSON configuration editor for script-specific parameters.
- **Delete Confirmation Modal**: Clear warning dialog preventing accidental script loss.
- **Settings View**: Global script enable toggle, disabled hostnames manager, and security documentation.
- **Clean Empty States**: Clean onboarding view on fresh installs (no fake mock scripts).

---

## Architecture & Security

### Manifest V3 Compliance
Chrome Extensions Manifest V3 enforces strict security standards:
- **No Remote Code Execution**: Scripts and bundles are packaged locally in `dist/`.
- **Content Security Policy**: Raw `eval()` is avoided. The service worker handles background coordination without DOM access, while content scripts run in isolated worlds with DOM access.
- **Minimum Permissions**: Uses only `"storage"` and `"activeTab"`.

### Shadow DOM Style Isolation
```
Webpage DOM
└── <div id="bearbox-floating-host">
    └── #shadow-root (open)
        ├── <style> [All BearBox CSS scoped here] </style>
        ├── <button id="bearbox-btn"> [Draggable Icon] </button>
        └── <div id="bearbox-panel"> [Attached Action Panel] </div>
```
No webpage CSS can alter BearBox fonts, margins, or colors, and BearBox styles never bleed into the host webpage.

### Modular Execution Framework
The execution system is decoupled into replaceable adapters via the `IExecutionAdapter` interface:

```typescript
export interface IExecutionAdapter {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  canExecute(script: BearBoxScript, context: ExecutionContext): boolean;
  execute(script: BearBoxScript, context: ExecutionContext): Promise<ExecutionResult>;
}
```

- **`SafeDOMExecutionAdapter`**: Safe execution engine that handles DOM queries, element highlighting, page inspection, structured directives (`// @bearbox:action`), and scoped evaluation.
- **`ExecutionRegistry`**: Central registry supporting multiple runtime adapters and tracking execution state per session (preventing duplicate automatic executions on SPA renders).
- **Graceful Failure Reporting**: Unsupported operations or restricted extension APIs (e.g., `chrome.cookies`) fail clearly with human-readable error messages.

---

## Project Structure

```
BearBox/
├── dist/                          # Production extension build (load this in Chrome)
│   ├── manifest.json              # Valid Manifest V3 configuration
│   ├── popup.html                 # Toolbar popup HTML
│   ├── manager.html               # Full Script Manager HTML
│   ├── background.js              # Service worker (ES module)
│   ├── content.js                 # Content script (IIFE standalone bundle)
│   ├── icons/                     # Extension icons (16, 32, 48, 128)
│   └── assets/                    # React & CSS bundles
├── public/
│   ├── manifest.json              # Source Manifest V3 file
│   ├── icons/                     # Source icon PNGs
│   └── test-page.html             # Live testing / demo simulation page
├── src/
│   ├── background/
│   │   └── index.ts               # Service worker lifecycle & badge coordinator
│   ├── content/
│   │   ├── FloatingUI.ts          # Shadow DOM floating button, dragging & panel
│   │   └── index.ts               # Content script entry, SPA observer & execution
│   ├── components/
│   │   ├── BearBoxLogo.tsx        # High-res vector SVG branding component
│   │   ├── CodeEditor.tsx         # JS editor with line numbers, tabs, syntax check
│   │   ├── ConfirmDeleteModal.tsx # Delete confirmation dialog
│   │   ├── RuleEditor.tsx         # Website matching rule editor with validation
│   │   └── ScriptModal.tsx        # Create & Edit script form modal
│   ├── manager/
│   │   ├── ManagerApp.tsx         # Full Script Manager page application
│   │   └── main.tsx               # Manager React entry
│   ├── popup/
│   │   ├── PopupApp.tsx           # Toolbar popup application
│   │   └── main.tsx               # Popup React entry
│   ├── services/
│   │   ├── executor.ts            # Modular script execution framework & adapters
│   │   ├── matcher.ts             # Chrome match pattern compiler & URL matcher
│   │   └── storage.ts             # Storage service (chrome.storage.local + fallbacks)
│   ├── styles/
│   │   └── theme.css              # BearBox Design System tokens & components
│   └── types/
│       └── script.ts              # Core TypeScript type definitions
├── tests/
│   ├── executor.test.ts           # Unit tests for execution engine
│   ├── integration.test.ts        # Integration test suite for 16 core requirements
│   ├── matcher.test.ts            # Unit tests for website URL pattern matcher
│   └── storage.test.ts            # Unit tests for storage operations & persistence
├── scripts/
│   ├── build-extension.js         # Multi-target bundler (Background ES + Content IIFE)
│   └── generate-icons.js          # Node.js icon generator
├── package.json
├── tsconfig.json
└── vite.config.ts
```

---

## Data Schema Documentation

```typescript
export type ExecutionMode = 'manual' | 'automatic';
export type ScriptRunStatus = 'idle' | 'running' | 'success' | 'error';

export interface ScriptRule {
  id: string;                      // Unique rule identifier (e.g. "rule_1729...")
  pattern: string;                 // Chrome match pattern (e.g. "https://*.github.com/*")
  description?: string;
}

export interface BearBoxScript {
  id: string;                      // Stable unique ID (e.g. "bb_172910...")
  name: string;                    // Script display name
  description?: string;            // Optional description
  sourceCode: string;              // JavaScript source code or structured directives
  rules: ScriptRule[];             // Target website matching rules
  enabled: boolean;                // Master toggle for this script
  executionMode: ExecutionMode;    // 'manual' (click Run) or 'automatic' (on page load)
  config?: Record<string, unknown>;// Extensible JSON configuration
  createdAt: number;               // Timestamp (ms)
  updatedAt: number;               // Timestamp (ms)
  lastRunAt?: number;              // Timestamp of last execution
  lastRunStatus?: ScriptRunStatus; // 'idle' | 'running' | 'success' | 'error'
  lastRunMessage?: string;         // Result summary or error message
}

export interface BearBoxSettings {
  enabledGlobally: boolean;        // Master extension toggle
  disabledHostnames: string[];     // Array of paused hostnames (e.g. ["example.com"])
  showIconOnMatchingPages: boolean;// Toggle floating icon injection
  theme: 'system' | 'light' | 'dark';
}
```

---

## Website Matching Rule Syntax

BearBox uses the standard Chrome match pattern format `<scheme>://<host>/<path>`:

| Pattern | Matches | Does NOT Match |
| :--- | :--- | :--- |
| `https://example.com/*` | `https://example.com/`, `https://example.com/products` | `http://example.com/`, `https://notexample.com/` |
| `https://*.example.com/*` | `https://example.com/`, `https://app.example.com/` | `https://myexample.com/`, `https://example.org/` |
| `*://*.github.com/*` | `https://github.com/torvalds`, `http://github.com/` | `https://gitlab.com/` |
| `https://example.com/products/*` | `https://example.com/products/item-1` | `https://example.com/orders/item-1` |
| `http://localhost:*/*` | `http://localhost:3000/`, `http://localhost:8080/app` | `https://remotehost.com/` |

### Validation Rules:
1. **Scheme**: Must be `http`, `https`, `*`, or `file`.
2. **Host Wildcard**: Must appear at the start as `*.domain.tld` or `*`. Wildcards mid-domain (e.g. `foo.*.bar`) are rejected with clear error feedback.
3. **Path**: Must start with `/` (e.g. `/*`).

---

## Installation Guide (Chrome Unpacked)

1. Open Google Chrome.
2. Navigate to `chrome://extensions/` in the address bar.
3. Enable **Developer mode** toggle in the top-right corner.
4. Click the **Load unpacked** button in the top-left.
5. Select the **`dist`** folder inside the BearBox project directory (`E:\BearBox\dist`).
6. The **BearBox** extension is now installed and active! Pin it to your Chrome toolbar for quick access.

---

## Development & Build Commands

```bash
# Install dependencies
npm install

# Run unit and integration tests (35 passing tests)
npm test

# Build production Chrome extension package
npm run build

# Watch mode for development
npm run dev
```

---

## Testing & Quality Verification

All 16 required test scenarios are covered by automated tests in `tests/`:

```
 ✓ tests/matcher.test.ts (12 tests)
 ✓ tests/storage.test.ts (9 tests)
 ✓ tests/integration.test.ts (9 tests)
 ✓ tests/executor.test.ts (5 tests)

 Test Files  4 passed (4)
      Tests  35 passed (35)
```

### Verified Scenarios:
1. Fresh installation starts with 0 scripts and helpful empty state.
2. User can create, configure, and save scripts with custom IDs and timestamps.
3. Saved scripts persist reliably in storage.
4. User can edit, toggle enable/disable, and delete scripts with confirmation.
5. Website rules validate syntax and explain errors clearly.
6. Matching websites show active script; unrelated websites do not.
7. Disabling scripts removes active matches.
8. Draggable icon position persists and clamps within viewport.
9. Attached panel opens and displays only matching scripts.
10. Execution adapter executes structured actions and reports status.
11. Unauthorized access (e.g. `chrome.cookies`) is blocked with clear errors.
12. SPA navigation route changes re-evaluate without duplicate icons.

---

## Future Extensibility Guide

When you are ready to define the specific purpose of BearBox scripts, the extension is ready:

1. **Plug in a Custom Execution Adapter**:
   Open `src/services/executor.ts`, implement `IExecutionAdapter`, and register it:
   ```typescript
   export class CustomBusinessScriptAdapter implements IExecutionAdapter {
     readonly id = 'custom-business-adapter';
     readonly name = 'My Custom Script Engine';
     readonly description = 'Executes specialized automation routines.';

     canExecute(script: BearBoxScript): boolean {
       return script.enabled;
     }

     async execute(script: BearBoxScript, context: ExecutionContext): Promise<ExecutionResult> {
       // Your custom execution logic (automation, data extraction, API sync)
       return { success: true, scriptId: script.id, timestamp: Date.now(), mode: context.trigger };
     }
   }

   // Register adapter
   executionRegistry.registerAdapter(new CustomBusinessScriptAdapter());
   ```

2. **Custom Script Configuration**:
   The `config` field on `BearBoxScript` already persists arbitrary JSON configuration that your new adapter can consume.

3. **No UI or Storage Rewrites Needed**:
   The popup, script manager, website matching engine, and draggable floating interface will continue working seamlessly with your new execution engine!
