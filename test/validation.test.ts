/// <reference path="./declaration.d.ts" />
import { SchemaObject } from 'ajv';
import { Type, Static } from '@sinclair/typebox';

import WSMock, { MessageType } from './ws-mock';
import WaitSocket from '../src/index';

const wss = new WSMock();

beforeAll(async () => {
  await wss.startServer();
});

afterAll(() => {
  wss.close();
});

test('JSONSchema outgoing validation is working with JSONSchema object', async () => {
  const outgoingJSONSchema: SchemaObject = {
    type: 'object',
    properties: {
      type: {
        type: 'string',
        enum: ['REQUEST_MIRROR'],
      },
      payload: {
        type: 'number',
      },
    },
    required: [
      'type',
      'payload',
    ],
  };
  const waitSocket = new WaitSocket(wss.url);
  await waitSocket.waitForOpen();

  waitSocket.validation.outgoing.addJSONSchema(MessageType.RequestMirror, outgoingJSONSchema);
  await expect(waitSocket.sendRequest(MessageType.RequestMirror)).rejects.toThrow();
  await expect(waitSocket.sendRequest(MessageType.RequestMirror, 234)).resolves.toBeDefined();

  waitSocket.validation.outgoing.removeJSONSchema(MessageType.RequestMirror);
  await expect(waitSocket.sendRequest(MessageType.RequestMirror)).resolves.toBeDefined();
});

test('JSONSchema outgoing validation is working with typebox', async () => {
  const outgoingJSONSchema = Type.Object({
    type: Type.Literal('REQUEST_MIRROR'),
    payload: Type.Number(),
  });
  const waitSocket = new WaitSocket(wss.url);
  await waitSocket.waitForOpen();

  waitSocket.validation.outgoing
    .addJSONSchema(MessageType.RequestMirror, Type.Strict(outgoingJSONSchema));
  await expect(waitSocket.sendRequest(MessageType.RequestMirror)).rejects.toThrow();
  await expect(waitSocket.sendRequest(MessageType.RequestMirror, 234)).resolves.toBeDefined();
});

test('JSONSchema incoming validation is working with JSONSchema object', async () => {
  const incomingJSONSchema: SchemaObject = {
    type: 'object',
    properties: {
      type: {
        type: 'string',
        enum: ['RESPONSE_MIRROR'],
      },
      payload: {
        type: 'number',
      },
    },
    required: [
      'type',
      'payload',
    ],
  };
  const waitSocket = new WaitSocket(wss.url);
  await waitSocket.waitForOpen();

  waitSocket.validation.incoming.addJSONSchema(MessageType.ResponseMirror, incomingJSONSchema);
  await expect(waitSocket.sendRequest(MessageType.RequestMirror)).rejects.toThrow();
  await expect(waitSocket.sendRequest(MessageType.RequestMirror, null, MessageType.ResponseMirror))
    .rejects.toThrow();
  await expect(waitSocket.sendRequest(MessageType.RequestMirror, 234)).resolves.toBeDefined();

  waitSocket.validation.incoming.removeJSONSchema(MessageType.ResponseMirror);
  await expect(waitSocket.sendRequest(MessageType.RequestMirror)).resolves.toBeDefined();
});

test('JSONSchema incoming validation is working with typebox', async () => {
  const incomingJSONSchema = Type.Object({
    type: Type.Literal('RESPONSE_MIRROR'),
    payload: Type.Number(),
  });
  const waitSocket = new WaitSocket(wss.url);
  await waitSocket.waitForOpen();

  waitSocket.validation.incoming
    .addJSONSchema(MessageType.ResponseMirror, Type.Strict(incomingJSONSchema));
  await expect(waitSocket.sendRequest(MessageType.RequestMirror))
    .rejects.toThrow();
  await expect(waitSocket.sendRequest(MessageType.RequestMirror, 234))
    .resolves.toBeDefined();
});

test('Payload generics in SendRequest() are working', async () => {
  const outgoingJSONSchema = Type.Object({
    type: Type.Literal('REQUEST_MIRROR'),
    payload: Type.Number(),
  });
  const incomingJSONSchema = Type.Object({
    type: Type.Literal('RESPONSE_MIRROR'),
    payload: Type.Number(),
  });
  type OutgoingPayloadType = Static<typeof outgoingJSONSchema.properties.payload>;
  type IncomingPayloadType = Static<typeof incomingJSONSchema.properties.payload>;
  const waitSocket = new WaitSocket(wss.url);
  await waitSocket.waitForOpen();
  const { payload } = await waitSocket
    .sendRequest<OutgoingPayloadType, IncomingPayloadType>('REQUEST_MIRROR', 123);
  expect(payload).toBe(123);
});

test('JSONSchema param in sendMessage() validation is working', async () => {
  const outgoingJSONSchema = Type.Strict(Type.Object({
    type: Type.Literal('REQUEST_MIRROR'),
    payload: Type.Number(),
  }));
  const waitSocket = new WaitSocket(wss.url);
  await waitSocket.waitForOpen();
  expect(() => waitSocket.sendMessage('REQUEST_MIRROR', '234', outgoingJSONSchema)).toThrow();
  expect(() => waitSocket.sendMessage('REQUEST_MIRROR', '234')).not.toThrow();
  expect(() => waitSocket.sendMessage('REQUEST_MIRROR', 234, outgoingJSONSchema)).not.toThrow();
});

