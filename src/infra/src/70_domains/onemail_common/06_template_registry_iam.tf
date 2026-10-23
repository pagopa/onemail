locals {
  template_ses_regions = ["eu-south-1", "eu-central-1"]
  template_resource_arns = flatten([
    for region in local.template_ses_regions : [
      for product, tenant in local.tenants :
      "arn:${data.aws_partition.current.partition}:ses:${region}:${data.aws_caller_identity.current.account_id}:template/${product}_*"
    ]
  ])
  template_tenant_arns = flatten([
    for region in local.template_ses_regions : [
      for tenant in values(local.tenants) :
      "arn:${data.aws_partition.current.partition}:ses:${region}:${data.aws_caller_identity.current.account_id}:tenant/${tenant.tenant_name}/*"
    ]
  ])
  create_template_publish_role = var.aws_region == "eu-south-1" && contains(keys(var.dynamodb_tables), "template")
}

resource "aws_iam_role" "template_publish" {
  count       = local.create_template_publish_role ? 1 : 0
  name        = "${local.project_nodomain_ses}-template-publish-role"
  description = "Direct SES template publication, update and retirement from the protected template repository environment."
  tags        = module.tag_config.tags

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = "sts:AssumeRoleWithWebIdentity"
      Principal = {
        Federated = "arn:${data.aws_partition.current.partition}:iam::${data.aws_caller_identity.current.account_id}:oidc-provider/token.actions.githubusercontent.com"
      }
      Condition = {
        StringEquals = {
          "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
          "token.actions.githubusercontent.com:sub" = "repo:${var.template_github_repository}:environment:${var.env}"
        }
      }
    }]
  })
}

resource "aws_iam_role_policy" "template_publish" {
  count = local.create_template_publish_role ? 1 : 0
  name  = "${local.project_nodomain_ses}-template-publish-policy"
  role  = aws_iam_role.template_publish[0].id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "ManagedTemplates"
        Effect   = "Allow"
        Action   = ["ses:CreateEmailTemplate", "ses:GetEmailTemplate", "ses:UpdateEmailTemplate", "ses:DeleteEmailTemplate", "ses:ListResourceTenants"]
        Resource = local.template_resource_arns
      },
      {
        Sid      = "ConfiguredTenants"
        Effect   = "Allow"
        Action   = ["ses:GetTenant", "ses:ListTenantResources"]
        Resource = local.template_tenant_arns
      },
      {
        Sid      = "TemplateAssociationsOnly"
        Effect   = "Allow"
        Action   = ["ses:CreateTenantResourceAssociation", "ses:DeleteTenantResourceAssociation"]
        Resource = concat(local.template_resource_arns, local.template_tenant_arns)
      },
      {
        Sid      = "PrimaryRegistryItems"
        Effect   = "Allow"
        Action   = ["dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:UpdateItem"]
        Resource = module.dynamodb_table["template"].table_arn
      },
      {
        Sid      = "RegistryEncryption"
        Effect   = "Allow"
        Action   = ["kms:Decrypt", "kms:GenerateDataKey"]
        Resource = module.dynamodb_table["template"].kms_key_arn
        Condition = {
          StringEquals = {
            "kms:ViaService" = "dynamodb.eu-south-1.amazonaws.com"
          }
        }
      }
    ]
  })
}

output "template_publish_role_arn" {
  description = "OIDC role for the template repository's environment-specific direct publication workflow."
  value       = try(aws_iam_role.template_publish[0].arn, null)
}
