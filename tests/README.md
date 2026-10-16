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

Las pruebas de integración que requieran base de datos deberán usar una base de datos exclusiva para pruebas.
