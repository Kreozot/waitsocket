import { nanoid } from 'nanoid';
import Ajv from 'ajv';
import { SchemaObject, ValidateFunction } from 'ajv/dist/types';

/** Default timeout for response message waiting */
const DEFAULT_TIMEOUT = 10_000;

export type OnMessageCallback<PayloadType = any> =
  (payload: PayloadType, message: string, error?: string) => void;

/** WebSocket ready state */
export enum ReadyState {
  Connecting = 0,
  Open = 1,
  Closing = 2,
  Closed = 3,
}

export default abstract class WaitSocket<MessageType> {
  /**
   * Message type
   *
   * @typedef {*} MessageType
   */

  /**
   * Message interceptor callback
   *
   * @callback InterceptorCallback
   * @param {MessageType} messageObject Message object
   * @returns {MessageType} Modified message object
   */

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

  /** Map of JSONSchemas by incoming requestId */
  incomingJSONSchemasByRequestId: Map<string, ValidateFunction<MessageType>>;

  /** Map of JSONSchemas by outgoing message type */
  outgoingJSONSchemas: Map<string, ValidateFunction<MessageType>>;

  /**
   * Constructor
   *
   * @param {(WebSocket|string)} ws WebSocket instance
   * (you can use any extensions, like RobustWebSocket)
   * or WebSocket endpoint URI string
   * @param {SchemaObject} jsonSchema JSONSchema object for common message (for any type)
   *
   * @example
   * const waitSocket = new WaitSocket('ws://my.websocket.server:9000', jsonSchema);
   *
   * @example
   * const ws = new RobustWebSocket('ws://my.websocket.server:9000');
   * const waitSocket = new WaitSocket(ws, jsonSchema);
   */
  constructor(ws: WebSocket | string, jsonSchema?: SchemaObject) {
    if (typeof ws === 'string') {
      this.ws = new WebSocket(ws);
    } else {
      this.ws = ws;
    }
    this.ws.addEventListener('message', this.handleMessage.bind(this));
    this.ajv = new Ajv();
    this.ajv.addKeyword('kind');
    this.ajv.addKeyword('modifier');
    if (jsonSchema) {
      this.validateCommonObject = this.ajv.compile(jsonSchema);
    }
    this.callbacksByType = new Map();
    this.responseCallbacksByType = new Map();
    this.responseCallbacksByRequestId = new Map();
    this.incomingInterceptors = new Set();
    this.outgoingInterceptors = new Set();
    this.incomingJSONSchemas = new Map();
    this.incomingJSONSchemasByRequestId = new Map();
    this.outgoingJSONSchemas = new Map();
  }

  /**
   * Returns message type. Can be overrided.
   *
   * @abstract
   * @param {MessageType} messageObject Message object
   * @returns {string} Message type
   */
  public abstract getType(messageObject: MessageType): string;

  /**
   * Returns message payload. Can be overrided.
   *
   * @abstract
   * @param {MessageType} messageObject Message object
   * @returns {*} Message payload
   */
  public abstract getPayload(messageObject: MessageType): any;

  /**
   * Returns message requestId meta data.
   * Used for receiving response messages from server. Can be overrided.
   *
   * @abstract
   * @param {MessageType} messageObject Message object
   * @returns {string} Message requestId
   */
  public abstract getRequestId(messageObject: MessageType): string | undefined;

  /**
   * Returns message object with type, payload and requestId in it.
   *
   * @abstract
   * @param {string} type Message type identifier
   * @param {*} payload Message payload
   * @param {string} requestId requestId meta data
   * @returns {MessageType} Message object
   */
  public abstract getMessageObject(type: string, payload?: any, requestId?: string): MessageType;

  /**
   * Build and serialize message out of its parts.
   *
   * @param {string} type Message type identifier
   * @param {*} payload Message payload
   * @param {string} requestId requestId meta data
   * @param {SchemaObject} jsonSchema JSONSchema object to validate message.
   * If not set, tries to get a JSONSchema for this message type from assigned by
   * validation.outgoing.AddJSONSchema()
   * @returns {string} Serialized message ready to be sent
   */
  protected buildMessage(
    type: string,
    payload?: any,
    requestId?: string,
    jsonSchema?: SchemaObject,
  ): string {
    let messageObject = this.getMessageObject(type, payload, requestId);
    this.outgoingInterceptors.forEach((interceptor) => {
      messageObject = interceptor(messageObject);
    });

    if (this.validateCommonObject) {
      // TODO: Tests on this
      this.validate(messageObject, this.validateCommonObject);
    }
    const validateFunction = jsonSchema
      ? this.ajv.compile(jsonSchema)
      : this.outgoingJSONSchemas.get(type);
    this.validate(messageObject, validateFunction);
    return JSON.stringify(messageObject);
  }

