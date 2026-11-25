# Tokens declarados hoy (inventario para el diff)

Extraído el 2026-11-25 de `src/styles/tokens.css`, `src/styles/landing.css`. Cada línea es token, valor literal y número de línea. La columna de Apple la completa docs/estilo/especificacion-manzana.md.


## Escala tipografica

| Token | Valor | Archivo:línea |
| --- | --- | --- |
| `--fs-xs` | 0.75rem | src/styles/tokens.css:182 |
| `--fs-sm` | 0.8125rem | src/styles/tokens.css:183 |
| `--fs-base` | 1rem | src/styles/tokens.css:184 |
| `--fs-lg` | 1.125rem | src/styles/tokens.css:185 |
| `--fs-xl` | 1.375rem | src/styles/tokens.css:186 |
| `--fs-2xl` | 1.75rem | src/styles/tokens.css:187 |
| `--ios-fs-largeTitle` | 34px | src/styles/tokens.css:409 |
| `--ios-fs-title1` | 28px | src/styles/tokens.css:410 |
| `--ios-fs-title2` | 22px | src/styles/tokens.css:411 |
| `--ios-fs-title3` | 20px | src/styles/tokens.css:412 |
| `--ios-fs-headline` | 17px | src/styles/tokens.css:413 |
| `--ios-fs-body` | 17px | src/styles/tokens.css:414 |
| `--ios-fs-callout` | 16px | src/styles/tokens.css:415 |
| `--ios-fs-subheadline` | 15px | src/styles/tokens.css:416 |
| `--ios-fs-footnote` | 13px | src/styles/tokens.css:417 |
| `--ios-fs-caption1` | 12px | src/styles/tokens.css:418 |
| `--ios-fs-caption2` | 11px | src/styles/tokens.css:419 |
| `--lp-fs-hero` | clamp(2rem, 6.2vw, 4.75rem) | src/styles/landing.css:58 |
| `--lp-fs-seccion` | clamp(2rem, 4.8vw, 3.5rem) | src/styles/landing.css:59 |
| `--lp-fs-beneficio` | clamp(1.375rem, 2.5vw, 2rem) | src/styles/landing.css:60 |
| `--lp-fs-parrafo` | clamp(1.0625rem, 1.55vw, 1.3125rem) | src/styles/landing.css:61 |
| `--lp-fs-cuerpo` | 1.0625rem | src/styles/landing.css:62 |
| `--lp-fs-nota` | 0.75rem | src/styles/landing.css:63 |

## Color y marca

