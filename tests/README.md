# Pruebas

## Autorización HTTP con PostgreSQL aislado

Desde la raíz, ejecuta `docker compose -p bcdance-auth-tests -f docker-compose.auth-test.yml run --rm auth-tests`.
Instala el lockfile, aplica las migraciones a `auth-db/dashboard_auth_test` e inicia Vite dentro del contenedor sin publicar puertos. El runner `tests/http/dashboard-authorization.mjs` usa Playwright request y Better Auth con login real; no requiere navegadores ni dependencias nuevas. Su extensión `.mjs` lo mantiene fuera de los globs de Vitest.

Comprueba lecturas anónimas, de usuario y administrador, navegación de datos, rutas codificadas, formularios normales y mejorados, y ausencia de cambios tras inserciones, actualizaciones y eliminaciones rechazadas. Las mismas operaciones del administrador deben persistir. Crea cuentas y fixtures exclusivos en esa base y rechaza cualquier otro host o nombre de base. No usa credenciales ni contenedores de desarrollo/producción. PostgreSQL usa almacenamiento temporal y las dependencias tienen volúmenes propios.

Al terminar, elimina solo este stack con `docker compose -p bcdance-auth-tests -f docker-compose.auth-test.yml down -v`. No ejecutes el runner contra datos reales. Las sesiones incompletas, el no despacho del handler y los roles desconocidos se verifican en las pruebas unitarias del hook.

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

## Programas (`/dashboard/configuraciones/programas`)

- `unit/lib/programs.test.ts`: validación y normalización, campos vacíos o con espacios, errores simultáneos, Unicode, textos largos y valores de edición sin modificar el objeto original.
- `unit/routes/dashboard/configuraciones/programas/page.server.test.ts`: acceso por rol, listado vacío y programas sin clases, consulta con `LEFT JOIN` y conteo de clases, edición, identificadores inválidos, campos ausentes, 404, errores de lectura/escritura y metadatos enviados por el cliente que no deben modificarse.
- `unit/routes/dashboard/configuraciones/programas/program-dialog.svelte.test.ts`: precarga y campos requeridos, validación HTML, cancelación, errores accesibles, valores rechazados, envío real de callbacks, bloqueo durante guardado y reintentos.
- `unit/routes/dashboard/configuraciones/programas/page.svelte.test.ts`: tabla, pluralización del uso en clases, escape de contenido, selección del programa, conservación de conteos al guardar, rechazo de respuestas ajenas al listado, errores y apertura automática del diálogo.

Ejecuta solo este módulo con `pnpm test -- tests/unit/lib/programs.test.ts tests/unit/routes/dashboard/configuraciones/programas`.

La ruta solo expone edición; el alta se realiza desde la creación de clases. El modo `create` de `ProgramDialog` se comprueba únicamente como contrato visual del componente compartido, sin enviar a un endpoint inexistente. Los componentes, validadores y callbacks son reales; se simulan consultas y transporte de formularios. No se verifican persistencia ni restricciones SQL. La suite puede emitir las advertencias conocidas `derived_inert` durante el cierre y reapertura de diálogos.

## Planes de pago (`/dashboard/configuraciones/planes-de-pago`)

- `unit/lib/payment-plans.test.ts`: validación de los tres tipos, precios vacíos/no positivos/no finitos, periodicidades, clases opcionales, horas requeridas, crédito por defecto, limpieza de cantidades ajenas al tipo y valores/etiquetas del formulario.
- `unit/routes/dashboard/configuraciones/planes-de-pago/page.server.test.ts`: acceso por rol, catálogo vacío, serialización, altas y ediciones de las tres modalidades, datos inválidos, identificadores ausentes, 404, fallos de lectura/escritura y actualización exclusiva del catálogo.
- `unit/routes/dashboard/configuraciones/planes-de-pago/payment-plan-dialog.svelte.test.ts`: diálogo de alta y edición, campos dinámicos, periodicidad fija por clase, cantidades requeridas/opcionales, restricciones HTML, errores accesibles, cancelación, callbacks, bloqueo de envío y reintentos.
- `unit/routes/dashboard/configuraciones/planes-de-pago/page.svelte.test.ts`: tabla y estado vacío, cantidades nulas, precios en MXN, escape de contenido, apertura del plan elegido, inserción y sustitución sin duplicados, errores del servidor y conservación del catálogo ante fallos.

Ejecuta solo este módulo con `pnpm test -- tests/unit/lib/payment-plans.test.ts tests/unit/routes/dashboard/configuraciones/planes-de-pago`.

Se ejecutan los componentes, validadores y callbacks reales, simulando consultas y transporte de formularios. La prueba de precios históricos comprueba que la acción modifica únicamente `payment_plans`; no consulta ni modifica pagos existentes y no verifica persistencia contra PostgreSQL. Las advertencias conocidas `derived_inert` pueden aparecer al cerrar y reabrir diálogos.

## Usuarios (`/dashboard/configuraciones/usuarios`)

- `unit/routes/dashboard/configuraciones/usuarios/page.server.test.ts`: permiso exclusivo de administrador, roles ausentes/desconocidos, sesiones incompletas y fallos del padre.
- `unit/routes/dashboard/configuraciones/usuarios/page.svelte.test.ts`: carga pendiente, consulta ordenada con límite de cien, listado, roles y estados, respuestas vacías, errores del proveedor, valores nulos, Unicode, nombres repetidos y escape de HTML.
- `unit/routes/dashboard/configuraciones/usuarios/user-forms.svelte.test.ts`: alta con ambos roles, validación HTML y contraseña de ocho caracteres, edición exclusiva del nombre, cancelación, reinicio de campos, selección por ID, errores y reintentos, bloqueo durante envío y fallo de recarga tras guardar.
- `unit/routes/dashboard/configuraciones/usuarios/user-actions.svelte.test.ts`: promoción/degradación, suspensión/reactivación, errores con/sin mensaje, conservación del estado, eliminación con confirmación, cancelación, bloqueo, reintentos y última cuenta eliminada.

Ejecuta solo este módulo con `pnpm test -- tests/unit/routes/dashboard/configuraciones/usuarios`.

Los componentes, eventos, validación HTML y diálogos compartidos se ejecutan realmente en Chromium. `tests/helpers/users.ts` simula únicamente las respuestas del cliente administrativo de Better Auth; no se crean cuentas ni se verifica el proveedor real, su autorización de endpoints o la persistencia. El control de acceso del servidor se prueba por separado. Las advertencias conocidas `derived_inert` pueden aparecer durante el cierre y reapertura de diálogos.
