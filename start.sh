#!/bin/bash
# ── Traceify GPS — One-click dev launcher ──────────────────────────────────
# Opens two background processes: NestJS backend + Vite frontend

ROOT="$(cd "$(dirname "$0")" && pwd)"
BACKEND="$ROOT/gps-backend"
FRONTEND="$ROOT"

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║       Traceify GPS — Starting All Services           ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

# ── 1. Backend ─────────────────────────────────────────────
echo "▶  Starting NestJS backend on http://localhost:3001 ..."
cd "$BACKEND"
npm run start:dev &
BACKEND_PID=$!

# Give NestJS a few seconds to boot before opening the browser
sleep 5

# ── 2. Frontend ────────────────────────────────────────────
echo "▶  Starting Vite frontend on http://localhost:8080 ..."
cd "$FRONTEND"
npm run dev &
FRONTEND_PID=$!

sleep 3

# ── 3. Open browser automatically ──────────────────────────
echo ""
echo "✅  Both servers are running!"
echo "   Frontend  → http://localhost:8080"
echo "   Backend   → http://localhost:3001"
echo "   API Docs  → http://localhost:3001/swagger"
echo ""
echo "Press Ctrl+C to stop everything."
echo ""

# Open in default browser (macOS)
open http://localhost:8080 2>/dev/null || xdg-open http://localhost:8080 2>/dev/null

# Wait and forward Ctrl+C to kill both processes
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" SIGINT SIGTERM
wait
