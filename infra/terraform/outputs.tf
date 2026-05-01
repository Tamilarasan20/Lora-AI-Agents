output "api_server_ip" {
  description = "Public IPv4 address of the API server"
  value       = hcloud_server.api.ipv4_address
}

output "floating_ip" {
  description = "Floating IP address assigned to the API server"
  value       = hcloud_floating_ip.api.ip_address
}
