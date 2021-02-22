import wss, { WS_MOCK_PORT, MessageType } from './ws-mock';
import WaitSocket from '../src/index';

afterAll(() => {
  wss.close();
});

test('send() is working with WebSocket', (cb) => {
  const ws = new WebSocket(`ws://localhost:${WS_MOCK_PORT}`);
  const waitSocket = new WaitSocket(ws);
  waitSocket.onOpen(() => {
    waitSocket.send('test');
    waitSocket.on(MessageType.Message1Answer, (payload) => {
      expect(payload.test).toBe(123);
      cb();
    });
  });
});
