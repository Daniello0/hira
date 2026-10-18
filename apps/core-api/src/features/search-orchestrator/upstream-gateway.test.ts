import type { UnderstandResponse } from '@hira/contracts';
import { describe, expect, it } from 'vitest';
import { InvalidSearchError, SearchUpstreamError } from '../chat/chat.errors';
import { heuristicIntent } from './heuristic-intent';
import { TOKEN_USAGE } from './search-fixture';
import { createLlmGateway, createRetrievalGateway, type FetchLike } from './upstream-gateway';

const options = { baseUrl: 'http://upstream.test', token: 'secret', timeoutMs: 1000 };

describe('upstream gateways', () => {
  it('reads an understand body and a generate stream', async () => {
    const intent = heuristicIntent('python');
    const understand: UnderstandResponse = { intent, meta: { tokenUsage: TOKEN_USAGE } };
    const sse = 'event: token\ndata: {"delta":"Hi"}\n\nevent: done\ndata: {"meta":{"tokenUsage":{"promptTokens":1,"completionTokens":1,"totalTokens":2}}}\n\n';
    const fetchImpl = scripted(jsonResponse(200, understand), textResponse(200, sse));
    const llm = createLlmGateway({ ...options, fetchImpl });
    expect((await llm.understand({ query: 'python', history: [], memory: [] }, 'req-1')).intent).toEqual(intent);
    const events = [];
    for await (const event of llm.generate({ intent, results: [], history: [] }, 'req-1')) events.push(event);
    expect(events[0]).toEqual({ kind: 'token', delta: 'Hi' });
    expect(events[1]?.kind).toBe('done');
  });

  it('turns a retrieval 400 into a validation error and other failures into upstream errors', async () => {
    const retrieval = createRetrievalGateway({ ...options, fetchImpl: scripted(jsonResponse(400, {})) });
    const down = createRetrievalGateway({ ...options, fetchImpl: scripted(jsonResponse(503, {})) });
    const intent = heuristicIntent('python');
    await expect(retrieval.search({ intent, limit: 10 }, 'req')).rejects.toBeInstanceOf(InvalidSearchError);
    await expect(down.search({ intent, limit: 10 }, 'req')).rejects.toBeInstanceOf(SearchUpstreamError);
  });

});

function scripted(...responses: Response[]): FetchLike {
  const queue = [...responses];
  return () => {
    const next = queue.shift();
    if (next === undefined) throw new Error('no scripted response');
    return Promise.resolve(next);
  };
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

function textResponse(status: number, body: string): Response {
  return new Response(body, { status, headers: { 'content-type': 'text/event-stream' } });
}
