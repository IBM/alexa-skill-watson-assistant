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
let watson = require('watson-developer-cloud');
let ConversationV1 = require('watson-developer-cloud/conversation/v1');
let redis = require("redis");

function main(args) {
    //console.log(args)

    let conversation = new ConversationV1({
        username: args.WATSON_USER_NAME,
        password: args.WATSON_PASSWORD,
        version_date: ConversationV1.VERSION_DATE_2017_04_21
    });
    let client = redis.createClient(args.REDIS_PORT, args.REDIS_IP);

    let errorResponse = {
        "version": "1.0",
        "response": {
            "shouldEndSession": true,
            "outputSpeech": {
                "type": "PlainText",
                "text": "An unexpected error occured. Please try again later."
            }
        }
    }

    return new Promise(function (resolve, reject) {

        let signaturechainurl = args.__ow_headers.signaturecertchainurl;
        let signature = args.__ow_headers.signature;
        let body = new Buffer(args.__ow_body, 'base64').toString('ascii');

        alexaVerifier(signaturechainurl, signature, body, function (err) {

            if (err) {
                console.log('err? ' + JSON.stringify(err));
                reject(err);
            } else {
                let request = JSON.parse(body).request;
                let session = JSON.parse(body).session;

                let previousContext = {};
                let redisContext;

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
                        conversation.message({
                            input: { text: input },
                            workspace_id: args.WATSON_WORKSPACE_ID,
                            context: previousContext
                        }, function (err, watsonResponse) {
                            if (err) {
                                console.error(err);
                                resolve(errorResponse);
                            }
                            else {
                                let newContext = {};
                                if (watsonResponse.context) {
                                    let newContextString = JSON.stringify(watsonResponse.context);                                    
                                    client.set(session.sessionId, newContextString, 'EX', 600);
                                }

                                let response = {
                                    "version": "1.0",
                                    "response": {
                                        "shouldEndSession": false,
                                        "outputSpeech": {
                                            "type": "PlainText",
                                            "text": watsonResponse.output.text[0]
                                        }
                                    }
                                }
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