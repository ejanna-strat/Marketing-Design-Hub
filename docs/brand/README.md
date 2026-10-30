# App icon

The owner's light bulb + fountain pen icon on a blue tile (provided Oct 17; tile recoloured to #3b94e4 on Oct 22).

| File | Used for |
|---|---|
| `icon-master.png` | 512×512 master, transparent corners. Make every other size from this. |
| `src/app/icon.png` | 64×64 browser-tab icon. |
| `src/app/apple-icon.png` | 180×180 iPhone home-screen icon, square on solid blue (iPhones round the corners). |
| `public/brand/logo.png` | 128×128 logo in the top bar and on the sign-in pages. |

Brand colour: `#3b94e4` for buttons, icons and highlights, `#1f6fbf` ("ink") for small blue text (set in `src/config/theme.ts` and `--brand` / `--brand-ink` in `src/app/globals.css`). Emails load the logo from each Supabase project's public `brand` bucket (`logo.png`), so re-upload it there when the icon changes. App name font: Inter, bold.
