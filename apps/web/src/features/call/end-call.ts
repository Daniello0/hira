import { coreApiUrl } from '../../common/api/core-api';

/** Ends a call even if the page is going away. A second end keeps the original time. */
export function endCall(sessionId: string, token: string): void {
  void fetch(`${coreApiUrl()}/api/v1/calls/${sessionId}/end`, {
    method: 'POST',
    credentials: 'include',
    keepalive: true,
    headers: { Authorization: `Bearer ${token}` },
  });
}
