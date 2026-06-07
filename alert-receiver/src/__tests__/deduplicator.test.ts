import { Deduplicator } from '../deduplicator';

// Mock ioredis
const mockSet = jest.fn();
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    set: mockSet,
  }));
});

import Redis from 'ioredis';

describe('Deduplicator', () => {
  let deduplicator: Deduplicator;

  beforeEach(() => {
    jest.clearAllMocks();
    const redis = new Redis();
    deduplicator = new Deduplicator(redis);
  });

  it('returns true for a new (unseen) dedupKey', async () => {
    mockSet.mockResolvedValueOnce('OK');
    const result = await deduplicator.isNew('abc123');
    expect(result).toBe(true);
    expect(mockSet).toHaveBeenCalledWith('dedup:abc123', '1', 'EX', 300, 'NX');
  });

  it('returns false for a duplicate dedupKey', async () => {
    mockSet.mockResolvedValueOnce(null);
    const result = await deduplicator.isNew('abc123');
    expect(result).toBe(false);
  });

  it('uses the correct key prefix', async () => {
    mockSet.mockResolvedValueOnce('OK');
    await deduplicator.isNew('mykey');
    expect(mockSet).toHaveBeenCalledWith(
      expect.stringContaining('dedup:'),
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything()
    );
  });

  it('sets the correct TTL of 300 seconds', async () => {
    mockSet.mockResolvedValueOnce('OK');
    await deduplicator.isNew('ttltest');
    const callArgs = mockSet.mock.calls[0];
    expect(callArgs[2]).toBe('EX');
    expect(callArgs[3]).toBe(300);
  });
});
