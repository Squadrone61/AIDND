import type { DMRequest } from "./types.js";

/**
 * Async queue: WS pushes dm_requests, wait_for_message pops them.
 * No polling, no timers — pure async await.
 */
export class MessageQueue {
  private queue: DMRequest[] = [];
  private waiters: Array<(msg: DMRequest) => void> = [];

  /** Called by WS client when server:dm_request arrives. */
  push(msg: DMRequest): void {
    const waiter = this.waiters.shift();
    if (waiter) {
      waiter(msg);
    } else {
      this.queue.push(msg);
    }
  }

  /** Promise that resolves on next message. Used by wait_for_message tool.
   *  Accepts an optional AbortSignal so the MCP SDK can cancel stale waiters
   *  (e.g. after context compression) without deadlocking the queue. */
  waitForNext(signal?: AbortSignal): Promise<DMRequest> {
    const queued = this.queue.shift();
    if (queued) return Promise.resolve(queued);

    return new Promise<DMRequest>((resolve, reject) => {
      const waiter = (msg: DMRequest) => {
        signal?.removeEventListener("abort", onAbort);
        resolve(msg);
      };

      const onAbort = () => {
        const idx = this.waiters.indexOf(waiter);
        if (idx !== -1) this.waiters.splice(idx, 1);
        reject(new Error("wait_for_message cancelled"));
      };

      if (signal?.aborted) {
        reject(new Error("wait_for_message cancelled"));
        return;
      }

      signal?.addEventListener("abort", onAbort, { once: true });
      this.waiters.push(waiter);
    });
  }

  /** Number of queued messages waiting to be consumed. */
  get pending(): number {
    return this.queue.length;
  }
}
