import { metricsFlush } from '#middlewares/metrics.middleware';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const forceFlushMetrics = vi.hoisted(() => vi.fn());
const onFinished = vi.hoisted(() => vi.fn());

vi.mock('om-common/repositories', () => ({ forceFlushMetrics }));
vi.mock('on-finished', () => ({ default: onFinished }));

beforeEach(() => {
  forceFlushMetrics.mockReset();
  onFinished.mockReset();
});

describe('metricsFlush middleware', () => {
  it('calls next immediately after registering the response listener', () => {
    const next = vi.fn();

    metricsFlush({} as never, {} as never, next);

    expect(next).toHaveBeenCalledOnce();
  });

  it('registers an onFinished listener on the response object', () => {
    const res = {} as never;

    metricsFlush({} as never, res, vi.fn());

    expect(onFinished).toHaveBeenCalledWith(res, expect.any(Function));
  });

  it('flushes metrics when the response finishes', () => {
    metricsFlush({} as never, {} as never, vi.fn());
    const [, callback] = onFinished.mock.calls[0] as [unknown, () => void];

    callback();

    expect(forceFlushMetrics).toHaveBeenCalledOnce();
  });

  it('swallows forceFlushMetrics errors without propagating to the caller', () => {
    forceFlushMetrics.mockImplementation(() => {
      throw new Error('flush failed');
    });
    metricsFlush({} as never, {} as never, vi.fn());
    const [, callback] = onFinished.mock.calls[0] as [unknown, () => void];

    expect(() => callback()).not.toThrow();
  });
});
