FROM mcr.microsoft.com/devcontainers/typescript-node:5-24-trixie
ARG DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libx11-dev \
    libxkbfile-dev \
    libsecret-1-dev && rm -rf /var/lib/apt/lists/* && apt-get clean
