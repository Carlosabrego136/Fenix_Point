-- ═══════════════════════════════════════════════════════════════
--  Fénix Point · esquema inicial
--  Flujo: el cliente captura por QR (EN ESPERA, sin folio) → el mostrador marca "Recibido"
--  (se asigna el folio, sin huecos) → "Finalizado" (solo admin). Los envíos jamás se borran.
-- ═══════════════════════════════════════════════════════════════

-- Esta base debe ser propia de Fénix Point: si ya hay tablas de otro sistema, se detiene.
DO $$
BEGIN
  IF to_regclass('public.users') IS NOT NULL OR to_regclass('public.audit_log') IS NOT NULL THEN
    RAISE EXCEPTION 'Esta base de datos ya contiene tablas de otro sistema. Fénix Point debe usar su propia base de datos.';
  END IF;
END $$;

CREATE FUNCTION touch_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$;

-- ── Usuarios (admin y operador; el cliente final NO tiene cuenta) ──
CREATE TABLE users (
  id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  username         TEXT        NOT NULL CHECK (username ~ '^[a-z0-9._-]{3,30}$'),
  name             TEXT        NOT NULL CHECK (char_length(btrim(name)) BETWEEN 2 AND 80),
  role             TEXT        NOT NULL CHECK (role IN ('admin', 'operador')),
  password_hash    TEXT        NOT NULL,
  is_active        BOOLEAN     NOT NULL DEFAULT TRUE,
  failed_attempts  INTEGER     NOT NULL DEFAULT 0,
  locked_until     TIMESTAMPTZ,
  token_version    INTEGER     NOT NULL DEFAULT 0,
  last_login_at    TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX users_username_uidx ON users (lower(username));
CREATE TRIGGER users_touch BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TABLE login_attempts (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  username    TEXT        NOT NULL,
  ip_hash     TEXT        NOT NULL,
  success     BOOLEAN     NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX login_attempts_ip_idx   ON login_attempts (ip_hash, created_at DESC);
CREATE INDEX login_attempts_user_idx ON login_attempts (lower(username), created_at DESC);

-- ── Bitácora inmutable ──
CREATE TABLE audit_log (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor_id        BIGINT,
  actor_username  TEXT        NOT NULL DEFAULT 'sistema',
  actor_name      TEXT        NOT NULL DEFAULT 'Sistema',
  actor_role      TEXT        NOT NULL DEFAULT 'system',
  action          TEXT        NOT NULL,
  entity          TEXT        NOT NULL,
  entity_id       TEXT        NOT NULL DEFAULT '',
  summary         TEXT        NOT NULL DEFAULT '',
  before_data     JSONB,
  after_data      JSONB,
  ip_hash         TEXT        NOT NULL DEFAULT '',
  user_agent      TEXT        NOT NULL DEFAULT ''
);
CREATE INDEX audit_log_created_idx ON audit_log (created_at DESC);
CREATE INDEX audit_log_entity_idx  ON audit_log (entity, entity_id, created_at DESC);

CREATE FUNCTION audit_log_block_changes() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_log es inmutable: no se permite % sobre la bitácora', TG_OP
    USING ERRCODE = 'insufficient_privilege';
END $$;
CREATE TRIGGER audit_log_no_update_delete BEFORE UPDATE OR DELETE ON audit_log FOR EACH ROW EXECUTE FUNCTION audit_log_block_changes();
CREATE TRIGGER audit_log_no_truncate BEFORE TRUNCATE ON audit_log FOR EACH STATEMENT EXECUTE FUNCTION audit_log_block_changes();

-- ── Ajustes (clave/valor editable desde el panel) ──
CREATE TABLE settings (
  key         TEXT PRIMARY KEY,
  value       TEXT        NOT NULL DEFAULT '',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by  BIGINT REFERENCES users (id) ON DELETE SET NULL
);
CREATE TRIGGER settings_touch BEFORE UPDATE ON settings FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

INSERT INTO settings (key, value) VALUES
  ('timezone', 'America/Tijuana'),
  ('label_branch_title', 'Entrega en'),
  ('label_note', ''),
  ('wa_message', E'Hola {remitente}, su paquete quedó registrado con el folio {folio}.\nRecibe: {destinatario}\nPunto de entrega: {sucursal}\nTamaño: {tamano}\nCosto: {precio} ({estado_pago})\nGracias por su preferencia.');

-- ── Puntos de recolección (editables; no se borran, se desactivan) ──
CREATE TABLE branches (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name        TEXT        NOT NULL CHECK (char_length(btrim(name)) BETWEEN 2 AND 80),
  sort_order  INTEGER     NOT NULL DEFAULT 0,
  is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX branches_name_uidx ON branches (lower(name));
CREATE TRIGGER branches_touch BEFORE UPDATE ON branches FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
INSERT INTO branches (name, sort_order) VALUES ('5 y 10 Tijuana', 1), ('Ensenada Bustamante', 2);

-- ── Tamaños y precios (A/B/C + servicios especiales) ──
CREATE TABLE sizes (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name         TEXT          NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 60),
  description  TEXT          NOT NULL DEFAULT '' CHECK (char_length(description) <= 120),
  price        NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
  show_public  BOOLEAN       NOT NULL DEFAULT TRUE,
  sort_order   INTEGER       NOT NULL DEFAULT 0,
  is_active    BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX sizes_name_uidx ON sizes (lower(name));
CREATE TRIGGER sizes_touch BEFORE UPDATE ON sizes FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
INSERT INTO sizes (name, price, show_public, sort_order) VALUES
  ('Tamaño A', 15, TRUE, 1),
  ('Tamaño B', 30, TRUE, 2),
  ('Tamaño C', 45, TRUE, 3),
  ('Especial hasta 15 kg', 250, FALSE, 4),
  ('Especial hasta 30 kg', 300, FALSE, 5);

-- ── Contador de folios (una sola fila; se incrementa en la MISMA transacción que "Recibido") ──
CREATE TABLE folio_counter (
  id           SMALLINT PRIMARY KEY CHECK (id = 1),
  last_number  INTEGER NOT NULL DEFAULT 0 CHECK (last_number BETWEEN 0 AND 99999)
);
INSERT INTO folio_counter (id, last_number) VALUES (1, 0);

-- ── Envíos ──
CREATE TABLE envios (
  id                 BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  request_id         UUID        NOT NULL,
  short_code         TEXT        NOT NULL CHECK (short_code ~ '^[0-9]{4}$'),
  status             TEXT        NOT NULL DEFAULT 'en_espera' CHECK (status IN ('en_espera', 'recibido', 'finalizado', 'cancelado')),
  sender_name        TEXT        NOT NULL CHECK (char_length(btrim(sender_name)) BETWEEN 2 AND 100),
  sender_phone       TEXT        NOT NULL DEFAULT '',
  recipient_name     TEXT        NOT NULL CHECK (char_length(btrim(recipient_name)) BETWEEN 2 AND 100),
  branch_id          BIGINT      REFERENCES branches (id) ON DELETE SET NULL,
  branch             TEXT        NOT NULL,
  size_hint          TEXT        NOT NULL DEFAULT '',
  weight_kg          NUMERIC(6, 2) CHECK (weight_kg IS NULL OR (weight_kg > 0 AND weight_kg <= 1000)),
  size_id            BIGINT      REFERENCES sizes (id) ON DELETE SET NULL,
  size_name          TEXT        NOT NULL DEFAULT '',
  price              NUMERIC(10, 2) CHECK (price IS NULL OR price >= 0),
  paid               BOOLEAN     NOT NULL DEFAULT FALSE,
  paid_at            TIMESTAMPTZ,
  notes              TEXT        NOT NULL DEFAULT '',
  folio_number       INTEGER     CHECK (folio_number BETWEEN 1 AND 99999),
  ip_hash            TEXT        NOT NULL DEFAULT '',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  received_at        TIMESTAMPTZ,
  received_by        BIGINT      REFERENCES users (id) ON DELETE SET NULL,
  received_by_name   TEXT        NOT NULL DEFAULT '',
  finalized_at       TIMESTAMPTZ,
  finalized_by_name  TEXT        NOT NULL DEFAULT '',
  cancel_reason      TEXT        NOT NULL DEFAULT '',
  cancelled_at       TIMESTAMPTZ,
  cancelled_by       TEXT        NOT NULL DEFAULT '',
  CONSTRAINT envios_espera_chk   CHECK (status <> 'en_espera' OR folio_number IS NULL),
  CONSTRAINT envios_recibido_chk CHECK (status NOT IN ('recibido', 'finalizado')
                                        OR (folio_number IS NOT NULL AND size_name <> '' AND price IS NOT NULL AND received_at IS NOT NULL)),
  CONSTRAINT envios_cancel_chk   CHECK (status <> 'cancelado' OR (cancel_reason <> '' AND cancelled_at IS NOT NULL))
);
CREATE UNIQUE INDEX envios_request_uidx ON envios (request_id);
CREATE UNIQUE INDEX envios_folio_uidx   ON envios (folio_number) WHERE folio_number IS NOT NULL;
-- El código corto de 4 dígitos es único entre los envíos que siguen EN ESPERA (después se puede reutilizar).
CREATE UNIQUE INDEX envios_code_wait_uidx ON envios (short_code) WHERE status = 'en_espera';
CREATE INDEX envios_status_created_idx ON envios (status, created_at DESC);
CREATE INDEX envios_received_idx       ON envios (received_at DESC) WHERE received_at IS NOT NULL;
CREATE INDEX envios_ip_idx             ON envios (ip_hash, created_at DESC);

-- Integridad: nada se borra; el folio se asigna una sola vez (al recibir) y nunca cambia;
-- los estados solo avanzan (en_espera → recibido → finalizado) o terminan en cancelado; finalizado y cancelado quedan congelados.
CREATE FUNCTION envios_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' OR TG_OP = 'TRUNCATE' THEN
    RAISE EXCEPTION 'Los envíos no se eliminan: descártelos o cancélelos con un motivo.' USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  IF NEW.request_id <> OLD.request_id OR NEW.created_at <> OLD.created_at THEN
    RAISE EXCEPTION 'La solicitud y la fecha de captura no se pueden cambiar.' USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  IF OLD.status IN ('cancelado', 'finalizado') THEN
    RAISE EXCEPTION 'Un envío % ya no se puede modificar.', OLD.status USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  IF OLD.folio_number IS NOT NULL AND NEW.folio_number IS DISTINCT FROM OLD.folio_number THEN
    RAISE EXCEPTION 'El folio no se puede cambiar.' USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  IF OLD.folio_number IS NULL AND NEW.folio_number IS NOT NULL AND NOT (OLD.status = 'en_espera' AND NEW.status = 'recibido') THEN
    RAISE EXCEPTION 'El folio solo se asigna al marcar el envío como recibido.' USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  IF NEW.status <> OLD.status
     AND NOT ((OLD.status = 'en_espera' AND NEW.status IN ('recibido', 'cancelado'))
           OR (OLD.status = 'recibido'  AND NEW.status IN ('finalizado', 'cancelado'))) THEN
    RAISE EXCEPTION 'Cambio de estado no permitido (% → %).', OLD.status, NEW.status USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER envios_no_delete   BEFORE DELETE   ON envios FOR EACH ROW       EXECUTE FUNCTION envios_guard();
CREATE TRIGGER envios_no_truncate BEFORE TRUNCATE ON envios FOR EACH STATEMENT EXECUTE FUNCTION envios_guard();
CREATE TRIGGER envios_protect     BEFORE UPDATE   ON envios FOR EACH ROW       EXECUTE FUNCTION envios_guard();
CREATE TRIGGER envios_touch       BEFORE UPDATE   ON envios FOR EACH ROW       EXECUTE FUNCTION touch_updated_at();
