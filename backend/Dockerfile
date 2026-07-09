# Build stage: compile the API server.
FROM golang:1.25-alpine AS build

WORKDIR /src

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/server ./cmd/server

# Runtime stage: minimal image.
FROM alpine:3.20

RUN adduser -D -u 10001 app
COPY --from=build /out/server /usr/local/bin/

USER app
EXPOSE 8080

# The server runs GORM AutoMigrate on startup before serving.
ENTRYPOINT ["server"]
