#!/usr/bin/env python3
"""
Decodex — one-command dev launcher.

Usage:
    python app.py          Start backend + frontend dev servers

Requires: Python 3.8+, Node.js/npm.
Postgres and Redis must be running (locally or via Docker) before starting.
No additional Python packages — stdlib only.
"""

import os
import platform
import shutil
import signal
import socket
import secrets
import subprocess
import sys
import time
import threading
from pathlib import Path
from urllib.request import urlopen
from urllib.error import URLError

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

# ─── Paths ──────────────────────────────────────────────────────────────────────

ROOT = Path(__file__).resolve().parent
BACKEND_DIR = ROOT / "backend"
FRONTEND_DIR = ROOT / "frontend"


BACKEND_URL = "http://localhost:3000"
FRONTEND_URL = "http://localhost:5173"

IS_WINDOWS = platform.system() == "Windows"
NPM = "npm.cmd" if IS_WINDOWS else "npm"

# ─── Colours (skip on Windows without VT support) ──────────────────────────────

_colour = sys.stdout.isatty() and os.environ.get("NO_COLOR") is None

def _c(code: str, text: str) -> str:
    return f"\033[{code}m{text}\033[0m" if _colour else text

def green(t: str) -> str: return _c("32", t)
def yellow(t: str) -> str: return _c("33", t)
def red(t: str) -> str: return _c("31", t)
def cyan(t: str) -> str: return _c("36", t)
def bold(t: str) -> str: return _c("1", t)
def dim(t: str) -> str: return _c("2", t)


# ═══════════════════════════════════════════════════════════════════════════════
# 1. ENV FILE CHECK
# ═══════════════════════════════════════════════════════════════════════════════

_SECRETS_NEEDING_REAL_VALUES = {
    "GROQ_API_KEY":       "gsk-your-key-here",
    "OPENAI_API_KEY":     "sk-your-key-here",
    "GMAIL_USER":         "your-gmail-address@gmail.com",
    "GMAIL_APP_PASSWORD": "your-google-app-password",
}

_DEV_ENV_DEFAULTS = {
    "PORT": "3000",
    "REDIS_URL": "redis://localhost:6379",
    "FRONTEND_URL": FRONTEND_URL,
}


def _env_check() -> None:
    """Copy .env.example → .env if missing; warn about placeholder secrets."""
    env_file = BACKEND_DIR / ".env"
    example  = BACKEND_DIR / ".env.example"

    if env_file.exists():
        print(f"  {green('✓')} backend/.env exists")
    elif example.exists():
        shutil.copy2(example, env_file)
        print(f"  {yellow('⚠')} Created backend/.env from .env.example")
    else:
        print(f"  {red('✗')} No backend/.env or .env.example found — "
              "backend may fail to start")
        return

    # Scan for placeholders that need real values
    try:
        content = env_file.read_text(encoding="utf-8")
    except OSError:
        return

    missing: list[str] = []
    for key, placeholder in _SECRETS_NEEDING_REAL_VALUES.items():
        for line in content.splitlines():
            stripped = line.strip()
            if stripped.startswith("#"):
                continue
            if stripped.startswith(f"{key}="):
                value = stripped.split("=", 1)[1].strip()
                if value == placeholder or not value:
                    missing.append(key)
                break

    if missing:
        print()
        print(f"  {yellow('⚠')}  The following backend/.env values are still "
              "placeholders and need real credentials:")
        for m in missing:
            print(f"      • {bold(m)}")
        print(f"      (The app will run in {cyan('mock/offline')} mode without "
              "a valid OPENAI_API_KEY.)")
        print()


# ═══════════════════════════════════════════════════════════════════════════════
# 2. INFRASTRUCTURE CONNECTIVITY CHECK
# ═══════════════════════════════════════════════════════════════════════════════

def _run(cmd: list[str], **kwargs) -> subprocess.CompletedProcess:
    """Run a command."""
    return subprocess.run(cmd, **kwargs)


def _read_env_values(env_file: Path) -> dict[str, str]:
    """Parse simple KEY=VALUE lines from a dotenv file."""
    values: dict[str, str] = {}
    if not env_file.exists():
        return values

    for raw in env_file.read_text(encoding="utf-8", errors="replace").splitlines():
        stripped = raw.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        key, value = stripped.split("=", 1)
        values[key.strip()] = value.strip()
    return values


