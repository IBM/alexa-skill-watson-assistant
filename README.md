[![Build Status](https://travis-ci.org/IBM/alexa-skill-watson-conversation.svg?branch=master)](https://travis-ci.org/IBM/alexa-skill-watson-conversation)

# Create an Alexa skill using Watson Assistant and OpenWhisk

> Watson Conversation is now Watson Assistant. Although some images in this code pattern may show the service as Watson Conversation, the steps and processes will still work.

In this Code Pattern, we will create an Alexa skill using
[Watson Assistant](https://www.ibm.com/watson/developercloud/conversation.html)
via the [Apache OpenWhisk](http://openwhisk.incubator.apache.org/) serverless framework.
Alexa is the voice service behind products like the Amazon Echo.
IBM Cloud Functions (based on Apache OpenWhisk) will be used to integrate Alexa
with Watson Assistant.
Credit goes to [Niklas Heidloff](http://heidloff.net/) for creating the original project.

An example conversation is included to demonstrate how to pass context between
different intents. You can also use this Code Pattern to try out a conversation from
the [Bot Asset Exchange (BAE)](https://developer.ibm.com/code/exchanges/bots/).

When the reader has completed this Code Pattern, they will understand how to:

* Create an OpenWhisk action in the IBM Cloud Functions serverless platform
* Use Redis to store a session's conversation context across events
* Import a conversation from the Bot Asset Exchange (BAE) or a JSON file
* Invoke a conversation with Watson using Node.js
* Use the Weather Channel Data service to lookup locations and forecasts
* Create an Alexa skill to reach tens of millions of customers

![](doc/source/images/architecture.png)

## Flow
1. User says "Alexa, ask Watson...".
2. Alexa invokes IBM Cloud Functions with input text.
3. The action gets the conversation context from Redis (if any).
4. The action gets a response from Watson Assistant.
5. The Weather Company Data service provides the forecast (when applicable).
6. The response context is stored in Redis.
7. The response text is sent back to Alexa.
8. Alexa replies to the user.

## Included components

* [Watson Assistant](https://www.ibm.com/watson/developercloud/conversation.html): Create a chatbot with a program that conducts a conversation via auditory or textual methods.
* [OpenWhisk](https://console.ng.bluemix.net/openwhisk): Execute code on demand in a highly scalable, serverless environment.
* [Redis](https://redis.io/): An open-source, in-memory data structure store, used as a database, cache and message broker.

## Featured technologies
* [Serverless](https://www.ibm.com/cloud-computing/bluemix/openwhisk): An event-action platform that allows you to execute code in response to an event.
* [Databases](https://en.wikipedia.org/wiki/IBM_Information_Management_System#.22Full_Function.22_databases): Repository for storing and managing collections of data.
* [Node.js](https://nodejs.org/): An open-source JavaScript run-time environment for executing server-side JavaScript code.

# Watch the Video

[![](http://img.youtube.com/vi/4cTSkX0wSV8/0.jpg)](https://www.youtube.com/watch?v=4cTSkX0wSV8)

# Steps

## Run locally

1. [Clone the repo](#1-clone-the-repo)
1. [Create a Watson Assistant workspace](#2-create-a-watson-conversation-workspace)
1. [Create a Compose for Redis service](#3-create-a-compose-for-redis-service)
1. [Create a Weather Company Data service](#4-create-a-weather-company-data-service)
1. [Configure credentials](#5-configure-credentials)
1. [Create the OpenWhisk action](#6-create-the-openwhisk-action)
1. [Create an Alexa skill](#7-create-an-alexa-skill)
1. [Talk to it](#8-talk-to-it)

### 1. Clone the repo

Clone the `alexa-skill-watson-conversation` repo locally and `cd` to the local repo
(for commands in later steps). In a terminal, run:

```
$ git clone https://github.com/IBM/alexa-skill-watson-conversation
$ cd alexa-skill-watson-conversation
```

### 2. Create a Watson Assistant workspace

Sign up for [IBM Cloud](https://console.ng.bluemix.net/registration/) if you don't have an IBM Cloud account yet.

Use one or both of these options (with or without BAE) to setup a Assistant workspace.

#### Using Bot Asset Exchange (BAE)
If you are using BAE, use [Get a bot](https://developer.ibm.com/code/exchanges/bots/#botSearch) and `Get this bot` to automatically create
your Assistant service and import your workspace(s). The service will be named
`Bot Asset Exchange Workspaces` and can hold up to 5 selected workspaces.

#### Using the provided workspace.json file
Create the service by following this link and hitting `Create`:
* [**Watson Assistant**](https://console.ng.bluemix.net/catalog/services/conversation)

Import the Assistant workspace.json:
* Find the Assistant service in your IBM Cloud Dashboard.
* Click on the service and then click on `Launch Tool`.
* Click on the **import** icon (next to the Workspaces Create button).
* Click `Choose a file` and find the local version of [`data/conversation/workspaces/workspace.json`](data/conversation/workspaces/workspace.json).
* Select `Everything` and click `Import`.

### 3. Create a Compose for Redis service

Follow this link and hit `Create`:
* [**Compose for Redis**](https://console.ng.bluemix.net/catalog/services/compose-for-redis)

### 4. Create a Weather Company Data service

If you are using the provided workspace.json, use Weather Company Data to provide weather responses.

Follow this link and hit `Create`:
* [**Weather Company Data**](https://console.ng.bluemix.net/catalog/services/weather-company-data)

This service includes an OpenWhisk package.
Run the following to [install the OpenWhisk bindings for IBM Cloud](https://console.bluemix.net/openwhisk/learn/cli):
```
$ bx plugin install Cloud-Functions -r Bluemix
```

Run the following command to update your OpenWhisk bindings if they are already installed:
```
$ bx wsk package refresh
```

Run the following to test OpenWhisk on IBM Cloud:
```
$ bx wsk action invoke /whisk.system/utils/echo -p message hello --result
```
### 5. Configure credentials

The credentials for IBM Cloud services (Assistant,
Compose for Redis and Weather Company Data), can be found in the ``Services`` menu in IBM Cloud,
by selecting the ``Service Credentials`` option for each service.

Find the ``WORKSPACE_ID`` by clicking on the context menu of the
workspace and select **View details**.

The default runtime parameters need to be set for the action.
These can be set on the command-line or via the IBM Cloud UI.
Here we've provided a params.sample file for you to copy and use
with the `-param-file .params` option.

Copy the [`params.sample`](params.sample) to `.params`.

```
$ cp params.sample .params
```
Edit the `.params` file and add the required settings.

#### `params.sample:`

```json
{
  "CONVERSATION_USERNAME": "<add_conversation_username>",
  "CONVERSATION_PASSWORD": "<add_conversation_password>",
  "WORKSPACE_ID": "<add_conversation_workspace_id>",
  "REDIS_URI": "<add_redis_uri>",
  "WEATHER_URL": "<add_weather_url>"
}
```

### 6. Create the OpenWhisk action

#### Create the OpenWhisk action
Run these commands to gather Node.js requirements, zip the source files, and upload the zipped files
to create a raw HTTP web action in OpenWhisk.

> Note: You can use the same commands to update the action if you modify the code.

```sh
$ npm install
$ zip -r action.zip *
$ bx wsk action update alexa-watson action.zip --kind nodejs:6 --web raw --param-file .params
```

### 7. Create an Alexa skill
Sign up for an Amazon Developer Portal account [here](http://developer.amazon.com/).

Follow the instructions
[here](https://developer.amazon.com/public/solutions/alexa/alexa-skills-kit/docs/registering-and-managing-alexa-skills-in-the-developer-portal#register-a-new-skill)
to register your new skill using the `Alexa Skills Kit`.

Select `Custom Interaction Model` and choose a `Name` and `Invocation Name`.

![](doc/source/images/create_skill.png)

Save and hit `Next` and then you will enter an `Intent Schema`, `Custom Slot Types` and `Sample Utterances`. We'll use a very minimal data here and let Watson Assistant do most of the work.

Copy the data from `data/alexa` to fill out these three sections.

#### Intent Schema
![](doc/source/images/intent_schema.png)
#### Custom Slot Types
![](doc/source/images/custom_slot_types.png)
#### Sample Utterances
![](doc/source/images/sample_utterances.png)

On the configuration page you need to define an **HTTPS** service endpoint which is the URL of your OpenWhisk **Web Action**. To find this URL, navigate to [IBM Cloud Functions - Actions](https://console.bluemix.net/openwhisk/manage/actions), click on your action and navigate to `Endpoints`.  The Web Action URL ends with `.json`.

![](doc/source/images/functions_endpoints.png)

Hit `Next`. Under 'Certificate for DEFAULT Endpoint:' select the `My development endpoint is a sub-domain of a domain that has a wildcard certificate from a certificate authority` option.

Hit `Next` and your skill is ready for testing!

### 8. Talk to it

You can run the sample via Alexa enabled devices, or the [Echo simulator](https://echosim.io/) or the service simulator in the Amazon developer portal.

You can invite others to test it with the beta test feature. In order to be
eligible for beta test, you must fill out most of the publishing information.

You probably shouldn't publish this example, but you are now
ready to create and publish your own Alexa skill.

# Sample output

Here is a sample conversation flow using the provided conversation workspace.json:

- User: Alexa, ask Watson what do you know about me?
- Alexa/Watson: I don't know anything about you. Where do you live?
- User: Alexa, tell Watson Berlin
- Alexa/Watson: I understand you live in Berlin.
- User: Alexa, ask Watson what is the weather forecast?
- Alexa/Watson: Looking up weather information for Berlin ...

The sample has been implemented via the [slots filling](http://heidloff.net/article/conversation-watson-slots) functionality in Watson Assistant. The screenshot shows how the entity (slot) 'location' is defined as mandatory and how the value is stored in a context variable.

![alt text](https://raw.githubusercontent.com/nheidloff/alexa-skill-watson-conversation/master/screenshots/dialog-2.png "Watson")

The next screenshot shows how the location is automatically used in the next 'weather' intent.

![alt text](https://raw.githubusercontent.com/nheidloff/alexa-skill-watson-conversation/master/screenshots/dialog-1.png "Watson")

# Troubleshooting

  > Use the IBM Cloud UI to monitor logs, or use this command to show the latest activation log:
  ```
  bx wsk activation list -l1 | tail -n1 | cut -d ' ' -f1 | xargs bx wsk activation logs
  ```

* Invoke from command line

  > Use these commands to invoke the action (named alexa-watson in the example) without any input, then check the latest logs. Expect an error ("Must be called from Alexa").
  ```
  bx wsk action invoke alexa-watson -bvd
  bx wsk activation list -l1 | tail -n1 | cut -d ' ' -f1 | xargs bx wsk activation logs
  ```

# Links

* [Demo on Youtube](https://www.youtube.com/watch?v=4cTSkX0wSV8): Watch the video.
* [Watson Node.js SDK](https://github.com/watson-developer-cloud/node-sdk): Download the Watson Node SDK.
* [Alexa/Google Home infinite loop conversation](https://www.youtube.com/watch?v=LEz9AU9c2qQ): Check out how it works.
* [Award winners](https://www.voicebot.ai/2017/03/01/amazon-alexa-ibm-watson-won-2016-voice-assistant-wars-already-winning-2017/): Amazon Alexa and IBM Watson won the 2016 Voice Assistant Wars.
* [Bluemix Stirred](https://bluemixstirred.wordpress.com/2017/05/11/use-the-amazon-echo-dot-with-the-watson-conversation-service/): Learn how to use the Amazon Echo and Dot with the Watson Assistant Service.

# Learn more

* **Artificial Intelligence Code Patterns**: Enjoyed this Code Pattern? Check out our other [AI Code Patterns](https://developer.ibm.com/code/technologies/artificial-intelligence/).
* **AI and Data Code Pattern Playlist**: Bookmark our [playlist](https://www.youtube.com/playlist?list=PLzUbsvIyrNfknNewObx5N7uGZ5FKH0Fde) with all of our Code Pattern videos
* **With Watson**: Want to take your Watson app to the next level? Looking to utilize Watson Brand assets? [Join the With Watson program](https://www.ibm.com/watson/with-watson/) to leverage exclusive brand, marketing, and tech resources to amplify and accelerate your Watson embedded commercial solution.

# License
[Apache 2.0](LICENSE)
