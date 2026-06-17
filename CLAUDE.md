# Vibe Gallery — CLAUDE.md

## Project overview
A static HTML/CSS/JS portfolio gallery. No build step, no package.json. Served locally with `python3 -m http.server 8080`.

**Files:**
- `index.html` — the main gallery (Three.js sphere of project cards)
- `editor.html` — local-only GUI editor for `js/data.js`
- `js/main.js` — Three.js scene, drag/interaction, detail page logic
- `js/data.js` — project data array (source of truth for all cards)
- `css/style.css` — all styles

## Running locally
```bash
cd /Users/ianwong/Documents/Claude/Projects/vibe-gallery
python3 -m http.server 8080
```
Then open `http://localhost:8080` (gallery) and `http://localhost:8080/editor.html` (editor).

The editor uses the **File System Access API** — Chrome/Edge/Brave only. When connecting a folder, select the `vibe-gallery` root (the folder containing `index.html`). After saving in the editor, do a hard refresh (`Cmd+Shift+R`) in the gallery tab.

## Project data structure (`js/data.js`)
Each project in `PROJECTS` has:
```js
{
  id: 'kebab-case-string',
  client: 'UPPERCASE STRING',
  title: 'UPPERCASE STRING',
  tags: ['TAG1', 'TAG2'],
  year: '2026',
  accent: '#hex',        // detail page background colour
  ink: '#hex',           // detail page text colour
  highlight: false,      // true = red card treatment (only one at a time)
  img: 'assets/...',     // card image, square-ish (900×900)
  link: '',              // optional live URL — shows "Experience it live ↗" button; leave blank to hide
  images: [
    'assets/...',        // images[0] = hero image on detail page (wide, 1600×900)
    'assets/...',        // images[1+] = extra images below the blurb
  ],
  blurb: 'Description shown on the detail page.',
}
```
Uploaded images are saved to `assets/` via the editor.

## Changes made (session 2026-06-17)

### HUD / navigation cleanup
- Removed **Sound [OFF]** toggle from the top HUD centre
- Removed **San Francisco / Auckland clocks** widget from the top HUD centre
- Removed **Grid / List view toggle** buttons from the bottom HUD
- Removed **Filter** button from the bottom HUD
- Replaced **Work / About / Careers** nav with a single **"Visit Ian's Portfolio"** pill link → `https://ianwongdesign.com/`
- Cleaned up corresponding dead CSS (`.sound-toggle`, `.sound-bars`, `.hud-clocks`, `.view-toggle`, `.vt-btn`, `.filter-btn`, `.bn-item.active`)
- Removed `tickClocks()` and `setInterval` from `main.js`

### "Experience it live" button on detail page
- Added a `link` field to every project in `data.js` (empty string = button hidden)
- Button (`#detail-live-btn`, class `live-btn`) is placed in `index.html` **below the project title, above the `<hr>` divider**
- `populateDetail()` in `main.js` sets the href and toggles `display: none` when `link` is empty
- Styled with `var(--detail-ink)` background and `var(--detail-accent)` text so it adapts per project
- Centre-aligned with `margin: 16px auto 48px` and `width: fit-content`
- Editor (`editor.html`) has a "Live URL" field that serialises `link` into `data.js`

### Detail page title spacing
- Reduced `detail-title` bottom margin from `90px` to `12px` to visually pair the title and live button together
