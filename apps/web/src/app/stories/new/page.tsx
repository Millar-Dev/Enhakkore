import { PublicShell } from '@/components/layout/PublicShell';
import { StoryForm } from '@/components/public/StoryForm';

export const metadata = { title: 'Share a story' };

export default function NewStoryPage() {
  return (
    <PublicShell>
      <section className="shell max-w-2xl py-12">
        <p className="kicker">Community stories</p>
        <h1 className="display-md mt-3 text-acacia-700">Share a story</h1>
        <p className="mt-3 text-ink-soft">A place you found, an activity you loved, a trip worth remembering. Stories are read by the team before they appear.</p>
        <div className="mt-8"><StoryForm /></div>
      </section>
    </PublicShell>
  );
}
