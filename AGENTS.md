# AGENTS

Documento fuente única para el desarrollo de Sailog.

## 1) Estado actual y foco

Este documento está actualizado para el trabajo que queda por venir.

## 2) Sprint actual: Team Sessions Detail

Foco real: `team-sessions/[id]`, especialmente el tab `Info` existente en el
detalle de sesión.

Item actual:

- UI: Desktop Sheet derecho, Mobile Drawer, header/footer fijos y contenido
  scrolleable para `Edit info`.

Items siguientes:

- UI: estados loading en botones con spinner.
- Performance: Optimistic UI, prefetch, deferred loading en tabs, secondary loading,
  skeletons y loading states.
- Schema: Wind Patterns relacionados a Venue para búsqueda.
- Schema/media: procesar imágenes y analytics files; reducir fotos al menor peso
  posible sin pixelar, con máximo necesario de 720px.

## 3) Qué ya está hecho (no volver a planear como pendiente)

- Foundation del producto migrado: App Router de Next.js + TypeScript + Supabase.
- Reglas de dominio y modelo base ya definidos en DB/RLS.
- Auth + acceso por organización/equipo.
- Núcleo operativo básico (venues, team_venues, camps, sessions).
- UI Fixes.
- UX improvements.
- Performance enhancements ya aplicadas: Optimistic UI, caché, prefetch, loading/secondary loading, skeletons y estados de carga/pending.
- New features ya liberadas: manejo de imágenes, videos y wind patterns.

Todo lo anterior queda **cerrado** y fuera del backlog inmediato salvo que el sprint
actual lo reabra de forma explícita.

## 4) Dominio (reglas congeladas)

1. Organizations own Teams.
2. Teams tienen usuarios con roles (`team_admin`, `coach`, `crew`).
3. Venues son entidades estables (Mismo `venue_id` entre años).
4. `team_venues` es único por `(team_id, venue_id)`.
5. Camps pertenecen a `team_venues`.
6. Sessions pertenecen a Camps.
7. Assessments están fuera del alcance actual.
8. Coach review y crew setup son registros separados.
9. Totales de Camp vienen derivados del detalle de sessions.
10. Gear es fase 2 y no distorsiona el schema MVP.

## 5) Stack y reglas técnicas

- Next.js App Router con componentes server por defecto.
- TypeScript estricto y tipos explícitos (sin `any`).
- Zod para validación de inputs externos cuando aplique.
- UI con shadcn/ui + Tailwind; prioridad móvil operativa.
- Persistencia: Supabase (Auth, Postgres, Storage, RLS).
- Acceso con servidor-first: lógica de permisos y escritura con checks en servidor.
- Migraciones SQL obligatorias para cambios de schema.
- RLS habilitada en tablas públicas.
- Diseñar para integridad relacional, sin sobre-desnormalizar.
- Índices explícitos en FK y filtros de uso frecuente.

## 6) Reglas de producto y PWA

- Prioridad: rendimiento percibido en pantallas operativas.
- Cada vista principal debe tener estado de carga útil (skeleton/loading state).
- Cada acción de guardado debe mostrar estado pending/disabled visible.
- PWA: manifest + service worker + instalación; shell y navegación mobile-first.
- Evitar complejidades fuera de alcance (offline avanzado, automations complejos, workflows genéricos).

## 7) Hoja de ruta próxima (solo pendientes)

### Fase A — Calidad operativa
- Revisar RLS y permisos finos por rol para cubrir edge cases.
- Medir regresiones de performance en pantallas críticas de Camps/Sessions.
- Estandarizar fallback/loading en rutas de edición y vista detalle.
- Consolidar y endurecer tests manuales de flujos de guardado y recuperación de errores.

### Fase B — Analytics operativo v1
- Métricas base orientadas a operación diaria:
  - sessions por camp
  - tiempo total de navegación por camp
  - histórico por equipo/venue/temporada
  - sesiones destacadas
- Filtros simples y confiables para uso diario.

### Fase C — Gear module (fase 2)
- `gear_items`, `session_gear_usage` y flujo mínimo de trazabilidad.

### Fase D — Refinamiento
- Ajustes visuales de detalle móvil y navegación secundaria.
- Mejoras de mantenibilidad del estado compartido entre vistas.

## 8) Estructura objetivo del repo

```text
app/
  (auth)/
  (dashboard)/
  api/
components/
  ui/
  layout/
  shared/
features/
  teams/
  venues/
  team-venues/
  camps/
  sessions/
lib/
  supabase/
  auth/
  db/
  validation/
  permissions/
supabase/
  migrations/
types/
```

## 9) Convención de operación

- Priorizar cambios pequeños y reversibles.
- No introducir abstracciones nuevas si existe patrón reutilizable.
- Mantener comportamiento vigente salvo necesidad explícita.
- Evitar librerías nuevas salvo justificación técnica clara.
- Antes de cambios grandes, validar con la ruta más pequeña posible que habilita la entrega.

## 10) Mobile PWA Rules

- Desktop: sidebar.
- Mobile: bottom navigation + Drawer/Sheet para navegación secundaria.
- Listas: Table en desktop, cards/listas en mobile (fila/carta tappable).
- Forms: una columna en mobile, controles mínimos 44-48px, acción guardar visible/estable.
- Filters: inline en desktop, Sheet en mobile.
- Detail móvil: header claro, acción primaria visible, secciones compactas.
