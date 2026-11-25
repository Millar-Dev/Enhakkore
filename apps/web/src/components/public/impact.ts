export interface Project {
  id: string;
  slug: string;
  title: string;
  category: string;
  status: string;
  summary: string;
  description: string;
  beneficiaryGroup: string | null;
  location: string;
  partnerName: string | null;
  partnerNote: string | null;
  heroImage: string;
  gallery: string[];
  videoUrl: string | null;
  beneficiaries: number | null;
  startedAt: string | null;
  completedAt: string | null;
  funding?: { goal: number | null; raised: number; currency: string; contributors: number };
  updates?: { id: string; title: string; body: string; images: string[]; milestone: boolean; publishedAt: string }[];
}
