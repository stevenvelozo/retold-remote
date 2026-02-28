FROM node:20-slim

# Install optional tools for full functionality
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    imagemagick \
    p7zip-full \
    calibre \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files and install dependencies
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Install sharp (optional image processing, may fail on some architectures)
RUN npm install sharp || true

# Copy application source and built assets
COPY source/ source/
COPY web-application/ web-application/
COPY css/ css/
COPY html/ html/
COPY server.js ./

# Create cache directory
RUN mkdir -p /cache

# Default port
ENV PORT=8086

EXPOSE 8086

# Serve /media with cache at /cache
CMD ["node", "server.js", "/media"]
