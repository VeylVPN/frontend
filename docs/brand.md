# Brand sync with the website

The website (`VeylVPN/website`) is the visual source of truth. The app keeps its own local copies, so it never loads anything from the website at runtime.

| Website | Desktop |
| --- | --- |
| `frontend/src/assets/main.css` `@theme` colors, radii, shadows, easings | `src/assets/main.css`, same names plus desktop tokens: `base`, `elevated`, `overlay`, `surface`, `idle`, `busy`, `on`, `fail`, and a desktop type scale (`display`, `heading`, `section`, `body`, `small`, `tech`) |
| `components/BrandMark.vue` (pixel V) | `src/components/brand/BrandMark.vue`, copied as is |
| `components/PixelWordmark.vue` | `src/components/brand/BrandWordmark.vue`, the same pixel font with P and N added to spell VEYLVPN, assembling on launch |
| `components/HeroGlobe.vue` | `src/components/connection/PixelGlobe.vue`, rebuilt on real Natural Earth land data with connection states, an atmosphere rim and an orbiting tunnel light |
| `components/HeroOrb.vue` | `src/components/connection/ConnectOrb.vue`, a real button whose lavender fill sweeps closed when the tunnel is up |
| `components/UiButton.vue` primary and secondary | `src/components/ui/UiButton.vue` |
| `components/icons/*` | `src/components/icons/*`, the same 24px, 1.75 stroke, `currentColor` set |
| `public/favicon.svg` | `public/favicon.svg` |
| `scripts/fonts.ts` (Satoshi, pinned SHA-256) | `scripts/fonts.ts`, same file and checksum |
| Copy rules: no eyebrow labels, no em dashes | Followed in every screen |

## Layout

One stage, no dashboard frame: the globe and ring are the app. Server, Devices and Settings open as panels from the right while the stage recedes behind them. The composition follows the Argus references the website is based on: a large timer over dark sky, the globe horizon below it, a single glass action pill and three quiet cards.

## Motion

- Launch: the wordmark pixels assemble, the stage rises in.
- Connect: ripples spread from the ring and the globe spins up; when the tunnel is up the ring fill sweeps closed, a shockwave fires, the timer digits roll in and the cards change over with a stagger.
- Timer: each digit rolls on its own like an odometer. Traffic totals tween between real readings.
- Panels slide in with their sections staggered; cards lift with a cursor spotlight; switches overshoot slightly.

- 150 to 250 ms for controls, 900 ms for connection changes, eased with `--ease-veil` like the website.
- Motion is mostly `transform` and `opacity`. The exceptions are the ring fill sweep (an animated angle) and short blur fades on state text, and they only run during state changes.
- The globe redraws at 60 fps while connecting and 24 fps while protected. It does not redraw when idle, hidden, minimized or in the tray, with reduced motion, or with "Animate the globe" off.

## Keeping them aligned

1. When the website changes a token in `@theme`, copy the value into `src/assets/main.css` under the same name.
2. When the brand mark or favicon changes, copy the file over.
3. When the website's Satoshi checksum changes, update `FONT_SHA256` in `scripts/fonts.ts` the same way.
4. Run `pnpm typecheck` and `pnpm build`.
