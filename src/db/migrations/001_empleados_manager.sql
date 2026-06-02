-- ============================================================
--  MIGRACIÓN: tabla de equivalencia legajo ↔ Manager
--  Ejecutar en Supabase > SQL Editor DESPUÉS del schema.sql
-- ============================================================

-- Tabla que conecta cada empleado del portal con su código
-- de cliente en el sistema Manager. Un empleado puede tener
-- un único código de cliente en Manager.
CREATE TABLE empleados_manager (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  empleado_id     UUID        NOT NULL UNIQUE REFERENCES empleados(id) ON DELETE CASCADE,
  manager_codigo  VARCHAR(50) NOT NULL,         -- campo "Codigo" en Manager (JSON CLI)
  activo          BOOLEAN     NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_emp_manager_codigo ON empleados_manager(manager_codigo);
CREATE INDEX idx_emp_manager_empleado ON empleados_manager(empleado_id);

CREATE TRIGGER trg_emp_manager_updated_at
  BEFORE UPDATE ON empleados_manager
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Ejemplo: asociar el empleado de prueba (legajo 001) con
-- el código de cliente "CLI001" en Manager.
-- Reemplazá "CLI001" por el código real.
INSERT INTO empleados_manager (empleado_id, manager_codigo)
SELECT id, 'CLI001'
FROM empleados WHERE legajo = '001';

-- ============================================================
--  VISTA de conveniencia: empleados con su código de Manager
-- ============================================================
CREATE OR REPLACE VIEW v_empleados_con_manager AS
SELECT
  e.id,
  e.legajo,
  e.nombre_completo,
  e.email,
  e.cargo,
  e.area,
  e.activo,
  em.manager_codigo
FROM empleados e
LEFT JOIN empleados_manager em ON em.empleado_id = e.id;
