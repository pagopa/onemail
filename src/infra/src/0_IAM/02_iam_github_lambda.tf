data "aws_s3_bucket" "lambda_code_bucket" {
  bucket = var.lambda_code_bucket_name
}

resource "aws_iam_role" "github_lambda_deploy" {
  name        = "${local.project}-deploy-lambda-role"
  description = "Role to deploy lambda functions with github actions."
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow",
        Principal = {
          "Federated" : "arn:aws:iam::${data.aws_caller_identity.current.account_id}:oidc-provider/token.actions.githubusercontent.com"
        },
        Action = "sts:AssumeRoleWithWebIdentity",
        Condition = {
          StringEquals = {
            "token.actions.githubusercontent.com:aud" : "sts.amazonaws.com"
          }
          StringLike = {
            "token.actions.githubusercontent.com:sub" : [
              "repo:${var.github_repository}:environment:dev",
              "repo:${var.github_repository}:environment:uat",
              "repo:${var.github_repository}:environment:prod",
              "repo:${var.github_repository}:ref:refs/heads/main"
            ]
          }
        }
      }
    ]
  })
}

resource "aws_iam_policy" "deploy_lambda" {
  name        = "${local.project}-deploy-lambda-policy"
  description = "Policy to deploy Lambda functions"

  policy = jsonencode({

    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "lambda:CreateFunction",
          "lambda:UpdateFunctionCode",
          "lambda:UpdateFunctionConfiguration"
        ]
        Resource = "*"
      },
      {
        Action = [
          "s3:PutObject",
          "s3:GetObject"
        ]
        Effect = "Allow"
        Resource = [
          "${data.aws_s3_bucket.lambda_code_bucket.arn}/*"
        ]
      },
    ]
  })
}

resource "aws_iam_role_policy_attachment" "deploy_lambda" {
  role       = aws_iam_role.github_lambda_deploy.name
  policy_arn = aws_iam_policy.deploy_lambda.id
}
