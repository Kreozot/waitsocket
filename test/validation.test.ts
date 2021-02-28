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
