export class Mutex {
  private queue: Array<() => void> = [];
  private locked = false;

  async acquire(): Promise<() => void> {
    return new Promise((resolve) => {
      this.queue.push(() => resolve(() => this.release()));
      this.dispatch();
    });
  }

  private dispatch(): void {
    if (this.locked) return;
    const next = this.queue.shift();
    if (!next) return;
    this.locked = true;
    next();
  }

  release(): void {
    this.locked = false;
    this.dispatch();
  }

  async runExclusive<T>(callback: () => Promise<T>): Promise<T> {
    const releaseFn = await this.acquire();
    try {
      return await callback();
    } finally {
      releaseFn();
    }
  }
}
