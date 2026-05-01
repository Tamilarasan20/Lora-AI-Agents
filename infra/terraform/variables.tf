variable "hcloud_token" {
  description = "Hetzner Cloud API token"
  sensitive   = true
}

variable "ssh_public_key" {
  description = "SSH public key to install on the server for deployments"
}

variable "environment" {
  description = "Deployment environment (production, staging)"
  default     = "production"
}

variable "use_managed_db" {
  description = "Whether to provision a Hetzner managed PostgreSQL database"
  type        = bool
  default     = false
}
