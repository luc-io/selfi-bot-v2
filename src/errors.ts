export class FalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FalError';
  }
}