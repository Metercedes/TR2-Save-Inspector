# TR2 Save Inspector (Unofficial)

Web-based Temple Run 2 save inspector/editor for local use. Upload a save file, edit supported fields through the UI, and export with a valid hash.

## Important Legal Notice

- This project is **unofficial** and is **not affiliated with, endorsed by, or sponsored by Imangi Studios**.
- "Temple Run" and related marks are trademarks of their respective owners.
- Use this tool only with save files and devices you own, and only where local law and platform terms allow it.
- This repository does **not** ship copyrighted game binaries/assets from the original game.
- Nothing here is legal advice. If you need legal certainty, consult a qualified attorney.

## Requirements

- Python 3.10+
- Flask

Install dependencies:

```bash
python3 -m pip install flask requests
```

## Quick Start

```bash
python3 app.py
```

Open `http://localhost:8080`.

## Core Features

- Currency editing (coins, gems, keys, scrolls, LCC/LSCC)
- Character unlock/remove, active character, skin/power selection
- Hats management with crash-safe sanitization and character-hair protection
- Pets, artifacts, powers, collectables, objectives, regions
- Advanced actions: unlock everything, max account, raw JSON edit, save diff
- Export validation and hash recalculation before download

## Safety Guardrails Included

- Upload-time sanitization for known crash patterns
- Preservation of character-specific Hair cosmetics
- Type-preserving export sanitization
- Session cleanup policy (TTL + max session cap)

## Project Layout

```text
app.py
templates/index.html
Config/
  gameConfig.txt
  Artifacts.txt
  Challenges.txt
  Objectives.txt
  Powers.txt
test_comprehensive.py
gamedata.sample.txt
```

## Test Workflow

Start server:

```bash
python3 app.py
```

Run tests in another terminal:

```bash
python3 test_comprehensive.py
```

`test_comprehensive.py` will use `gamedata.txt` when present, otherwise it falls back to `gamedata.sample.txt`.

## Privacy and Publishing

- `gamedata.txt` is ignored by git to reduce accidental upload of personal save data.
- Keep only synthetic/sanitized samples in public repositories.

## License

Licensed under MIT. See `LICENSE`.
