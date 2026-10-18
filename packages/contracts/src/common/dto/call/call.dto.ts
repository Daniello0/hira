/** A call session. It is not a chat. */
export interface CallSessionDto {
  id: string;
  startedAt: string;
  endedAt: string | null;
}

/** Body of `POST /api/v1/calls/{id}/turns`. */
export interface CreateCallTurnRequest {
  content: string;
  useMemory?: boolean;
}
