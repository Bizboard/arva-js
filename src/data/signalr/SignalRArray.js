import {LocalPrioritisedArray}      from 'arva-js/data/local/LocalPrioritisedArray.js';
import {Injection}                  from 'arva-js/utils/Injection.js';
import {DataSource}                 from 'arva-js/data/DataSource.js';

import {signalr, SignalRConnection} from './SignalRDecorators.js';
import                              'ms-signalr-client';

export class SignalRArray extends LocalPrioritisedArray {
    constructor(dataType) {
        let dataSource = Injection.get(DataSource);
        super(dataType, dataSource);
        let hubName = this.constructor.name || Object.getPrototypeOf(this).constructor.name;
        hubName = `${hubName}Hub`;
        this.connection = Injection.get(SignalRConnection);
        this.proxy = this.connection.getProxy(hubName) || null;
        signalr.mapClientMethods.apply(this);
        signalr.mapServerCallbacks.apply(this);
        if(this.connection && this.proxy) {
            if(this.connection.connection.state === 1) {
                this._init();
            } else {
                this.connection.on('ready', () => {
                    this._init();
                })
            }
        }
    }

    _init() {
        this.getAll();
    }

    @signalr.registerServerCallback('getAll')
    getAll(data) {
        let promises = [];
        for (const id of data) {
            promises.push(this.add(Injection.get(this._dataType, id)).once('get'));
        }
        window.promises = promises;
        Promise.all(promises).then(() => {
            console.log('All data retrieved?');
            this._eventEmitter.emit('getAll');
        })
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
}