# WaitSocket.js

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

## API

### constructor

## Customization

If you wish to use your own message format, you can do it by extending WaitSocket class and overriding these functions, responsible for message construction and parsing:

* `addType(messageObject: PlainObject, type: string)` - Returns message object with type in it.
* `getType(messageObject: PlainObject): string` - Returns message type.
* `addPayload(messageObject: PlainObject, payload?: any)` - Returns message object with payload in it.
* `getPayload(messageObject: PlainObject): any` - Returns message payload.
* `addRequestId(messageObject: PlainObject, requestId?: string)` - Returns message object with requestId meta data.
* `getRequestId(messageObject: PlainObject)` - Returns message requestId meta data.

Example (use `body` parameter instead of `payload`):
```typescript
class myWaitSocket extends WaitSocket {
  protected addPayload(messageObject: PlainObject, payload?: PlainObject) {
    if (!body) {
      return { ...messageObject };
    }
    return {
      ...messageObject,
      body: payload,
    };
  }

  public getPayload(messageObject: PlainObject) {
    return messageObject.body;
  }
}
```
