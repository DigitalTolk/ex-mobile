#!/usr/bin/env bash
# Renders the App Store screenshots inside the Playwright image, which is where
# the browsers live on a machine that has none.
#
# It also installs the fonts the screens ask for. iOS ships Futura (the display
# face) and falls back to SF Pro for body text; neither can be shipped in CI, so
# the closest free equivalents stand in — Beteckna for Futura and Inter for
# Proxima Nova — mapped through fontconfig. Without this the container falls all
# the way back to DejaVu, and the screenshots carry typography no device shows.
#
#   ./scripts/generate-screenshots-docker.sh [--force]
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EX_REPO="${EX_REPO:-$REPO/../ex}"
IMAGE="${PLAYWRIGHT_IMAGE:-mcr.microsoft.com/playwright:v1.61.1-noble}"

if [ ! -d "$EX_REPO/dist" ]; then
  echo "built web client not found at $EX_REPO/dist — run 'npm run build' in $EX_REPO" >&2
  exit 1
fi

docker run --rm --ipc=host \
  -e HOME=/tmp -e EX_REPO=/ex -e PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
  -v "$REPO":/w -v "$EX_REPO":/ex -w /w \
  "$IMAGE" bash -euc '
    apt-get update -qq >/dev/null
    apt-get install -y -qq fonts-inter-variable >/dev/null
    curl -fsSL -o /usr/local/share/fonts/Jost.ttf \
      "https://github.com/google/fonts/raw/main/ofl/jost/Jost%5Bwght%5D.ttf"
    cat > /etc/fonts/conf.d/99-ex-screenshots.conf <<"CONF"
<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "fonts.dtd">
<fontconfig>
  <!-- iOS renders these; the container renders the closest free stand-ins. -->
  <match target="pattern">
    <test name="family"><string>Futura</string></test>
    <edit name="family" mode="assign" binding="same"><string>Jost</string></edit>
  </match>
  <match target="pattern">
    <test name="family"><string>Futura PT Demo</string></test>
    <edit name="family" mode="assign" binding="same"><string>Jost</string></edit>
  </match>
  <match target="pattern">
    <test name="family"><string>Proxima Nova</string></test>
    <edit name="family" mode="assign" binding="same"><string>Inter Variable</string></edit>
  </match>
</fontconfig>
CONF
    fc-cache -f >/dev/null
    node scripts/generate-ipad-screenshots.mjs "$@"
    chown -R '"$(id -u)":"$(id -g)"' fastlane/screenshots resources/screenshots
  ' -- "$@"
