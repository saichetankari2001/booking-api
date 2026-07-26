data "oci_objectstorage_namespace" "ns" {
  compartment_id = var.compartment_ocid
}

resource "oci_artifacts_container_repository" "booking_api" {
  compartment_id = var.compartment_ocid
  display_name   = "booking-api"
  is_public      = false
}
