import type { Metadata } from 'next';
import SignInPage from '@/app/signin/page';

/** The team's sign-in: the same secure form as members (password, then a two-factor code when switched on). */
export const metadata: Metadata = { title: 'Control centre sign-in', robots: { index: false, follow: false } };

export default SignInPage;
