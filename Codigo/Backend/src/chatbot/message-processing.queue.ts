export class MessageProcessingQueue {
  private readonly tails = new Map<string, Promise<void>>();

  enqueue<T>(conversationKey: string, task: () => Promise<T>): Promise<T> {
    const previous = this.tails.get(conversationKey) ?? Promise.resolve();

    const runTask = previous
      .catch(() => undefined)
      .then(task);

    const queueTail = runTask.then(
      () => undefined,
      () => undefined,
    );
    this.tails.set(conversationKey, queueTail);

    return runTask.finally(() => {
      const currentTail = this.tails.get(conversationKey);
      if (currentTail === queueTail) {
        this.tails.delete(conversationKey);
      }
    });
  }
}

