Alexa Skill using IBM Watson Conversation and OpenWhisk
================================================================================

This [project](https://github.com/nheidloff/alexa-skill-watson-conversation) contains a simple Alexa skill which has been implemented via the serverless framework [OpenWhisk](http://openwhisk.incubator.apache.org/) and [IBM Watson Conversation](https://www.ibm.com/watson/developercloud/conversation.html). It demonstrates how to define a conversation flow declaratively via Watson Conversation dialogs and it shows how to pass context between different intents.

Here is a sample conversation flow:

- User: Alexa, ask my skill what do you know about me
- Alexa/Watson: I don't know anything about you. Where do you live?
- User: Berlin
- Alexa/Watson: Now I know you live in Berlin
- User: Alexa, ask my skill what is the weather
- Alexa/Watson: Looking up weather information for Berlin ...

The sample has been implemented via the new [slots filling](http://heidloff.net/article/conversation-watson-slots) functionality in Watson Conversation. The screenshot shows how the entity (slot) 'location' is defined as mandatory and how the value is stored in a context variable.

![alt text](https://raw.githubusercontent.com/nheidloff/alexa-skill-watson-conversation/master/screenshots/dialog-2.png "Watson")

The next screenshot shows how the location is automatically used in the next 'weather' intent.

![alt text](https://raw.githubusercontent.com/nheidloff/alexa-skill-watson-conversation/master/screenshots/dialog-1.png "Watson")


Setup - OpenWhisk and Watson
================================================================================

Sign up to [Bluemix](https://console.ng.bluemix.net/registration/) if you don't have a Bluemix account yet.

Install the [OpenWhisk CLI](https://console.bluemix.net/openwhisk/learn/cli).

Create a [Watson Conversation](https://console.bluemix.net/catalog/services/conversation) instance and get the [service credentials](https://github.com/watson-developer-cloud/node-sdk#getting-the-service-credentials). After this import the [workspace](https://github.com/nheidloff/alexa-skill-watson-conversation/blob/master/workspace.json).

In order to set up Redis you can either use [Compose for Redis](https://console.bluemix.net/catalog/services/compose-for-redis) or deploy a Docker container on Bluemix. I've deployed a Docker container and only needed for the purpose of this demo the container's IP address and port.

Run these commands:

```sh
$ git clone https://github.com/nheidloff/alexa-skill-watson-conversation.git
§ cd alexa-skill-watson-conversation
$ zip -r action.zip * 
$ wsk action update alexa-watson action.zip --kind nodejs:6 -a raw-http true -a web-export true --param WATSON_USER_NAME xxx --param WATSON_PASSWORD xxx --param WATSON_WORKSPACE_ID xxx --param REDIS_IP xxx --param REDIS_PORT xxx
```

Setup - Alexa Skill
================================================================================

[Sign up](http://developer.amazon.com/) for an Amazon Developer Portal account.

Create a new [Alexa skill](https://developer.amazon.com/public/solutions/alexa/alexa-skills-kit/docs/registering-and-managing-alexa-skills-in-the-developer-portal#register-a-new-skill). Check out the [screenshots](https://github.com/nheidloff/alexa-skill-watson-conversation/tree/master/screenshots) alexa-config-1.png - alexa-config-4.png. You can find the data for the interaction page in the directory 'speechAssets'.

On the configuration page you need to define the service endpoint which is the URL of your OpenWhisk action ending with '.json', for example https://openwhisk.ng.bluemix.net/api/v1/web/niklas_heidloff%40de.ibm.com_demo/default/alexa-skill.json. To find this URL, navigate to the [OpenWhisk dashboard](https://console.bluemix.net/openwhisk/manage/actions), select your action and navigate to 'Additional Details'.


Run the Sample
================================================================================

You can run the sample via Alexa enabled devices, or the [Echo simulator](https://echosim.io/) or the service simulator in the Amazon developer portal.