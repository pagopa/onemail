import {
  HealthResponseDTO,
  HealthStatus,
  SimpleHealthResponseDTO,
} from '#dtos/health/health.dto';
import * as HealthService from '#services/health.service';
import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';

export const readinessCheck = async (
  req: Request,
  res: Response<HealthResponseDTO>,
) => {
  const statusRes = await HealthService.healthCheck();
  res.status(StatusCodes.OK).json(statusRes);
};

export const livenessCheck = async (
  req: Request,
  res: Response<SimpleHealthResponseDTO>,
) => {
  const payload: SimpleHealthResponseDTO = {
    status: HealthStatus.Healthy,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  };

  res.status(StatusCodes.OK).json(payload);
};
