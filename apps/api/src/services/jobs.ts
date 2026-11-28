import { expireGameInvites } from '../routes/gaming';
import { sendSessionReminders } from '../routes/groups';

/**
 * Small recurring jobs: session reminders and expiring gaming invitations.
 *
 * They run inside the API process every few minutes. On a hosting plan that
 * sleeps when idle (Render's free plan), they only run while the API is awake;
 * expiry is also checked whenever an invitation is opened, so nothing depends
 * on the timer alone.
 */
let timer: NodeJS.Timeout | null = null;

export async function runJobsOnce() {
  await Promise.allSettled([sendSessionReminders(), expireGameInvites()]);
}

export function startJobs(intervalMs = 5 * 60 * 1000) {
  if (timer) return;
  timer = setInterval(() => void runJobsOnce().catch((error) => console.error('[jobs]', error)), intervalMs);
  timer.unref();
  void runJobsOnce().catch(() => undefined);
}
