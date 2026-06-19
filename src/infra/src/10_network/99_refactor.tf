# Temporary state address migrations for the multi-region network refactor.
moved {
  from = aws_route53_record.dns_records["root_ga_alias"]
  to   = aws_route53_record.dns_alias_records["root_ga_alias"]
}

moved {
  from = module.acm.aws_route53_record.validation[0]
  to   = aws_route53_record.alb_certificate_validation[0]
}

moved {
  from = module.acm.aws_acm_certificate_validation.this[0]
  to   = aws_acm_certificate_validation.alb
}