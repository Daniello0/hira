import { FeedbackRating } from '@hira/contracts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useFeedback } from './feedback.store';

const send = vi.hoisted(() => vi.fn());

vi.mock('./vacancy-api', () => ({
  sendFeedback: (...args: unknown[]) => send(...args),
}));

describe('feedback votes', () => {
  beforeEach(() => {
    send.mockReset();
    useFeedback.setState({ votes: {}, errors: {}, pending: {} });
  });

  it('ignores a second click until the first request finishes', async () => {
    let finish: (value: null) => void = () => undefined;
    send.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    const first = useFeedback.getState().vote('m', 'v', FeedbackRating.Relevant);
    void useFeedback.getState().vote('m', 'v', FeedbackRating.Irrelevant);
    expect(send).toHaveBeenCalledTimes(1);
    finish(null);
    await first;
    expect(useFeedback.getState().votes['m:v']).toBeUndefined();
    expect(useFeedback.getState().pending['m:v']).toBe(false);
  });
});
