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
const sinonTest = require('sinon-test');
const watson = require('watson-developer-cloud');

const main = rewire('../../main.js'); // For testing private functions
const expect = chai.expect;
sinon.test = sinonTest.configureTest(sinon, { useFakeTimers: false }); // For using sinon.test with async.

const narrative = 'It was a dark and stormy night.';

describe('test actionHandler()', function() {
  const actionHandler = main.__get__('actionHandler');

  const fakeOpenWhisk = function() {
    return {
      actions: {
        invoke: sinon.stub().returns(
          Promise.resolve({
            response: {
              result: {
                forecasts: [
                  {
                    narrative: narrative
                  }
                ]
              }
            }
          })
        )
      },
      packages: {
        list: sinon.stub().returns(
          Promise.resolve([
            { name: 'test-other', binding: {} },
            {
              name: 'Whatevr_Weather Company Data-credentials123',
              namespace: 'test-namespace',
              binding: { name: 'weather' }
            }
          ])
        )
      }
    };
  };

  main.__set__('myOpenWhisk', fakeOpenWhisk);
  const TEST_INPUT = { output: {} };
  const TEST_INPUT_ACTION = {
    output: {
      action: 'lookupWeather',
      location: 'test location',
      text: ['one', 'two', 'three']
    }
  };

  it(
    'test actionHandler without action returns no change',
    sinon.test(function(done) {
      actionHandler({}, TEST_INPUT).then(result => {
        expect(result).to.deep.equal(TEST_INPUT);
        done();
      });
    })
  );
  it(
    'test actionHandler with action adds narrative',
    sinon.test(function(done) {
      actionHandler({}, TEST_INPUT_ACTION).then(result => {
        expect(result.output.action).to.equal('lookupWeather');
        expect(result.output.location).to.equal('test location');
        expect(result.output.text).to.deep.equal(['one', 'two', 'three', narrative]);
        done();
      });
    })
  );
});

describe('test assistantMessage()', function() {
  const assistantMessage = main.__get__('assistantMessage');
  let message;
  let assistant;
  const contextOut = { context: { test: 'testcontext' } };
  const err = null;
  const WS_ID = 'ws-id-to-find';
  const TEST_INPUT = 'test input text';
  const TEST_CONTEXT = 'test input context';

  beforeEach(function() {
    main.__set__('context', TEST_CONTEXT);
    main.__set__(
      'assistant',
      new watson.AssistantV1({
        username: 'fake',
        password: 'fake',
        url: 'fake',
        version_date: '2017-04-21',
        version: 'v1'
      })
    );
    assistant = main.__get__('assistant');
    message = sinon.stub(assistant, 'message');
    message.yields(err, contextOut);
  });

  it(
    'test assistantMessage without intent',
    sinon.test(function(done) {
      assistantMessage({}, WS_ID).then(result => {
        expect(result).to.deep.equal(contextOut);
        sinon.assert.calledWithMatch(message, { context: TEST_CONTEXT, input: { text: 'start skill' }, workspace_id: WS_ID });
        done();
      });
    })
  );

  it(
    'test assistantMessage with intent',
    sinon.test(function(done) {
      assistantMessage({ intent: { slots: { EveryThingSlot: { value: TEST_INPUT } } } }, WS_ID).then(result => {
        expect(result).to.deep.equal(contextOut);
        sinon.assert.calledWithMatch(message, { context: TEST_CONTEXT, input: { text: TEST_INPUT }, workspace_id: WS_ID });
        done();
      });
    })
  );
});

describe('test main()', function() {
  it(
    'test main no __ow_body',
    sinon.test(function(done) {
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
