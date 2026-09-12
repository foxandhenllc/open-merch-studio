export type RetentionReport = {
  available: boolean;
  graceDays: number;
  scanned: number;
  eligible: number;
  fileCount: number;
  bytes: number;
  cleared: number;
  failed: number;
  nextCursor?: string;
};
