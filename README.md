# Portal del Empleado

PWA mobile-first para gestión de recibos, cuenta corriente, RRHH y fichaje.

---

## Estructura del proyecto

```
portal-empleado/
├── portal-backend/    ← Node.js + Express + PostgreSQL
└── portal-frontend/   ← React + Vite + PWA
```

---

## 1. Supabase (base de datos + storage)

1. Crear cuenta en https://supabase.com (gratis)
2. Crear nuevo proyecto
3. Ir a **SQL Editor → New query**
4. Pegar el contenido de `portal-backend/src/db/schema.sql` y ejecutar
5. Ir a **Storage → New bucket**, crear un bucket llamado `recibos` (privado)
6. Copiar los siguientes valores desde **Settings → API**:
   - `Project URL` → `SUPABASE_URL`
   - `service_role` key → `SUPABASE_SERVICE_KEY`
7. Copiar `DATABASE_URL` desde **Settings → Database → Connection string → URI**

---

## 2. Backend (Railway)

### Instalación local

```bash
cd portal-backend
cp .env.example .env        # completar las variables
npm install
npm run dev                 # corre en http://localhost:3000
```

### Variables de entorno requeridas

| Variable | Dónde obtenerla |
|---|---|
| `DATABASE_URL` | Supabase → Settings → Database |
| `JWT_SECRET` | Cualquier string largo random |
| `MANAGER_API_URL` | URL base de tu sistema manager |
| `MANAGER_API_KEY` | Token de acceso al manager |
| `SUPABASE_URL` | Supabase → Settings → API |
| `SUPABASE_SERVICE_KEY` | Supabase → Settings → API (service_role) |
| `STORAGE_BUCKET` | `recibos` (el que creaste) |

### Deploy en Railway

1. Crear cuenta en https://railway.app
2. **New Project → Deploy from GitHub repo**
3. Seleccionar la carpeta `portal-backend`
4. Agregar todas las variables de entorno en el panel de Railway
5. Railway detecta el `railway.toml` y hace deploy automático

### Verificar que funciona

```bash
curl https://tu-backend.up.railway.app/health
# → {"ok":true,"version":"1.0.0","timestamp":"..."}
```

---

## 3. Integración con el sistema manager

El archivo clave es `portal-backend/src/services/manager.service.js`.

Buscá los comentarios `TODO` — hay 3 rutas que ajustar:

```js
// Buscar empleado
GET /empleados/${legajo}          ← cambiá por la ruta real de tu manager

// Saldo cuenta corriente
GET /empleados/${legajo}/cuenta-corriente

// Movimientos
GET /empleados/${legajo}/movimientos
```

Los mapeos de campos (`raw.legajo ?? raw.employee_code ?? raw.id_empleado`) ya cubren los nombres más comunes. Si tu manager usa nombres distintos, editá las funciones `mapearEmpleado`, `mapearSaldo` y `mapearMovimiento`.

---

## 4. Frontend (Vercel o Railway)

### Instalación local

```bash
cd portal-frontend
cp .env.example .env
# Editar VITE_API_URL con la URL de tu backend en Railway
npm install
npm run dev                 # corre en http://localhost:5173
```

### Deploy en Vercel (recomendado para el frontend)

```bash
npm install -g vercel
cd portal-frontend
vercel --prod
# Agregar VITE_API_URL en las variables de entorno de Vercel
```

### Instalar como app en el celular

- **Android Chrome**: abrir la URL → menú (⋮) → "Agregar a pantalla de inicio"
- **iPhone Safari**: abrir la URL → compartir (□↑) → "Agregar a pantalla de inicio"

---

## 5. Empleado de prueba (creado por el schema)

| Campo | Valor |
|---|---|
| Legajo | `001` |
| Contraseña | `Portal2025!` |
| Nota | El sistema pedirá cambiar la contraseña en el primer ingreso |

---

## 6. Subir recibos

Por ahora el flujo manual es:
1. Ir a **Supabase → Storage → recibos**
2. Subir el PDF con la ruta: `recibos/legajo-001/2025-03.pdf`
3. Registrar en la base de datos:

```sql
INSERT INTO recibos (empleado_id, periodo, url_archivo, monto_neto)
VALUES (
  (SELECT id FROM empleados WHERE legajo = '001'),
  '2025-03',
  'recibos/legajo-001/2025-03.pdf',
  320000
);
```

En etapa 2 esto se automatiza con un endpoint de admin que sube el PDF y notifica al empleado.

---

## 7. Endpoints disponibles (etapa 1)

```
POST   /auth/login
POST   /auth/refresh
POST   /auth/logout
POST   /auth/cambiar-password

GET    /empleado/perfil

GET    /recibos
GET    /recibos/:id/url

GET    /cuenta-cte/saldo
GET    /cuenta-cte/movimientos
POST   /cuenta-cte/sync

GET    /rrhh/solicitudes
POST   /rrhh/solicitudes
POST   /rrhh/solicitudes/:id/adjunto

GET    /fichajes/estado
GET    /fichajes/semana
POST   /fichajes/entrada
POST   /fichajes/salida
```

---

## Próximos pasos (etapa 2)

- [ ] Panel admin para RRHH (responder solicitudes, subir recibos masivos)
- [ ] Notificaciones push al emitir recibos
- [ ] Cron job de sincronización automática con el manager
- [ ] Fichaje con validación de geolocalización (radio de la oficina)
- [ ] Exportación de fichajes a Excel para liquidación
 
