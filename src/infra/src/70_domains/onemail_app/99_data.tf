data "aws_sqs_queue" "high_priority" {
  name = "${local.project_nodomain}-sqs-high-priority"
}

data "aws_sqs_queue" "low_priority" {
  name = "${local.project_nodomain}-sqs-low-priority"
}

data "aws_vpc_endpoint" "dynamodb" {
  service_name = "com.amazonaws.eu-south-1.dynamodb"
}

data "aws_vpc_endpoint" "api_gtw" {
  service_name = "com.amazonaws.eu-south-1.execute-api"
}

data "aws_lb" "nlb" {
  name = "${local.project_nodomain}-elb"
}

data "aws_dynamodb_table" "EmailStatusHistory" {
  name = "EmailStatusHistory"
}
