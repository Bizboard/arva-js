/**
 * Created by mysim1 on 13/06/15.
 */

import extend           from 'lodash/extend.js';
import EventEmitter     from 'eventemitter3';
import {Settings}       from './Settings.js';
import {UrlParser}      from '../../../../utils/request/UrlParser.js';
import {ObjectHelper}   from '../../../../utils/ObjectHelper.js';
import {BlobHelper}     from '../../../../utils/BlobHelper.js';

let DEBUG_WORKER = true;
let SPWorker = new Worker('worker.js');
let workerEvents = new EventEmitter();
SPWorker.onmessage = (messageEvent) => {
    workerEvents.emit('message', messageEvent);
};

/**
 * The SharePoint class will utilize a Web Worker to perform data operations. Running the data interfacing in a
 * seperate thread from the UI thread will ensure there is minimal interruption of the user interaction.
 */

export class SharePoint extends EventEmitter {

    constructor(options = {}) {
        super();


        let endpoint = UrlParser(options.endPoint);
        if (!endpoint) throw Error('Invalid configuration.');

        this.subscriberID = SharePoint.hashCode(endpoint.path + JSON.stringify(options.query) + options.orderBy + options.limit);
        this.options = options;
        this.cache = null;

        workerEvents.on('message', this._onMessage.bind(this));
    }

    getAuth(callback, context = this) {
        super.once('auth_result', (authData) => this._handleAuthResult(authData, callback, context));

        /* Grab any existing cached data for this path. There will be data if there are other
         * subscribers on the same path already. */
        SPWorker.postMessage(extend({}, this.options, {
            subscriberID: this.subscriberID,
            endPoint: this.options.endPoint,
            operation: 'get_auth'
        }));
    }

    once(event, handler, context = this) {
        this.on(event, function () {
            handler.call(context, ...arguments);
            this.off(event, handler, context);
        }.bind(this), context);
    }

    on(event, handler, context = this) {
        /* Hold off on initialising the actual SharePoint connection until someone actually subscribes to data changes. */
        if (!this._initialised) {
            this._initialise();
            this._initialised = true;
        }

        /* Fix to make Arva-ds PrioArray.add() work, by immediately returning the model data with an ID when the model is created. */
        if (!this._ready && this.cache && event === 'value') {
            handler.call(context, this.cache);
        }

        if (this._ready && event === 'value') {
            this.once('cache_data', (cacheData) => this._handleCacheData(cacheData, event, handler, context));

            /* Grab any existing cached data for this path. There will be data if there are other
             * subscribers on the same path already. */
            SPWorker.postMessage(extend({}, this.options, {
                subscriberID: this.subscriberID,
                operation: 'get_cache'
            }));
        }

        /* Tell the SharePoint worker that we want to be subscribed to changes from now on (can be called multiple times) */
        SPWorker.postMessage(extend({}, this.options, {
            subscriberID: this.subscriberID,
            operation: 'subscribe'
        }));

        super.on(event, handler, context);
    }

    off(event, handler) {
        let amountRemoved;
        if (event && handler) {
            this.removeListener(event, handler);
            amountRemoved = 1;
        } else {
            this.removeAllListeners(event);
            amountRemoved = this.listeners(event).length;
        }

        for (let i = 0; i < amountRemoved; i++) {
            /* Tell the Manager that this subscription is cancelled and no longer requires refreshed data from SharePoint. */
            SPWorker.postMessage(extend({}, this.options, {
                subscriberID: this.subscriberID,
                operation: 'dispose'
            }));
        }
    }

    set(model) {
        /* Hold off on initialising the actual SharePoint connection until someone actually subscribes to data changes. */
        if (!this._initialised) {
            this._initialise();
            this._initialised = true;
        }

        /* If there is no ID, make a temporary ID for reference in the main thread for the session scope. */
        let modelId = model.id;
        if (!modelId || modelId === 0) {
            model['_temporary-identifier'] = `${Settings.localKeyPrefix}${Math.floor((Math.random() * 2000000000))}`;
        }

        SPWorker.postMessage({
            subscriberID: this.subscriberID,
            endPoint: this.options.endPoint,
            listName: this.options.listName,
            operation: 'set',
            model: model
        });

        if (model['_temporary-identifier']) {
            /* Set the model's ID to the temporary one so it can be used to query the dataSource with. */
            if (model.disableChangeListener) {
                model.disableChangeListener();
            }
            model.id = model['_temporary-identifier'];
            if (model.enableChangeListener) {
                model.enableChangeListener();
            }
        }

        /* Cache is used to immediately trigger the value callback if a new model was created and subscribes to its own changes. */
        this.cache = model;
        return model;
    }

    remove(model) {
        SPWorker.postMessage({
            subscriberID: this.subscriberID,
            endPoint: this.options.endPoint,
            listName: this.options.listName,
            operation: 'remove',
            model: model
        });
    }

    _initialise() {

        super.once('value', () => {
            this._ready = true;
        });

        /* Initialise the worker */
        SPWorker.postMessage(extend({}, this.options, {
            subscriberID: this.subscriberID,
            operation: 'init'
        }));
    }

    _onMessage(messageEvent) {
        let message = messageEvent.data;
        /* Ignore messages not meant for this SharePoint instance. */
        if (message.subscriberID !== this.subscriberID) {
            return;
        }

        if (message.event === 'cache_data') {
            this.emit('cache_data', message.cache);
        } else if (message.event === 'auth_result') {
            this.emit('auth_result', message.auth);
        } else if (message.event !== 'INVALIDSTATE') {
            this.emit(message.event, message.result, message.previousSiblingId);
        } else {
            console.log("Worker Error:", message.result);
        }
    }

    _handleCacheData(cacheData, event, handler, context) {
        if (!cacheData) {
            cacheData = [];
        }

        if (event === 'child_added') {
            for (let index = 0; index < cacheData.length; index++) {
                let child = cacheData[index];
                let previousChildID = index > 0 ? cacheData[index - 1] : null;
                handler.call(context, child, previousChildID);
            }
        } else if (event === 'value') {
            handler.call(context, cacheData.length ? cacheData : null);
        }
    }

    _handleAuthResult(authData, handler, context = this) {
        if (!authData) {
            authData = {};
        }

        handler.call(context, authData);

    }

    static hashCode(s) {
        return s.split("").reduce(function (a, b) {
            a = ((a << 5) - a) + b.charCodeAt(0);
            return a & a
        }, 0);
    }
}
