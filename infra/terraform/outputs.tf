output "instance_public_ip" {
  value = oci_core_instance.booking_api.public_ip
}

output "registry_repository" {
  value = "${var.region}.ocir.io/${data.oci_objectstorage_namespace.ns.namespace}/${oci_artifacts_container_repository.booking_api.display_name}"
}
