import { describe, expect, it, vi } from 'vitest';
import { VoicePlayer, type PlayerContext, type PlayerGain, type PlayerSource } from './voice-player';

function fakeContext(state = 'running') {
  const sources: Array<PlayerSource & { startedAt: number }> = [];
  const gains: PlayerGain[] = [];
  const context: PlayerContext = {
    currentTime: 10,
    destination: {},
    state,
    resume: vi.fn(async () => undefined),
    decodeAudioData: async () => ({ duration: 2, sampleRate: 1000, getChannelData: () => new Float32Array(2000).fill(0.5) }),
    createGain: () => gains.at(gains.push({ gain: { setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), cancelScheduledValues: vi.fn() }, connect: vi.fn() }) - 1) as PlayerGain,
    createBufferSource: () => {
      const source = { buffer: null, onended: null, startedAt: -1, connect: vi.fn(), start(when: number) { this.startedAt = when; }, stop: vi.fn() };
      sources.push(source);
      return source;
    },
  };
  return { context, sources, gains };
}

const bytes = new ArrayBuffer(4);

describe('voice player', () => {
  it('plays pieces one after another, with a breath between them', async () => {
    const { context, sources } = fakeContext();
    const player = new VoicePlayer(context);
    void player.play(bytes);
    void player.play(bytes);
    await vi.waitFor(() => expect(sources).toHaveLength(2));
    expect(sources[0]?.startedAt).toBe(10);
    expect(sources[1]?.startedAt).toBeCloseTo(12.22);
    expect(player.busy).toBe(true);
  });

  it('resolves when a piece ends', async () => {
    const { context, sources } = fakeContext();
    const player = new VoicePlayer(context);
    const done = player.play(bytes);
    await vi.waitFor(() => expect(sources).toHaveLength(1));
    sources[0]?.onended?.();
    await done;
    expect(player.busy).toBe(false);
  });

  it('cuts everything at once on stop, and starts fresh afterwards', async () => {
    const { context, sources } = fakeContext();
    const player = new VoicePlayer(context);
    const first = player.play(bytes);
    const second = player.play(bytes);
    await vi.waitFor(() => expect(sources).toHaveLength(2));
    player.stop();
    await Promise.all([first, second]);
    expect(sources[0]?.stop).toHaveBeenCalled();
    expect(sources[1]?.stop).toHaveBeenCalled();
    expect(player.busy).toBe(false);
    void player.play(bytes);
    await vi.waitFor(() => expect(sources).toHaveLength(3));
    expect(sources[2]?.startedAt).toBe(10);
  });

  it('plays every piece below full scale, at the level the loudness rule gives', async () => {
    const { context, sources, gains } = fakeContext();
    void new VoicePlayer(context).play(bytes);
    await vi.waitFor(() => expect(sources).toHaveLength(1));
    const ramp = gains[0]?.gain.linearRampToValueAtTime as ReturnType<typeof vi.fn>;
    expect(ramp.mock.calls[0]?.[0]).toBeLessThan(0.3);
  });

  it('knows how much of the current piece was heard', async () => {
    const { context, sources } = fakeContext();
    const player = new VoicePlayer(context);
    expect(player.playedFraction()).toBe(0);
    void player.play(bytes);
    await vi.waitFor(() => expect(sources).toHaveLength(1));
    context.currentTime = 11;
    expect(player.playedFraction()).toBe(0.5);
  });

  it('wakes a suspended context on the click', async () => {
    const { context } = fakeContext('suspended');
    await new VoicePlayer(context).unlock();
    expect(context.resume).toHaveBeenCalled();
  });
});
