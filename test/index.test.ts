/// <reference path="./declaration.d.ts" />
import RobustWebSocket from 'robust-websocket';

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
    waitSocket.on(MessageType.Message1Answer, (payload, message) => {
      expect(payload.test).toBe(123);
      const messageObject = JSON.parse(message);
      expect(messageObject.payload.test).toBe(123);
      expect(messageObject.type).toBe(MessageType.Message1Answer);
      cb();
    });
  });
});

test('send() is working with RobustWebSocket', (cb) => {
  const ws = new RobustWebSocket(`ws://localhost:${WS_MOCK_PORT}`);
  const waitSocket = new WaitSocket(ws);
  waitSocket.onOpen(() => {
    waitSocket.send('test');
    waitSocket.on(MessageType.Message1Answer, (payload, message) => {
      expect(payload.test).toBe(123);
      const messageObject = JSON.parse(message);
      expect(messageObject.payload.test).toBe(123);
      expect(messageObject.type).toBe(MessageType.Message1Answer);
      cb();
    });
  });
});
