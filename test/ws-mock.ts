import WS from 'ws';

export const WS_MOCK_PORT = 9001;
const wss = new WS.Server({
  port: WS_MOCK_PORT,
});

export enum MessageType {
  Message1 = 'MESSAGE_1',
  Message1Answer = 'MESSAGE_1_ANSWER',
  Request1 = 'REQUEST_1',
  Request1Answer = 'REQUEST_1_ANSWER',
  RequestMirror = 'REQUEST_2',
  Request2Answer = 'REQUEST_2_ANSWER',
  RequestWithoutResponse = 'REQUEST_WITHOUT_RESPONSE',
}

wss.on('connection', (ws: WS) => {
  ws.on('message', (message: string) => {
    if (message === 'test') {
      ws.send(JSON.stringify({
        type: MessageType.Message1Answer,
        payload: {
          test: 123,
        },
      }));
      return;
    }

    const messageObject = JSON.parse(message);

    const { type, payload, meta } = messageObject;
    if (type === MessageType.Message1) {
      ws.send(JSON.stringify({
        type: MessageType.Message1Answer,
        payload: {
          test: 123,
        },
      }));
    } else if (type === MessageType.Request1) {
      ws.send(JSON.stringify({
        type: MessageType.Request1Answer,
        payload: {
          test: 234,
        },
        meta: {
          requestId: meta.requestId,
        },
      }));
    } else if (type === MessageType.RequestMirror) {
      ws.send(JSON.stringify({
        type: MessageType.Request2Answer,
        payload,
      }));
    }
  });
});

export default wss;
