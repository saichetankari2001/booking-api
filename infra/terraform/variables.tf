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
