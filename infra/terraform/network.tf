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
