# SpeedSong: frontend y API

React + TypeScript y Laravel 12 + Sanctum 4. PHP 8.2+, Composer y Node 20.19+.
Se actualizó Laravel 10 porque Composer bloqueó sus versiones por avisos de seguridad.

## Ejecutar localmente

En dos terminales desde la raíz:

```powershell
cd backend
php artisan serve --host=localhost --port=8000
```

```powershell
cd frontend
npm.cmd run dev
```

Abre http://localhost:5173. Usa localhost tanto para la API como para el frontend; no lo mezcles con 127.0.0.1.

La instalación local ya tiene migraciones y un administrador creado en SQLite
(`backend/database/database.sqlite`). El correo es `admin@speedsong.local`;
la contraseña inicial está en `ADMIN_PASSWORD` del archivo privado `backend/.env`.
Puedes cambiarla editando tu cuenta en Usuarios. El seeder no restablece cuentas existentes.
MySQL estaba apagado; para usarlo configura DB_CONNECTION=mysql y los DB_* en backend/.env,
crea la base, ejecuta `php artisan config:clear` y `php artisan migrate --seed`.

## URL de la API

`frontend/.env`:

```dotenv
URL_API_KEY=http://localhost:8000/api
```

Es una URL pública, no un secreto. Vite expone exclusivamente esta variable personalizada.
Reinicia Vite al cambiarla; para producción vuelve a ejecutar `npm.cmd run build`.

## Producción

Frontend y API deben compartir dominio principal para la sesión de Sanctum, por ejemplo
https://app.ejemplo.com y https://api.ejemplo.com.

Frontend:

```dotenv
URL_API_KEY=https://api.ejemplo.com/api
```

Backend:

```dotenv
APP_ENV=production
APP_DEBUG=false
APP_URL=https://api.ejemplo.com
FRONTEND_URL=https://app.ejemplo.com
SANCTUM_STATEFUL_DOMAINS=app.ejemplo.com
SESSION_DOMAIN=.ejemplo.com
SESSION_SECURE_COOKIE=true
ADMIN_EMAIL=admin@ejemplo.com
ADMIN_PASSWORD=elige-una-contrasena-unica
```

Configura también DB_* y una APP_KEY propia (`php artisan key:generate` en una instalación nueva).
Publica Laravel con document root en backend/public. Configura el servidor del frontend
para devolver index.html en las rutas de React. Ejecuta `composer install --no-dev`,
`php artisan migrate --seed --force` y `php artisan config:cache`.
No publiques .env ni la base local. FRONTEND_URL permite varios orígenes separados por comas,
sin espacios; SANCTUM_STATEFUL_DOMAINS usa host y puerto, sin protocolo.
Dominios principales distintos requieren un proxy bajo el mismo dominio.

## Autenticación y usuarios

Sesión HttpOnly de Sanctum, protección CSRF, restauración de sesión con /api/user y cierre
de sesión en el servidor. No se guardan tokens en localStorage.
El login está limitado a 5 intentos por minuto por IP.

- GET /sanctum/csrf-cookie: inicializa CSRF.
- POST /api/login: email y password.
- GET /api/user: usuario autenticado.
- POST /api/logout: termina la sesión.
- GET /api/users?search=texto&page=1: listado paginado, administradores.
- POST /api/users: crear.
- GET /api/users/{id}: consultar.
- PUT /api/users/{id}: editar.
- DELETE /api/users/{id}: eliminar.

Crear/editar usa name, email, is_admin, password y password_confirmation.
Al editar, contraseña vacía conserva la actual. Correo único; contraseña mínima de 8 caracteres.
No puedes eliminarte ni quitarte permisos de administrador.
La interfaz incluye búsqueda, paginación, confirmación de eliminación y errores de validación.
Cartera, Más vendidos y las métricas del panel siguen pendientes de conectar.

## Verificación

```powershell
cd backend
php artisan test
cd ../frontend
npm.cmd run build
```

Las pruebas usan SQLite en memoria, sin modificar la base de desarrollo.
## Interfaz, animaciones y avisos

- Lucide identifica acciones, roles, navegación y estados.
- Framer Motion anima páginas, tarjetas, formularios y desplegables, respetando la preferencia de movimiento reducido.
- El navbar permite buscar módulos (Ctrl/Cmd+K), consultar la cuenta y cerrar sesión.
- La campana contiene hasta 40 resultados reales de peticiones durante la sesión actual.
  Permite marcar avisos leídos y limpiar el historial. Se vacía al recargar o cambiar de cuenta;
  no es un servicio de notificaciones persistentes del backend.
- El cliente Axios centraliza Toastify: carga, éxito y error. Las peticiones canceladas se
  descartan y una sesión anónima esperada no se presenta como error.
- Los desplegables se cierran con Escape, al salir con Tab o al pulsar fuera.
- Para personalizar un aviso usa `feedback: { pending: "...", success: "...", history: false }`
  en la configuración Axios. `feedback: false` desactiva los avisos de una petición interna.

Ejecuta `npm.cmd run test:feedback` para comprobar éxito, validación, sesión anónima,
cancelación de peticiones y CSRF sin modificar la base de datos.
## Cierre de caja y apariencia

El módulo /cierre permite a administradores registrar el cierre diario de una caja general.
Los valores son manuales: saldo inicial, ingresos y egresos en efectivo, y efectivo contado.
El servidor calcula esperado = inicial + ingresos - egresos y diferencia = contado - esperado.
Se conservan centavos; no se admiten importes negativos, más de dos decimales, fechas futuras,
saldo esperado negativo ni más de un cierre por fecha. El día se interpreta en America/Bogota.
Los registros son definitivos, con responsable y observaciones; no modifican ventas ni cartera.
Incluye historial paginado y filtro por fecha. La API usa GET y POST /api/cash-closings con Sanctum.
En otra instalación ejecuta php artisan migrate para crear la tabla cash_closings.

Poppins se distribuye localmente con @fontsource/poppins (pesos 400, 500, 600 y 700).
El botón de sol/luna está en el navbar y en el login. La preferencia claro/oscuro se guarda
por navegador en speedsong_theme; inicialmente sigue al sistema. Se aplica antes de renderizar
para evitar un destello claro. También se adapta Toastify y se sincronizan pestañas.
Verificación: npm.cmd run test:theme, npm.cmd run test:feedback y npm.cmd run build.