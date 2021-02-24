/// <reference path="./declaration.d.ts" />
import RobustWebSocket from 'robust-websocket';

import wss, { WS_MOCK_PORT, MessageType } from './ws-mock';
import WaitSocket from '../src/index';

afterAll(() => {
  wss.close();
});

test('send() is working with WebSocket', async (cb) => {
  const ws = new WebSocket(`ws://localhost:${WS_MOCK_PORT}`);
  const waitSocket = new WaitSocket(ws);
  await waitSocket.waitForOpen();
  waitSocket.send('test');
  waitSocket.on(MessageType.Message1Answer, (payload, message) => {
    expect(payload.test).toBe(123);
    const messageObject = JSON.parse(message);
    expect(messageObject.payload.test).toBe(123);
    expect(messageObject.type).toBe(MessageType.Message1Answer);
    ws.close();
    cb();
  });
});

test('send() is working with url parameter in constructor', async (cb) => {
  const waitSocket = new WaitSocket(`ws://localhost:${WS_MOCK_PORT}`);
  await waitSocket.waitForOpen();
  waitSocket.send('test');
  waitSocket.on(MessageType.Message1Answer, (payload, message) => {
    expect(payload.test).toBe(123);
    const messageObject = JSON.parse(message);
    expect(messageObject.payload.test).toBe(123);
    expect(messageObject.type).toBe(MessageType.Message1Answer);
    cb();
  });
});

test('send() is working with RobustWebSocket', async (cb) => {
  const ws = new RobustWebSocket(`ws://localhost:${WS_MOCK_PORT}`);
  const waitSocket = new WaitSocket(ws);
  await waitSocket.waitForOpen();
  waitSocket.send('test');
  waitSocket.on(MessageType.Message1Answer, (payload, message) => {
    expect(payload.test).toBe(123);
    const messageObject = JSON.parse(message);
    expect(messageObject.payload.test).toBe(123);
    expect(messageObject.type).toBe(MessageType.Message1Answer);
    ws.close();
    cb();
  });
});

test('sendMessage() is working', async (cb) => {
  const ws = new WebSocket(`ws://localhost:${WS_MOCK_PORT}`);
  const waitSocket = new WaitSocket(ws);
  await waitSocket.waitForOpen();
  waitSocket.sendMessage(MessageType.Message1);
  waitSocket.on(MessageType.Message1Answer, (payload, message) => {
    expect(payload.test).toBe(123);
    const messageObject = JSON.parse(message);
    expect(messageObject.payload.test).toBe(123);
    expect(messageObject.type).toBe(MessageType.Message1Answer);
    ws.close();
    cb();
  });
});

test('sendRequest() is working', async (cb) => {
  const ws = new WebSocket(`ws://localhost:${WS_MOCK_PORT}`);
  const waitSocket = new WaitSocket(ws);
  await waitSocket.waitForOpen();
  const { payload, message } = await waitSocket.sendRequest(MessageType.Request1);
  expect(payload.test).toBe(234);
  const messageObject = JSON.parse(message);
  expect(messageObject.payload.test).toBe(234);
  expect(messageObject.type).toBe(MessageType.Request1Answer);
  ws.close();
  cb();
});

test('sendRequest() rejects when no response', async () => {
  const ws = new WebSocket(`ws://localhost:${WS_MOCK_PORT}`);
  const waitSocket = new WaitSocket(ws);
  waitSocket.timeout = 100;
  await waitSocket.waitForOpen();
  await expect(async () => {
    await waitSocket.sendRequest(MessageType.RequestWithoutResponse);
  }).rejects.toThrow();
  ws.close();
});

test('sendRequest() with waitForType is working', async () => {
  const ws = new WebSocket(`ws://localhost:${WS_MOCK_PORT}`);
  const waitSocket = new WaitSocket(ws);
  await waitSocket.waitForOpen();
  const { payload, message } = await waitSocket
    .sendRequest(MessageType.Request2, { test: 345 }, MessageType.Request2Answer);
  expect(payload.test).toBe(345);
  const messageObject = JSON.parse(message);
  expect(messageObject.payload.test).toBe(345);
  expect(messageObject.type).toBe(MessageType.Request2Answer);
  ws.close();
});

test('sendRequest() with waitForType rejects when no response', async () => {
  const ws = new WebSocket(`ws://localhost:${WS_MOCK_PORT}`);
  const waitSocket = new WaitSocket(ws);
  waitSocket.timeout = 100;
  await waitSocket.waitForOpen();
  await expect(async () => {
    await waitSocket
      .sendRequest(MessageType.RequestWithoutResponse, null, MessageType.Request2Answer);
  }).rejects.toThrow();
  ws.close();
});

test('waitForOpen() is working after open', async () => {
  const ws = new WebSocket(`ws://localhost:${WS_MOCK_PORT}`);
  const waitSocket = new WaitSocket(ws);
  await waitSocket.waitForOpen();
  await waitSocket.waitForOpen();
  waitSocket.send('test');
  ws.close();
});

test('off() removes the callback', async (cb) => {
  const ws = new WebSocket(`ws://localhost:${WS_MOCK_PORT}`);
  const waitSocket = new WaitSocket(ws);
  waitSocket.timeout = 100;
  await waitSocket.waitForOpen();
  const callback = jest.fn();
  waitSocket.on(MessageType.Message1Answer, () => {
    callback();
  });
  waitSocket.off(MessageType.Message1Answer);
  waitSocket.send('test');
  setTimeout(() => {
    expect(callback).not.toBeCalled();
    ws.close();
    cb();
  }, 100);
});

test('Native WebSocket message event listener is working', async () => {
  const ws = new WebSocket(`ws://localhost:${WS_MOCK_PORT}`);
  const callback = jest.fn();
  ws.onmessage = callback;
  const waitSocket = new WaitSocket(ws);
  await waitSocket.waitForOpen();
  await waitSocket.sendRequest(MessageType.Request1);
  expect(callback).toBeCalled();
});
