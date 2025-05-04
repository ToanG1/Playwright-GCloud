# Use official Playwright base image (Debian-based)
FROM mcr.microsoft.com/playwright:v1.44.0-jammy

# Set working directory
WORKDIR /usr/src/app

# Copy dependency manifests
COPY package*.json ./

# Install dependencies (prod only)
RUN npm install --production

# Install only Chromium (skip Firefox, WebKit)
RUN npx playwright install chromium

# Copy application code
COPY . .

# Run your app
CMD ["node", "index.js"]
