export interface Job {
  id: number | string;
  url: string;
  jobSlug?: string;
  jobTitle?: string;
  companyName?: string;
  companyLogo?: string | false | null;
  jobIndustry?: string[];
  jobType?: string[];
  jobGeo?: string;
  jobLevel?: string;
  jobExcerpt?: string;
  jobDescription?: string;
  pubDate?: string;
  salaryMin?: number | null;
  salaryMax?: number | null;
  salaryCurrency?: string | null;
  salaryPeriod?: string | null;
}

export interface JobFilters {
  /** Page size, from 1 to 200. Defaults to 50. */
  count?: number;
  geo?: string;
  industry?: string;
  tag?: string;
  cursor?: string | null;
}

export interface JobPage {
  jobs: Job[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface JobStatus {
  id: number;
  status: "active" | "closed" | "unknown";
}

export class JobicyError extends Error {
  status: number | null;
  retryAfterSeconds: number | null;
  constructor(message: string, options?: {status?: number | null; retryAfterSeconds?: number | null; cause?: unknown});
}

export class JobicyClient {
  timeout: number;
  apiUrl: string;
  constructor(options?: {timeout?: number; apiUrl?: string});
  getJobs(options?: JobFilters): Promise<Job[]>;
  getJobsPage(options?: JobFilters): Promise<JobPage>;
  iterJobs(options?: JobFilters): AsyncGenerator<Job, void, unknown>;
  getAllJobs(options?: JobFilters): Promise<Job[]>;
  getJobStatuses(ids: Array<number | string>): Promise<JobStatus[]>;
  request(url: string | URL): Promise<unknown>;
}

export function formatSalary(job: Job): string;
