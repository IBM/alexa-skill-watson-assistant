//------------------------------------------------------------------------------
// Copyright IBM Corp. 2017
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//------------------------------------------------------------------------------

let alexaVerifier = require('alexa-verifier');
let ConversationV1 = require('watson-developer-cloud/conversation/v1');
let redis = require("redis");

function main(args) {
    // console.log(args)

    let conversation = new ConversationV1({
        username: args.CONVERSATION_USERNAME,
        password: args.CONVERSATION_PASSWORD,
        version_date: ConversationV1.VERSION_DATE_2017_04_21
    });
    console.log("Connected to Watson Conversation");

    let client = null;
    if (args.REDIS_URI) {
        client = redis.createClient(args.REDIS_URI);
    } else if (args.REDIS_PORT && args.REDIS_IP) {
        client = redis.createClient(args.REDIS_PORT, args.REDIS_IP);
    } else {
        client = redis.createClient();
    }
    console.log("Connected to Redis");

    let errorResponse = {
        "version": "1.0",
        "response": {
            "shouldEndSession": true,
            "outputSpeech": {
                "type": "PlainText",
                "text": "An unexpected error occurred. Please try again later."
            }
        }
    };

    return new Promise(function (resolve, reject) {

        let signaturechainurl = args.__ow_headers.signaturecertchainurl;
        let signature = args.__ow_headers.signature;
        let body = new Buffer(args.__ow_body, 'base64').toString('ascii');

        alexaVerifier(signaturechainurl, signature, body, function (err) {

            if (err) {
                console.error('err? ' + JSON.stringify(err));
                reject(err);
            } else {
                let request = JSON.parse(body).request;
                let session = JSON.parse(body).session;

                let previousContext = {};

                console.log("sessionId: " + session.sessionId);

                client.get(session.sessionId, function (err, value) {
                    if (err) {
                        console.error(err);
                        resolve(errorResponse);
                    }
                    else {
                        if (value) {
                            previousContext = JSON.parse(value);
                        }
                        let input;
                        if (request.intent) {
                            input = request.intent.slots.EveryThingSlot.value;
                        }
                        else {
                            input = 'start skill';
                        }

                        console.log("WORKSPACE_ID: " + args.WORKSPACE_ID);
                        console.log("Input text: " + input);
                        conversation.message({
                            input: { text: input },
                            workspace_id: args.WORKSPACE_ID,
                            context: previousContext
                        }, function (err, watsonResponse) {
                            if (err) {
                                console.error(err);
                                resolve(errorResponse);
                            }
                            else {
                                let output = watsonResponse.output.text[0];
                                console.log("Output text: " + output);
                                if (watsonResponse.context) {
                                    let newContextString = JSON.stringify(watsonResponse.context);
                                    // Save context with expiration of 600 secs
                                    client.set(session.sessionId, newContextString, 'EX', 600);
                                }

                                let response = {
                                    "version": "1.0",
                                    "response": {
                                        "shouldEndSession": false,
                                        "outputSpeech": {
                                            "type": "PlainText",
                                            "text": output
                                        }
                                    }
                                };
                                resolve(response);
                            }
                        });
                    }
                })
            }
        });
    });
}

exports.main = main;