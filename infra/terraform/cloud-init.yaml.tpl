#cloud-config
package_update: true
packages:
  - docker.io
  - docker-compose-v2

runcmd:
  - systemctl enable docker
  - systemctl start docker
  - mkdir -p /opt/booking-api
  - |
    cat > /opt/booking-api/docker-compose.yml <<'EOF'
    services:
      postgres:
        image: postgres:16
        restart: unless-stopped
        environment:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: ${postgres_password}
          POSTGRES_DB: booking_api
        volumes:
          - postgres_data:/var/lib/postgresql/data
        healthcheck:
          test: ["CMD-SHELL", "pg_isready -U postgres"]
          interval: 5s
          timeout: 5s
          retries: 5

      app:
        image: ${app_image}
        restart: unless-stopped
        ports:
          - "3000:3000"
        environment:
          NODE_ENV: production
          PORT: 3000
          DATABASE_URL: postgresql://postgres:${postgres_password}@postgres:5432/booking_api
          JWT_SECRET: ${jwt_secret}
        depends_on:
          postgres:
            condition: service_healthy
    volumes:
      postgres_data:
    EOF
  - docker compose -f /opt/booking-api/docker-compose.yml up -d postgres
