-- ============================================================
--  PORTAL DEL EMPLEADO · schema.sql
--  Base de datos: PostgreSQL (Supabase)
--  Ejecutar en: Supabase > SQL Editor > New Query
-- ============================================================

-- Extensión para UUIDs
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
--  1. EMPLEADOS
--     Tabla central. Un registro por persona.
--     legajo y dni son únicos y se usan para login.
-- ============================================================
CREATE TABLE empleados (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  legajo           VARCHAR(20) UNIQUE NOT NULL,
  dni              VARCHAR(11) UNIQUE,
  nombre_completo  VARCHAR(120) NOT NULL,
  email            VARCHAR(120),
  telefono         VARCHAR(20),
  cargo            VARCHAR(80),
  area             VARCHAR(80),
  activo           BOOLEAN     NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
--  2. CREDENCIALES
--     Separado de empleados para que RRHH pueda cargar
--     empleados antes de que activen su cuenta.
--     metodo_login: 'legajo' | 'dni' | 'email'
-- ============================================================
CREATE TABLE credenciales (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  empleado_id       UUID        NOT NULL UNIQUE REFERENCES empleados(id) ON DELETE CASCADE,
  hash_password     TEXT        NOT NULL,
  metodo_login      VARCHAR(20) NOT NULL DEFAULT 'legajo',
  debe_cambiar_pass BOOLEAN     NOT NULL DEFAULT true,  -- true en primer login
  ultimo_acceso     TIMESTAMPTZ,
  intentos_fallidos INT         NOT NULL DEFAULT 0,
  bloqueado_hasta   TIMESTAMPTZ,                        -- bloqueo temporal tras N intentos
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
--  3. SESIONES
--     Refresh tokens persistidos. Permite invalidar
--     sesiones por dispositivo sin rotar el JWT_SECRET.
-- ============================================================
CREATE TABLE sesiones (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  empleado_id   UUID        NOT NULL REFERENCES empleados(id) ON DELETE CASCADE,
  refresh_token TEXT        NOT NULL UNIQUE,
  dispositivo   VARCHAR(200),                           -- user-agent resumido
  ip_origen     INET,
  expira_en     TIMESTAMPTZ NOT NULL,
  revocada      BOOLEAN     NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
--  4. RECIBOS DE SUELDO
--     url_archivo: path relativo dentro del bucket.
--     El backend genera signed URLs on-demand (nunca expone
--     el bucket directamente al frontend).
-- ============================================================
CREATE TABLE recibos (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  empleado_id    UUID        NOT NULL REFERENCES empleados(id) ON DELETE CASCADE,
  periodo        VARCHAR(7)  NOT NULL,                 -- formato: '2025-03'
  url_archivo    TEXT        NOT NULL,                 -- ej: 'recibos/legajo-001/2025-03.pdf'
  monto_neto     NUMERIC(12,2),
  notificado     BOOLEAN     NOT NULL DEFAULT false,   -- se marca true al enviar push
  fecha_emision  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (empleado_id, periodo)                        -- un recibo por empleado por mes
);

-- ============================================================
--  5. MOVIMIENTOS DE CUENTA CORRIENTE
--     origen: 'manager_api' | 'manual' | 'sync_cron'
--     manager_ref: ID del movimiento en el sistema manager
--     (evita duplicados en re-sincronizaciones)
-- ============================================================
CREATE TABLE movimientos_cta (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  empleado_id  UUID        NOT NULL REFERENCES empleados(id) ON DELETE CASCADE,
  descripcion  VARCHAR(200) NOT NULL,
  monto        NUMERIC(12,2) NOT NULL,                -- positivo: acreditación, negativo: débito
  tipo         VARCHAR(40) NOT NULL,                  -- 'haberes' | 'anticipo' | 'descuento' | 'otro'
  origen       VARCHAR(20) NOT NULL DEFAULT 'manager_api',
  manager_ref  VARCHAR(100) UNIQUE,                   -- ID externo del manager (para deduplicar)
  fecha        TIMESTAMPTZ NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
--  6. SOLICITUDES A RRHH
--     tipo: 'dia_personal' | 'vacaciones' | 'cert_medico' | 'consulta'
--     estado: 'pendiente' | 'aprobada' | 'rechazada' | 'en_revision'
--     url_adjunto: path en el bucket (nullable)
-- ============================================================
CREATE TABLE solicitudes_rrhh (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  empleado_id     UUID        NOT NULL REFERENCES empleados(id) ON DELETE CASCADE,
  tipo            VARCHAR(40) NOT NULL,
  fecha_solicitada DATE        NOT NULL,
  descripcion     TEXT,
  url_adjunto     TEXT,                               -- certificado médico u otro doc
  estado          VARCHAR(20) NOT NULL DEFAULT 'pendiente',
  respuesta_rrhh  TEXT,                               -- mensaje de respuesta del área
  respondido_por  VARCHAR(120),                       -- nombre del operador de RRHH
  respondido_en   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
--  7. FICHAJES
--     Entrada y salida en el mismo registro.
--     horas_trabajadas se calcula al registrar la salida.
--     Coordenadas GPS opcionales (nullable).
-- ============================================================
CREATE TABLE fichajes (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  empleado_id      UUID        NOT NULL REFERENCES empleados(id) ON DELETE CASCADE,
  entrada          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  salida           TIMESTAMPTZ,
  horas_trabajadas NUMERIC(4,2),                      -- calculado: (salida - entrada) en horas
  lat_entrada      NUMERIC(9,6),
  lng_entrada      NUMERIC(9,6),
  lat_salida       NUMERIC(9,6),
  lng_salida       NUMERIC(9,6),
  estado           VARCHAR(20) NOT NULL DEFAULT 'activo', -- 'activo' | 'cerrado' | 'incompleto'
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
--  8. NOTIFICACIONES
--     tipo: 'recibo_nuevo' | 'solicitud_respondida' |
--           'fichaje_recordatorio' | 'sistema'
-- ============================================================
CREATE TABLE notificaciones (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  empleado_id  UUID        NOT NULL REFERENCES empleados(id) ON DELETE CASCADE,
  tipo         VARCHAR(40) NOT NULL,
  titulo       VARCHAR(100) NOT NULL,
  cuerpo       TEXT        NOT NULL,
  leida        BOOLEAN     NOT NULL DEFAULT false,
  referencia   UUID,                                  -- ID del recibo, solicitud, etc.
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
--  9. PUSH SUBSCRIPTIONS
--     Guarda los tokens de Web Push por dispositivo.
--     Un empleado puede tener múltiples dispositivos.
-- ============================================================
CREATE TABLE push_subscriptions (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  empleado_id  UUID        NOT NULL REFERENCES empleados(id) ON DELETE CASCADE,
  endpoint     TEXT        NOT NULL UNIQUE,
  p256dh       TEXT        NOT NULL,
  auth         TEXT        NOT NULL,
  activo       BOOLEAN     NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
--  ÍNDICES
--  Solo los necesarios para las queries más frecuentes.
-- ============================================================
CREATE INDEX idx_sesiones_empleado    ON sesiones(empleado_id);
CREATE INDEX idx_sesiones_token       ON sesiones(refresh_token);
CREATE INDEX idx_recibos_empleado     ON recibos(empleado_id);
CREATE INDEX idx_movimientos_empleado ON movimientos_cta(empleado_id);
CREATE INDEX idx_movimientos_fecha    ON movimientos_cta(fecha DESC);
CREATE INDEX idx_solicitudes_empleado ON solicitudes_rrhh(empleado_id);
CREATE INDEX idx_solicitudes_estado   ON solicitudes_rrhh(estado);
CREATE INDEX idx_fichajes_empleado    ON fichajes(empleado_id);
CREATE INDEX idx_fichajes_entrada     ON fichajes(entrada DESC);
CREATE INDEX idx_notif_empleado       ON notificaciones(empleado_id);
CREATE INDEX idx_notif_leida          ON notificaciones(leida) WHERE leida = false;

-- ============================================================
--  FUNCIÓN: actualiza updated_at automáticamente
-- ============================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_empleados_updated_at
  BEFORE UPDATE ON empleados
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_credenciales_updated_at
  BEFORE UPDATE ON credenciales
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_solicitudes_updated_at
  BEFORE UPDATE ON solicitudes_rrhh
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
--  FUNCIÓN: calcula horas_trabajadas al registrar salida
-- ============================================================
CREATE OR REPLACE FUNCTION calcular_horas_trabajadas()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.salida IS NOT NULL AND OLD.salida IS NULL THEN
    NEW.horas_trabajadas = ROUND(
      EXTRACT(EPOCH FROM (NEW.salida - NEW.entrada)) / 3600.0,
      2
    );
    NEW.estado = 'cerrado';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_fichajes_horas
  BEFORE UPDATE ON fichajes
  FOR EACH ROW EXECUTE FUNCTION calcular_horas_trabajadas();

-- ============================================================
--  DATOS INICIALES · empleado de prueba
--  Password: 'Portal2025!' (bcrypt, cost 10)
--  Cambiar antes de producción.
-- ============================================================
INSERT INTO empleados (legajo, dni, nombre_completo, email, cargo, area)
VALUES ('001', '20123456', 'María García', 'maria.garcia@empresa.com', 'Analista', 'Administración');

INSERT INTO credenciales (empleado_id, hash_password, metodo_login, debe_cambiar_pass)
SELECT id,
       '$2b$10$X9z3v8mK2nL4pQ7rW1tYuOeHsGfDjCbNvMxIqA5kR6lT0wP8sEyZi',
       'legajo',
       true
FROM empleados WHERE legajo = '001';

-- ============================================================
--  ROW LEVEL SECURITY (RLS) — habilitar en Supabase
--  Cada empleado solo ve sus propios datos.
-- ============================================================
ALTER TABLE recibos           ENABLE ROW LEVEL SECURITY;
ALTER TABLE movimientos_cta   ENABLE ROW LEVEL SECURITY;
ALTER TABLE solicitudes_rrhh  ENABLE ROW LEVEL SECURITY;
ALTER TABLE fichajes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE notificaciones    ENABLE ROW LEVEL SECURITY;

-- Política base: el empleado solo accede a sus filas
-- (el backend usa service_role key, estas políticas aplican
--  solo si algún día usás el cliente de Supabase directo)
CREATE POLICY "empleado_own_recibos"
  ON recibos FOR SELECT
  USING (empleado_id::text = current_setting('app.empleado_id', true));

CREATE POLICY "empleado_own_movimientos"
  ON movimientos_cta FOR SELECT
  USING (empleado_id::text = current_setting('app.empleado_id', true));

CREATE POLICY "empleado_own_solicitudes"
  ON solicitudes_rrhh FOR ALL
  USING (empleado_id::text = current_setting('app.empleado_id', true));

CREATE POLICY "empleado_own_fichajes"
  ON fichajes FOR ALL
  USING (empleado_id::text = current_setting('app.empleado_id', true));

CREATE POLICY "empleado_own_notificaciones"
  ON notificaciones FOR ALL
  USING (empleado_id::text = current_setting('app.empleado_id', true));
