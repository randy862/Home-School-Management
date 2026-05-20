const fs = require("fs/promises");
const path = require("path");

function createMaintenanceService(options = {}) {
  const {
    enabled = true,
    cleanupIntervalMs = 60 * 60 * 1000,
    expiredExportBatchSize = 50,
    exportArtifactDir,
    listExpiredCancellationExportRequests,
    markCancellationExportRequestExpired,
    logger = console,
    now = () => Date.now()
  } = options;

  let lastCleanupAtMs = 0;

  async function runDueCleanup() {
    if (!enabled) {
      return { skipped: "disabled" };
    }

    const rawCurrentMs = Number(now());
    const currentMs = Number.isFinite(rawCurrentMs) ? rawCurrentMs : Date.now();
    const safeIntervalMs = Math.max(60 * 1000, Number(cleanupIntervalMs || 0));
    if (lastCleanupAtMs && currentMs - lastCleanupAtMs < safeIntervalMs) {
      return { skipped: "not_due" };
    }

    const result = await cleanupExpiredCancellationExports({
      exportArtifactDir,
      limit: expiredExportBatchSize,
      listExpiredCancellationExportRequests,
      markCancellationExportRequestExpired,
      logger
    });
    lastCleanupAtMs = currentMs;
    return result;
  }

  return {
    cleanupExpiredCancellationExports: () => cleanupExpiredCancellationExports({
      exportArtifactDir,
      limit: expiredExportBatchSize,
      listExpiredCancellationExportRequests,
      markCancellationExportRequestExpired,
      logger
    }),
    runDueCleanup
  };
}

async function cleanupExpiredCancellationExports(options = {}) {
  const {
    exportArtifactDir,
    limit = 50,
    listExpiredCancellationExportRequests,
    markCancellationExportRequestExpired,
    logger = console
  } = options;

  if (!listExpiredCancellationExportRequests || !markCancellationExportRequestExpired) {
    throw new Error("Cancellation export cleanup dependencies are required.");
  }

  const requests = await listExpiredCancellationExportRequests({ limit: safeLimit(limit) });
  const result = {
    checked: requests.length,
    expired: 0,
    deleted: 0,
    missing: 0,
    unsafePath: 0,
    errors: 0
  };

  for (const request of requests) {
    const expired = await markCancellationExportRequestExpired(
      request.id,
      "Export artifact expired and was removed by cleanup."
    );
    if (!expired) continue;
    result.expired += 1;

    if (!request.artifactPath) continue;
    let artifactPath = "";
    try {
      artifactPath = resolveExportArtifactPath(request.artifactPath, exportArtifactDir);
    } catch (error) {
      result.unsafePath += 1;
      logger.warn("Skipped expired export artifact outside configured directory:", {
        exportRequestId: request.id,
        artifactPath: request.artifactPath,
        error: error.message
      });
      continue;
    }

    try {
      await fs.unlink(artifactPath);
      result.deleted += 1;
    } catch (error) {
      if (error.code === "ENOENT") {
        result.missing += 1;
      } else {
        result.errors += 1;
        logger.error("Failed to remove expired export artifact:", {
          exportRequestId: request.id,
          artifactPath,
          error: error.message
        });
      }
    }
  }

  if (result.expired || result.deleted || result.missing || result.unsafePath || result.errors) {
    logger.log("Cancellation export cleanup completed:", result);
  }

  return result;
}

function resolveExportArtifactPath(artifactPath, exportArtifactDir) {
  const exportDir = path.resolve(String(exportArtifactDir || ""));
  const resolved = path.resolve(String(artifactPath || ""));
  const relative = path.relative(exportDir, resolved);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Export artifact path is outside the configured export directory.");
  }
  return resolved;
}

function safeLimit(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 50;
  return Math.max(1, Math.min(500, Math.floor(parsed)));
}

module.exports = {
  cleanupExpiredCancellationExports,
  createMaintenanceService,
  resolveExportArtifactPath
};
