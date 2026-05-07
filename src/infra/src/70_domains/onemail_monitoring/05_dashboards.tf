resource "aws_cloudwatch_dashboard" "main" {
  dashboard_name = "${local.project_nodomain}-${var.dashboard_name}"

  dashboard_body = templatefile("${path.module}/../../../dashboards/main.tpl.json",
    {
      aws_region   = var.aws_region
      api_name     = local.api_gateway_name
      status_table = data.aws_dynamodb_table.EmailStatusHistory.name
      tenant_table = data.aws_dynamodb_table.TenantConfig.name
      ecs = {
        cluster_name = data.aws_ecs_cluster.core.cluster_name
        service_name = data.aws_ecs_service.core.service_name
      }
      nlb = {
        arn_suffix              = data.aws_lb.nlb.arn_suffix
        target_group_arn_suffix = data.aws_lb_target_group.ecs_core.arn_suffix
      }
      sqs_high_priority = data.aws_sqs_queue.high_priority.name
      sqs_low_priority  = data.aws_sqs_queue.low_priority.name
      namespace         = local.project_nodomain
      csp_service       = "${local.project_nodomain}-lambda-config-set-processor"
    }
  )
}

resource "aws_cloudwatch_dashboard" "application" {
  dashboard_name = "${local.project_nodomain}-${var.application_dashboard_name}"

  dashboard_body = templatefile("${path.module}/../../../dashboards/application.tpl.json",
    {
      aws_region         = var.aws_region
      namespace          = local.project_nodomain
      sender_service     = "${local.project_nodomain}-lambda-sender"
      dispatcher_service = "${local.project_nodomain}-ecs-dispatcher"
      tenants            = local.tenants
    }
  )
}
