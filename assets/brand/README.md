# OxVault artwork

The OxVault icon is original artwork made for this project: the solid lambda (one filled path, no strokes, #0F766E teal ground).

- `OxVault.icon/`: editable Icon Composer document and its glyph.
- `source/oxvault-glyph.svg`: foreground vector.
- `source/flat-icon.svg`: full icon. Every PNG below is rendered from this file via `render.sh`.
- `render.sh`: render script producing the icon assets from `source/flat-icon.svg`.
- `macos/icon-{16,32,64,128,256,512,1024}.png`: default macOS icon sizes. The native build generates the asset catalog and ICNS used by the app and AutoFill provider.
- `../../apps/extension/public/icon-{16,32,48,128}.png`: browser toolbar icons.
- `../../apps/raycast/assets/icon.png`: Raycast icon.
