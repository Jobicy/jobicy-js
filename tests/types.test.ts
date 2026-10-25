import { JobicyClient, JobicyError, type Job, type JobStatus } from "@jobicy/jobs";

async function example(): Promise<Job[]> {
  const client = new JobicyClient({ timeout: 15000 });
  const statuses: JobStatus[] = await client.getJobStatuses([1, "2"]);
  const page = await client.getJobsPage({ count: 100, cursor: null });
  for await (const job of client.iterJobs({ geo: "usa" })) console.log(job.url);
  console.log(statuses, new JobicyError("Example").status);
  // @ts-expect-error counts must be numeric
  void client.getJobs({ count: "100" });
  return page.jobs;
}
void example;
