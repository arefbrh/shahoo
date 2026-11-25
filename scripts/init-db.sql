-- PostgreSQL container first-boot initialization.
-- The official image runs this against POSTGRES_DB as the bootstrap superuser.
\getenv app_user APP_DB_USER
\getenv app_password APP_DB_PASSWORD

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Fail closed before granting ownership or changing role privileges.
-- The PostgreSQL image executes this file with ON_ERROR_STOP=1.
SELECT format(
  'DO $shahoo_role_guard$ BEGIN IF %L = CURRENT_USER OR EXISTS (SELECT 1 FROM pg_roles WHERE rolname = %L AND rolsuper) THEN RAISE EXCEPTION ''APP_DB_USER must differ from bootstrap user and cannot be a superuser''; END IF; END $shahoo_role_guard$;',
  :'app_user', :'app_user'
)
\gexec

SELECT format('CREATE ROLE %I LOGIN', :'app_user')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'app_user')
\gexec

SELECT format('ALTER ROLE %I WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD %L', :'app_user', :'app_password')
\gexec

SELECT format('ALTER DATABASE %I OWNER TO %I', current_database(), :'app_user')
\gexec

SELECT format('ALTER SCHEMA public OWNER TO %I', :'app_user')
\gexec

SELECT format('GRANT CONNECT, TEMP ON DATABASE %I TO %I', current_database(), :'app_user')
\gexec

SELECT format('ALTER DATABASE %I SET timezone TO %L', current_database(), 'Asia/Tehran')
\gexec

SELECT format('ALTER ROLE %I SET timezone TO %L', :'app_user', 'Asia/Tehran')
\gexec
