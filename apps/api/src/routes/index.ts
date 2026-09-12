import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { route } from '../lib/http';
import { paymentGateway } from '../services/payments';
import { hasDemoData, platformStats } from '../services/stats';
import { adminRouter } from './admin';
import { authRouter } from './auth';
import { bookingsRouter } from './bookings';
import { conversationsRouter } from './conversations';
import { destinationsRouter } from './destinations';
import { impactRouter } from './impact';
import { meRouter } from './me';
import { organizersRouter } from './organizers';
import { requestsRouter } from './requests';
import { tripsRouter } from './trips';

export const apiRouter = Router();

apiRouter.get(
  '/health',
  route(async (_req, res) => {
    await prisma.$queryRaw`SELECT 1`;
    const gateway = paymentGateway();
    res.json({
      status: 'ok',
      time: new Date().toISOString(),
      // Stated plainly so no client has to guess whether money can actually move.
      payments: { provider: gateway.name, live: gateway.isLive },
      demoData: await hasDemoData(),
    });
  }),
);

/** Public counters used by the homepage and the impact dashboard. */
apiRouter.get(
  '/stats',
  route(async (_req, res) => {
    const stats = await platformStats();
    res.json({
      travellersInvolved: stats.totalTravellers,
      projectsSupported: stats.projectsSupported,
      communitiesReached: stats.communitiesReached,
      totalContributions: stats.impactContributions,
      publishedTrips: stats.publishedTrips,
      activeOrganizers: stats.activeOrganizers,
      isDemoData: stats.isDemoData,
    });
  }),
);

apiRouter.use('/auth', authRouter);
apiRouter.use('/trips', tripsRouter);
apiRouter.use('/destinations', destinationsRouter);
apiRouter.use('/organizers', organizersRouter);
apiRouter.use('/bookings', bookingsRouter);
apiRouter.use('/impact', impactRouter);
apiRouter.use('/conversations', conversationsRouter);
apiRouter.use('/requests', requestsRouter);
apiRouter.use('/me', meRouter);
apiRouter.use('/admin', adminRouter);
