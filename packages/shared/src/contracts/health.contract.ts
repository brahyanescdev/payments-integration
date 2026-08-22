import { z } from 'zod';

/**
 * Liveness payload returned by `GET /health`.
 *
 * App Runner polls this endpoint to decide whether a deployment is healthy, and the
 * Playwright harness waits on it before starting a run, so its shape is part of the
 * published contract rather than an incidental debug response.
 */
export const healthResponseSchema = z.object({
  status: z.literal('ok'),
  /** ISO-8601 timestamp produced by the server at the moment of the check. */
  timestamp: z.string().datetime(),
  /** Deployed application version, taken from the package manifest. */
  version: z.string().min(1),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
