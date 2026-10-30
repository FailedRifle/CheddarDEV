# syntax=docker/dockerfile:1.7

# Keep the source tree in a build-only stage. The runtime image copies assets
# into separate layers so large game bundles don't become one huge registry upload.
FROM scratch AS project-files
COPY . /project

FROM node:22-bookworm-slim
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

RUN --mount=type=bind,from=project-files,source=/project,target=/project \
    set -eu; \
    mkdir -p /app/core/games; \
    cp -a /project/api /project/lib /project/loader /project/proxy-assets /project/src /app/; \
    cp -a /project/injector.html /project/robots.txt /app/; \
    cp -a /project/core/*.html /project/core/*.md /app/core/; \
    cp -a /project/core/json /project/core/images /project/core/js /project/core/tools /app/core/

# The smaller games fit together in a modest layer. Keep the four largest games
# out of this copy; their bundles are added in chunks below.
RUN --mount=type=bind,from=project-files,source=/project,target=/project \
    set -eu; \
    for game in /project/core/games/*; do \
      case "${game##*/}" in \
        postal|clustertruck|cheeserolling|they-are-coming) continue ;; \
      esac; \
      cp -a "$game" /app/core/games/; \
    done

# Postal's Unity data is split into 20 MB files. Group five files per layer.
RUN --mount=type=bind,from=project-files,source=/project,target=/project \
    set -eu; mkdir -p /app/core/games/postal; \
    cp /project/core/games/postal/index.data.part1 /project/core/games/postal/index.data.part2 /project/core/games/postal/index.data.part3 /project/core/games/postal/index.data.part4 /project/core/games/postal/index.data.part5 /app/core/games/postal/
RUN --mount=type=bind,from=project-files,source=/project,target=/project \
    set -eu; \
    cp /project/core/games/postal/index.data.part6 /project/core/games/postal/index.data.part7 /project/core/games/postal/index.data.part8 /project/core/games/postal/index.data.part9 /project/core/games/postal/index.data.part10 /app/core/games/postal/
RUN --mount=type=bind,from=project-files,source=/project,target=/project \
    set -eu; \
    cp /project/core/games/postal/index.data.part11 /project/core/games/postal/index.data.part12 /project/core/games/postal/index.data.part13 /project/core/games/postal/index.data.part14 /project/core/games/postal/index.data.part15 /app/core/games/postal/
RUN --mount=type=bind,from=project-files,source=/project,target=/project \
    set -eu; \
    cp /project/core/games/postal/index.data.part16 /project/core/games/postal/index.data.part17 /project/core/games/postal/index.data.part18 /project/core/games/postal/index.data.part19 /project/core/games/postal/index.data.part20 /app/core/games/postal/
RUN --mount=type=bind,from=project-files,source=/project,target=/project \
    set -eu; \
    cp /project/core/games/postal/index.data.part21 /project/core/games/postal/index.data.part22 /project/core/games/postal/index.data.part23 /project/core/games/postal/index.data.part24 /project/core/games/postal/index.html /project/core/games/postal/index.js /project/core/games/postal/index.wasm /project/core/games/postal/icon.png /project/core/games/postal/banner.png /project/core/games/postal/desc.md /project/core/games/postal/play-postal-free.jpg /app/core/games/postal/

# Clustertruck's data and WebAssembly chunks are also kept below a single large layer.
RUN --mount=type=bind,from=project-files,source=/project,target=/project \
    set -eu; mkdir -p /app/core/games/clustertruck/Build; \
    cp -a /project/core/games/clustertruck/StreamingAssets /project/core/games/clustertruck/TemplateData /app/core/games/clustertruck/; \
    cp /project/core/games/clustertruck/index.html /project/core/games/clustertruck/icon.png /project/core/games/clustertruck/banner.png /project/core/games/clustertruck/desc.md /app/core/games/clustertruck/
RUN --mount=type=bind,from=project-files,source=/project,target=/project \
    set -eu; \
    cp /project/core/games/clustertruck/Build/ClusterTruckWEB.data.part1 /project/core/games/clustertruck/Build/ClusterTruckWEB.data.part2 /project/core/games/clustertruck/Build/ClusterTruckWEB.data.part3 /app/core/games/clustertruck/Build/
RUN --mount=type=bind,from=project-files,source=/project,target=/project \
    set -eu; \
    cp /project/core/games/clustertruck/Build/ClusterTruckWEB.data.part4 /project/core/games/clustertruck/Build/ClusterTruckWEB.data.part5 /project/core/games/clustertruck/Build/ClusterTruckWEB.data.part6 /app/core/games/clustertruck/Build/
RUN --mount=type=bind,from=project-files,source=/project,target=/project \
    set -eu; \
    cp /project/core/games/clustertruck/Build/ClusterTruckWEB.wasm.part1 /project/core/games/clustertruck/Build/ClusterTruckWEB.wasm.part2 /project/core/games/clustertruck/Build/ClusterTruckWEB.wasm.part3 /app/core/games/clustertruck/Build/
RUN --mount=type=bind,from=project-files,source=/project,target=/project \
    set -eu; \
    cp /project/core/games/clustertruck/Build/ClusterTruckWEB.wasm.part4 /project/core/games/clustertruck/Build/ClusterTruckWEB.wasm.part5 /project/core/games/clustertruck/Build/ClusterTruckWEB.framework.js /project/core/games/clustertruck/Build/ClusterTruckWEB.loader.js /app/core/games/clustertruck/Build/

# Cheese Rolling's Unity bundle is divided into data and WebAssembly layers.
RUN --mount=type=bind,from=project-files,source=/project,target=/project \
    set -eu; mkdir -p /app/core/games/cheeserolling/Build; \
    cp -a /project/core/games/cheeserolling/TemplateData /app/core/games/cheeserolling/; \
    cp /project/core/games/cheeserolling/index.html /project/core/games/cheeserolling/icon.png /project/core/games/cheeserolling/banner.png /project/core/games/cheeserolling/desc.md /project/core/games/cheeserolling/manifest.webmanifest /project/core/games/cheeserolling/ServiceWorker.js /app/core/games/cheeserolling/
RUN --mount=type=bind,from=project-files,source=/project,target=/project \
    set -eu; \
    cp /project/core/games/cheeserolling/Build/CheeseRollingWeb.data.part001 /project/core/games/cheeserolling/Build/CheeseRollingWeb.data.part002 /project/core/games/cheeserolling/Build/CheeseRollingWeb.data.part003 /app/core/games/cheeserolling/Build/
RUN --mount=type=bind,from=project-files,source=/project,target=/project \
    set -eu; \
    cp /project/core/games/cheeserolling/Build/CheeseRollingWeb.data.part004 /project/core/games/cheeserolling/Build/CheeseRollingWeb.data.part005 /app/core/games/cheeserolling/Build/
RUN --mount=type=bind,from=project-files,source=/project,target=/project \
    set -eu; \
    cp /project/core/games/cheeserolling/Build/CheeseRollingWeb.wasm.part001 /project/core/games/cheeserolling/Build/CheeseRollingWeb.wasm.part002 /project/core/games/cheeserolling/Build/CheeseRollingWeb.framework.js /project/core/games/cheeserolling/Build/CheeseRollingWeb.loader.js /app/core/games/cheeserolling/Build/

# This remaining large game bundle is about 55 MB and can use its own layer.
RUN --mount=type=bind,from=project-files,source=/project,target=/project \
    cp -a /project/core/games/they-are-coming /app/core/games/

ENV PORT=4040
EXPOSE 4040

CMD ["node", "src/index.js"]
