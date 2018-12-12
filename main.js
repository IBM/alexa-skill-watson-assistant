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

const alexaVerifier = require('alexa-verifier');
const AssistantV1 = require('watson-developer-cloud/assistant/v1');
const redis = require('redis');
const openwhisk = require('openwhisk');
const request = require('request');
const Url = require('url').Url;

function errorResponse(reason) {
  return {
    version: '1.0',
    response: {
      shouldEndSession: true,
      outputSpeech: {
        type: 'PlainText',
        text: reason || 'An unexpected error occurred. Please try again later.'
      }
    }
  };
}

// Using some globals for now
let assistant;
let redisClient;
let context;

function verifyFromAlexa(args, rawBody) {
  return new Promise(function(resolve, reject) {
    const certUrl = args.__ow_headers.signaturecertchainurl;
    const signature = args.__ow_headers.signature;
    alexaVerifier(certUrl, signature, rawBody, function(err) {
      if (err) {
        console.error('err? ' + JSON.stringify(err));
        throw new Error('Alexa verification failed.');
      }
      resolve();
    });
  });
}

function initClients(args) {
  // Connect a client to Watson Assistant
  if (args.ASSISTANT_IAM_APIKEY) {
    assistant = new AssistantV1({
      version: '2018-02-16',
      iam_apikey: args.ASSISTANT_IAM_APIKEY,
      url: args.ASSISTANT_IAM_URL
    });
  } else if (args.ASSISTANT_USERNAME) {
    assistant = new AssistantV1({
      version: '2018-02-16',
      username: args.ASSISTANT_USERNAME,
      password: args.ASSISTANT_PASSWORD
    });
  } else {
    console.error('err? ' + 'Invalid Credentials');
    throw new Error('Invalid Credentials');
  }

  console.log('Connected to Watson Assistant');

  // Connect a client to Redis
  const connectionString = args.REDIS_URI;
  if (connectionString.startsWith('rediss://')) {
    const convertedCert = Buffer.from(args.REDIS_CERT, 'base64').toString();
    redisClient = redis.createClient(connectionString, {
      tls: { servername: new Url(connectionString).hostname, ca: convertedCert }
    });
  } else {
    redisClient = redis.createClient(connectionString);
  }
  redisClient.on('error', function(err) {
    console.log('Redis Error - ' + err);
  });

  console.log('Connected to Redis');
}

function getSessionContext(sessionId) {
  console.log('sessionId: ' + sessionId);

  return new Promise(function(resolve, reject) {
    redisClient.get(sessionId, function(err, value) {
      if (err) {
        console.error(err);
        reject('Error getting context from Redis.');
      }
      // set global context
      context = value ? JSON.parse(value) : {};
      console.log('context:');
      console.log(context);
      resolve();
    });
  });
}

function assistantMessage(request, workspaceId) {
  return new Promise(function(resolve, reject) {
    const input = request.intent ? request.intent.slots.EveryThingSlot.value : 'start skill';
    console.log('WORKSPACE_ID: ' + workspaceId);
    console.log('Input text: ' + input);

    assistant.message(
      {
        input: { text: input },
        workspace_id: workspaceId,
        context: context
      },
      function(err, watsonResponse) {
        if (err) {
          console.error(err);
          reject('Error talking to Watson.');
        } else {
          console.log(watsonResponse);
          context = watsonResponse.context; // Update global context
          resolve(watsonResponse);
        }
      }
    );
  });
}

function lookupGeocode(args, location) {
  if (args.WEATHER_URL) {
    return new Promise(function(resolve, reject) {
      const weatherPort = args.WEATHER_PORT || 443;
      const url = args.WEATHER_URL + ':' + weatherPort + '/api/weather/v3/location/search';
      console.log('Getting geocode for ' + location);
      request(
        {
          method: 'GET',
          url: url,
          jar: true,
          json: true,
          qs: {
            query: location,
            locationType: 'city',
            language: 'en-US'
          }
        },
        function(err, response, body) {
          // console.log('Locations from Weather location services');
          // console.log(body.location);
          if (body.location.length < 1) {
            reject('Location not found');
          }
          // Just take the first one.
          const latitude = body.location.latitude[0];
          const longitude = body.location.longitude[0];
          resolve([latitude, longitude]);
        }
      );
    });
  } else {
    console.log('Cannot lookup geocode, using Honolulu.');
    return Promise.resolve([21.32, -157.85]);
  }
}

