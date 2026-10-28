export function createMutex() {
  let tail = Promise.resolve();

  return {
    async acquire() {
      let release;
      const current = new Promise((resolve) => {
        release = resolve;
      });
      const previous = tail;
      tail = previous.then(() => current);
      await previous;
      return release;
    }
  };
}