  /**
   * Send message to server
   *
   * @param {string} message Serialized message
   */
  public send(message: string) {
    this.ws.send(message);
  }

  /**
   * Send message to server
   *
   * @param {string} type Message type identifier
   * @param {*} payload Message payload
   * @param {SchemaObject} jsonSchema JSONSchema object to validate message before sending
   */
  public sendMessage<PayloadType = any>(
    type: string,
    payload?: PayloadType,
    jsonSchema?: SchemaObject,
  ) {
    const message = this.buildMessage(type, payload, undefined, jsonSchema);
    this.send(message);
  }

  /**
   * Send message to server and asynchronously wait for the response.
   * By default it adds random "requestId" parameter to "meta" section of the message.
   * In order to identify the response as relative to the specific request,
   * server must return back this "meta.requestId" in the response message.
   * If server not returns "meta.requestId", you can specify "waitForType" parameter:
   * In that case the response will be identified by "type" in the response message.
   *
   * @param {string} type Message type identifier
   * @param {*} payload Message payload
   * @param {string} waitForType Message type in the response waiting for (not recommended)
     @param {SchemaObject} requestJSONSchema JSONSchema object to validate request message
     before sending
     @param {SchemaObject} responseJSONSchema JSONSchema object to validate response message
     after receiving
   * @returns {Promise<{payload, message}>} Object with payload and raw message string
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
   *
   * @example
   * // Not recommended way
   * const {payload, message} =
   *   await sendRequest('MY_REQUEST', { optionalPayload: 'example' }, 'MY_RESPONSE');
   * // Outgoing message will be {
   * //   type: 'MY_REQUEST',
   * //   payload: {optionalPayload: 'example'},
   * // }
   */
  public async sendRequest<RequestPayloadType = any, ResponsePayloadType = any>(
    type: string,
    payload?: RequestPayloadType,
    waitForType?: string,
    requestJSONSchema?: SchemaObject,
    responseJSONSchema?: SchemaObject,
  ): Promise<{ payload: ResponsePayloadType, message: string }> {
    return new Promise((resolve, reject) => {
      if (waitForType) {
        if (responseJSONSchema) {
          this.validation.incoming.addJSONSchema(type, responseJSONSchema);
        }

        const timeoutId = setTimeout(() => {
          this.responseCallbacksByType.delete(waitForType);
          // TODO: Custom error
          reject(new Error(`Timeout while waiting for response for type=${waitForType}`));
        }, this.timeout);
        const callback = (
          responsePayload: ResponsePayloadType,
          responseMessage: string,
          error: string,
        ) => {
          clearTimeout(timeoutId);
          this.responseCallbacksByType.delete(waitForType);
          if (error) {
            // TODO: Custom error
            reject(new Error(error));
          } else {
            resolve({ payload: responsePayload, message: responseMessage });
          }
        };

        const message = this.buildMessage(type, payload, undefined, requestJSONSchema);
        this.responseCallbacksByType.set(waitForType, callback);
        this.send(message);
      } else {
        const requestId = nanoid();

        if (responseJSONSchema) {
          this.incomingJSONSchemasByRequestId.set(requestId, this.ajv.compile(responseJSONSchema));
        }

        const timeoutId = setTimeout(() => {
          this.responseCallbacksByRequestId.delete(requestId);
          this.incomingJSONSchemasByRequestId.delete(requestId);
          // TODO: Custom error
          reject(new Error(`Timeout while waiting for response for requestId=${requestId}`));
        }, this.timeout);
        const callback = (
          responsePayload: ResponsePayloadType,
          responseMessage: string,
          error: string,
        ) => {
          clearTimeout(timeoutId);
          this.responseCallbacksByRequestId.delete(requestId);
          this.incomingJSONSchemasByRequestId.delete(requestId);
          if (error) {
            // TODO: Custom error
            reject(new Error(error));
          } else {
            resolve({ payload: responsePayload, message: responseMessage });
          }
        };

        const message = this.buildMessage(type, payload, requestId, requestJSONSchema);
        this.responseCallbacksByRequestId.set(requestId, callback);
        this.send(message);
      }
    });
  }

