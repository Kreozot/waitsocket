import { nanoid } from 'nanoid';

const DEFAULT_TIMEOUT = 60_000;

type PlainObject = {
  [key: string]: any
};

type OnMessageCallback = (payload: PlainObject, message: string) => void;

export default class MyWebSocket {
  ws: WebSocket;

  timeout: number = DEFAULT_TIMEOUT;

  callbacksByType: Map<string, OnMessageCallback>;

  responseCallbacksByType: Map<string, OnMessageCallback>;

  responseCallbacksByRequestId: Map<string, OnMessageCallback>;

  constructor(ws: WebSocket) {
    this.ws = ws;
    this.ws.onmessage = this.onMessage.bind(this);
  }

  protected addType(messageObject: PlainObject, type: string) {
    return {
      ...messageObject,
      type,
    };
  }

  protected getType(messageObject: PlainObject) {
    return messageObject.type;
  }

  protected addPayload(messageObject: PlainObject, payload?: PlainObject) {
    if (!payload) {
      return { ...messageObject };
    }
    return {
      ...messageObject,
      payload,
    };
  }

  protected getPayload(messageObject: PlainObject) {
    return messageObject.payload;
  }

  protected addRequestId(messageObject: PlainObject, requestId?: string) {
    if (!requestId) {
      return { ...messageObject };
    }
    return {
      ...messageObject,
      meta: {
        requestId,
      },
    };
  }

  protected getRequestId(messageObject: PlainObject) {
    return messageObject.meta?.requestId;
  }

  protected buildMessage(type: string, payload?: PlainObject, requestId?: string): string {
    let messageObject: PlainObject = this.addRequestId({}, requestId);
    messageObject = this.addPayload(messageObject, payload);
    messageObject = this.addType(messageObject, type);
    return JSON.stringify(messageObject);
  }

  /**
   * Send message to server
   * @param message Serialized message.
   */
  public send(message: string) {
    this.ws.send(message);
  }

  /**
   * Send message to server
   * @param type Message type identifier.
   * @param payload Message payload object.
   */
  public sendMessage(type: string, payload?: PlainObject) {
    const message = this.buildMessage(type, payload);
    this.send(message);
  }

  /**
   * Send message to server and asynchronously wait for the response.
   * By default it adds random "requestId" parameter to "meta" section of the message.
   * In order to identify the response as relative to the specific request,
   * server must return "meta.requestId" in the response message.
   * If server not returns "meta.requestId", you can specify "waitForType" parameter:
   * In that case the response will be identified by "type" in the response message.
   * @param type Message type identifier.
   * @param payload Message payload object.
   * @param waitForType Message type in the response waiting for. Optional and not recommended.
   * @param timeout Timeout value (ms) for waiting for the response.
   * @returns Promise<{payload, message}>
   *
   * @example
   * // Recommended way
   * const {payload, message} =
   *   await sendRequest('MY_REQUEST', { optionalPayload: 'example' });
   * // Outgoing message will be {
   * //   type: 'MY_REQUEST',
   * //   payload: { optionalPayload: 'example' },
   * //   meta: { requestId: 'nb1SQCTRmbDSv1u4idPr1' }
   * // }
   * @example
   * // Not recommended way
   * const {payload, message} =
   *   await sendRequest('MY_REQUEST', { optionalPayload: 'example' }, 'MY_RESPONSE');
   * // Outgoing message will be {
   * //   type: 'MY_REQUEST',
   * //   payload: {optionalPayload: 'example'},
   * // }
   */
  public async sendRequest(
    type: string,
    payload?: PlainObject,
    waitForType?: string,
    timeout: number = this.timeout,
  ): Promise<{ payload: PlainObject, message: string }> {
    return new Promise((resolve, reject) => {
      if (waitForType) {
        const timeoutId = setTimeout(() => {
          this.responseCallbacksByType.delete(waitForType);
          // TODO: Custom error
          reject(new Error(`Timeout while waiting for response for type=${waitForType}`));
        }, timeout);
        const callback = (responsePayload: PlainObject, message: string) => {
          clearTimeout(timeoutId);
          this.responseCallbacksByType.delete(waitForType);
          resolve({ payload: responsePayload, message });
        };

        const message = this.buildMessage(type, payload);
        this.responseCallbacksByType.set(waitForType, callback);
        this.send(message);
      } else {
        const requestId = nanoid();
        const timeoutId = setTimeout(() => {
          this.responseCallbacksByRequestId.delete(requestId);
          // TODO: Custom error
          reject(new Error(`Timeout while waiting for response for requestId=${requestId}`));
        }, timeout);
        const callback = (responsePayload: PlainObject, message: string) => {
          clearTimeout(timeoutId);
          this.responseCallbacksByRequestId.delete(requestId);
          resolve({ payload: responsePayload, message });
        };

        const message = this.buildMessage(type, payload, requestId);
        this.responseCallbacksByRequestId.set(requestId, callback);
        this.send(message);
      }
    });
  }

  private onMessage(message: string) {
    const messageObject = JSON.parse(message);
    const type = this.getType(messageObject);
    const payload = this.getPayload(messageObject);
    const requestId = this.getRequestId(messageObject);

    const requestHandler = requestId
      ? this.responseCallbacksByRequestId.get(requestId)
      : this.responseCallbacksByType.get(type);

    if (requestHandler) {
      requestHandler(payload, message);
    } else {
      const messageHandler = this.callbacksByType.get(type);
      if (messageHandler) {
        messageHandler(payload, message);
      }
    }
  }

  /**
   * Add handler for the message type
   * @param type Message type identifier
   * @param callback Handler callback
   */
  public on(type: string, callback: OnMessageCallback) {
    this.callbacksByType.set(type, callback);
  }

  /**
   * Remove handler for the message type
   * @param type Message type identifier
   */
  public off(type: string) {
    this.callbacksByType.delete(type);
  }
}
