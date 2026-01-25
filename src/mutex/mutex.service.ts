import { Injectable } from '@nestjs/common';
import { Mutex } from 'async-mutex';

@Injectable()
export class MutexService {
  private mutexes: Map<string, Mutex> = new Map();

  async executeWithLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
    // Get or create mutex for this key
    if (!this.mutexes.has(key)) {
      this.mutexes.set(key, new Mutex());
    }

    const mutex = this.mutexes.get(key)!;

    // Acquire lock and execute function
    return await mutex.runExclusive(async () => {
      return await fn();
    });
  }
}
