# general
prefix         = "oml"
env_short      = "p"
env            = "prod"
domain         = "onemail_app"
location       = "eu-south"
location_short = "eus1"
aws_region     = "eu-south-1"

# API Gateway
api_gateway_deployment_version = "1.0.0"

# ECS Service
ecs_service_image_name    = "core"
ecs_service_image_version = "latest" #Temporary version to test ECS Service
deploy_role_github_repository = "pagopa/onemail"

# Lambda Sender
lambda_sender = {
  package_path                   = "lambda/hello-nodejs/hello-nodejs.zip"
  reserved_concurrent_executions = -1 #Set based on expected load, Use -1 for unlimited concurrency for now
}