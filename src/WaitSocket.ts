import { Type, Static } from '@sinclair/typebox';
import { SchemaObject } from 'ajv';

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
  /**
   * Constructor
   *
   * @param {(WebSocket|string)} ws WebSocket instance
   * (you can use any extensions, like RobustWebSocket)
   * or WebSocket endpoint URI string
   * @param {SchemaObject} jsonSchema JSONSchema object for common message (for any type)
   *
   * @example
   * const waitSocket = new WaitSocket('ws://my.websocket.server:9000');
   *
   * @example
   * const ws = new RobustWebSocket('ws://my.websocket.server:9000');
   * const waitSocket = new WaitSocket(ws);
   */
  constructor(
    ws: WebSocket | string,
    jsonSchema: SchemaObject = Type.Strict(DefaultMessageSchema),
  ) {
    super(ws, jsonSchema);
  }

  /**
   * Returns message object with type, payload and requestId in it.
   *
   * @param {string} type Message type identifier
   * @param {*} payload Message payload
   * @param {string} requestId requestId meta data
   * @returns {DefaultMessageType} Message object
   */
  public getMessageObject(type: string, payload?: any, requestId?: string) {
    const result: DefaultMessageType = { type };
    if (payload) {
      result.payload = payload;
    }
    if (requestId) {
      result.meta = { requestId };
    }
    return result;
  }

  /**
   * Returns message type. Can be overrided.
   *
   * @param {DefaultMessageType} messageObject Message object
   * @returns {string} Message type
   */
  public getType(messageObject: DefaultMessageType): string {
    return messageObject.type;
  }

  /**
   * Returns message payload.
   *
   * @param {DefaultMessageType} messageObject Message object
   * @returns {*} Message payload
   */
  public getPayload(messageObject: DefaultMessageType): any {
    return messageObject.payload;
  }

  /**
   * Returns message requestId meta data.
   * Used for receiving response messages from server.
   *
   * @param {DefaultMessageType} messageObject Message object
   * @returns {string} Message requestId
   */
  public getRequestId(messageObject: DefaultMessageType): string | undefined {
    return messageObject.meta?.requestId;
  }
}
