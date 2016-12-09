/**
 * Created by tom on 28/08/15.
 */
import ES6Promise       from 'es6-promise';
import '../../../../../utils/hotfixes/polyfills/FunctionName.js';
import '../../../../../utils/hotfixes/polyfills/ObjectKeys.js';
import '../../../../../utils/hotfixes/polyfills/StartsWith.js';
import {SharePointClient}               from './SharePointClient.js';

let clients = {};

/* PolyFill ES6 Promises */
ES6Promise.polyfill();


onmessage = async function (messageEvent) {
    let message = messageEvent.data;
    let {subscriberID, operation} = message;
    let client = clients[subscriberID];
    let clientExisted = !!client;

    /* If the requested client doesn't exist yet, create a new instance. */
    if (!clientExisted) {
        /* This automatically subscribes to changes, so for a set/remove operation that
         * isn't interested in listening to changes we'll need to unsubscribe again after the operation. */
        client = clients[subscriberID] = new SharePointClient(message);
        client.referenceCount = 0;
    }

    switch (operation) {
        case 'init':
            if (!client.initialised) {
                client.init();
                client.initialised = true;
                client.on('message', (message) => {
                    message.subscriberID = subscriberID;
                    postMessage(message);
                });
            }
            break;
        case 'subscribe':
            client.subscribeToChanges();
            client.referenceCount++;
            break;
        case 'dispose':
            client.referenceCount--;
            if (client.referenceCount <= 0) {
                client.dispose();
            }
            break;
        case 'set':
            client.set(message.model);
            /* If the client was created for this set operation,
             * cancel all subscriptions that were automatically created on instantiation. */
            if (!clientExisted) {
                client.dispose();
            }
            break;
        case 'remove':
            client.remove(message.model);
            /* If the client was created for this remove operation,
             * cancel all subscriptions that were automatically created on instantiation. */
            if (!clientExisted) {
                client.dispose();
            }
            break;
        case 'get_cache':
            let cacheData = client.cache;
            postMessage({
                subscriberID: subscriberID,
                event: 'cache_data',
                cache: cacheData
            });
            break;
        case 'get_auth':
            try {
                let authData = await client.getAuth();
                postMessage({
                    subscriberID: subscriberID,
                    event: 'auth_result',
                    auth: authData
                });
            } catch (error) {
                console.log('Error whilst fetching user auth data: ', error);
            }
            break;
    }
};
