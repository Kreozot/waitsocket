import WS from 'ws';

export const WS_MOCK_PORT = 9001;
const wss = new WS.Server({
  port: WS_MOCK_PORT,
});

export enum MessageType {
  Message1 = 'MESSAGE_1',
  Message1Answer = 'MESSAGE_1_ANSWER',
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

    const { type } = messageObject;
    if (type === MessageType.Message1) {
      ws.send(JSON.stringify({
        type: MessageType.Message1Answer,
        payload: {
          test: 123,
        },
      }));
    }
  });
});

export default wss;
