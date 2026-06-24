# Safe Areas Mobile Plan

Actualizado: 2026-06-07

Este documento define la estrategia global de safe areas para Sailog PWA.
El objetivo es evitar que header, contenido, acciones flotantes, Drawers y
navegacion inferior se pisen con el notch, status bar, teclado o home
indicator en iPhone y Android.

## Decision

Sailog mantiene una PWA edge-to-edge:

- `viewport-fit=cover` queda activo.
- `appleWebApp.statusBarStyle` queda en `black-translucent`.
- La app no detecta modelo de iPhone ni sistema operativo para layout.
- Las zonas seguras se resuelven con `env(safe-area-inset-*)` y variables
  globales compartidas.

La deteccion de OS queda reservada solo para bugs reales no resolubles con
CSS/viewport, por ejemplo un comportamiento puntual del teclado en una version
de iOS PWA.

## Orden De Implementacion

1. Configuracion base de viewport/PWA.
   - Mantener `viewportFit: "cover"` en `src/app/layout.tsx`.
   - Mantener status bar translucid para que la PWA use toda la pantalla.
2. Variables globales de safe area.
   - Definir `--safe-area-top`, `--safe-area-right`,
     `--safe-area-bottom` y `--safe-area-left`.
   - Definir alturas compartidas para header mobile, bottom nav, contenido,
     FABs y Drawers.
3. Mobile Shell.
   - El shell privado mantiene el viewport fijo.
   - Solo scrollea el contenido interno.
   - El padding inferior del contenido sale de la altura del bottom nav y de
     `--safe-area-bottom`.
4. Header mobile.
   - El header suma `--safe-area-top` y cubre visualmente la zona del notch.
   - El breadcrumb nunca debe quedar debajo de la hora/status bar.
5. Contenido critico.
   - Tabs, buscadores y formularios no agregan paddings propios para safe area.
   - Si una pantalla necesita espacio por navegacion fija, usa variables
     globales o componentes compartidos.
6. Bottom actions.
   - FABs y acciones flotantes usan una clase compartida.
   - No se repite `env(safe-area-inset-bottom)` en cada pagina.
7. Drawers y Sheets.
   - `DrawerFooter` y `SheetFooter` respetan safe area inferior desde el
     componente base.
   - Los altos maximos de Drawer usan una variable compartida y `100dvh`.
8. Tests en iOS y Android.
   - Probar PWA instalada en iPhone, Safari iOS, Android Chrome/PWA y desktop.
   - Revisar header, bottom nav, FAB, Drawer y teclado abierto.

## Criterios De Aceptacion

- En iPhone PWA instalada, la hora/notch no pisa breadcrumbs ni tabs.
- En Android, no aparecen paddings dobles cuando los safe-area insets son `0`.
- El bottom nav queda por encima del home indicator.
- Los FABs quedan arriba del bottom nav y no cambian de posicion por pantalla.
- Los Drawers con footer muestran acciones completas aunque haya home indicator.
- No hay hacks por dispositivo ni deteccion preventiva de OS.
