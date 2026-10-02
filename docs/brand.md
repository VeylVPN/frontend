# Brand sync with the website

The website (`VeylVPN/website`) is the visual source of truth. The app keeps its own local copies, so it never loads anything from the website at runtime.

| Website | Desktop |
| --- | --- |
| `frontend/src/assets/main.css` `@theme` colors, radii, shadows, easings | `src/assets/main.css`, same names plus desktop tokens: `base`, `elevated`, `overlay`, `surface`, `idle`, `busy`, `on`, `fail`, and a desktop type scale (`display`, `heading`, `section`, `body`, `small`, `tech`) |
| `components/BrandMark.vue` (pixel V) | `src/components/brand/BrandMark.vue`, copied as is |
| `components/BrandLogo.vue` | `src/components/brand/BrandLogo.vue`, smaller |
| `components/HeroGlobe.vue` | `src/components/connection/PixelGlobe.vue`, rebuilt on real Natural Earth land data with connection states, an atmosphere rim and an orbiting tunnel light |
| `components/HeroOrb.vue` | `src/components/connection/ConnectOrb.vue`, a real button with connection states |
| `components/UiButton.vue` primary and secondary | `src/components/ui/UiButton.vue` |
| `components/icons/*` | `src/components/icons/*`, the same 24px, 1.75 stroke, `currentColor` set |
| `public/favicon.svg` | `public/favicon.svg` |
| `scripts/fonts.ts` (Satoshi, pinned SHA-256) | `scripts/fonts.ts`, same file and checksum |
| Copy rules: no eyebrow labels, no em dashes | Followed in every screen |

## Motion

- 150 to 250 ms for controls, 900 ms for connection changes, eased with `--ease-veil` like the website.
- Only `transform` and `opacity` animate, plus short blur fades on state text.
- The globe redraws at 60 fps while connecting, 24 fps while protected, not at all when idle, hidden, minimized or in the tray, and never with reduced motion or with "Animate the globe" off.

## Keeping them aligned

1. When the website changes a token in `@theme`, copy the value into `src/assets/main.css` under the same name.
2. When the brand mark or favicon changes, copy the file over.
3. When the website's Satoshi checksum changes, update `FONT_SHA256` in `scripts/fonts.ts` the same way.
4. Run `pnpm typecheck` and `pnpm build`.
