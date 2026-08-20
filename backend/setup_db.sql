-- Create the 'user' role if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'user') THEN
    CREATE ROLE "user" WITH LOGIN PASSWORD 'password' CREATEDB;
  END IF;
END
$$;

-- Create the 'decodex' database if it doesn't exist
SELECT 'CREATE DATABASE decodex OWNER "user"'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'decodex')
\gexec
