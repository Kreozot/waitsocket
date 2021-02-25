import { nanoid } from 'nanoid';

/** Default timeout for response message waiting */
const DEFAULT_TIMEOUT = 10_000;

export type PlainObject = {
  [key: string]: any
};

export type OnMessageCallback = (payload: any, message: string) => void;
export type MessageInterceptor = (messageObject: PlainObject) => PlainObject;

/** WebSocket ready state */
export enum ReadyState {
  Connecting = 0,
  Open = 1,
  Closing = 2,
  Closed = 3,
}

export default class MyWebSocket {
  /** WebSocket instance */
  ws: WebSocket;

  /** Timeout for response message waiting */
  public timeout: number = DEFAULT_TIMEOUT;

  /** Callbacks for incoming messages by type. Adds by on() function */
  callbacksByType: Map<string, OnMessageCallback>;

  /** Callbacks for response messages by type. Adds by sendRequest() with waitForType parameter. */
  responseCallbacksByType: Map<string, OnMessageCallback>;

  /** Callbacks for response messages by requestId. Adds by sendRequest() */
  responseCallbacksByRequestId: Map<string, OnMessageCallback>;

  /** Incoming message interceptors */
  incomingInterceptors: Set<MessageInterceptor>;

  /** Outgoing message interceptors */
  outgoingInterceptors: Set<MessageInterceptor>;

  /**
   * Constructor
   * @param ws WebSocket instance (you can use any extensions, like RobustWebSocket)
   * or WebSocket server URI string
   * @example
   * const waitSocket = new WaitSocket('ws://my.websocket.server:9000');
   * @example
   * const ws = new RobustWebSocket('ws://my.websocket.server:9000');
   * const waitSocket = new WaitSocket(ws);
   */
  constructor(ws: WebSocket | string) {
    if (typeof ws === 'string') {
      this.ws = new WebSocket(ws);
    } else {
      this.ws = ws;
    }
    this.ws.addEventListener('message', this.handleMessage.bind(this));
    this.callbacksByType = new Map();
    this.responseCallbacksByType = new Map();
    this.responseCallbacksByRequestId = new Map();
    this.incomingInterceptors = new Set();
    this.outgoingInterceptors = new Set();
  }

  /**
   * Returns message object with type in it. Can be overrided.
   * @param messageObject Message object
   * @param type Message type identifier
   */
  protected addType(messageObject: PlainObject, type: string) {
    return {
      ...messageObject,
      type,
    };
  }

  /**
   * Returns message type. Can be overrided.
   * @param messageObject Message object
   */
  public getType(messageObject: PlainObject): string {
    return messageObject.type;
  }

  /**
   * Returns message object with payload in it. Can be overrided.
   * @param messageObject Message object
   * @param payload Message payload object
   */
  protected addPayload(messageObject: PlainObject, payload?: any) {
    if (!payload) {
      return { ...messageObject };
    }
    return {
      ...messageObject,
      payload,
    };
  }

  /**
   * Returns message payload. Can be overrided.
   * @param messageObject Message object
   */
  public getPayload(messageObject: PlainObject): any {
    return messageObject.payload;
  }

  /**
   * Returns message object with requestId meta data.
   * Used for making response messages from server. Can be overrided.
   * @param messageObject Message object
   * @param type Message type identifier
   */
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

  /**
   * Returns message requestId meta data.
   * Used for receiving response messages from server. Can be overrided.
   * @param messageObject Message object
   */
  public getRequestId(messageObject: PlainObject) {
    return messageObject.meta?.requestId;
  }

  /**
   * Build and serialize message out of its parts.
   * @param type Message type identifier
   * @param payload Message payload
   * @param requestId requestId meta data
   */
  protected buildMessage(type: string, payload?: any, requestId?: string): string {
    let messageObject: PlainObject = this.addRequestId({}, requestId);
    messageObject = this.addPayload(messageObject, payload);
    messageObject = this.addType(messageObject, type);
    this.outgoingInterceptors.forEach((interceptor) => {
      messageObject = interceptor(messageObject);
    });
    return JSON.stringify(messageObject);
  }

  /**
   * Send message to server
   * @param message Serialized message
   */
  public send(message: string) {
    this.ws.send(message);
  }

  /**
   * Send message to server
   * @param type Message type identifier
   * @param payload Message payload
   */
  public sendMessage(type: string, payload?: any) {
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
   * @param payload Message payload
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
    payload?: any,
    waitForType?: string,
  ): Promise<{ payload: any, message: string }> {
    return new Promise((resolve, reject) => {
      if (waitForType) {
        const timeoutId = setTimeout(() => {
          this.responseCallbacksByType.delete(waitForType);
          // TODO: Custom error
          reject(new Error(`Timeout while waiting for response for type=${waitForType}`));
        }, this.timeout);
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
        }, this.timeout);
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

  /**
   * Handle incoming WebSocket message event
   * @param event Message event object
   */
  private handleMessage(event: MessageEvent) {
    const message = event.data;
    let messageObject = JSON.parse(message);
    this.incomingInterceptors.forEach((interceptor) => {
      messageObject = interceptor(messageObject);
    });

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

  /** Asynchronously wait for WebSocket connection to open */
  public async waitForOpen() {
    if (this.ws.readyState === ReadyState.Open) {
      return;
    }
    await new Promise((resolve) => {
      this.ws.addEventListener('open', resolve);
    });
  }

  /**
   * Add handler for the message type
   * @param type Message type identifier
   * @param callback Handler callback
   */
  public onMessage(type: string, callback: OnMessageCallback) {
    this.callbacksByType.set(type, callback);
  }

  /**
   * Remove handler for the message type
   * @param type Message type identifier
   */
  public offMessage(type: string) {
    this.callbacksByType.delete(type);
  }

  /** Message interceptors */
  public interceptors = {
    /** Outgoing message interceptors */
    outgoing: {
      /** Add an outgoing message interceptor (which returns modified message object) */
      use: (interceptor: MessageInterceptor) => {
        this.outgoingInterceptors.add(interceptor);
        return interceptor;
      },
      /** Remove a registered outgoing interceptor */
      eject: (interceptor: MessageInterceptor) => {
        this.outgoingInterceptors.delete(interceptor);
      },
    },
    incoming: {
      /** Add an incoming message interceptor (which returns modified message object) */
      use: (interceptor: MessageInterceptor) => {
        this.incomingInterceptors.add(interceptor);
        return interceptor;
      },
      /** Remove a registered incoming interceptor */
      eject: (interceptor: MessageInterceptor) => {
        this.incomingInterceptors.delete(interceptor);
      },
    },
  };
}
