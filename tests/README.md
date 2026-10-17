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

## Clases (`/dashboard/clases`)

La cobertura incluye las cuatro páginas del módulo y todos sus componentes de negocio. Los componentes compartidos de UI se ejercitan a través de estos flujos.

| Archivo en `unit/routes/dashboard/clases/` | Cobertura |
| --- | --- |
| `pages.svelte.test.ts` | Listado activo/inactivo, contadores, estado vacío, alta desde el listado y las cinco pestañas del detalle: resumen, alumnos, asistencia, pagos y configuraciones. |
| `class-forms.svelte.test.ts` | `ClassCreationWizard` y `ClassSettingsForm`: programa existente/nuevo, pasos, campos obligatorios, múltiples días, estado, fechas opcionales, errores y guardado. |
| `enrollment.svelte.test.ts` | Página de inscripción y `PaymentWizard` en modo inscripción: alumno existente/nuevo, duplicados, planes ausentes, cuatro modalidades, clase fija y descuento del 100 %. |
| `attendance-components.svelte.test.ts` | `AttendanceStatusToggle`, `FullPassStudentPicker` y `DropInQuickRegisterDialog`: marcas guardadas/pendientes, controles bloqueados, búsqueda y exclusión de alumnos, planes ausentes, descuentos, pago con/sin alumno y errores. |
| `attendance-page.svelte.test.ts` | Selección de clase, lista vacía, marcas obligatorias, payload, pagos vencidos, sesiones bloqueadas, agregar/quitar full pass con confirmación y pagos de sesión. |
| `page.server.test.ts` | Carga del listado/detalle, agrupación y contadores, creación con programa existente/nuevo, actualización, validación, 404 y fallos de transacción. |
| `enrollment.server.test.ts` | Carga e inscripción con el helper real de pagos: cuatro modalidades, alumno nuevo, duplicados, datos inválidos y alumnos inexistentes. |
| `attendance.server.test.ts` | Carga de sesión, validación, descuentos y restituciones de horas/créditos, guardado repetido sin doble descuento, pago rápido con/sin asistencia y errores de transacción. |

Además, `unit/lib/classes.test.ts` cubre horarios, fechas, agrupación y contadores, y `unit/lib/attendance.test.ts` cubre parsing de entradas, vigencia histórica, fechas límite y selección de derechos.

Ejecuta solo el módulo con `pnpm test -- tests/unit/lib/classes.test.ts tests/unit/lib/attendance.test.ts tests/unit/routes/dashboard/clases`.

Los helpers en `tests/helpers/` comparten datos y simulan las consultas de Drizzle y el transporte de formularios. Las transformaciones, validadores, callbacks y componentes son reales. Las pruebas no verifican HTTP, restricciones SQL, concurrencia ni rollback de PostgreSQL. No requieren credenciales ni base de datos. Las advertencias `derived_inert` también pueden aparecer durante las pruebas de diálogos de este módulo.

## Pagos (`/dashboard/pagos`)

La cobertura incluye el historial, sus filtros y paginación, la página de registro y los cinco pasos de `PaymentWizard` en modo pago. El mismo asistente en modo inscripción se prueba en el módulo de clases.

| Archivo | Cobertura |
| --- | --- |
| `unit/lib/payments.test.ts` | Parsing y serialización de filtros, páginas inválidas, rangos de fechas, descuentos límite, redondeo, totales de cuatro modalidades, validación de planes/alumnos y fecha de México. |
| `unit/routes/dashboard/pagos/page.server.test.ts` | Serialización, pagos sin alumno, historial vacío, límites y desplazamiento de paginación, filtros compartidos entre conteo y listado, parámetros SQL, escape de comodines y fechas inclusivas en México. |
| `unit/routes/dashboard/pagos/register.server.test.ts` | Catálogos, helper real de registro, cuatro modalidades, pago sin alumno, planes/alumnos inválidos, errores de transacción, descuentos, importes calculados desde catálogo, vigencias y horas/créditos contratados o por defecto. |
| `unit/routes/dashboard/pagos/page.svelte.test.ts` | Tabla, importes y descuentos, estados vacíos, búsqueda con espera de 300 ms, filtros combinados, limpieza, paginación y escape de contenido. |
| `unit/routes/dashboard/pagos/payment-wizard.svelte.test.ts` | Preselecciones por URL, avance/retroceso de cinco pasos, cuatro modalidades, pago sin alumno, catálogos vacíos, validación, confirmación, bloqueo durante envío, errores y reintentos. |

Ejecuta solo este módulo con `pnpm test -- tests/unit/lib/payments.test.ts tests/unit/routes/dashboard/pagos`.

Los catálogos y resultados de consultas se simulan con `tests/helpers/database.ts`. Las condiciones SQL del historial se compilan con el dialecto real de Drizzle para verificar parámetros y filtros; no se ejecutan contra PostgreSQL. La UI usa componentes y callbacks reales con transporte de formularios y navegación simulados. Estas pruebas no verifican persistencia, rollback, concurrencia ni navegación HTTP real y no requieren credenciales.

## Flujo de efectivo (`/dashboard/flujo-de-efectivo`)

| Archivo | Cobertura |
| --- | --- |
| `unit/lib/cash-flow.test.ts` | Presets y rangos personalizados, fechas invertidas, años bisiestos y cambio de año, validación y normalización de ingresos/egresos, saldo por método, categorías, movimientos y puntos diarios/mensuales de gráfica. |
| `unit/routes/dashboard/flujo-de-efectivo/page.server.test.ts` | Carga de pagos, ingresos adicionales y egresos; filtros SQL inclusivos en México; acumulados sin filtro de periodo; altas, eliminaciones, errores y redirección al día de un movimiento fuera del rango. |
| `unit/routes/dashboard/flujo-de-efectivo/dialogs.svelte.test.ts` | `ExpenseDialog` y `AdditionalIncomeDialog`: campos requeridos, montos inválidos, categorías, cancelación, envío, errores, valores previos, bloqueo mientras guarda y reintentos. |
| `unit/routes/dashboard/flujo-de-efectivo/page.svelte.test.ts` | Selector de periodo, saldos, contadores, superávit/déficit, gráfica real de LayerChart, categorías, movimientos con signos, avisos, apertura de diálogos y confirmación de eliminaciones. |

Ejecuta solo este módulo con `pnpm test -- tests/unit/lib/cash-flow.test.ts tests/unit/routes/dashboard/flujo-de-efectivo`.

Los casos de borde incluyen pagos de cero pesos, IDs coincidentes entre fuentes de movimientos, categorías repetidas, fechas límite y cambios de día UTC/México, así como los umbrales de 14/15 y 45/46 días de la gráfica. Los componentes y transformaciones se ejecutan realmente; se simulan el transporte de formularios, navegación y consultas. La compilación SQL usa el dialecto real de Drizzle, sin conexión a PostgreSQL. No se verifican persistencia, restricciones SQL ni concurrencia. Las advertencias conocidas `derived_inert` de los diálogos pueden aparecer durante la ejecución.
