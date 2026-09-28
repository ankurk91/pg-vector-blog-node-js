export class PostNotFoundError extends Error {
  constructor(id) {
    super(`Post ${id} not found`);
    this.name = 'PostNotFoundError';
  }
}

export class PostNotEmbeddedError extends Error {
  constructor(id) {
    super(`Post ${id} has no embedding yet`);
    this.name = 'PostNotEmbeddedError';
  }
}
