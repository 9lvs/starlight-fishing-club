import { describe, expect, it, vi } from 'vitest';
import { EventBus } from '../src/core/eventBus';

interface TestEvents {
  ping: { n: number };
  pong: { s: string };
}

describe('EventBus', () => {
  it('delivers payloads to listeners of the right type only', () => {
    const bus = new EventBus<TestEvents>();
    const ping = vi.fn();
    const pong = vi.fn();
    bus.on('ping', ping);
    bus.on('pong', pong);
    bus.emit('ping', { n: 1 });
    expect(ping).toHaveBeenCalledWith({ n: 1 });
    expect(pong).not.toHaveBeenCalled();
  });

  it('unsubscribes with the returned function and supports once', () => {
    const bus = new EventBus<TestEvents>();
    const fn = vi.fn();
    const off = bus.on('ping', fn);
    off();
    bus.emit('ping', { n: 1 });
    expect(fn).not.toHaveBeenCalled();
    const onceFn = vi.fn();
    bus.once('ping', onceFn);
    bus.emit('ping', { n: 2 });
    bus.emit('ping', { n: 3 });
    expect(onceFn).toHaveBeenCalledTimes(1);
  });

  it('keeps calling other listeners when one throws', () => {
    const bus = new EventBus<TestEvents>();
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const after = vi.fn();
    bus.on('ping', () => {
      throw new Error('boom');
    });
    bus.on('ping', after);
    bus.emit('ping', { n: 1 });
    expect(after).toHaveBeenCalled();
    spy.mockRestore();
  });
});
