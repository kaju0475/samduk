

export async function register() {
  // ⚠️ CRITICAL FIX: Do NOT start backup service during build
  // This was causing `npm run build` to hang indefinitely
  
  if (process.env.NEXT_RUNTIME !== 'nodejs') {
    return; // Skip Edge runtime
  }

  // Skip during production build (Vercel, local npm run build)
  if (process.env.NEXT_PHASE === 'phase-production-build') {
    console.log('[Instrumentation] Skipping backup service during build');
    return;
  }

  // Only start in dev or production server (not build)
  try {
    const { startBackupService } = await import('@/lib/backup-scheduler');
    startBackupService();
    console.log('[Instrumentation] Backup service started successfully');
  } catch (error) {
    console.error('[Instrumentation] Failed to start backup service:', error);
  }
}

