import WS from 'ws';
import getPort from 'get-port';

export enum MessageType {
  Message1 = 'MESSAGE_1',
  Message1Answer = 'MESSAGE_1_ANSWER',
  Request1 = 'REQUEST_1',
  Request1Answer = 'REQUEST_1_ANSWER',
  Request2 = 'REQUEST_2',
  Request2Answer = 'REQUEST_2_ANSWER',
  RequestMirror = 'REQUEST_MIRROR',
  ResponseMirror = 'RESPONSE_MIRROR',
  RequestWithoutResponse = 'REQUEST_WITHOUT_RESPONSE',
}

export default class WSMock {
  wss: WS.Server;

  public get url() {
    return `ws://localhost:${this.wss.options.port}`;
  }

  public close() {
    this.wss.close();
  }

  public async startServer() {
    const port = await getPort();
    this.wss = new WS.Server({ port });

    this.wss.on('connection', (ws: WS) => {
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
        } else if (type === MessageType.Request2) {
          ws.send(JSON.stringify({
            type: MessageType.Request2Answer,
            payload: {
              test: 345,
            },
          }));
        } else if (type === MessageType.RequestMirror) {
          const response: any = {
            type: MessageType.ResponseMirror,
            payload,
          };
          if (meta) {
            response.meta = meta;
          }
          ws.send(JSON.stringify(response));
        }
      });
    });
  }
}
