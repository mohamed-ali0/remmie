# Build stage
FROM node:18-alpine as build

# === EDIT 1: Accept build-time variables for Vite ===
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ARG VITE_PYTHON_API_URL
ENV VITE_PYTHON_API_URL=$VITE_PYTHON_API_URL
ARG VITE_GOOGLE_CLIENT_ID
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID
ARG VITE_STRIPE_PUBLIC_KEY
ENV VITE_STRIPE_PUBLIC_KEY=$VITE_STRIPE_PUBLIC_KEY
ARG VITE_WHATSAPP_CONTACT_NUMBER
ENV VITE_WHATSAPP_CONTACT_NUMBER=$VITE_WHATSAPP_CONTACT_NUMBER

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM nginx:alpine

# === EDIT 2: Install curl for the healthcheck ===
RUN apk add --no-cache curl

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built assets from build stage
COPY --from=build /app/dist /usr/share/nginx/html

# Expose port
EXPOSE 80

# Add healthcheck
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:80 || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]