import { healthCheck as healthService } from '#services/health.service';
import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';

export const healthCheck = async (req: Request, res: Response) => {
  const statusRes = await healthService();
  res.status(StatusCodes.OK).json(statusRes);
};
