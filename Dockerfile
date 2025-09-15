FROM ubuntu:24.04

# Set environment variables to avoid interactive prompts
ENV DEBIAN_FRONTEND=noninteractive

# Install only the necessary dependencies
RUN apt-get update && apt-get install -y \
    wget \
    curl \
    npm \
    nodejs \
    python3 \
    inotify-tools \
    libnss3 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libpangocairo-1.0-0 \
    libpango-1.0-0 \
    libcairo2 \
    libasound2t64 \
    && rm -rf /var/lib/apt/lists/*

# Install mermaid-cli globally
RUN npm install -g @mermaid-js/mermaid-cli

# Create app directory
WORKDIR /app

# Copy the mermaid-live.sh script from local filesystem
COPY mermaid-live.sh .

# Make script executable
RUN chmod +x mermaid-live.sh

# Expose the correct port (18000 as used in the script)
EXPOSE 18000

# Set entrypoint with working directory configuration
ENTRYPOINT ["./mermaid-live.sh", "-i", "/diagrams"]
