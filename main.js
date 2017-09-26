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

const alexaVerifier = require('alexa-verifier');
const ConversationV1 = require('watson-developer-cloud/conversation/v1');
const redis = require("redis");
const openwhisk = require('openwhisk');
const request = require('request');

function lookupGeocode(args, location) {

    if (args.WEATHER_URL) {
        return new Promise(function(resolve, reject) {
            const weatherPort = args.WEATHER_PORT || 443;
            const url = args.WEATHER_URL + ':' + weatherPort + '/api/weather/v3/location/search';
            console.log("Getting geocode for " + location);
            request({
                method: 'GET',
                url: url,
                jar: true,
                json: true,
                qs: {
                    query: location,
                    locationType: 'city',
                    language: 'en-US'
                }
            }, function (err, response, body) {
                // console.log("Locations from Weather location services");
                // console.log(body.location);
                if (body.location.length < 1) {
                    reject("Location not found");
                }
                // Just take the first one.
                let latitude = body.location.latitude[0];
                let longitude = body.location.longitude[0];
                resolve([latitude, longitude]);
            });
        });
    }
    else {
        console.log("Cannot lookup geocode, using Honolulu.");
        return Promise.resolve([21.32, -157.85]);
    }
}

function getWeatherCompanyForecast(geocode) {

    const ow = openwhisk();
    const blocking = true;
    const params = {units: 'e', latitude: geocode[0].toString(), longitude: geocode[1].toString()};

    return ow.packages.list()
    .then(results => {
        console.log('results: ', results);
        let name;
        // Find the Weather Company Data package and build the action name for forecast.
        for (let i = 0, size = results.length; i < size; i++) {
            let result = results[i];
            console.log(result);
            console.log(result.name);
            if (result.name.startsWith('Bluemix_Weather Company Data')) {
                name = '/' + result.namespace + '/' + result.name + '/forecast';
                break;
            }
        }
        console.log("Using weather from " + name);
        return name;
    })
    .then(name => {
        return ow.actions.invoke({name, blocking, params})
    });
}

function actionHandler(args, watsonResponse) {
    return new Promise((resolve, reject) => {

        switch (watsonResponse.output.action) {
            case "lookupWeather":
                console.log("Calling action 'lookupWeather'");
                return lookupGeocode(args, watsonResponse.output.location)
                    .then(geocode => getWeatherCompanyForecast(geocode))
                    .then(forecast => {
                        // Use the first narrative.
                        let narrative = forecast.response.result.forecasts[0].narrative;
                        watsonResponse.output.text.push(narrative);
                        resolve(watsonResponse);
                    });
            /* Other actions could be implemented with this switch or using watsonResponse values.
            case "addMoreActionsHere":
                return resolve(watsonResponse);
            */
            default:
                // No action. Resolve with watsonResponse as-is.
                return resolve(watsonResponse);
        }
    });
}

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

                // Get the saved session context, if any, from Redis
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

                        // Call Watson Conversation
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
                                // Perform additional actions based on the response.
                                actionHandler(args, watsonResponse).then(actionResponse => {
                                    // console.log(actionResponse);

                                    // Combine the output messages into one message.
                                    let output = actionResponse.output.text.join(' ');
                                    console.log("Output text: " + output);

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

                                    // Save the context in Redis. Can do this after resolve(response).
                                    if (watsonResponse.context) {
                                        let newContextString = JSON.stringify(watsonResponse.context);
                                        // Saved context will expire in 600 secs.
                                        client.set(session.sessionId, newContextString, 'EX', 600);
                                        console.log("Saved context in Redis");
                                    }
                                })
                            }
                        });
                    }
                })
            }
        });
    });
}

exports.main = main;