def _write_env_updates(env_file: Path, updates: dict[str, str]) -> None:
    """Update or append dotenv values while preserving unrelated lines."""
    if not updates:
        return

    lines = env_file.read_text(encoding="utf-8", errors="replace").splitlines()
    seen: set[str] = set()
    next_lines: list[str] = []

    for line in lines:
        stripped = line.strip()
        if stripped and not stripped.startswith("#") and "=" in stripped:
            key = stripped.split("=", 1)[0].strip()
            if key in updates:
                next_lines.append(f"{key}={updates[key]}")
                seen.add(key)
                continue
        next_lines.append(line)

    for key, value in updates.items():
        if key not in seen:
            next_lines.append(f"{key}={value}")

    env_file.write_text("\n".join(next_lines) + "\n", encoding="utf-8")


def _docker_compose_available() -> bool:
    if shutil.which("docker") is None:
        return False
    result = _run(
        ["docker", "compose", "version"],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    return result.returncode == 0


def _start_docker_infra_if_needed() -> None:
    """Start local Postgres/Redis via docker compose when Docker is available."""
    if _tcp_ready("localhost", 5433) and _tcp_ready("localhost", 6379):
        return

    if not _docker_compose_available():
        print(f"  {yellow('⚠')} Docker is not available; skipping automatic infra start")
        return

    print(f"  {cyan('→')} Starting Postgres + Redis with docker compose...")
    result = _run(["docker", "compose", "up", "-d"], cwd=str(ROOT))
    if result.returncode != 0:
        print(f"  {yellow('⚠')} docker compose up failed; continuing so backend can report details")


def _ensure_backend_env_connections() -> None:
    """Keep backend/.env aligned with the local dev services."""
    env_file = BACKEND_DIR / ".env"
    if not env_file.exists():
        return

    values = _read_env_values(env_file)
    updates: dict[str, str] = {}

    for key, value in _DEV_ENV_DEFAULTS.items():
        if not values.get(key):
            updates[key] = value

    if len(values.get("JWT_SECRET", "")) < 32:
        updates["JWT_SECRET"] = f"decodex-dev-{secrets.token_urlsafe(32)}"

    pg_port = 5433 if _tcp_ready("localhost", 5433) else 5432
    expected_db_url = f"postgresql://user:password@localhost:{pg_port}/decodex"
    db_url = values.get("DATABASE_URL", "")
    if not db_url:
        updates["DATABASE_URL"] = expected_db_url
    elif (
        "localhost:5432/decodex" in db_url
        and pg_port == 5433
        and db_url == "postgresql://user:password@localhost:5432/decodex"
    ):
        updates["DATABASE_URL"] = db_url.replace("localhost:5432/decodex", "localhost:5433/decodex")

    if updates:
        _write_env_updates(env_file, updates)
        print(f"  {green('✓')} backend/.env connection defaults updated")


def _tcp_ready(host: str, port: int, timeout: float = 1.0) -> bool:
    """Return True if a TCP socket can connect to host:port."""
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except (OSError, ConnectionRefusedError):
        return False


def _check_infra() -> None:
    """Verify Postgres and Redis are reachable. Warn if not — the backend
    will fail to connect on its own and print a clear error."""
    print(bold("\n🔌 Checking infrastructure (Postgres + Redis)…"))

    _start_docker_infra_if_needed()
    _ensure_backend_env_connections()

    pg_port = 5433 if _tcp_ready("localhost", 5433) else 5432
    services = [("Postgres", "localhost", pg_port), ("Redis", "localhost", 6379)]
    all_ok = True

    for name, host, port in services:
        if _tcp_ready(host, port):
            print(f"  {green('✓')} {name} on :{port} — reachable")
        else:
            print(f"  {yellow('⚠')} {name} on :{port} — not reachable")
            all_ok = False

    if not all_ok:
        print()
        print(f"  {yellow('⚠')}  Some services are not running. The backend needs")
        print(f"      Postgres and Redis. Start them manually, e.g.:")
        print(f"      • {dim('docker compose up -d')}   (if Docker is available)")
        print(f"      • Or install Postgres / Redis natively.")
        print(f"      Continuing anyway — the backend will retry on startup.")
        print()


# ═══════════════════════════════════════════════════════════════════════════════
# 3. NPM DEPENDENCY CHECK
# ═══════════════════════════════════════════════════════════════════════════════

def _ensure_node_modules(directory: Path, label: str) -> None:
    """Run `npm install` if node_modules/ is missing."""
    nm = directory / "node_modules"
    if nm.is_dir():
        print(f"  {green('✓')} {label}/node_modules present")
        return

    print(f"  {yellow('↓')} Installing {label} dependencies…")
    result = _run([NPM, "install"], cwd=str(directory))
    if result.returncode != 0:
        print(red(f"  ✗ npm install failed in {label}/"))
        sys.exit(1)


# ═══════════════════════════════════════════════════════════════════════════════
# 4. DEV SERVER SUBPROCESSES
# ═══════════════════════════════════════════════════════════════════════════════

_children: list[subprocess.Popen] = []


def _stream_output(proc: subprocess.Popen, prefix: str, colour_code: str) -> None:
    """Read lines from proc.stdout and print them prefixed."""
    assert proc.stdout is not None
    tag = _c(colour_code, f"[{prefix}]")
    try:
        for raw in proc.stdout:
            line = raw.decode("utf-8", errors="replace").rstrip("\n\r")
            print(f"{tag} {line}")
    except (ValueError, OSError):
        pass  # stream closed


def _start_dev_server(directory: Path, label: str, colour_code: str) -> subprocess.Popen:
    """Start `npm run dev` in *directory* and stream its output."""
    # On Windows we need shell=False with npm.cmd, and CREATE_NEW_PROCESS_GROUP
    # so we can send CTRL_BREAK_EVENT to kill the whole tree.
    kwargs: dict = dict(
        cwd=str(directory),
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
    )

    if IS_WINDOWS:
        kwargs["creationflags"] = subprocess.CREATE_NEW_PROCESS_GROUP  # type: ignore[attr-defined]

    proc = subprocess.Popen([NPM, "run", "dev"], **kwargs)
    _children.append(proc)

    t = threading.Thread(target=_stream_output, args=(proc, label, colour_code),
                         daemon=True)
    t.start()
    return proc


# ═══════════════════════════════════════════════════════════════════════════════
# 5. HEALTH POLL
# ═══════════════════════════════════════════════════════════════════════════════

def _poll_backend_health(max_wait: int = 60) -> bool:
    """GET /health until 200 or timeout."""
    url = f"{BACKEND_URL}/health"
    start = time.monotonic()
    sys.stdout.write(f"  Waiting for backend health ({url}) ")
    sys.stdout.flush()
    while time.monotonic() - start < max_wait:
        try:
            with urlopen(url, timeout=2) as resp:
                if resp.status == 200:
                    print(f" {green('ready')}")
                    return True
        except (URLError, OSError, Exception):
            pass
        sys.stdout.write(".")
        sys.stdout.flush()
        time.sleep(1)
    print(f" {red('timed out')}")
    return False


def _poll_frontend_ready(max_wait: int = 60) -> bool:
    """GET the Vite entry point until it responds or timeout."""
    start = time.monotonic()
    sys.stdout.write(f"  Waiting for frontend ({FRONTEND_URL}) ")
    sys.stdout.flush()
    while time.monotonic() - start < max_wait:
        try:
            with urlopen(FRONTEND_URL, timeout=2) as resp:
                if resp.status == 200:
                    print(f" {green('ready')}")
                    return True
        except (URLError, OSError, Exception):
            pass
        sys.stdout.write(".")
        sys.stdout.flush()
        time.sleep(1)
    print(f" {red('timed out')}")
    return False


# ═══════════════════════════════════════════════════════════════════════════════
# 6. GRACEFUL SHUTDOWN
# ═══════════════════════════════════════════════════════════════════════════════

_shutting_down = False


def _kill_children() -> None:
    """Terminate all child npm processes *and* their node subtrees."""
    for proc in _children:
        if proc.poll() is not None:
            continue
        try:
            if IS_WINDOWS:
                # taskkill /T kills the entire process tree
                subprocess.run(
                    ["taskkill", "/F", "/T", "/PID", str(proc.pid)],
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                )
            else:
                # Send SIGTERM to the process group (npm + child node)
                os.killpg(os.getpgid(proc.pid), signal.SIGTERM)
        except (OSError, ProcessLookupError):
            pass

    # Give them a moment, then force-kill stragglers
    deadline = time.monotonic() + 3
    for proc in _children:
        remaining = max(0, deadline - time.monotonic())
        try:
            proc.wait(timeout=remaining)
        except subprocess.TimeoutExpired:
            proc.kill()


def _shutdown() -> None:
    global _shutting_down
    if _shutting_down:
        return
    _shutting_down = True

    print(f"\n{bold('🛑 Shutting down…')}")
    _kill_children()


# ═══════════════════════════════════════════════════════════════════════════════
# 7. NON-WINDOWS PROCESS GROUP SETUP
# ═══════════════════════════════════════════════════════════════════════════════

def _start_dev_server_unix(directory: Path, label: str, colour_code: str) -> subprocess.Popen:
    """Unix variant: start in its own process group so we can kill the tree."""
    proc = subprocess.Popen(
        [NPM, "run", "dev"],
        cwd=str(directory),
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        preexec_fn=os.setsid,
    )
    _children.append(proc)

    t = threading.Thread(target=_stream_output, args=(proc, label, colour_code),
                         daemon=True)
    t.start()
    return proc


# ═══════════════════════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════════════════════

def main() -> None:
    print(bold("═" * 60))
    print(bold("  Decodex Dev Launcher"))
    print(bold("═" * 60))

    # 1. Env check
    print(bold("\n📋 Checking environment files…"))
    _env_check()

    # 2. Infrastructure connectivity check
    _check_infra()

    # 3. npm deps
    print(bold("\n📦 Checking Node dependencies…"))
    _ensure_node_modules(BACKEND_DIR, "backend")
    _ensure_node_modules(FRONTEND_DIR, "frontend")

    # 4. Start dev servers
    print(bold("\n🚀 Starting dev servers…"))
    starter = _start_dev_server if IS_WINDOWS else _start_dev_server_unix
    backend_proc = starter(BACKEND_DIR, "backend", "36")   # cyan
    frontend_proc = starter(FRONTEND_DIR, "frontend", "35")  # magenta

    # Wire up Ctrl+C
    def _on_signal(signum, frame):
        _shutdown()
        sys.exit(0)

    signal.signal(signal.SIGINT, _on_signal)
    if hasattr(signal, "SIGTERM"):
        signal.signal(signal.SIGTERM, _on_signal)

    # 5. Poll backend health
    print()
    backend_ready = _poll_backend_health()
    frontend_ready = _poll_frontend_ready()

    if backend_ready and frontend_ready:
        print()
        print(bold("═" * 60))
        print(f"  {green('✓')} Backend ready   → {cyan(BACKEND_URL)}")
        print(f"  {green('✓')} Frontend ready  → {cyan(FRONTEND_URL)}")
        print()
        print(f"  Demo credentials → see {bold('DEMO.md')}")
        print(bold("═" * 60))
        print(dim("  Press Ctrl+C to stop.\n"))
    else:
        if not backend_ready:
            print(yellow("  Backend did not pass /health in time; check the backend logs above."))
        if not frontend_ready:
            print(yellow("  Frontend did not respond in time; check the frontend logs above."))

    # Keep alive until child exits or Ctrl+C
    try:
        while True:
            # If either process dies, report and shut down
            if backend_proc.poll() is not None:
                print(red("\n  ✗ Backend process exited unexpectedly "
                          f"(code {backend_proc.returncode})"))
                _shutdown()
                sys.exit(1)
            if frontend_proc.poll() is not None:
                print(red("\n  ✗ Frontend process exited unexpectedly "
                          f"(code {frontend_proc.returncode})"))
                _shutdown()
                sys.exit(1)
            time.sleep(1)
    except KeyboardInterrupt:
        _shutdown()


if __name__ == "__main__":
    main()
