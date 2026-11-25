import { Router } from 'express';
import { requireAuth, requireStaff } from '../../middleware/auth';
import { coreRouter } from './core';
import { financeRouter } from './finance';
import { operationsRouter } from './operations';
import { peopleRouter } from './people';
import { resourcesRouter } from './resources';

/**
 * The control centre's API. Every route requires a signed-in team member, and
 * every route then checks the specific permission it needs.
 */
export const controlCentreRouter = Router();

controlCentreRouter.use(requireAuth, requireStaff);
controlCentreRouter.use('/r', resourcesRouter);
controlCentreRouter.use('/finance', financeRouter);
controlCentreRouter.use('/people', peopleRouter);
controlCentreRouter.use(operationsRouter);
controlCentreRouter.use(coreRouter);
