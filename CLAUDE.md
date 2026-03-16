# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **Docker Desktop Extension** that integrates MailHog (a lightweight SMTP testing server) into Docker Desktop. The extension image is published as `egekocabas/mailhog`.

## Architecture

Three components work together:

1. **Backend** (`backend/`) — Go service using Echo framework, runs inside the extension container and listens on a Unix socket (`/run/guest-services/backend.sock`). Communicates with Docker Engine to manage the MailHog container.

2. **Frontend** (`ui/`) — React + TypeScript app using MUI and Docker's theme. Communicates with the backend exclusively through `@docker/extension-api-client` (i.e., `ddClient.extension.vm?.service?.get(...)`) — never via direct HTTP. The UI cannot run in a plain browser due to this dependency.

3. **Managed MailHog container** — `mailhog/mailhog` Docker image, started/stopped by the backend. Runs on a dedicated Docker network (`mailhog-extension-network`). Default ports: SMTP 1025, Web UI/API 8025.

The backend and MailHog communicate internally over Docker networking. Host port binding is optional and user-controlled.

## Common Commands

### Extension lifecycle (preferred)
```sh
make build-extension       # docker build -t egekocabas/mailhog:0.1.0 .
make install-extension     # builds then installs into Docker Desktop
make update-extension      # rebuilds and reinstalls
make uninstall-extension
make validate-extension    # lint/validate extension metadata
```

### Frontend development (hot reload)
```sh
make run-client            # npm install + npm run dev (serves on port 3000)
make set-extension-source  # point Docker Desktop to http://localhost:3000
make debug-ui              # open Chrome DevTools for the extension tab
```

### Frontend build/test
```sh
cd ui && npm run build     # tsc + vite build → ui/build/
cd ui && npm test          # jest src
```

### Backend development
After changing Go code, use `make update-extension` to rebuild and redeploy the backend container.

### Multi-arch publish
```sh
make push-extension        # builds linux/amd64 + linux/arm64 and pushes to Docker Hub
```

## Key Files

- `Dockerfile` — multi-stage build: Go backend → Node frontend → alpine final image
- `metadata.json` — extension manifest; declares the Unix socket and UI entry point
- `docker-compose.yaml` — used by Docker Desktop to run the backend container
- `ui/src/App.tsx` — frontend entry component
- `backend/main.go` — backend entry point; currently only has `/hello`; MailHog orchestration logic goes here

## Docker Desktop Extension Constraints

- The backend must listen on the Unix socket path `/run/guest-services/backend.sock`.
- The UI must use `@docker/extension-api-client` to call the backend — direct `fetch` to localhost will not work inside Docker Desktop.
- Extension containers are hidden from the Docker Dashboard by default (Settings → Extensions → Show Docker Extensions system containers).
- The frontend build output directory is `ui/build/` (configured in `vite.config.ts`), which is copied to the final image as `ui/`.
