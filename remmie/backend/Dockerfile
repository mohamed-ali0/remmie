FROM node:18-alpine

# Install curl so the HEALTHCHECK instruction can run
RUN apk add --no-cache curl

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy source code
COPY . .

# Create uploads directory
RUN mkdir -p uploads/user_profile

# Expose port
EXPOSE 5000



# Start the application
CMD ["node", "server.js"]