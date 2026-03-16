FROM golang:1.25-alpine AS builder
ENV CGO_ENABLED=0
WORKDIR /backend
COPY backend/go.* .
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    go mod download
COPY backend/. .
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    go build -trimpath -ldflags="-s -w" -o bin/service

FROM --platform=$BUILDPLATFORM node:24-alpine AS client-builder
WORKDIR /ui
# cache packages in layer
COPY ui/package.json /ui/package.json
COPY ui/package-lock.json /ui/package-lock.json
RUN --mount=type=cache,target=/usr/src/app/.npm \
    npm set cache /usr/src/app/.npm && \
    npm ci
# install
COPY ui /ui
RUN npm run build

FROM alpine
LABEL org.opencontainers.image.title="mailhog"
LABEL org.opencontainers.image.description="My awesome Docker extension"
LABEL org.opencontainers.image.vendor="Ege Kocabaş"
LABEL com.docker.desktop.extension.api.version="0.4.2"
LABEL com.docker.extension.screenshots=""
LABEL com.docker.desktop.extension.icon="https://raw.githubusercontent.com/egekocabas/mailhog/refs/heads/main/assets/extension-icon.svg"
LABEL com.docker.extension.detailed-description=""
LABEL com.docker.extension.publisher-url="https://github.com/egekocabas/mailhog"
LABEL com.docker.extension.additional-urls="\
    [{\"title\":\"GitHub\",\"url\":\"https:\/\/github.com\/egekocabas\/mailhog\"},\
    {\"title\":\"License\",\"url\":\"https://github.com/egekocabas/mailhog/blob/main/LICENSE\"}]"
LABEL com.docker.extension.categories="utility-tools"
LABEL com.docker.extension.changelog="<ul><li>Initial release</li></ul>"
LABEL com.docker.extension.account-info=""

COPY --from=builder /backend/bin/service /
COPY compose.yaml .
COPY metadata.json .
COPY assets/extension-icon.svg .
COPY --from=client-builder /ui/build ui
CMD /service -socket /run/guest-services/backend.sock
