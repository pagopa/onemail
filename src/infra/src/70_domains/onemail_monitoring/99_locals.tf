locals {
  project_nodomain              = "${var.prefix}-${var.env_short}-${var.location_short}"
  project_nodomain_ses          = "${var.prefix}-${var.env_short}"
  alarm_topic_arn               = try(aws_sns_topic.alerts[0].arn, null)
  alarm_actions                 = compact([local.alarm_topic_arn])
  emails                        = var.alarm_subscribers != "" ? split(",", data.aws_ssm_parameter.alarm_subscribers[0].value) : []
  tenants_file_path             = "${path.module}/../../data/tenants/tenants.json"
  raw_tenants                   = jsondecode(file(local.tenants_file_path))
  tenant_name_prefix            = "${local.project_nodomain_ses}-tenant"
  configuration_set_name_prefix = "${local.project_nodomain_ses}-configuration-set"

  lambda_alarm_targets = {
    sender = {
      function_name = "${local.project_nodomain}-lambda-sender"
      label         = "sender"
    }
    config_set_processor = {
      function_name = "${local.project_nodomain}-lambda-config-set-processor"
      label         = "config-set-processor"
    }
  }
  sqs_alarm_targets = {
    high_priority = {
      queue_name      = "${local.project_nodomain}-sqs-high-priority"
      max_age_seconds = var.sqs_alarm_max_age_seconds.high_priority
      label           = "high-priority"
    }
    low_priority = {
      queue_name      = "${local.project_nodomain}-sqs-low-priority"
      max_age_seconds = var.sqs_alarm_max_age_seconds.low_priority
      label           = "low-priority"
    }
    config_set_processor = {
      queue_name      = "${local.project_nodomain}-sqs-config-set-processor"
      max_age_seconds = var.sqs_alarm_max_age_seconds.config_set_processor
      label           = "config-set-processor"
    }
  }
  ecs_cluster_name       = "${local.project_nodomain}-ecs-cluster"
  ecs_service_name       = "${local.project_nodomain}-ecs-service"
  api_gateway_name       = "${local.project_nodomain}-api-gateway"
  api_gateway_stage_name = var.env
  ses_event_rule_name    = "${local.project_nodomain}-${var.env}-ses-central-rule"

  infra_alarms = merge(
    {
      for key, queue in local.sqs_alarm_targets : "sqs_oldest_message_age_${key}" => merge(
        var.infra_alarm_templates.sqs_oldest_message_age,
        {
          alarm_name        = "${queue.queue_name}-oldest-message-age"
          alarm_description = "The oldest message in the ${queue.label} queue is older than ${queue.max_age_seconds} seconds."
          threshold         = queue.max_age_seconds
          dimensions = {
            QueueName = queue.queue_name
          }
        }
      )
    },
    {
      for key, lambda_target in local.lambda_alarm_targets : "lambda_errors_${key}" => merge(
        var.infra_alarm_templates.lambda_errors,
        {
          alarm_name        = "${lambda_target.function_name}-errors"
          alarm_description = "The ${lambda_target.label} Lambda function reported at least ${var.infra_alarm_templates.lambda_errors.threshold} errors in the last ${var.infra_alarm_templates.lambda_errors.period / 60} minutes."
          dimensions = {
            FunctionName = lambda_target.function_name
          }
        }
      )
    },
    {
      for key, lambda_target in local.lambda_alarm_targets : "lambda_throttles_${key}" => merge(
        var.infra_alarm_templates.lambda_throttles,
        {
          alarm_name        = "${lambda_target.function_name}-throttles"
          alarm_description = "The ${lambda_target.label} Lambda function was throttled at least ${var.infra_alarm_templates.lambda_throttles.threshold} times in the last ${var.infra_alarm_templates.lambda_throttles.period / 60} minutes."
          dimensions = {
            FunctionName = lambda_target.function_name
          }
        }
      )
    },
    {
      ses_rule_failed_invocations = merge(
        var.infra_alarm_templates.ses_rule_failed_invocations,
        {
          alarm_name        = "${local.ses_event_rule_name}-failed-invocations"
          alarm_description = "The SES EventBridge rule failed at least ${var.infra_alarm_templates.ses_rule_failed_invocations.threshold} invocations in the last ${var.infra_alarm_templates.ses_rule_failed_invocations.period / 60} minutes."
          dimensions = {
            RuleName = local.ses_event_rule_name
          }
        }
      )
      ecs_running_task_count = merge(
        var.infra_alarm_templates.ecs_running_task_count,
        {
          alarm_name        = "${local.ecs_service_name}-running-task-count"
          alarm_description = "The ECS dispatcher service running task count dropped below ${var.infra_alarm_templates.ecs_running_task_count.threshold}."
          dimensions = {
            ClusterName = local.ecs_cluster_name
            ServiceName = local.ecs_service_name
          }
        }
      )
      ecs_high_cpu_utilization = merge(
        var.infra_alarm_templates.ecs_high_cpu_utilization,
        {
          alarm_name        = "${local.ecs_service_name}-high-cpu-utilization"
          alarm_description = "The ECS dispatcher service CPU utilization has been above ${var.infra_alarm_templates.ecs_high_cpu_utilization.threshold}% for ${var.infra_alarm_templates.ecs_high_cpu_utilization.evaluation_periods * var.infra_alarm_templates.ecs_high_cpu_utilization.period / 60} minutes."
          dimensions = {
            ClusterName = local.ecs_cluster_name
            ServiceName = local.ecs_service_name
          }
        }
      )
      ecs_high_memory_utilization = merge(
        var.infra_alarm_templates.ecs_high_memory_utilization,
        {
          alarm_name        = "${local.ecs_service_name}-high-memory-utilization"
          alarm_description = "The ECS dispatcher service memory utilization has been above ${var.infra_alarm_templates.ecs_high_memory_utilization.threshold}% for ${var.infra_alarm_templates.ecs_high_memory_utilization.evaluation_periods * var.infra_alarm_templates.ecs_high_memory_utilization.period / 60} minutes."
          dimensions = {
            ClusterName = local.ecs_cluster_name
            ServiceName = local.ecs_service_name
          }
        }
      )
      api_gateway_5xx_errors = merge(
        var.infra_alarm_templates.api_gateway_5xx_errors,
        {
          alarm_name        = "${local.api_gateway_name}-${local.api_gateway_stage_name}-5xx-errors"
          alarm_description = "The API Gateway stage returned at least ${var.infra_alarm_templates.api_gateway_5xx_errors.threshold} 5XX responses in the last ${var.infra_alarm_templates.api_gateway_5xx_errors.period / 60} minutes."
          dimensions = {
            ApiName = local.api_gateway_name
            Stage   = local.api_gateway_stage_name
          }
        }
      )
      api_gateway_high_latency = merge(
        var.infra_alarm_templates.api_gateway_high_latency,
        {
          alarm_name        = "${local.api_gateway_name}-${local.api_gateway_stage_name}-high-latency"
          alarm_description = "The API Gateway stage p95 latency has been above ${var.infra_alarm_templates.api_gateway_high_latency.threshold} ms for ${var.infra_alarm_templates.api_gateway_high_latency.evaluation_periods * var.infra_alarm_templates.api_gateway_high_latency.period / 60} minutes."
          dimensions = {
            ApiName = local.api_gateway_name
            Stage   = local.api_gateway_stage_name
          }
        }
      )
    }
  )

  tenants = {
    for tenant_key, tenant_data in local.raw_tenants : tenant_key => {
      tenant_name            = "${local.tenant_name_prefix}-${tenant_key}"
      configuration_set_name = "${local.configuration_set_name_prefix}-${tenant_key}"
    }
  }

  # --- Custom application metric alarms ---

  custom_alarms_config_set_processor = {
    for key, tpl in var.custom_alarm_config.config_set_processor : key => merge(tpl, {
      alarm_name        = "${local.project_nodomain}-csp-${tpl.metric_name}"
      alarm_description = "The config-set-processor emitted at least ${tpl.threshold} ${tpl.metric_name} event(s) in the last ${tpl.period / 60} minutes."
      namespace         = local.project_nodomain
      dimensions = merge(
        { service = "${local.project_nodomain}-lambda-config-set-processor" },
        tpl.extra_dimensions
      )
    })
  }

  dispatcher_metrics_with_client_id = toset(["UnauthorizedTenant"])

  custom_alarms_dispatcher = merge([
    for key, tpl in var.custom_alarm_config.dispatcher : {
      for tenant_key, tenant in local.tenants : "${key}_${tenant_key}" => merge(tpl, {
        alarm_name        = "${local.project_nodomain}-dispatcher-${tpl.metric_name}-${tenant_key}"
        alarm_description = "The dispatcher emitted at least ${tpl.threshold} ${tpl.metric_name} event(s) for tenant ${tenant_key} in the last ${tpl.period / 60} minutes."
        namespace         = local.project_nodomain
        dimensions = {
          service    = "${local.project_nodomain}-ecs-dispatcher"
          tenantName = tenant.tenant_name
        }
      }) if !contains(local.dispatcher_metrics_with_client_id, tpl.metric_name)
    }
  ]...)

  custom_alarms_dispatcher_search = merge([
    for key, tpl in var.custom_alarm_config.dispatcher : {
      for tenant_key, tenant in local.tenants : "${key}_${tenant_key}" => merge(tpl, {
        alarm_name        = "${local.project_nodomain}-dispatcher-${tpl.metric_name}-${tenant_key}"
        alarm_description = "The dispatcher emitted at least ${tpl.threshold} ${tpl.metric_name} event(s) for tenant ${tenant_key} in the last ${tpl.period / 60} minutes."
        namespace         = local.project_nodomain
        service_name      = "${local.project_nodomain}-ecs-dispatcher"
        tenant_name       = tenant.tenant_name
      }) if contains(local.dispatcher_metrics_with_client_id, tpl.metric_name)
    }
  ]...)

  sender_metrics_with_client_id = toset(["HighPriorityRejected", "LowPriorityRejected", "HighPriorityExhaustedInternalRetries", "LowPriorityExhaustedInternalRetries"])

  custom_alarms_sender = {
    for key, tpl in var.custom_alarm_config.sender : key => merge(tpl, {
      alarm_name        = "${local.project_nodomain}-sender-${tpl.metric_name}"
      alarm_description = "The sender emitted at least ${tpl.threshold} ${tpl.metric_name} event(s) in the last ${tpl.period / 60} minutes."
      namespace         = local.project_nodomain
      dimensions = {
        service = "${local.project_nodomain}-lambda-sender"
      }
    }) if !contains(local.sender_metrics_with_client_id, tpl.metric_name)
  }

  custom_alarms_sender_search = {
    for key, tpl in var.custom_alarm_config.sender : key => merge(tpl, {
      alarm_name        = "${local.project_nodomain}-sender-${tpl.metric_name}"
      alarm_description = "The sender emitted at least ${tpl.threshold} ${tpl.metric_name} event(s) in the last ${tpl.period / 60} minutes."
      namespace         = local.project_nodomain
      service_name      = "${local.project_nodomain}-lambda-sender"
    }) if contains(local.sender_metrics_with_client_id, tpl.metric_name)
  }

  custom_alarms_config_set_processor_metric_math = {
    for key, tpl in var.config_set_processor_metric_math_alarm_config : key => {
      alarm_name          = "${local.project_nodomain}-csp-${tpl.metric_name}"
      alarm_description   = "The config-set-processor emitted at least ${tpl.threshold} ${tpl.metric_name} event(s) across all tenants in the last ${tpl.period / 60} minutes."
      comparison_operator = tpl.comparison_operator
      evaluation_periods  = tpl.evaluation_periods
      threshold           = tpl.threshold
      treat_missing_data  = tpl.treat_missing_data
      period              = tpl.period
      metric_name         = tpl.metric_name
    }
  }
}
