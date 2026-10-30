FROM golang:1.25-bookworm AS build
RUN apt-get update \
  && apt-get install -y --no-install-recommends libvips-dev pkg-config gcc libc6-dev \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /src
COPY . .
ENV GOPROXY=https://proxy.golang.org,direct
ENV GOSUMDB=off
RUN go mod tidy && CGO_ENABLED=1 go build -o /out/thumbnails ./cmd/thumbnails

FROM debian:bookworm-slim
RUN apt-get update \
  && apt-get install -y --no-install-recommends libvips42 ffmpeg curl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
COPY --from=build /out/thumbnails /usr/local/bin/thumbnails
EXPOSE 8080
ENTRYPOINT ["thumbnails"]