function myOpenWhisk() {
  return openwhisk();
}

function getWeatherCompanyForecast(geocode) {
  // console.log(geocode);
  const ow = myOpenWhisk();
  const blocking = true;
  const params = { units: 'e', latitude: geocode[0].toString(), longitude: geocode[1].toString() };

  return ow.packages
    .list()
    .then(results => {
      console.log('results: ', results);
      let name;
      // Find the Weather Company Data package and build the action name for forecast.
      for (let i = 0, size = results.length; i < size; i++) {
        const result = results[i];
        console.log(result);
        console.log(result.name);
        if (result.binding.name === 'weather') {
          name = '/' + result.namespace + '/' + result.name + '/forecast';
          break;
        }
      }
      console.log('Using weather from ' + name);
      return name;
    })
    .then(name => {
      return ow.actions.invoke({ name, blocking, params });
    });
}

function actionHandler(args, watsonResponse) {
  console.log('Begin actionHandler');
  console.log(args);
  console.log(watsonResponse);

  return new Promise((resolve, reject) => {
    switch (watsonResponse.output.action) {
      case 'lookupWeather':
        console.log("Calling action 'lookupWeather'");
        return lookupGeocode(args, watsonResponse.output.location)
          .then(geocode => getWeatherCompanyForecast(geocode))
          .then(forecast => {
            // Use the first narrative.
            const narrative = forecast.response.result.forecasts[0].narrative;
            watsonResponse.output.text.push(narrative);
            resolve(watsonResponse);
          });
      /* Other actions could be implemented with this switch or using watsonResponse values.
      case "addMoreActionsHere":
          return resolve(watsonResponse);
      */
      default:
        // No action. Resolve with watsonResponse as-is.
        console.log('No action');
        return resolve(watsonResponse);
    }
  });
}

function sendResponse(response, resolve) {
  console.log('Begin sendResponse');
  console.log(response);

  // Combine the output messages into one message.
  const output = response.output.text.join(' ');
  console.log('Output text: ' + output);

  // Resolve the main promise now that we have our response
  resolve({
    version: '1.0',
    response: {
      shouldEndSession: false,
      outputSpeech: {
        type: 'PlainText',
        text: output
      }
    }
  });
}

function saveSessionContext(sessionId) {
  console.log('Begin saveSessionContext');
  console.log(sessionId);

  // Save the context in Redis. Can do this after resolve(response).
  if (context) {
    const newContextString = JSON.stringify(context);
    // Saved context will expire in 600 secs.
    redisClient.set(sessionId, newContextString, 'EX', 600);
    console.log('Saved context in Redis');
    console.log(sessionId);
    console.log(newContextString);
  }
}

function main(args) {
  console.log('Begin action');
  // console.log(args);
  return new Promise(function(resolve, reject) {
    if (!args.__ow_body) {
      return reject(errorResponse('Must be called from Alexa.'));
    }

    const rawBody = Buffer.from(args.__ow_body, 'base64').toString('ascii');
    const body = JSON.parse(rawBody);
    const sessionId = body.session.sessionId;
    const request = body.request;

    verifyFromAlexa(args, rawBody)
      .then(() => initClients(args))
      .then(() => getSessionContext(sessionId))
      .then(() => assistantMessage(request, args.WORKSPACE_ID))
      .then(watsonResponse => actionHandler(args, watsonResponse))
      .then(actionResponse => sendResponse(actionResponse, resolve))
      .then(() => saveSessionContext(sessionId))
      .catch(err => {
        console.error('Caught error: ');
        console.log(err);
        reject(errorResponse(err));
      });
  });
}

exports.main = main;
