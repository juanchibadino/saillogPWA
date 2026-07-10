# Category Events Loading Pattern

## Contexto

Este documento describe el patron actual de carga de `/categories/[id]`, especialmente la pestaña `Eventos`.

La sensacion de velocidad no viene de cargar todo mas rapido. Viene de no bloquear la primera pantalla con todo el detalle historico de la categoria, reutilizar cache caliente cuando existe y pedir solo la ventana de eventos necesaria para operar.

## Resumen Del Patron

1. El Server Component hace solo el control minimo:
   - Lee el `scope` del usuario.
   - Valida acceso con `canManageCategoryEvents(scope, categoryId)`.
   - Renderiza `CategoryDetailClient` con `categoryId` y `initialScope`.

2. La UI cliente monta inmediatamente la estructura estable:
   - Tabs `Eventos`, `Jugadores`, `Ligas`.
   - Toolbar de busqueda/filtro/accion.
   - Skeleton inline solo si no hay eventos cacheados.

3. La pestana `Eventos` usa una query especifica y acotada:
   - Query key: `categoryEventsQueryKey(scope, categoryId, { window: "near", limit: 25 })`.
   - Fetch: `GET /api/categories/[id]/events?window=near&limit=25`.
   - Stale time: 5 minutos.
   - Cache time: 24 horas.

4. Antes de esperar a la red, intenta pintar desde cache:
   - `category-event-list` del warmup global.
   - `event-window` del warmup global.
   - Query cache previa de `category-events`.
   - `fallbackDetail.events`, si existe.

5. Despues revalida con TanStack Query:
   - Si habia datos cacheados, la tabla/cards quedan visibles mientras se actualiza.
   - Si no habia datos, muestra `EventsInlineSkeleton`.
   - No bloquea la pagina completa por eventos.

6. Los tabs pesados cargan bajo demanda:
   - `roster` solo se habilita al entrar a `Jugadores` o `Ligas`.
   - `leaguesDetail` solo se habilita al entrar a `Ligas`.
   - `admin-options` solo se habilita al abrir el editor de evento.

## Flujo De Eventos

```txt
/categories/[id]/page.tsx
  -> getCurrentUserScope()
  -> canManageCategoryEvents()
  -> <CategoryDetailClient categoryId initialScope />

CategoryDetailClient
  -> seed desde cache warmup/query cache
  -> render Eventos con datos cacheados si existen
  -> fetch /api/categories/[id]/events?window=near&limit=25
  -> reemplaza/revalida la lista sin desmontar el chrome
```

## Por Que Carga Rapido

- El route server no trae el detalle completo de categoria.
- La pestana inicial es `Eventos`, pero no pide todos los eventos historicos.
- La query de eventos trae una ventana cercana a hoy, no toda la historia.
- La UI puede pintar desde cache antes de que termine el fetch nuevo.
- Jugadores, ligas y opciones de administracion no compiten con la primera carga.
- La pantalla mantiene el chrome montado y usa skeleton inline solo en el area de resultados.
- Los primeros eventos visibles se prefetchan en idle para que abrir `/events/[id]` se sienta mas rapido.

## Ventana Cercana

El backend de eventos, cuando recibe `window=near`, hace dos lecturas paralelas:

- futuros desde hoy hacia adelante, orden ascendente;
- pasados antes de hoy, orden descendente.

Luego une, deduplica, ordena por cercania a hoy y corta al limite pedido.

Con el limite actual:

```ts
const EVENT_PAGE_SIZE = 25;
const CATEGORY_EVENTS_NEAR_OPTIONS = { window: "near", limit: EVENT_PAGE_SIZE };
```

Esto prioriza lo que el usuario probablemente necesita al entrar: proximos eventos y eventos recientes.

## Warmup Global

Al arrancar la app, `AppWarmupGate` espera lo critico:

- scope del usuario;
- lista base de categorias si falta cache critica.

Despues libera la UI y dispara warmup de fondo. Ese warmup llena caches como:

- `event-window` por categoria;
- `category-event-list` por categoria;
- `category-detail-warmup` para jugadores/ligas;
- players warmup;
- resultados recientes.

La pantalla de categoria aprovecha esas caches como `initialData`, no como requisito bloqueante.

## Patron De Cache

Claves relevantes:

- `category-events`: datos canonicos de la pestana Eventos para una categoria y ventana.
- `category-event-list`: lista liviana precaliente por categoria.
- `event-window`: pasado/futuro cercano por categoria.
- `category-detail-warmup`: jugadores, ligas y ligas disponibles precalentadas.

Tiempos actuales:

- eventos: stale 5 minutos;
- eventos: garbage collection 24 horas;
- warmup: cache de larga vida para evitar pantallas frias entre navegaciones.

## Render Incremental

El componente mantiene:

```ts
const [visibleEventLimit, setVisibleEventLimit] = useState(EVENT_PAGE_SIZE);
const displayedEvents = filteredEvents.slice(0, visibleEventLimit);
```

El boton/loader de mas eventos aumenta el limite local de render. No es una paginacion remota infinita. La carga remota principal sigue siendo la ventana cercana.

Esto es importante para copiar el patron correctamente: primero achicar el dataset remoto, despues renderizar en tandas si el dataset local lo necesita.

## Que No Hace

- No bloquea la ruta con `getSupabaseCategoryDetail()` completo.
- No carga roster completo al entrar en Eventos.
- No carga opciones de editor hasta que se necesitan.
- No hace Realtime global de eventos o asistencias.
- No pagina remotamente todos los eventos historicos desde la pestaña Eventos.
- No muestra un loader de pagina completa si hay cache util.

## Checklist Para Replicar En Otro Proyecto

1. Separar route guard/chrome de payload pesado.
2. Elegir una pestaña inicial liviana y operativa.
3. Crear un endpoint especifico para esa pestaña, con payload chico.
4. Si el dominio lo permite, pedir una ventana cercana en vez de toda la historia.
5. Guardar datos precalentados por entidad e inyectarlos como `initialData`.
6. Usar `placeholderData` para mantener UI visible durante revalidaciones.
7. Cargar tabs secundarios con `enabled` condicional.
8. Cargar opciones de formularios solo al abrir el formulario.
9. Usar skeleton inline dentro del area que falta, no bloquear todo el route.
10. Prefetchear detalles de los primeros items visibles en idle.
11. Mantener stale/cache times suficientemente largos para navegacion repetida.
12. Actualizar/invalidatear caches despues de mutaciones.

## Archivos De Referencia En RomaFC

- `src/app/categories/[id]/page.tsx`
- `src/app/categories/[id]/category-detail-client.tsx`
- `src/app/categories/[id]/loading.tsx`
- `src/app/api/categories/[id]/events/route.ts`
- `src/app/api/categories/[id]/summary/route.ts`
- `src/app/api/categories/[id]/roster/route.ts`
- `src/app/api/categories/[id]/leagues/route.ts`
- `src/app/api/categories/[id]/admin-options/route.ts`
- `src/app/api/cache/events/route.ts`
- `src/app/api/cache/category-details/route.ts`
- `src/lib/api/events.ts`
- `src/lib/api/cache.ts`
- `src/lib/data/supabase-data.ts`

## Nombre Corto Del Patron

Cache-first near-window tab loading.

En castellano: carga por ventana cercana con cache caliente y tabs diferidos.
