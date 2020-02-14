/**
 * Copyright 2017 IBM Corp. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the 'License'); you may not
 * use this file except in compliance with the License. You may obtain a copy of
 * the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an 'AS IS' BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
 * License for the specific language governing permissions and limitations under
 * the License.
 */

'use strict';

const chai = require('chai');
const rewire = require('rewire');
const sinon = require('sinon');
const sinonTest = require('sinon-test')(sinon, { useFakeTimers: false });
const AssistantV1 = require('ibm-watson/assistant/v1');
const { IamAuthenticator } = require('ibm-watson/auth');

const main = rewire('../../main.js'); // For testing private functions
const expect = chai.expect;

describe('test assistantMessage()', function() {
  const assistantMessage = main.__get__('assistantMessage');
  let message;
  let assistant;
  const contextOut = { result: { context: { test: 'testcontext' } } };
  const err = null;
  const WS_ID = 'ws-id-to-find';
  const TEST_INPUT = 'test input text';
  const TEST_CONTEXT = 'test input context';

  beforeEach(function() {
    main.__set__('context', TEST_CONTEXT);
    main.__set__(
      'assistant',
      new AssistantV1({
        version: '2020-02-02',
        authenticator: new IamAuthenticator({ apikey: 'fake' }),
        serviceUrl: 'fake'
      })
    );
    assistant = main.__get__('assistant');
    message = sinon.stub(assistant, 'message');
    message.yields(err, contextOut);
  });

  it(
    'test assistantMessage without intent',
    sinonTest(function(done) {
      assistantMessage({}, WS_ID).then(result => {
        expect(result).to.deep.equal(contextOut);
        sinon.assert.calledWithMatch(message, { context: TEST_CONTEXT, input: { text: 'start skill' }, workspaceId: WS_ID });
        done();
      });
    })
  );

  it(
    'test assistantMessage with intent',
    sinonTest(function(done) {
      assistantMessage({ intent: { slots: { EveryThingSlot: { value: TEST_INPUT } } } }, WS_ID).then(result => {
        expect(result).to.deep.equal(contextOut);
        sinon.assert.calledWithMatch(message, { context: TEST_CONTEXT, input: { text: TEST_INPUT }, workspaceId: WS_ID });
        done();
      });
    })
  );
});

describe('test main()', function() {
  it(
    'test main no __ow_body',
    sinonTest(function(done) {
      main
        .main({})
        .then(result => {
          sinon.assert.fail('Was supposed to fail before here.');
          done();
        })
        .catch(err => {
          console.log('test caught expected error');
          expect(err.response.outputSpeech.text).to.equal('Must be called from Alexa.');
          done();
        });
    })
  );
});
