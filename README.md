# Monk Extensions

Optional block editor extensions built for [Monk](https://monkwp.com) themes and any block-based WordPress theme. Each feature can be turned on or off independently from **Settings → Monk Extensions**.

**Requires:** WordPress 6.4+, PHP 7.4+  
**License:** [GPL-2.0-or-later](https://www.gnu.org/licenses/gpl-2.0.html)

---

## Overview

Monk Extensions adds small, focused enhancements to core blocks. Extensions are packaged as toggleable features so sites can enable only what they need—whether you are running a Monk theme or another block theme.

| Extension | Setting key | Blocks affected |
|-----------|-------------|-----------------|
| Video modal | `video_modal` | `core/cover`, `core/button` |
| Responsive grid breakpoints | `responsive_grid` | `core/group` (grid layout) |
| Paragraph link relations | `paragraph_link_relations` | Paragraph links (`core/link` format) |
| Columns reverse order | `columns_reverse_order` | `core/columns` |

All extensions are **enabled by default** on activation.

---

## Installation

1. Clone or copy this repository into `wp-content/plugins/monk-extensions`.
2. Activate **Monk Extensions** from the WordPress **Plugins** screen.
3. Open **Settings → Monk Extensions** to enable or disable individual features.

```bash
git clone <your-repo-url> wp-content/plugins/monk-extensions
```

Works with Monk themes out of the box and does not require a Monk theme to be active.

---

## Settings

The settings page lives at **Settings → Monk Extensions** and is also linked from the plugin row on the **Plugins** screen.

- Extensions are grouped (currently under **Blocks**).
- Each extension has a toggle on the left with label and description on the right.
- Changes save automatically when you flip a toggle.
- Only enabled extensions register hooks and load assets.

Settings are stored in the `monk_extensions_settings` option.

### REST API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/wp-json/monk-extensions/v1/settings` | `GET` | Current on/off state for all extensions |
| `/wp-json/monk-extensions/v1/settings` | `POST` | Update settings (boolean keys per extension) |
| `/wp-json/monk-extensions/v1/extensions` | `GET` | Extension metadata for the settings UI |

Requires `manage_options` capability.

---

## Extensions

### Video modal

Opens YouTube or uploaded video in an accessible modal with backdrop blur and scroll lock.

**Supported blocks:** Cover, Button

**Editor controls** (block sidebar):

- Enable video modal
- Video source: YouTube URL or media library upload
- YouTube start time (seconds)
- Autoplay when modal opens
- Play icon visibility on Cover blocks (`show` / `hide`)

**Button block style:** Registers a **Video Modal** block style on `core/button`.

**Block attributes** (stored in post content):

- `monkVideoModalEnabled`
- `monkVideoModalType` — `youtube` or `upload`
- `monkVideoModalYoutubeUrl`, `monkVideoModalStart`, `monkVideoModalAutoplay`, `monkVideoModalPlayIcon`
- `monkVideoModalUploadedId`, `monkVideoModalUploadedUrl`

**Frontend:** A single modal container is rendered in the footer. Triggers use `data-monk-video-modal` attributes on the block wrapper.

---

### Responsive grid breakpoints

Adds responsive column/row breakpoints to grid **Group** blocks and per-child span overrides.

**Supported blocks:** `core/group` with `layout.type: grid`

**Block inserter:** Registers a **Responsive grid** variation on Group (minimum column width `12rem`).

**Parent controls** (Group sidebar):

- Define breakpoints where the grid column count or row count changes at specific viewport widths.

**Child controls** (direct grid children):

- Override column/row span at parent breakpoints.
- Inspector shows a summary of the parent’s breakpoint configuration.

**Block attributes:**

- `monkGridBreakpoints` — parent breakpoint definitions
- `monkGridItemSpanBreakpoints` — per-child span overrides
- `monkDirectGridChild` — render-only flag for direct grid children

**Frontend:** Breakpoints are output as scoped CSS via the `render_block` pipeline (`render.php`).

---

### Paragraph link relations

Extends the core link popup in rich text (Paragraph and other blocks using the `core/link` format) with additional `rel` values beyond WordPress defaults.

**Editor behavior:**

- Re-registers the `core/link` format with an extended `LinkControl` settings panel.
- **Additional link relations** checkbox and text field (e.g. `sponsored`, `ugc`).
- Preserves core `rel` tokens (`nofollow`, `noreferrer`, `noopener`) separately from custom values.

**Use case:** SEO and accessibility compliance for affiliate links, sponsored content, and user-generated content without editing HTML manually.

---

### Columns reverse order

Adds a layout toggle to the core **Columns** block.

**Editor controls** (sidebar → Settings, with Columns and Stack on mobile):

- **Reverse column order on desktop** — reverses flex direction on viewports ≥ 782px.
- Mobile layout (≤ 781px) stays in normal column stack order.

**Block attribute:** `reverseOrder` (boolean)

**Frontend class:** `has-reverse-order` on `.wp-block-columns`

---

## Project structure

```
monk-extensions/
├── monk-extensions.php          # Plugin bootstrap
├── README.md
├── assets/
│   └── admin/                   # Settings page (CSS + JS)
├── includes/
│   ├── class-plugin.php         # Registers extensions, boots enabled ones
│   ├── class-extension-registry.php
│   ├── class-settings.php       # Options, REST, admin page
│   ├── interface-extension.php  # Extension contract
│   └── extensions/
│       ├── video-modal/
│       ├── responsive-grid/
│       ├── paragraph-link-relations/
│       └── columns-reverse-order/
```

Each extension folder follows the same pattern:

- `class-*-extension.php` — implements `Extension_Interface`
- `assets/` — editor and/or frontend CSS/JS
- Optional `render.php` for server-side block output (responsive grid)

---

## Development

### Adding a new extension

1. Create `includes/extensions/your-feature/class-your-feature-extension.php` implementing `Extension_Interface`.
2. Add the extension ID to `Settings::defaults()` in `includes/class-settings.php`.
3. Require and register the class in `includes/class-plugin.php`.
4. The settings UI and REST API pick up new extensions automatically via `Extension_Registry`.

### Extension interface

```php
interface Extension_Interface {
    public function get_id();          // Settings key, e.g. 'video_modal'
    public function get_label();       // Display name
    public function get_description(); // Short help text
    public function get_group();       // ['slug' => 'blocks', 'label' => 'Blocks']
    public function register();        // Called only when extension is enabled
}
```

### Building admin assets

The settings page uses WordPress components (`wp.element`, `wp.components`, `wp.data`) and does not require a separate build step. Extension editor scripts are plain IIFE files enqueued with `filemtime()` cache busting.

---

## Compatibility

Monk Extensions is built for Monk themes and works with any block-based theme that uses the WordPress block editor.

- Extensions hook into core blocks only—no Monk theme code is required.
- Block attributes are stored in post content; existing content keeps working when the plugin is active and the relevant extension is enabled.
- Disabling an extension stops loading its assets and hooks but does not remove saved block attributes from content.

---

## Changelog

### 1.0.0

- Initial release.
- Video modal for Cover and Button blocks.
- Responsive grid breakpoints for Group grid layouts.
- Paragraph link relations in the link popup.
- Columns reverse order toggle.
- Gutenberg-style settings page with per-extension toggles and REST API.

---

## Author

[Removement](https://removement.com)