test('JSONSchema param in sendRequest() validation is working', async () => {
  const outgoingJSONSchema = Type.Strict(Type.Object({
    type: Type.Literal('REQUEST_MIRROR'),
    payload: Type.Number(),
  }));
  const incomingJSONSchema = Type.Strict(Type.Object({
    type: Type.Literal('RESPONSE_MIRROR'),
    payload: Type.Number(),
  }));
  const incomingJSONSchemaWrong = Type.Strict(Type.Object({
    type: Type.Literal('WRONG_RESPONSE_MIRROR'),
    payload: Type.Number(),
  }));
  const waitSocket = new WaitSocket(wss.url);
  await waitSocket.waitForOpen();
  expect(waitSocket.sendRequest('REQUEST_MIRROR', '234', null, outgoingJSONSchema, incomingJSONSchema))
    .rejects.toThrow();
  expect(waitSocket.sendRequest('REQUEST_MIRROR', 234, null, outgoingJSONSchema, incomingJSONSchemaWrong))
    .rejects.toThrow();
  expect(waitSocket.sendRequest('REQUEST_MIRROR', 234, null, outgoingJSONSchema, incomingJSONSchema))
    .resolves.toBeDefined();
});

test('JSONSchema param in sendRequest() validation is working with waitForType param', async () => {
  const outgoingJSONSchema = Type.Strict(Type.Object({
    type: Type.Literal('REQUEST_MIRROR'),
    payload: Type.Number(),
  }));
  const incomingJSONSchema = Type.Strict(Type.Object({
    type: Type.Literal('RESPONSE_MIRROR'),
    payload: Type.Number(),
  }));
  const incomingJSONSchemaWrong = Type.Strict(Type.Object({
    type: Type.Literal('WRONG_RESPONSE_MIRROR'),
    payload: Type.Number(),
  }));
  const waitSocket = new WaitSocket(wss.url);
  await waitSocket.waitForOpen();
  expect(waitSocket.sendRequest('REQUEST_MIRROR', '234', 'RESPONSE_MIRROR', outgoingJSONSchema, incomingJSONSchema))
    .rejects.toThrow();
  expect(waitSocket.sendRequest('REQUEST_MIRROR', 234, 'RESPONSE_MIRROR', outgoingJSONSchema, incomingJSONSchemaWrong))
    .rejects.toThrow();
  expect(waitSocket.sendRequest('REQUEST_MIRROR', 234, 'RESPONSE_MIRROR', outgoingJSONSchema, incomingJSONSchema))
    .resolves.toBeDefined();
});

test('JSONSchema param in onMessage() validation is working', async (done) => {
  const incomingJSONSchema = Type.Strict(Type.Object({
    type: Type.Literal('RESPONSE_MIRROR'),
    payload: Type.Number(),
  }));
  const waitSocket = new WaitSocket(wss.url);
  await waitSocket.waitForOpen();
  waitSocket.sendMessage(MessageType.RequestMirror, '234');
  waitSocket.onMessage(MessageType.ResponseMirror, (payload, message, error) => {
    expect(error).toBeDefined();

    waitSocket.sendMessage(MessageType.RequestMirror, 234);
    waitSocket.onMessage(MessageType.ResponseMirror, (payload2, message2, error2) => {
      expect(error2).not.toBeDefined();
      done();
    }, incomingJSONSchema);
  }, incomingJSONSchema);
});

test('Outgoing common message JSONSchema validation is working', async () => {
  const waitSocket = new WaitSocket(wss.url);
  waitSocket.getMessageObject = (type: string, payload?: any) => ({ payload } as any);
  await waitSocket.waitForOpen();
  expect(() => waitSocket.sendMessage('REQUEST_MIRROR', 234)).toThrow();
});

test('Wrong outgoing message sending is working without common message JSONSchema', async () => {
  const waitSocket = new WaitSocket(wss.url, null);
  waitSocket.getMessageObject = (type: string, payload?: any) => ({ payload } as any);
  await waitSocket.waitForOpen();
  expect(() => waitSocket.sendMessage('REQUEST_MIRROR', 234)).not.toThrow();
});

test('Incoming common message JSONSchema validation is working', async (done) => {
  const waitSocket = new WaitSocket(wss.url);
  waitSocket.getMessageObject = (type: string, payload?: any) => ({ payload } as any);
  await waitSocket.waitForOpen();
  waitSocket.send(JSON.stringify({
    type: 'REQUEST_MIRROR',
    payload: 123,
    meta: {
      requestId: 1,
    },
  }));
  waitSocket.onMessage('RESPONSE_MIRROR', (payload, message, error) => {
    expect(error).toBeDefined();
    done();
  });
});

test('Wrong incoming message receiving is working without common message JSONSchema', async (done) => {
  const waitSocket = new WaitSocket(wss.url, null);
  waitSocket.getMessageObject = (type: string, payload?: any) => ({ payload } as any);
  await waitSocket.waitForOpen();
  waitSocket.send(JSON.stringify({
    type: 'REQUEST_MIRROR',
    payload: 123,
    meta: {
      requestId: 1,
    },
  }));
  waitSocket.onMessage('RESPONSE_MIRROR', (payload, message, error) => {
    expect(error).not.toBeDefined();
    done();
  });
});
