# general
prefix         = "oml"
env_short      = "p"
env            = "prod"
domain         = "onemail_com"
location       = "eu-south"
location_short = "eus1"
aws_region     = "eu-south-1"


alarm_subscribers = "alarm-subscribers"

sqs_alarm_max_age_seconds = {
	high_priority        = 60
	low_priority         = 600
	config_set_processor = 180
}

infra_alarm_templates = {
	sqs_oldest_message_age = {
		comparison_operator = "GreaterThanOrEqualToThreshold"
		evaluation_periods  = 1
		threshold           = 180
		metric_name         = "ApproximateAgeOfOldestMessage"
		namespace           = "AWS/SQS"
		period              = 300
		statistic           = "Maximum"
		treat_missing_data  = "notBreaching"
	}
	lambda_errors = {
		comparison_operator = "GreaterThanOrEqualToThreshold"
		evaluation_periods  = 1
		threshold           = 1
		metric_name         = "Errors"
		namespace           = "AWS/Lambda"
		period              = 300
		statistic           = "Sum"
		treat_missing_data  = "notBreaching"
	}
	lambda_throttles = {
		comparison_operator = "GreaterThanOrEqualToThreshold"
		evaluation_periods  = 1
		threshold           = 1
		metric_name         = "Throttles"
		namespace           = "AWS/Lambda"
		period              = 300
		statistic           = "Sum"
		treat_missing_data  = "notBreaching"
	}
	ses_rule_failed_invocations = {
		comparison_operator = "GreaterThanOrEqualToThreshold"
		evaluation_periods  = 1
		threshold           = 1
		metric_name         = "FailedInvocations"
		namespace           = "AWS/Events"
		period              = 300
		statistic           = "Sum"
		treat_missing_data  = "notBreaching"
	}
	ecs_running_task_count = {
		comparison_operator = "LessThanThreshold"
		evaluation_periods  = 2
		threshold           = 1
		metric_name         = "RunningTaskCount"
		namespace           = "AWS/ECS"
		period              = 300
		statistic           = "Minimum"
		treat_missing_data  = "missing"
	}
	ecs_high_cpu_utilization = {
		comparison_operator = "GreaterThanOrEqualToThreshold"
		evaluation_periods  = 3
		threshold           = 75
		metric_name         = "CPUUtilization"
		namespace           = "AWS/ECS"
		period              = 300
		statistic           = "Average"
		treat_missing_data  = "notBreaching"
	}
	ecs_high_memory_utilization = {
		comparison_operator = "GreaterThanOrEqualToThreshold"
		evaluation_periods  = 3
		threshold           = 75
		metric_name         = "MemoryUtilization"
		namespace           = "AWS/ECS"
		period              = 300
		statistic           = "Average"
		treat_missing_data  = "notBreaching"
	}
	api_gateway_5xx_errors = {
		comparison_operator = "GreaterThanOrEqualToThreshold"
		evaluation_periods  = 1
		threshold           = 2
		metric_name         = "5XXError"
		namespace           = "AWS/ApiGateway"
		period              = 300
		statistic           = "Sum"
		treat_missing_data  = "notBreaching"
	}
	api_gateway_high_latency = {
		comparison_operator = "GreaterThanOrEqualToThreshold"
		evaluation_periods  = 3
		threshold           = 2000
		metric_name         = "Latency"
		namespace           = "AWS/ApiGateway"
		period              = 300
		extended_statistic  = "p95"
		treat_missing_data  = "notBreaching"
	}
}
