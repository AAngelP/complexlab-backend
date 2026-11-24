CREATE TABLE IF NOT EXISTS usuario (
    id_usuario BIGSERIAL PRIMARY KEY,
    nombre_usuario VARCHAR(30) NOT NULL UNIQUE,
    correo TEXT NOT NULL,
    password_hash CHAR(64) NOT NULL,
    password_salt CHAR(32) NOT NULL,
    correo_verificado BOOLEAN NOT NULL DEFAULT FALSE
);

-- Registro temporal: los datos permanecen aquí mientras el usuario
-- todavía no ha demostrado que controla el correo.
CREATE TABLE IF NOT EXISTS registro_pendiente (
    id_pendiente BIGSERIAL PRIMARY KEY,
    nombre_usuario VARCHAR(30) NOT NULL,
    correo TEXT NOT NULL,
    password_hash CHAR(64) NOT NULL,
    password_salt CHAR(32) NOT NULL,
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_registro_pendiente_usuario
    ON registro_pendiente (LOWER(nombre_usuario));

CREATE TABLE IF NOT EXISTS codigo_de_verificacion (
    id_codigo BIGSERIAL PRIMARY KEY,
    codigo_temporal CHAR(6) NOT NULL,
    fecha_expiracion TIMESTAMPTZ NOT NULL,
    usado BOOLEAN NOT NULL DEFAULT FALSE,
    id_pendiente BIGINT NOT NULL
        REFERENCES registro_pendiente(id_pendiente) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_codigo_verificacion_pendiente
    ON codigo_de_verificacion(id_pendiente);

CREATE TABLE IF NOT EXISTS progreso (
    id_progreso BIGSERIAL PRIMARY KEY,
    id_usuario BIGINT NOT NULL
        REFERENCES usuario(id_usuario) ON DELETE CASCADE,
    numero_de_intento INTEGER NOT NULL,
    fecha_de_guardado TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    unidad_tematica VARCHAR(150) NOT NULL,
    calificacion NUMERIC(4,2) NOT NULL
        CHECK (calificacion >= 0 AND calificacion <= 10)
);

CREATE INDEX IF NOT EXISTS idx_progreso_usuario
    ON progreso(id_usuario);

CREATE TABLE IF NOT EXISTS desarrollo_simulacion (
    id_registro BIGSERIAL PRIMARY KEY,
    id_usuario BIGINT NOT NULL
        REFERENCES usuario(id_usuario) ON DELETE CASCADE,
    fecha_de_guardado TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    desarrollo_id VARCHAR(100) NOT NULL,
    simulacion_id VARCHAR(150) NOT NULL,
    ruta_pdf TEXT
);

CREATE INDEX IF NOT EXISTS idx_desarrollo_usuario
    ON desarrollo_simulacion(id_usuario);
