export interface QueueItem {
  index: number;
  status: "pending" | "opened" | "failed" | "skipped";
  record: Record<string, unknown>;
  opened_at: string | null;
  error: string | null;
}