  /**
   * Validate message object
   *
   * @param {MessageType} messageObject Message object
   * @param {ValidateFunction} validateFunction Validate function
   * @throws {Error} Validation error with all validation messages
   */
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
   *
   * @param {MessageEvent} event Message event object
   */
  private handleMessage(event: MessageEvent) {
    const errors = [];
    let payload;
    let message;
    let type = '';
    let requestId;
    try {
      message = event.data;
      let messageObject = JSON.parse(message);
      try {
        this.validate(messageObject, this.validateCommonObject);
      } catch (err) {
        errors.push(err);
      }
      this.incomingInterceptors.forEach((interceptor) => {
        messageObject = interceptor(messageObject);
      });

      type = this.getType(messageObject);
      try {
        this.validate(messageObject, this.incomingJSONSchemas.get(type));
      } catch (err) {
        errors.push(err);
      }

      payload = this.getPayload(messageObject);
      requestId = this.getRequestId(messageObject);
      if (requestId) {
        this.validate(messageObject, this.incomingJSONSchemasByRequestId.get(requestId));
      }
    } catch (err) {
      errors.push(err);
    }

    const responseHandler = requestId
      ? this.responseCallbacksByRequestId.get(requestId)
      : this.responseCallbacksByType.get(type);

    const error = errors.length
      ? errors.join('\n')
      : undefined;

    if (responseHandler) {
      responseHandler(payload, message, error);
    } else {
      const messageHandler = this.callbacksByType.get(type);
      if (messageHandler) {
        messageHandler(payload, message, error);
      }
    }
  }

  /**
   * Asynchronously wait for WebSocket connection to open
   */
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
   *
   * @param {string} type Message type identifier
   * @param {OnMessageCallback} callback Handler callback
   * @param {SchemaObject} jsonSchema JSONSchema object to validate message after receiving
   */
  public onMessage<PayloadType = any>(
    type: string,
    callback: OnMessageCallback<PayloadType>,
    jsonSchema?: SchemaObject,
  ) {
    if (jsonSchema) {
      this.validation.incoming.addJSONSchema(type, jsonSchema);
    }
    this.callbacksByType.set(type, callback);
  }

  /**
   * Remove handler for the message type
   *
   * @param {string} type Message type identifier
   */
  public offMessage(type: string) {
    this.validation.incoming.removeJSONSchema(type);
    this.callbacksByType.delete(type);
  }

  /** Message interceptors */
  public interceptors = {
    /** Outgoing message interceptors */
    outgoing: {
      /**
       * Add an outgoing message interceptor (which returns modified message object)
       *
       * @param {InterceptorCallback} interceptor Outgoing message interceptor callback
       * @returns {InterceptorCallback} Outgoing message interceptor callback
       * (to store if you want it to be ejected later)
       */
      use: (interceptor: (messageObject: MessageType) => MessageType) => {
        this.outgoingInterceptors.add(interceptor);
        return interceptor;
      },

      /**
       * Remove a registered outgoing interceptor
       *
       * @param {InterceptorCallback} interceptor Outgoing message interceptor callback
       */
      eject: (interceptor: (messageObject: MessageType) => MessageType) => {
        this.outgoingInterceptors.delete(interceptor);
      },
    },

    /** Incoming message interceptors */
    incoming: {
      /**
       * Add an incoming message interceptor (which returns modified message object)
       *
       * @param {InterceptorCallback} interceptor Incoming message interceptor callback
       * @returns {InterceptorCallback} Incoming message interceptor callback
       * (to store if you want it to be ejected later)
       */
      use: (interceptor: (messageObject: MessageType) => MessageType) => {
        this.incomingInterceptors.add(interceptor);
        return interceptor;
      },

      /**
       * Remove a registered incoming interceptor
       *
       * @param {InterceptorCallback} interceptor Incoming message interceptor callback
       */
      eject: (interceptor: (messageObject: MessageType) => MessageType) => {
        this.incomingInterceptors.delete(interceptor);
      },
    },
  };

  /** Messages validation */
  public validation = {
    /** Outgoing messages validation */
    outgoing: {
      /**
       * Add JSONSchema for specific outgoing message type
       *
       * @param {string} type Outgoing message type
       * @param {SchemaObject} jsonSchema JSONSchema object
       */
      addJSONSchema: (type: string, jsonSchema: SchemaObject) => {
        this.outgoingJSONSchemas.set(type, this.ajv.compile(jsonSchema));
      },

      /**
       * Remove JSONSchema for specific outgoing message type
       *
       * @param {string} type Outgoing message type
       */
      removeJSONSchema: (type: string) => {
        this.outgoingJSONSchemas.delete(type);
      },
    },

    /** Incoming messages validation */
    incoming: {
      /**
       * Add JSONSchema for specific incoming message type
       *
       * @param {string} type Incoming message type
       * @param {SchemaObject} jsonSchema JSONSchema object
       */
      addJSONSchema: (type: string, jsonSchema: SchemaObject) => {
        this.incomingJSONSchemas.set(type, this.ajv.compile(jsonSchema));
      },

      /**
       * Remove JSONSchema for specific incoming message type
       *
       * @param {string} type Incoming message type
       */
      removeJSONSchema: (type: string) => {
        this.incomingJSONSchemas.delete(type);
      },
    },
  };
}
