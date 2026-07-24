# Booking API — Terraform / OCI Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provision OCI infrastructure via Terraform (always-free tier) and add a GitHub Actions `deploy` job (main-only) that builds, pushes, and restarts the app — per spec Section 5's OCI deployment requirement.

**Architecture:** One `VM.Standard.A1.Flex` Compute instance (2 OCPU / 12GB, well within the 4 OCPU / 24GB always-free allotment) running Docker via cloud-init, hosting two containers side by side: `postgres` (self-hosted, persistent via the boot volume) and `app` (pulled from OCI Registry). One OCI Registry (OCIR) repository holds the app image. Networking is a dedicated VCN/subnet/security-list allowing SSH (22) and the app port (3000). The GitHub Actions `deploy` job builds the image, pushes it to OCIR, then SSHes in to pull and restart the `app` container.

**Tech Stack:** Terraform (`oracle/oci` provider), OCI Compute/Networking/Registry/Artifacts, cloud-init, GitHub Actions, `docker/login-action`, `appleboy/ssh-action`.

**Depends on:** `docs/superpowers/plans/2026-07-22-booking-api-core.md` (needs `Dockerfile`, `package.json` build script) and, ideally, `docs/superpowers/plans/2026-07-22-booking-api-ci.md` (this plan's `deploy.yml` sits alongside `ci.yml`, not merged into it).

## Global Constraints

- **Spec correction (documented, not silent):** the spec's Section 5 names two things that don't both exist as real OCI products — "OCI Autonomous Database (Postgres-compatible)" (Autonomous Database is Oracle DB, not Postgres) and "OCI Container Instance (A1 ARM)" (the cited free-tier specs — 4 OCPU/24GB RAM/200GB block storage/no expiry — belong to the Ampere A1 **Compute** shape, not the separate "Container Instances" product, which has no native persistent block storage). Per user decision, this plan uses: a self-hosted Postgres container (not Autonomous DB) on a `VM.Standard.A1.Flex` **Compute instance** (not the Container Instances service) running Docker.
- `terraform apply` provisions real, billable-adjacent cloud resources. **No task in this plan runs `terraform apply` automatically** — every apply step is something the user runs themselves after reviewing `terraform plan` output, consistent with "hard to reverse, affects shared systems" caution. Automated verification in this plan is limited to `terraform validate`, `terraform fmt -check`, and `terraform plan`.
- No hardcoded secrets in `.tf` files — all sensitive values (`jwt_secret`, `postgres_password`, OCI credentials) come from `variables.tf` (marked `sensitive = true`) or GitHub Actions secrets, never committed. `terraform.tfvars` itself must be gitignored; only `terraform.tfvars.example` is committed.
- Terraform state: this plan does not configure a remote backend (S3/OCI Object Storage backend) — local state is acceptable for a single-operator side project. If multiple people ever apply this, add a remote backend before that happens; not done here (YAGNI for a solo project).

---

## Task 1: Terraform Provider, Backend, and Variables

**Files:**

- Create: `infra/terraform/versions.tf`
- Create: `infra/terraform/variables.tf`
- Create: `infra/terraform/terraform.tfvars.example`
- Modify: `.gitignore` (add Terraform state/vars ignores)

**Interfaces:**

- Produces: `var.tenancy_ocid`, `var.user_ocid`, `var.fingerprint`, `var.private_key_path`, `var.region`, `var.compartment_ocid`, `var.ssh_public_key`, `var.app_image`, `var.jwt_secret`, `var.postgres_password` — consumed by every later `.tf` file in this plan.

- [ ] **Step 1: Write `infra/terraform/versions.tf`**

```hcl
terraform {
  required_version = ">= 1.5.0"
  required_providers {
    oci = {
      source  = "oracle/oci"
      version = "~> 5.0"
    }
  }
}

provider "oci" {
  tenancy_ocid     = var.tenancy_ocid
  user_ocid        = var.user_ocid
  fingerprint      = var.fingerprint
  private_key_path = var.private_key_path
  region           = var.region
}
```

- [ ] **Step 2: Write `infra/terraform/variables.tf`**

```hcl
variable "tenancy_ocid" {
  type        = string
  description = "OCID of the OCI tenancy"
}

variable "user_ocid" {
  type        = string
  description = "OCID of the OCI user Terraform authenticates as"
}

variable "fingerprint" {
  type        = string
  description = "Fingerprint of the API signing key"
}

variable "private_key_path" {
  type        = string
  description = "Path to the API signing private key"
}

variable "region" {
  type        = string
  description = "OCI region, e.g. us-ashburn-1"
}

variable "compartment_ocid" {
  type        = string
  description = "OCID of the compartment to provision resources into"
}

variable "ssh_public_key" {
  type        = string
  description = "SSH public key to allow admin access to the compute instance"
}

variable "app_image" {
  type        = string
  description = "Full OCIR path of the app image the instance should run, e.g. <region>.ocir.io/<namespace>/booking-api:latest"
}

variable "jwt_secret" {
  type        = string
  description = "JWT_SECRET for the running app"
  sensitive   = true
}

variable "postgres_password" {
  type        = string
  description = "Password for the self-hosted postgres container"
  sensitive   = true
}
```

- [ ] **Step 3: Write `infra/terraform/terraform.tfvars.example`**

```
tenancy_ocid      = "ocid1.tenancy.oc1..xxxxx"
user_ocid         = "ocid1.user.oc1..xxxxx"
fingerprint       = "xx:xx:xx:xx:xx:xx:xx:xx:xx:xx:xx:xx:xx:xx:xx:xx"
private_key_path  = "~/.oci/oci_api_key.pem"
region            = "us-ashburn-1"
compartment_ocid  = "ocid1.compartment.oc1..xxxxx"
ssh_public_key    = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAA... you@example.com"
app_image         = "us-ashburn-1.ocir.io/your-namespace/booking-api:latest"
jwt_secret        = "change-me-to-a-long-random-string"
postgres_password = "change-me-too"
```

- [ ] **Step 4: Modify `.gitignore`** — append:

```
infra/terraform/.terraform/
infra/terraform/*.tfstate
infra/terraform/*.tfstate.backup
infra/terraform/terraform.tfvars
```

- [ ] **Step 5: Initialize and validate**

Run: `cd infra/terraform && terraform init && terraform validate`
Expected: `Terraform has been successfully initialized!`, then `Success! The configuration is valid.`

- [ ] **Step 6: Commit**

```bash
git add infra/terraform/versions.tf infra/terraform/variables.tf infra/terraform/terraform.tfvars.example .gitignore
git commit -m "infra: terraform provider config and variables"
```

---

## Task 2: Networking (VCN, Subnet, Security List)

**Files:**

- Create: `infra/terraform/network.tf`

**Interfaces:**

- Consumes: `var.compartment_ocid` (Task 1).
- Produces: `oci_core_subnet.booking_api` (referenced by Task 4's compute instance).

- [ ] **Step 1: Write `infra/terraform/network.tf`**

```hcl
resource "oci_core_vcn" "booking_api" {
  compartment_id = var.compartment_ocid
  cidr_block     = "10.0.0.0/16"
  display_name   = "booking-api-vcn"
  dns_label      = "bookingapi"
}

resource "oci_core_internet_gateway" "booking_api" {
  compartment_id = var.compartment_ocid
  vcn_id         = oci_core_vcn.booking_api.id
  display_name   = "booking-api-igw"
  enabled        = true
}

resource "oci_core_route_table" "booking_api" {
  compartment_id = var.compartment_ocid
  vcn_id         = oci_core_vcn.booking_api.id
  display_name   = "booking-api-rt"

  route_rules {
    destination       = "0.0.0.0/0"
    network_entity_id = oci_core_internet_gateway.booking_api.id
  }
}

resource "oci_core_security_list" "booking_api" {
  compartment_id = var.compartment_ocid
  vcn_id         = oci_core_vcn.booking_api.id
  display_name   = "booking-api-security-list"

  egress_security_rules {
    destination = "0.0.0.0/0"
    protocol    = "all"
  }

  ingress_security_rules {
    source   = "0.0.0.0/0"
    protocol = "6"
    tcp_options {
      min = 22
      max = 22
    }
  }

  ingress_security_rules {
    source   = "0.0.0.0/0"
    protocol = "6"
    tcp_options {
      min = 3000
      max = 3000
    }
  }
}

resource "oci_core_subnet" "booking_api" {
  compartment_id             = var.compartment_ocid
  vcn_id                     = oci_core_vcn.booking_api.id
  cidr_block                 = "10.0.1.0/24"
  display_name               = "booking-api-subnet"
  dns_label                  = "bookingapisub"
  route_table_id             = oci_core_route_table.booking_api.id
  security_list_ids          = [oci_core_security_list.booking_api.id]
  prohibit_public_ip_on_vnic = false
}
```

- [ ] **Step 2: Validate**

Run: `cd infra/terraform && terraform validate && terraform fmt -check`
Expected: both succeed with no output (or `fmt -check` prints nothing if already formatted; run `terraform fmt` first if it complains).

- [ ] **Step 3: Commit**

```bash
git add infra/terraform/network.tf
git commit -m "infra: vcn, subnet, and security list allowing ssh and app port"
```

---

## Task 3: OCI Registry Repository

**Files:**

- Create: `infra/terraform/registry.tf`

**Interfaces:**

- Consumes: `var.compartment_ocid` (Task 1).
- Produces: `oci_artifacts_container_repository.booking_api`, `data.oci_objectstorage_namespace.ns` (the OCIR namespace, needed to compute the full image path — reused by Task 4's cloud-init and Task 6's outputs).

- [ ] **Step 1: Write `infra/terraform/registry.tf`**

```hcl
data "oci_objectstorage_namespace" "ns" {
  compartment_id = var.compartment_ocid
}

resource "oci_artifacts_container_repository" "booking_api" {
  compartment_id = var.compartment_ocid
  display_name   = "booking-api"
  is_public      = false
}
```

- [ ] **Step 2: Validate**

Run: `cd infra/terraform && terraform validate`
Expected: `Success! The configuration is valid.`

- [ ] **Step 3: Commit**

```bash
git add infra/terraform/registry.tf
git commit -m "infra: oci registry repository for the app image"
```

---

## Task 4: Compute Instance (Postgres + App via Docker, cloud-init)

**Files:**

- Create: `infra/terraform/compute.tf`
- Create: `infra/terraform/cloud-init.yaml.tpl`

**Interfaces:**

- Consumes: `oci_core_subnet.booking_api` (Task 2), `data.oci_objectstorage_namespace.ns` (Task 3), `var.ssh_public_key`, `var.jwt_secret`, `var.postgres_password`, `var.region`, `var.compartment_ocid`, `var.tenancy_ocid` (Task 1).
- Produces: `oci_core_instance.booking_api` — its `public_ip` is consumed by Task 6's `outputs.tf` and by the `deploy.yml` workflow (Task 7) as the SSH target.

- [ ] **Step 1: Write `infra/terraform/cloud-init.yaml.tpl`**

```yaml
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
```

Note: only `postgres` is brought up at boot — `app` references an image that doesn't exist in OCIR yet on first `terraform apply` (nothing has been pushed). The `deploy.yml` workflow (Task 7) runs `docker compose up -d` for the full stack once the first image is pushed.

- [ ] **Step 2: Write `infra/terraform/compute.tf`**

```hcl
data "oci_identity_availability_domains" "ads" {
  compartment_id = var.tenancy_ocid
}

data "oci_core_images" "ubuntu_arm" {
  compartment_id           = var.compartment_ocid
  operating_system         = "Canonical Ubuntu"
  operating_system_version = "22.04"
  shape                    = "VM.Standard.A1.Flex"
  sort_by                  = "TIMECREATED"
  sort_order                = "DESC"
}

resource "oci_core_instance" "booking_api" {
  compartment_id      = var.compartment_ocid
  availability_domain = data.oci_identity_availability_domains.ads.availability_domains[0].name
  display_name         = "booking-api-instance"
  shape                = "VM.Standard.A1.Flex"

  shape_config {
    ocpus         = 2
    memory_in_gbs = 12
  }

  create_vnic_details {
    subnet_id        = oci_core_subnet.booking_api.id
    assign_public_ip = true
  }

  source_details {
    source_type            = "image"
    source_id               = data.oci_core_images.ubuntu_arm.images[0].id
    boot_volume_size_in_gbs = 100
  }

  metadata = {
    ssh_authorized_keys = var.ssh_public_key
    user_data = base64encode(templatefile("${path.module}/cloud-init.yaml.tpl", {
      jwt_secret        = var.jwt_secret
      postgres_password = var.postgres_password
      app_image         = "${var.region}.ocir.io/${data.oci_objectstorage_namespace.ns.namespace}/${oci_artifacts_container_repository.booking_api.display_name}:latest"
    }))
  }
}
```

- [ ] **Step 3: Validate**

Run: `cd infra/terraform && terraform validate && terraform fmt -check`
Expected: both succeed.

- [ ] **Step 4: Commit**

```bash
git add infra/terraform/compute.tf infra/terraform/cloud-init.yaml.tpl
git commit -m "infra: a1.flex compute instance running postgres+app via docker compose"
```

---

## Task 5: Outputs

**Files:**

- Create: `infra/terraform/outputs.tf`

**Interfaces:**

- Consumes: `oci_core_instance.booking_api.public_ip` (Task 4), `data.oci_objectstorage_namespace.ns` and `oci_artifacts_container_repository.booking_api` (Task 3).
- Produces: `terraform output instance_public_ip`, `terraform output registry_repository` — the values you'll copy into GitHub Actions secrets/variables in Task 7.

- [ ] **Step 1: Write `infra/terraform/outputs.tf`**

```hcl
output "instance_public_ip" {
  value = oci_core_instance.booking_api.public_ip
}

output "registry_repository" {
  value = "${var.region}.ocir.io/${data.oci_objectstorage_namespace.ns.namespace}/${oci_artifacts_container_repository.booking_api.display_name}"
}
```

- [ ] **Step 2: Full validation of the complete configuration**

Run: `cd infra/terraform && terraform validate && terraform fmt -check && echo "all valid"`
Expected: `all valid` printed, no errors.

- [ ] **Step 3: Commit**

```bash
git add infra/terraform/outputs.tf
git commit -m "infra: terraform outputs for instance ip and registry path"
```

---

## Task 6: `terraform plan` Dry Run (User-Executed)

**Files:** none — verification only. **This step requires your own OCI credentials; it is not something to run unattended.**

- [ ] **Step 1: Copy the example vars and fill in real values**

Run: `cd infra/terraform && cp terraform.tfvars.example terraform.tfvars`
Then edit `terraform.tfvars` with your actual `tenancy_ocid`, `user_ocid`, `fingerprint`, `private_key_path`, `region`, `compartment_ocid`, `ssh_public_key`, `jwt_secret`, `postgres_password`. Leave `app_image` as the placeholder from the example — it's only used inside the instance, doesn't need to resolve at plan time.

- [ ] **Step 2: Run a plan (read-only, does not create anything)**

Run: `terraform plan -var-file=terraform.tfvars`
Expected: a plan showing ~9 resources to add (VCN, IGW, route table, security list, subnet, registry repo, compute instance, plus data source reads) and zero to destroy. Review it.

- [ ] **Step 3: When ready, apply it yourself**

Run: `terraform apply -var-file=terraform.tfvars`
This is a real, deliberate action outside this plan's automated steps — confirm the plan output looks right before typing `yes`.

- [ ] **Step 4: Record the outputs for Task 7**

Run: `terraform output`
Expected: `instance_public_ip` and `registry_repository` printed — you'll need both for the GitHub Actions secrets/variables in the next task.

---

## Task 7: GitHub Actions `deploy` Job

**Files:**

- Create: `.github/workflows/deploy.yml`

**Interfaces:**

- Consumes: `Dockerfile` (core API plan), `instance_public_ip` and `registry_repository` (Task 6's `terraform output`).
- Produces: `deploy.yml`, runs only on push to `main`, builds + pushes the image to OCIR, then SSHes into the instance to pull and restart.

- [ ] **Step 1: Write `.github/workflows/deploy.yml`**

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4

      - name: Log in to OCIR
        uses: docker/login-action@v3
        with:
          registry: ${{ vars.OCI_REGION }}.ocir.io
          username: ${{ vars.OCI_NAMESPACE }}/${{ secrets.OCI_AUTH_USER }}
          password: ${{ secrets.OCI_AUTH_TOKEN }}

      - uses: docker/setup-buildx-action@v3

      - name: Build and push image
        run: |
          IMAGE="${{ vars.OCI_REGION }}.ocir.io/${{ vars.OCI_NAMESPACE }}/booking-api:${{ github.sha }}"
          LATEST="${{ vars.OCI_REGION }}.ocir.io/${{ vars.OCI_NAMESPACE }}/booking-api:latest"
          docker build -t "$IMAGE" -t "$LATEST" -f Dockerfile .
          docker push "$IMAGE"
          docker push "$LATEST"

      - name: Pull and restart the app container on the instance
        uses: appleboy/ssh-action@v1.0.3
        with:
          host: ${{ vars.OCI_INSTANCE_IP }}
          username: ubuntu
          key: ${{ secrets.OCI_SSH_PRIVATE_KEY }}
          script: |
            cd /opt/booking-api
            docker compose pull app
            docker compose up -d
```

- [ ] **Step 2: Validate YAML syntax**

Run: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/deploy.yml'))" && echo "valid yaml"`
Expected: `valid yaml` printed.

- [ ] **Step 3: Document the required repo secrets/variables** (set these in GitHub repo Settings → Secrets and variables → Actions — this is a manual, one-time step for you, not something to script):
  - Secret `OCI_AUTH_USER` — your OCI username (e.g. `oracleidentitycloudservice/you@example.com`)
  - Secret `OCI_AUTH_TOKEN` — an OCI auth token generated for that user (Profile → Auth Tokens in the OCI console), used as the registry password
  - Secret `OCI_SSH_PRIVATE_KEY` — the private key matching `ssh_public_key` in `terraform.tfvars`
  - Variable `OCI_REGION` — e.g. `us-ashburn-1`
  - Variable `OCI_NAMESPACE` — the Object Storage/registry namespace (from `terraform output registry_repository`, the segment between `.ocir.io/` and `/booking-api`)
  - Variable `OCI_INSTANCE_IP` — from `terraform output instance_public_ip`

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/deploy.yml
git commit -m "ci: add main-only deploy job pushing to ocir and restarting the instance"
```

---

## Task 8: First Deploy Verification (User-Executed)

**Files:** none — verification only. **Requires the real instance from Task 6 and secrets from Task 7 to be in place.**

- [ ] **Step 1: Push to `main`** (or merge a PR into it) to trigger the `deploy` job

Run: `gh run watch` (or check the Actions tab)
Expected: `deploy` job succeeds — image built, pushed, container pulled and restarted.

- [ ] **Step 2: Confirm the app is reachable and healthy**

Run: `curl -s http://<instance_public_ip>:3000/health`
Expected: `{"status":"ok","db":"ok"}`.