| Token | Valor | Archivo:línea |
| --- | --- | --- |
| `--color-card-brand` | #007AFF | src/styles/tokens.css:35 |
| `--color-bg-primary` | #f2f2f7 | src/styles/tokens.css:51 |
| `--color-bg-primary` | light-dark(#f2f2f7, #000000) | src/styles/tokens.css:52 |
| `--color-text-primary` | #1D1D1F | src/styles/tokens.css:53 |
| `--color-text-primary` | light-dark(#1D1D1F, #FFFFFF) | src/styles/tokens.css:54 |
| `--color-accent` | var(--blink-blue-light) | src/styles/tokens.css:55 |
| `--color-accent` | light-dark(var(--blink-blue-light), var(--blink-blue-dark)) | src/styles/tokens.css:56 |
| `--color-accent-hover` | color-mix(in srgb, var(--blink-blue-light) 82%, #000000) | src/styles/tokens.css:59 |
| `--color-bg-elevated` | #ffffff | src/styles/tokens.css:67 |
| `--color-bg-elevated` | light-dark(#ffffff, #1c1c1e) | src/styles/tokens.css:68 |
| `--color-bg-subtle` | #f2f2f7 | src/styles/tokens.css:69 |
| `--color-bg-subtle` | light-dark(#f2f2f7, #2c2c2e) | src/styles/tokens.css:70 |
| `--color-bg-inset` | #f2f2f7 | src/styles/tokens.css:71 |
| `--color-bg-inset` | light-dark(#f2f2f7, #000000) | src/styles/tokens.css:72 |
| `--color-text-secondary` | #424242 | src/styles/tokens.css:77 |
| `--color-text-secondary` | light-dark(#424242, #ebebf5) | src/styles/tokens.css:78 |
| `--color-text-tertiary` | #6e6e6e | src/styles/tokens.css:82 |
| `--color-text-tertiary` | light-dark(#6e6e6e, #a1a1aa) | src/styles/tokens.css:83 |
| `--color-text-inverse` | #FFFEFB | src/styles/tokens.css:84 |
| `--color-text-inverse` | light-dark(#FFFEFB, #000000) | src/styles/tokens.css:85 |
| `--color-text-on-accent` | #ffffff | src/styles/tokens.css:91 |
| `--color-action-fill` | #0066cc | src/styles/tokens.css:92 |
| `--color-accent-soft` | rgb(from var(--acento) r g b / 0.08) | src/styles/tokens.css:95 |
| `--color-accent-soft` | light-dark(rgb(from var(--acento) r g b / 0.08), rgb(from var(--acento) r g b / 0.18)) | src/styles/tokens.css:96 |
| `--color-accent-soft-strong` | rgb(from var(--acento) r g b / 0.16) | src/styles/tokens.css:97 |
| `--color-accent-soft-strong` | light-dark(rgb(from var(--acento) r g b / 0.16), rgb(from var(--acento) r g b / 0.3)) | src/styles/tokens.css:98 |
| `--color-accent-ring` | rgb(from var(--acento) r g b / 0.25) | src/styles/tokens.css:99 |
| `--color-accent-ring` | light-dark(rgb(from var(--acento) r g b / 0.25), rgb(from var(--acento) r g b / 0.4)) | src/styles/tokens.css:100 |
| `--color-accent-text` | #0066cc | src/styles/tokens.css:106 |
| `--color-accent-text` | light-dark(#0066cc, #8cc7ff) | src/styles/tokens.css:107 |
| `--color-accent-soft-hover` | rgb(from var(--acento) r g b / 0.16) | src/styles/tokens.css:110 |
| `--color-success-text` | #1e7a34 | src/styles/tokens.css:119 |
| `--color-success-text` | light-dark(#1e7a34, #30d158) | src/styles/tokens.css:120 |
| `--color-danger-text` | #c4272b | src/styles/tokens.css:121 |
| `--color-danger-text` | light-dark(#c4272b, #ff4245) | src/styles/tokens.css:122 |
| `--color-warning-soft` | rgba(255, 204, 0, 0.18) | src/styles/tokens.css:125 |
| `--color-warning-soft` | light-dark(rgba(255, 204, 0, 0.18), rgba(255, 214, 0, 0.2)) | src/styles/tokens.css:126 |
| `--color-warning-text` | #6e5200 | src/styles/tokens.css:127 |
| `--color-warning-text` | light-dark(#6e5200, #ffd600) | src/styles/tokens.css:128 |
| `--color-danger-soft` | rgba(255, 56, 60, 0.12) | src/styles/tokens.css:129 |
| `--color-danger-soft` | light-dark(rgba(255, 56, 60, 0.12), rgba(255, 66, 69, 0.16)) | src/styles/tokens.css:130 |
| `--color-danger-soft-text` | #b32025 | src/styles/tokens.css:131 |
| `--color-danger-soft-text` | light-dark(#b32025, #ff6b6e) | src/styles/tokens.css:132 |
| `--color-border` | rgba(66, 66, 66, 0.16) | src/styles/tokens.css:135 |
| `--color-border` | light-dark(rgba(66, 66, 66, 0.16), rgba(235, 235, 245, 0.18)) | src/styles/tokens.css:136 |
| `--color-border-strong` | rgba(66, 66, 66, 0.28) | src/styles/tokens.css:137 |
| `--color-border-strong` | light-dark(rgba(66, 66, 66, 0.28), rgba(235, 235, 245, 0.32)) | src/styles/tokens.css:138 |
| `--color-neutral-soft` | rgba(66, 66, 66, 0.06) | src/styles/tokens.css:141 |
| `--color-neutral-soft` | light-dark(rgba(66, 66, 66, 0.06), rgba(235, 235, 245, 0.07)) | src/styles/tokens.css:142 |
| `--lp-fondo` | #ffffff | src/styles/landing.css:39 |
| `--lp-fondo-alt` | #f2f2f7 | src/styles/landing.css:40 |
| `--lp-texto` | #1d1d1f | src/styles/landing.css:41 |
| `--lp-texto-2` | #424242 | src/styles/landing.css:42 |
| `--lp-texto-3` | #6e6e6e | src/styles/landing.css:43 |
| `--lp-enlace` | #0066cc | src/styles/landing.css:44 |
| `--lp-acento` | #007aff | src/styles/landing.css:45 |
| `--lp-borde` | rgba(66, 66, 66, 0.16) | src/styles/landing.css:46 |
| `--lp-relleno` | rgba(66, 66, 66, 0.06) | src/styles/landing.css:47 |
| `--lp-relleno-fuerte` | rgba(66, 66, 66, 0.1) | src/styles/landing.css:48 |
| `--lp-fondo` | #000000 | src/styles/landing.css:80 |
| `--lp-fondo-alt` | #1c1c1e | src/styles/landing.css:81 |
| `--lp-texto` | #ffffff | src/styles/landing.css:82 |
| `--lp-texto-2` | #ebebf5 | src/styles/landing.css:83 |
| `--lp-texto-3` | #a1a1aa | src/styles/landing.css:84 |
| `--lp-enlace` | #8cc7ff | src/styles/landing.css:85 |
| `--lp-acento` | #0091ff | src/styles/landing.css:86 |
| `--lp-borde` | rgba(235, 235, 245, 0.18) | src/styles/landing.css:87 |
| `--lp-relleno` | rgba(235, 235, 245, 0.07) | src/styles/landing.css:88 |
| `--lp-relleno-fuerte` | rgba(235, 235, 245, 0.12) | src/styles/landing.css:89 |
| `--lp-fondo` | #f2f2f7 | src/styles/landing.css:96 |

## Materiales y desenfoque

| Token | Valor | Archivo:línea |
| --- | --- | --- |
| `--blink-primary` | #007AFF | src/styles/tokens.css:38 |
| `--blink-primary` | light-dark(var(--blink-blue-light), var(--blink-blue-dark)) | src/styles/tokens.css:39 |
| `--color-bg-primary` | #f2f2f7 | src/styles/tokens.css:51 |
| `--color-bg-primary` | light-dark(#f2f2f7, #000000) | src/styles/tokens.css:52 |
| `--color-text-primary` | #1D1D1F | src/styles/tokens.css:53 |
| `--color-text-primary` | light-dark(#1D1D1F, #FFFFFF) | src/styles/tokens.css:54 |
| `--font-primary` | var(--font-pila) | src/styles/tokens.css:173 |
| `--blink-crimson-light` | #ff2d55 | src/styles/tokens.css:195 |
| `--blink-crimson-dark` | #ff375f | src/styles/tokens.css:196 |
| `--ios-material-blur-small` | 6px | src/styles/tokens.css:273 |
| `--ios-material-blur-medium` | 15px | src/styles/tokens.css:274 |
| `--ios-material-blur-large` | 30px | src/styles/tokens.css:275 |
| `--ios-material-blur-clear` | 3px | src/styles/tokens.css:276 |
| `--ios-blur` | var(--ios-material-blur-small) | src/styles/tokens.css:282 |
| `--ios-blur` | light-dark(var(--ios-material-blur-small), var(--ios-material-blur-medium)) | src/styles/tokens.css:283 |
| `--ios-rim` | inset 0 0 0 1px rgb(from var(--halo) r g b / 0.14) | src/styles/tokens.css:287 |
| `--ios-specular` | inset 0 1px 0 rgba(255, 255, 255, 0.72) | src/styles/tokens.css:295 |
| `--ios-specular-soft` | inset 0 1px 0 rgba(255, 255, 255, 0.45) | src/styles/tokens.css:300 |
| `--ios-specular-dark` | inset 0 -1px 0 rgba(66, 66, 66, 0.1) | src/styles/tokens.css:305 |
| `--ios-label-light-primary` | #000000 | src/styles/tokens.css:375 |
| `--ios-label-dark-primary` | #ffffff | src/styles/tokens.css:380 |
| `--ios-fill-light-primary` | #787878 | src/styles/tokens.css:387 |
| `--ios-fill-dark-primary` | #787880 | src/styles/tokens.css:392 |
| `--ios-glass-blur-small` | 6px | src/styles/tokens.css:399 |
| `--ios-glass-blur-medium` | 15px | src/styles/tokens.css:400 |
| `--ios-glass-blur-large` | 30px | src/styles/tokens.css:401 |
| `--ios-glass-bg-light` | #f8f8f8 | src/styles/tokens.css:402 |
| `--ios-glass-bg-dark` | #1a1a1a | src/styles/tokens.css:403 |
| `--ios-glass-bg` | var(--ios-glass-bg-light) | src/styles/tokens.css:405 |
| `--ios-glass-bg` | light-dark(var(--ios-glass-bg-light), var(--ios-glass-bg-dark)) | src/styles/tokens.css:406 |

## Radios, sombras y bordes

| Token | Valor | Archivo:línea |
| --- | --- | --- |
| `--radius-sm` | 8px | src/styles/tokens.css:240 |
| `--radius-md` | 12px | src/styles/tokens.css:241 |
| `--radius-lg` | 18px | src/styles/tokens.css:242 |
| `--radius-pill` | 50px | src/styles/tokens.css:243 |
| `--shadow-card` | 0 1px 2px rgba(66, 66, 66, 0.04) | src/styles/tokens.css:245 |
| `--shadow-pop` | 0 12px 32px rgba(66, 66, 66, 0.18) | src/styles/tokens.css:246 |
| `--shadow-ios-card` | 0 1px 2px rgba(29, 29, 31, 0.04) | src/styles/tokens.css:250 |
| `--shadow-ios-panel` | 0 1px 2px rgba(29, 29, 31, 0.05) | src/styles/tokens.css:259 |
| `--shadow-ios-raised` | 0 1px 2px rgba(29, 29, 31, 0.06) | src/styles/tokens.css:264 |
| `--ios-rim` | inset 0 0 0 1px rgb(from var(--halo) r g b / 0.14) | src/styles/tokens.css:287 |
| `--ios-red-light` | #ff383c | src/styles/tokens.css:358 |
| `--ios-red-dark` | #ff4245 | src/styles/tokens.css:370 |

## Layout y ritmo

| Token | Valor | Archivo:línea |
| --- | --- | --- |
| `--topbar-h` | 56px | src/styles/tokens.css:338 |
| `--page-max` | 1320px | src/styles/tokens.css:340 |
| `--ios-touch-target` | 44px | src/styles/tokens.css:422 |
| `--lp-ancho` | 980px | src/styles/landing.css:65 |
| `--lp-curva` | cubic-bezier(0.32, 0.72, 0, 1) | src/styles/landing.css:66 |

## Total

238 declaraciones: src/styles/tokens.css tiene 197 y src/styles/landing.css tiene 41.
