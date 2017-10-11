import {LocalPrioritisedArray}      from 'arva-js/data/local/LocalPrioritisedArray.js';
import {Injection}                  from 'arva-js/utils/Injection.js';
import {DataSource}                 from 'arva-js/data/DataSource.js';
import {combineOptions}             from 'arva-js/utils/CombineOptions.js';

import {signalr, SignalRConnection} from './SignalRDecorators.js';
import                              'ms-signalr-client';

export class SignalRArray extends LocalPrioritisedArray {
    constructor(dataType, options) {
        let dataSource = Injection.get(DataSource);
        super(dataType, dataSource);
        this.options = combineOptions({shouldPopulate: true}, options);
        this._ready = false;
        let hubName = this.constructor.name || Object.getPrototypeOf(this).constructor.name;
        this.hubName = `${hubName}Hub`;
        this.connection = Injection.get(SignalRConnection);
        this.proxy = this.connection.getProxy(this.hubName) || null;
        signalr.mapClientMethods.apply(this);
        signalr.mapServerCallbacks.apply(this);

        if (this.options.shouldPopulate){
            let initPromise;
            if (this.options.eventID){
                initPromise = this.getAll(this.options.eventID);
            } else {
                initPromise = this.getAll();
            }

            initPromise.then(()=> {
                this._ready = true;
            })
        } else {
            this._ready = true;
        }
    }

    @signalr.cachedOffline()
    @signalr.registerServerCallback('getAll')
    async getAll(data) {
        while(this.length) {
            this.remove(0);
        }
        const pages = [];
        if(this.options.paged) {
            const perPage = this.options.paged;
            const numberOfPages = Math.round(data.length / perPage + 0.49999999);
            let index = 0;
            for(let x = 0; x < numberOfPages; x++) {
                pages[x] = [];
                pages[x] = data.slice(x * perPage, (x + 1) * perPage);
            } 
        } else {
            pages.push(data);
        }
        let promises = [];
        for(const page of pages) {
            await promises.push(this.parseIDList(page));
            await this.wait(1000);
        }

        Promise.all(promises).then(() => {
            this._ready = true;
            this._eventEmitter.emit('getAll');
            return this;
        })
    }

    wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    parseIDList(data) {
        let promises = [];
        for(const id of data) {
            promises.push(this.add(Injection.get(this._dataType, id)).once('value'));
        }
        return Promise.all(promises);
    }


    /**
     * Subscribes to events emitted by this PrioritisedArray.
     * @param {String} event One of the following Event Types: 'value', 'child_changed', 'child_moved', 'child_removed'.
     * @param {Function} handler Function that is called when the given event type is emitted.
     * @param {Object} context Optional: context of 'this' inside the handler function when it is called.
     * @returns {void}
     */
    on(event, handler, context) {
        /* If we're already ready, fire immediately */
        if ((event === 'ready') && this._dataSource && this._dataSource.ready) {
            handler.call(context, this);
        }

        if ((event === 'getAll') && this._ready) {
            handler.call(context, this);
        }

        /* If we already have children stored locally when the subscriber calls this method,
         * fire their callback for all pre-existing children. */
        if (event === 'child_added') {

            for (let i = 0; i < this.length; i++) {
                this._childAddedThrottler.add(() => {
                    let model = this._children[i];
                    let previousSiblingID = i > 0 ? this._children[i - 1].id : null;
                    handler.call(context, model, previousSiblingID);
                });
            }
        }

        this._eventEmitter.on(event, handler, context);
    }


    once(event, handler, context = this) {
        return new Promise((resolve) => {
            this.on(event, function onceWrapper() {
                this.off(event, onceWrapper, context);
                handler && handler.call(context, ...arguments);
                resolve(...arguments);
            }, this);
        });
    }
}