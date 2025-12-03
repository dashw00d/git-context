export function getStateLogger() {
  return {
    log: (data: { actionType: string; payload: any; stateBefore: any; stateAfter: any }) => {
      // Basic logging - can be enhanced with file logging later
      // We use console.log only if debug mode is enabled (checking env var or config)
      if (process.env.GIT_CONTEXT_DEBUG === '1') {
        console.log('[StateLogger]', data);
      }
    },
    getLogPath: () => null,
  };
}
