terraform {
  required_providers {
    hcloud = {
      source  = "hetznercloud/hcloud"
      version = "~> 1.44"
    }
  }
  backend "s3" {
    # Hetzner Object Storage as S3-compatible backend
    endpoint = "https://fsn1.your-objectstorage.com"
    bucket   = "loraloop-tfstate"
    key      = "terraform.tfstate"
    region   = "us-east-1" # dummy for S3 compat
    skip_credentials_validation = true
    skip_metadata_api_check     = true
    skip_region_validation      = true
    force_path_style            = true
  }
}

provider "hcloud" {
  token = var.hcloud_token
}

# SSH key
resource "hcloud_ssh_key" "deploy" {
  name       = "loraloop-deploy"
  public_key = var.ssh_public_key
}

# API server (CX31 = 2vCPU, 8GB RAM)
resource "hcloud_server" "api" {
  name        = "loraloop-api-${var.environment}"
  image       = "ubuntu-22.04"
  server_type = "cx31"
  location    = "fsn1"
  ssh_keys    = [hcloud_ssh_key.deploy.id]
  labels = {
    env  = var.environment
    role = "api"
  }
  user_data = file("${path.module}/cloud-init.yml")
}

# Firewall
resource "hcloud_firewall" "api" {
  name = "loraloop-api-fw-${var.environment}"
  rule { direction = "in"; protocol = "tcp"; port = "22";   source_ips = ["0.0.0.0/0", "::/0"] }
  rule { direction = "in"; protocol = "tcp"; port = "80";   source_ips = ["0.0.0.0/0", "::/0"] }
  rule { direction = "in"; protocol = "tcp"; port = "443";  source_ips = ["0.0.0.0/0", "::/0"] }
  rule { direction = "in"; protocol = "tcp"; port = "3000"; source_ips = ["0.0.0.0/0", "::/0"] }
}

resource "hcloud_firewall_attachment" "api" {
  firewall_id = hcloud_firewall.api.id
  server_ids  = [hcloud_server.api.id]
}

# Floating IP for zero-downtime deployments
resource "hcloud_floating_ip" "api" {
  type          = "ipv4"
  home_location = "fsn1"
  description   = "loraloop-api-${var.environment}"
}

resource "hcloud_floating_ip_assignment" "api" {
  floating_ip_id = hcloud_floating_ip.api.id
  server_id      = hcloud_server.api.id
}

# Hetzner Managed Database (PostgreSQL 16)
resource "hcloud_managed_database" "postgres" {
  count    = var.use_managed_db ? 1 : 0
  name     = "loraloop-postgres-${var.environment}"
  type     = "pg-2" # 2vCPU, 4GB
  version  = "16"
  location = "fsn1"
}

# Volume for persistent data
resource "hcloud_volume" "data" {
  name     = "loraloop-data-${var.environment}"
  size     = 50 # GB
  location = "fsn1"
  format   = "ext4"
}

resource "hcloud_volume_attachment" "data" {
  volume_id = hcloud_volume.data.id
  server_id = hcloud_server.api.id
  automount = true
}
