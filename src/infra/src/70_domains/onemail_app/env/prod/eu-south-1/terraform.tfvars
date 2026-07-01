# general
prefix                            = "oml"
env_short                         = "p"
env                               = "prod"
domain                            = "onemail_app"
location                          = "eu-south"
location_short                    = "eus1"
aws_region                        = "eu-south-1"
ses_multi_region_endpoint_enabled = true
ses_regions                       = ["eu-south-1", "eu-central-1"]

# API Gateway
api_gateway_deployment_version = "1.0.0"
api_gateway_usage_plan_throttle = {
  burst_limit = 1000
  rate_limit  = 200
}

# ECS Service
ecs_service_image_name        = "core"
ecs_service_image_version     = "latest" #Temporary version to test ECS Service
deploy_role_github_repository = "pagopa/onemail"

# Lambda Sender
lambda_sender = {
  package_path                   = "lambda/hello-nodejs/hello-nodejs.zip"
  reserved_concurrent_executions = -1 #Set based on expected load, Use -1 for unlimited concurrency for now
}

#Lambda Config Set Processor
lambda_set_processor = {
  package_path                   = "lambda/hello-nodejs/hello-nodejs.zip"
  reserved_concurrent_executions = -1 #Set based on expected load, Use -1 for unlimited concurrency for now
}
