# ci-doctor brand kit

| File | Use |
|---|---|
| `logo/ci-doctor-mark-{dark,light}.svg` + `-512.png` / `-1024.png` | App icon / mark |
| `logo/ci-doctor-wordmark-{dark,light}.svg` + `.png` | Mark + name (dark = for dark backgrounds) |
| `logo/ci-doctor-avatar-{dark,light}-400.png` | Square avatar (safe for circle crops) |
| `ci-doctor-demo.gif` | 1280x720 demo, looping |
| `social/post-card-x-1600x900.png`, `social/post-card-square-1080.png` | Launch post cards |

## Colors

| Name | Hex |
|---|---|
| Navy (background) | `#0B1220` |
| Teal | `#2DD4BF` (light backgrounds: `#0D9488`) |
| Mint | `#34D399` (light backgrounds: `#10B981`) |
| Ink (text on light) | `#0F172A` |
| Off-white (text on dark) | `#F8FAFC` |

## Fonts

- **Space Grotesk** (Bold/Medium/Regular): wordmark and headlines. Copyright 2020 The Space Grotesk Project Authors. SIL Open Font License 1.1, see `fonts/SpaceGrotesk-OFL.txt`.
- **JetBrains Mono** (Regular/Medium/Bold): code and terminal text. Copyright 2020 The JetBrains Mono Project Authors. SIL Open Font License 1.1, see `fonts/JetBrainsMono-OFL.txt`.

Both come from Google Fonts (github.com/google/fonts). Text in the SVG wordmarks is converted to outlines, so the SVGs need no font installed.

## Where the demo text comes from

Every finding in the GIF and the post cards is real ci-doctor output from
[fitzyracing1/jess run 43396327866](https://github.com/fitzyracing1/jess/actions/runs/43396327866)
(passed; 0 errors, 9 warnings, 5 notices). File:line positions come from that run's annotations and a local
re-run of ci-doctor@9a0df89 on jess@495e14b. Long messages are cut with `…`; nothing is reworded.

## Regenerating

`src/logo.py`, `src/gif.py` and `src/cards.py` (Python 3, Pillow, fontTools, cairosvg). They expect the font
files in a `fonts/` folder next to `src/` (static instances made with `fonttools varLib.instancer`), so update the
`B` path at the top of each script.

The mark is original artwork (a pipeline stage feeding a pulse that ends in a check). It uses no third-party logos.
