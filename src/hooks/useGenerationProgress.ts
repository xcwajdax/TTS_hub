// Compatibility shim: the legacy single-job hook now reads from JobsContext.
// New code should use `useLatestJobProgress` / `useJobs` directly.
export {
  PHASE_LABEL,
  useLatestJobProgress as useGenerationProgress,
  type JobProgressView as GenerationProgress,
  type Phase,
} from "../context/JobsContext";
