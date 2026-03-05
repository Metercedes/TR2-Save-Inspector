# Temple Run 2 Save Editor

A web-based save file editor for Temple Run 2. Upload your `gamedata.txt`, make changes through an intuitive UI, and download the modified save with a valid hash.

## Live Site

Visit the live editor at your Netlify domain (for example: `https://<site-name>.netlify.app`).

## Hosting

This is a fully static site — no server required. It runs entirely in your browser.

- **Netlify (recommended)**: Connect this GitHub repository in Netlify and deploy from the root directory.
  - Build command: *(leave empty)*
  - Publish directory: `.`
  - Routing/caching/security headers are already configured in `netlify.toml`.
- **Local**: Open `index.html` in a browser, or use any static file server:

  ```bash
  python3 -m http.server 8080
  ```

## How to Use

### Getting Your Save File

1. On a jailbroken iOS device, locate `gamedata.txt` at:

  ```text
   /var/mobile/Containers/Data/Application/<APP-UUID>/Documents/gamedata.txt
   ```

1. Transfer the file to your computer.

### Editing

1. Open the editor in your browser and upload `gamedata.txt`.
1. Use the UI tabs to make changes (currency, characters, hats, etc.).
1. Click **Download** to get the modified save file.
1. Transfer it back to your device and replace the original.

### Modes

- **Inspect** — View save data (read-only).
- **Edit** — Make changes to your save.

## Features

### Currency

- Set coins, gems, scrolls, keys
- Set Lucky Coin Count (LCC) and Lucky Spin Coin Count (LSCC)
- Max all currency at once

### Characters

- Unlock / remove individual characters
- Unlock / remove all characters
- Set active character
- Set character skins and powers

### Hats & Cosmetics

- Unlock / remove individual hats
- Unlock / remove all hats (preserves character-specific Hair)
- Equip hats on characters
- Batch unlock hats

### Pets

- Unlock / remove individual pets (54 total)
- Unlock / remove all pets

### Artifacts

- Unlock / remove individual artifacts (51 total)
- Unlock / remove all artifacts

### Powers

- Unlock / remove individual powers (7 total)
- Unlock / remove all powers
- Max all power upgrade levels

### Objectives & Progression

- Complete / reset all objectives
- Set player level and score multiplier
- Complete / reset battle pass
- Complete / reset daily challenges
- Complete / reset daily totems
- Complete / reset idol quest
- Complete / reset global challenges
- Complete / reset minigame

### Perks & Potions

- Max / reset all perks (10 perk types)
- Set individual perk levels
- Max / reset all potions (5 potion types)
- Set individual potion counts

### Regions

- Purchase / unpurchase individual regions
- Purchase / unpurchase all regions

### Collectables

- Unlock / lock individual collectables
- Unlock / lock all collectables

### Stats

- Set individual stats (high score, distance, etc.)
- Set daily streak

### Advanced

- Unlock everything at once
- Max account (all items, currencies, levels)
- Randomize values (economy, stats, or both)
- Raw JSON editor for direct field manipulation
- View save diff (changes since upload)
- Validate save integrity before download

### Save Integrity

- Automatic hash recalculation on download
- Pre-download validation catches structural issues
- Sanitization on upload fixes known crash-causing patterns
- Character-specific cosmetics (Hair) are never accidentally removed

## Project Structure

```text
index.html              # Main web app (static, client-side)
engine.js               # Save editor engine (ported from Python)
Config/                 # Game config files (items, objectives, etc.)
  gameConfig.txt        # Master config (characters, hats, pets, etc.)
.nojekyll               # Prevents Jekyll processing on GitHub Pages
```

## Config Files

The `Config/` directory contains game configuration files that define valid item IDs, names, and properties. If the directory is missing, the editor falls back to extracting config data directly from your uploaded save file — so it works without config files, just with less detailed item names.

## Notes

- Everything runs client-side in your browser — no data leaves your device.
- Save files use MD5-based hash verification. The editor recalculates the hash on download so the game accepts the modified file.
- Integer values are capped at safe limits to prevent in-game overflow.
- If the Config files can't be fetched, the editor falls back to extracting config data from the uploaded save file.
