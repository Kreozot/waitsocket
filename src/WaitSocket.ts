import { Type, Static } from '@sinclair/typebox';

import AbstractWaitSocket from './AbstractWaitSocket';

export const DefaultMessageSchema = Type.Object({
  type: Type.String(),
  payload: Type.Optional(Type.Any()),
  meta: Type.Optional(Type.Object({
    requestId: Type.String(),
  })),
});

export type DefaultMessageType = Static<typeof DefaultMessageSchema>;

export default class WaitSocket extends AbstractWaitSocket<DefaultMessageType> {
  constructor(ws: WebSocket | string) {
    super(ws, Type.Strict(DefaultMessageSchema));
  }

  protected getMessageObject(type: string, payload?: any, requestId?: string) {
    const result: DefaultMessageType = { type };
    if (payload) {
      result.payload = payload;
    }
    if (requestId) {
      result.meta = { requestId };
    }
    return result;
  }

  public getType(messageObject: DefaultMessageType): string {
    return messageObject.type;
  }

  /**
   * Returns message payload. Can be overrided.
   * @param messageObject Message object
   */
  public getPayload(messageObject: DefaultMessageType): any {
    return messageObject.payload;
  }

  /**
   * Returns message requestId meta data.
   * Used for receiving response messages from server. Can be overrided.
   * @param messageObject Message object
   */
  public getRequestId(messageObject: DefaultMessageType): string | undefined {
    return messageObject.meta?.requestId;
  }
}
