FROM node:20-slim

# Install latest Chromium and all Linux dependencies required by Puppeteer
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-liberation \
    fonts-freefont-ttf \
    libnss3 \
    libatk-bridge2.0-0 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    libpangocairo-1.0-0 \
    libatk1.0-0 \
    libcups2 \
    ca-certificates \
    curl \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Point Puppeteer to the system-installed Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app

# Copy dependency manifests
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy application source code
COPY . .

# Default port
ENV PORT=4200
EXPOSE 4200

# Start Express dashboard & agent backend
CMD ["node", "node_modules/tsx/dist/cli.mjs", "dashboard.ts"]
