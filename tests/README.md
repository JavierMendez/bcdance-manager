# Pruebas

Las pruebas se ejecutan con Vitest y se organizan en:

- `unit/`: pruebas de funciones y lógica aislada. Refleja la estructura de `src/`, por ejemplo `unit/lib/phone.test.ts` para `src/lib/phone.ts`.
- `integration/`: pruebas de interacción entre módulos.

Usa archivos `*.test.ts` o `*.spec.ts` e importa `describe`, `it`, `expect` y los mocks desde `vitest`. El alias `$lib` está disponible mediante la configuración compartida de Vite y SvelteKit.

Todas las pruebas de UI usan Playwright en Chromium mediante Vitest Browser Mode. Nombra estos archivos `*.svelte.test.ts` o `*.svelte.spec.ts` y monta los componentes con `vitest-browser-svelte`. Las demás pruebas se ejecutan en Node.js.

## Comandos

- `pnpm test`: ejecuta las pruebas una vez.
- `pnpm test:watch`: vuelve a ejecutarlas al modificar archivos.
- `pnpm test:unit`: ejecuta únicamente las pruebas de Node.js.
- `pnpm test:ui`: ejecuta únicamente las pruebas de UI con Playwright.
- `pnpm test:install`: instala Chromium antes de la primera ejecución local. En Linux, `pnpm exec playwright install --with-deps chromium` instala también las dependencias del sistema.
- `pnpm test -- tests/unit/routes/login/page.server.test.ts`: ejecuta un archivo específico.

## Docker

Ejecuta toda la suite con `docker compose -f docker-compose.test.yml run --rm tests`. Este servicio usa la imagen oficial de Playwright con Chromium instalado y volúmenes propios para las dependencias y archivos generados de SvelteKit. No requiere iniciar la aplicación ni la base de datos. Al actualizar Playwright, actualiza también la versión de su imagen en `docker-compose.test.yml`.

El contenedor de desarrollo usa Alpine y permite ejecutar `docker compose exec app pnpm test:unit`. Para las pruebas de UI, usa el servicio de pruebas anterior, ya que los navegadores de Playwright requieren un sistema compatible.

## Login

- `unit/routes/login/page.server.test.ts`: acceso sin sesión, sesiones incompletas y redirección al dashboard.
- `unit/lib/components/login-form.svelte.test.ts`: validación HTML, credenciales, navegación, bloqueo durante el envío, errores del proveedor y reintentos.

El cliente de autenticación y `goto` se simulan para aislar el formulario. Estas pruebas no verifican el servicio de autenticación real ni crean sesiones en la base de datos.

La configuración está en `vitest.config.ts`, que comparte los plugins y alias de `vite.config.ts`. La ejecución falla si no se encuentran pruebas.

## Dashboard (`/dashboard`)

- `unit/routes/dashboard/page.svelte.test.ts`: tarjetas de pagos mensuales y full pass, clases del día, accesos rápidos, enlaces por alumno y grupo, estados vacíos, visibilidad de «Ver todos», pluralización, teléfonos ausentes y escape de contenido.
- `unit/lib/dashboard.test.ts`: selección y orden de alumnos por urgencia, planes renovados, alumnos y derechos inactivos, vencimientos exactos, umbral de siete días, horas fraccionarias, pases agotados, límites y totales.
- `unit/routes/dashboard/page.server.test.ts`: transformación de consultas en datos de la página, agrupación de derechos, inscripciones sin duplicados, clases activas por día de México, límites de ambas tarjetas y errores de base de datos.
- `unit/routes/dashboard/layout.server.test.ts`: sesiones completas e incompletas, normalización de roles y rechazo de rutas restringidas.

Ejecuta solo estas pruebas con `pnpm test -- tests/unit/lib/dashboard.test.ts tests/unit/routes/dashboard`.
Las consultas de base de datos se simulan; las funciones de transformación y los componentes de la página se ejecutan sin sustituirlos. No se requieren credenciales, sesiones reales ni una base de datos. Esta cobertura corresponde al inicio `/dashboard` y su control de acceso; los formularios de las subrutas tienen sus propios flujos.

Las pruebas de integración que requieran base de datos deberán usar una base de datos exclusiva para pruebas.

## Alumnos (`/dashboard/alumnos`)

- `unit/lib/students.test.ts`: normalización de nombres y teléfonos, campos obligatorios, errores simultáneos, teléfono opcional, Unicode y fechas del formulario en la zona horaria de México.
- `unit/routes/dashboard/alumnos/page.server.test.ts`: carga y serialización de alumnos, estados de pago y renovaciones, alta, edición, activación/desactivación, validación antes de consultar la base de datos, alumnos inexistentes y fallos de escritura.
- `unit/routes/dashboard/alumnos/page.svelte.test.ts`: tabla y contadores, búsqueda por nombre y teléfono, filtros de estado y pago combinados, estados vacíos, escape de contenido, diálogos de alta y edición, cancelación, validación HTML, errores accesibles, bloqueo durante el envío, reintentos y actualización de la tabla tras guardar o activar un alumno.

Ejecuta solo este módulo con `pnpm test -- tests/unit/lib/students.test.ts tests/unit/routes/dashboard/alumnos`.

Las consultas de base de datos y el transporte de `enhance` se simulan. Los componentes, sus callbacks de envío y la validación se ejecutan realmente en Chromium; los resultados del servidor se controlan desde las pruebas. No se verifica HTTP ni persistencia real y no se necesitan credenciales ni una base de datos.

La ejecución de UI emite advertencias de Svelte `derived_inert` al cerrar y reabrir el diálogo. Las advertencias se mantienen visibles; las aserciones de reapertura, reinicio de campos y envío pasan.
