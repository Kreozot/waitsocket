# WaitSocket.js

Simplifies communication over WebSocket.

## Features

* Serialization/Deserialization out of the box

* More structured way to exchange messages (separates 'type' from 'payload')
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

## Usage

```javascript
const ws = new WebSocket(`ws://my.websocket.server:9000`);
const waitSocket = new WaitSocket(ws);
```

## API

### constructor

## Customization

```typescript
class myWaitSocket extends waitSocket {
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
