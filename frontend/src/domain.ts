export type Post = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  contentHtml: string;
  status: 'draft' | 'published';
  author: string;
  tags: string[];
  seoTitle: string | null;
  seoDescription: string | null;
  coverImage: string | null;
  source: 'admin' | 'ai' | 'legacy';
  createdAt: string;
  updatedAt: string;
};

export type AdminSettings = {
  masterPrompt: string;
  generationTime: string;
  generationFrequency: 'daily' | 'weekly';
  generationMode: 'daily' | 'weekly';
  generationCount: number;
  generationTimes: string[];
  generationWeekdays: number[];
  autoGenerationEnabled: boolean;
  timezone: string;
  openRouterModel: string;
  openRouterSiteUrl: string;
  openRouterTimeoutMs: number;
  openRouterMaxInputChars: number;
  openRouterMaxOutputTokens: number;
  openRouterTemperature: number;
  openRouterRetryAttempts: number;
  openRouterApiKey: string;
  hasOpenRouterApiKey: boolean;
  clearOpenRouterApiKey?: boolean;
};

export type Article = Post & {
  cover: string;
  category: string;
  readingTime: number;
  views: number;
};
