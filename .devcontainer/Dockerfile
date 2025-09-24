FROM mcr.microsoft.com/devcontainers/javascript-node:1-22-bookworm

RUN apt-get update \
 && apt-get install -y \
        iputils-ping \
        redis-server \
 && rm -rf /var/lib/apt/lists/*

RUN curl https://qlty.sh | /bin/bash \
 && mv ~/.qlty/bin/qlty /usr/local/bin/qlty \
 && rm -rf ~/.qlty \
 && qlty --version