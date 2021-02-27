import { nanoid } from 'nanoid';
import Ajv from 'ajv';
import { SchemaObject, ValidateFunction } from 'ajv/dist/types';

/** Default timeout for response message waiting */
const DEFAULT_TIMEOUT = 10_000;

export type OnMessageCallback = (payload: any, message: string, error?: string) => void;

/** WebSocket ready state */
export enum ReadyState {
  Connecting = 0,
  Open = 1,
  Closing = 2,
  Closed = 3,
}

export default abstract class WaitSocket<MessageType> {
  /** WebSocket instance */
  ws: WebSocket;

  /** AJV instance for validate message by JSONSchema */
  ajv: Ajv;

  /** Validation function for common message format */
  validateCommonObject: ValidateFunction<MessageType>;

  /** Timeout for response message waiting */
  public timeout: number = DEFAULT_TIMEOUT;

  /** Callbacks for incoming messages by type. Adds by on() function */
  callbacksByType: Map<string, OnMessageCallback>;

  /** Callbacks for response messages by type. Adds by sendRequest() with waitForType parameter. */
  responseCallbacksByType: Map<string, OnMessageCallback>;

  /** Callbacks for response messages by requestId. Adds by sendRequest() */
  responseCallbacksByRequestId: Map<string, OnMessageCallback>;

  /** Incoming message interceptors */
  incomingInterceptors: Set<(messageObject: MessageType) => MessageType>;

  /** Outgoing message interceptors */
  outgoingInterceptors: Set<(messageObject: MessageType) => MessageType>;

  /** Map of JSONSchemas by incoming message type */
  incomingJSONSchemas: Map<string, ValidateFunction<MessageType>>;

  /** Map of JSONSchemas by outgoing message type */
  outgoingJSONSchemas: Map<string, ValidateFunction<MessageType>>;

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
  constructor(ws: WebSocket | string, jsonSchema: SchemaObject) {
    if (typeof ws === 'string') {
      this.ws = new WebSocket(ws);
    } else {
      this.ws = ws;
    }
    this.ws.addEventListener('message', this.handleMessage.bind(this));
    this.ajv = new Ajv();
    this.validateCommonObject = this.ajv.compile(jsonSchema);
    this.callbacksByType = new Map();
    this.responseCallbacksByType = new Map();
    this.responseCallbacksByRequestId = new Map();
    this.incomingInterceptors = new Set();
    this.outgoingInterceptors = new Set();
    this.incomingJSONSchemas = new Map();
    this.outgoingJSONSchemas = new Map();
  }

  /**
   * Returns message type. Can be overrided.
   * @param messageObject Message object
   */
  public abstract getType(messageObject: MessageType): string;

  /**
   * Returns message payload. Can be overrided.
   * @param messageObject Message object
   */
  public abstract getPayload(messageObject: MessageType): any;

  /**
   * Returns message requestId meta data.
   * Used for receiving response messages from server. Can be overrided.
   * @param messageObject Message object
   */
  public abstract getRequestId(messageObject: MessageType): string | undefined;

  /**
   * Returns message object with type, payload and requestId in it.
   * @param type Message type identifier
   * @param payload Message payload
   * @param requestId requestId meta data
   */
  protected abstract getMessageObject(type: string, payload?: any, requestId?: string): MessageType;

  /**
   * Build and serialize message out of its parts.
   * @param type Message type identifier
   * @param payload Message payload
   * @param requestId requestId meta data
   */
  protected buildMessage(type: string, payload?: any, requestId?: string): string {
    let messageObject = this.getMessageObject(type, payload, requestId);
    this.outgoingInterceptors.forEach((interceptor) => {
      messageObject = interceptor(messageObject);
    });

    const validateFunction = this.outgoingJSONSchemas.get(type);
    this.validate(messageObject, validateFunction);
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
        const callback = (responsePayload: any, message: string, error: string) => {
          clearTimeout(timeoutId);
          this.responseCallbacksByType.delete(waitForType);
          if (error) {
            // TODO: Custom error
            reject(error);
          } else {
            resolve({ payload: responsePayload, message });
          }
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
        const callback = (responsePayload: any, message: string, error: string) => {
          clearTimeout(timeoutId);
          this.responseCallbacksByRequestId.delete(requestId);
          if (error) {
            // TODO: Custom error
            reject(error);
          } else {
            resolve({ payload: responsePayload, message });
          }
        };

        const message = this.buildMessage(type, payload, requestId);
        this.responseCallbacksByRequestId.set(requestId, callback);
        this.send(message);
      }
    });
  }

  private validate(messageObject: MessageType, validateFunction?: ValidateFunction) {
    if (validateFunction && !validateFunction(messageObject) && validateFunction.errors) {
      const errorMessage = validateFunction.errors.reduce((result, error) => {
        if (error.message) {
          result.push(error.message);
        }
        return result;
      }, ['JSONSchema validation failed:'])
        .join('\n');
      throw new Error(errorMessage);
    }
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
    const validateFunction = this.incomingJSONSchemas.get(type);
    let error;
    try {
      this.validate(messageObject, validateFunction);
    } catch (err) {
      error = err;
    }

    const payload = this.getPayload(messageObject);
    const requestId = this.getRequestId(messageObject);

    const requestHandler = requestId
      ? this.responseCallbacksByRequestId.get(requestId)
      : this.responseCallbacksByType.get(type);

    if (requestHandler) {
      requestHandler(payload, message, error);
    } else {
      const messageHandler = this.callbacksByType.get(type);
      if (messageHandler) {
        messageHandler(payload, message, error);
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
      use: (interceptor: (messageObject: MessageType) => MessageType) => {
        this.outgoingInterceptors.add(interceptor);
        return interceptor;
      },
      /** Remove a registered outgoing interceptor */
      eject: (interceptor: (messageObject: MessageType) => MessageType) => {
        this.outgoingInterceptors.delete(interceptor);
      },
    },
    incoming: {
      /** Add an incoming message interceptor (which returns modified message object) */
      use: (interceptor: (messageObject: MessageType) => MessageType) => {
        this.incomingInterceptors.add(interceptor);
        return interceptor;
      },
      /** Remove a registered incoming interceptor */
      eject: (interceptor: (messageObject: MessageType) => MessageType) => {
        this.incomingInterceptors.delete(interceptor);
      },
    },
  };

  public validation = {
    outgoing: {
      addJSONSchema: (type: string, jsonSchema: SchemaObject) => {
        this.outgoingJSONSchemas.set(type, this.ajv.compile(jsonSchema));
      },
      removeJSONSchema: (type: string) => {
        this.outgoingJSONSchemas.delete(type);
      },
    },
    incoming: {
      addJSONSchema: (type: string, jsonSchema: SchemaObject) => {
        this.incomingJSONSchemas.set(type, this.ajv.compile(jsonSchema));
      },
      removeJSONSchema: (type: string) => {
        this.incomingJSONSchemas.delete(type);
      },
    },
  };
}
