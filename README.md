# WaitSocket.js

[![Build Status](https://travis-ci.org/Kreozot/waitsocket.svg?branch=main)](https://travis-ci.org/Kreozot/waitsocket)
[![codecov](https://codecov.io/gh/Kreozot/waitsocket/branch/main/graph/badge.svg?token=MBOK47MES6)](https://codecov.io/gh/Kreozot/waitsocket)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=Kreozot_waitsocket&metric=alert_status)](https://sonarcloud.io/dashboard?id=Kreozot_waitsocket)

Simplifies communication over WebSocket.

## Features

* Serialization/Deserialization out of the box

* More structured way to exchange messages (separates `type` from `payload`)
  ```javascript
  waitSocket.sendMessage('MESSAGE_TYPE', { somePayload: 'example' });
  ```

* Convenient way to handle incoming messages:
  ```javascript
  waitSocket.on('MESSAGE_TYPE', (payload) => doSomething(payload));
  ```

* Ability to use a request/response paradigm with WebSockets (mechanism described below):
  ```javascript
  const { payload } = await waitSocket.sendRequest('MESSAGE_TYPE', requestPayload);
  ```

* JSONSchema validation of each type of incoming and outgoing messages:
  ```javascript
  waitSocket.validation.incoming.addJSONSchema('MESSAGE_TYPE', jsonSchemaObject);
  ```

* Ability to add interceptors to modify incoming and outgoing messages:
  ```javascript
  waitSocket.interceptors.incoming.use((messageObject) => {
    console.log('Let\'s see what we have received', messageObject);
    // And modify the object
    return {
      ...messageObject,
      something: 'new',
    };
  });
  ```

* Flexible message format customization

* Fully TypeScript

## Installation

```
npm i waitsocket
```

or

```
yarn add waitsocket
```

## Usage

### Importing

```javascript
import WaitSocket from 'waitsocket';
```

### Creating instance

```javascript
const waitSocket = new WaitSocket('ws://my.websocket.server:9000');
```

Or you can use it with your own instance of WebSocket, and even with some extends like [RobustWebSocket](https://github.com/appuri/robust-websocket):

```javascript
const ws = new RobustWebSocket('ws://my.websocket.server:9000');
const waitSocket = new WaitSocket(ws);
```

## JSONSchema Validation

You can define JSONSchema for each type of your incoming and outgoing messages. For incoming messages, validation process original deserialized message (before any interceptors). For outgoing messages, validation process resulting message (after all interceptors, but before serialization, of course).

```javascript
waitSocket.validation.incoming.addJSONSchema('INCOMING_MESSAGE_TYPE', incomingJSONSchemaObject);
waitSocket.validation.outgoing.addJSONSchema('OUTGOING_MESSAGE_TYPE', outgoingJSONSchemaObject);
```

## Customization

If you wish to use your own message format, you can do it by extending WaitSocket class and overriding these functions, responsible for message construction and parsing:

* `getType(messageObject: MessageType): string` - Returns message type.
* `getPayload(messageObject: MessageType): any` - Returns message payload.
* `getRequestId(messageObject: MessageType): string` - Returns message requestId meta data.
* `getMessageObject(type: string, payload?: any, requestId?: string): MessageType;` - Returns message object with type, payload and requestId in it.

Example (use `body` parameter instead of `payload`):
```typescript
class myWaitSocket extends AbstractWaitSocket<MyMessageType> {
  protected getMessageObject(type: string, payload?: any, requestId?: string) {
    const result: DefaultMessageType = { type };
    if (payload) {
      result.body = payload;
    }
    if (requestId) {
      result.meta = { requestId };
    }
    return result;
  }


  public getPayload(messageObject: PlainObject) {
    return messageObject.body;
  }
}
```
