import {LocalModel}                     from 'arva-js/data/local/LocalModel.js';
import {Injection}                      from 'arva-js/utils/Injection.js';
import {DataSource}                     from 'arva-js/data/DataSource.js';

import {signalr, SignalRConnection}     from './SignalRDecorators.js';

import * as fooBar                      from 'jquery';
import                                  'ms-signalr-client';

export class SignalRModel extends LocalModel {
    constructor(id, data = null, options = {}) {
        let dataSource = options.dataSource || Injection.get(DataSource);
        super(id, data, options);
        this._ready = false;
        this.argumentId = id;
        let hubName = this.constructor.name || Object.getPrototypeOf(this).constructor.name;
        this.hubName = `${hubName}sHub`;
        this.connection = Injection.get(SignalRConnection);
        this.proxy = this.connection.getProxy(this.hubName) || null;
        signalr.mapClientMethods.apply(this);
        signalr.mapServerCallbacks.apply(this);
        if(this.argumentId) {
            this.value(this.argumentId);
        }
        this._dataSource.ready = false;
        if(this.connection && this.proxy) {
                if(this.connection.connection.state === 1) {
                    this._init();
                } else {
                this.connection.on('ready', () => {
                    this._init();
                })
            }
        }

        //  let prototype = Object.getPrototypeOf(this);
        //  this.serverCallbacks = prototype.serverCallbacks;
        
    }

    serialize(){
        return this.shadow;
    }

    deserialize(shadow){
        return new this(null, shadow);
    }

    _init() {
        this.onConnect();
    }

    @signalr.registerServerCallback('get')
    value(id) {
        let obj = arguments[0];
        if(typeof obj === "undefined") {
            this.emit('getError', 'getError');
            return;
        }
        if(Array.isArray(obj)) { obj = obj[0]; }
        for(let [key, value] of Object.entries(obj)) {
            this[key] = value;
        }
        this._ready = true;
        this._dataSource._ready = true;
        return this;
    }

    @signalr.registerServerCallback('update')
    update(id, data) {
    }

    _onSetterTriggered({propertyName, newValue}) {

    }

    _toCamelCase(first, ...rest) {
        return [first.toLowerCase(), ...rest].join('');
    }

    _initalizeHubConnection() {
        this._setupLifecycleEvents();
    }

    _mapClientMethods() {
        for(const method of this.clientMethods) {
            this.proxy.on(method.fnName, () => {
                method.fn.apply(this, ...arguments);
            })
        }
    }

    _mapServerCallbacks() {
        for(const method of this.serverCallbacks) {
            const originalMethod = this[method.fn.name];
            this[method.fn.name] = (...params) => {
                this.proxy.invoke.apply(this.proxy, [method.fnName, ...params]).done((...params) => {
                    method.fn.apply(this, [...params]);
                }).fail((e) => {
                    console.debug(e);
                });
            }
        }
    }

    addClientMethod(fnName, fn) {
        if(!this.clientMethods) {
            this.clientMethods = [];
        }
        this.clientMethods.push({fnName, fn});
    }

    addServerCallback(fnName, fn) {
        if(!this.serverCallbacks) {
            this.serverCallbacks = [];
        }
        this.serverCallbacks.push({fnName, fn});
    }

    _setupLifecycleEvents() {
        this.connection.starting(() => {

        })
        this.connection.received((data) => {

        })
        this.connection.connectionSlow(() => {

        })
        this.connection.reconnecting(() => {

        })
        this.connection.reconnected(() => {

        })
        this.connection.disconnected(() => {
            setTimeout(() => {
                this.connection.start().done(this._init).fail((e) => {
                    this.connectionError(e);
                })
            }, 5000);
        })
    }

    onConnect() {
        console.log(`Connection ${this.connection.connection.id} has connected`);
    }

    onDisconnect() {
        console.log(`Connection ${this.connection.connection.id} has disconnected`);
    }

    onReconnecting() {
        console.log(`Connection ${this.connection.connection.id} is reconnecting`);
    }

    connectionError(e) {
        console.log(`Connection error!\nMessage: ${e}`);
    }

    on(event, handler, context = this) {
        let haveListeners = this._hasListenersOfType(event);
        super.on(event, handler, context);

        switch (event) {
            case 'ready':
                /* If we're already ready, fire immediately */
                if (this._dataSource && this._dataSource.ready) {
                    handler.call(context, this);
                }
                break;
            case 'value':
                if (!haveListeners) {
                    /* Only subscribe to the dataSource if there are no previous listeners for this event type. */
                    this._dataSource.setValueChangedCallback(this._onChildValue);
                } else {
                    if (this._dataSource.ready) {
                        /* If there are previous listeners, fire the value callback once to present the subscriber with inital data. */
                        handler.call(context, this);
                    }
                }
                break;
            case 'added':

                if (haveListeners) {
                    this._dataSource.setChildAddedCallback(this._onChildAdded);
                }
                break;
            case 'changed':
                /* We include the changed event in the value callback */
                if (!this._hasListenersOfType('value')) {
                    this._dataSource.setValueChangedCallback(this._onChildValue);
                }
                break;
            case 'moved':
                if (!haveListeners) {
                    this._dataSource.setChildMovedCallback(this._onChildMoved);
                }
                break;
            case 'removed':
                if (!haveListeners) {
                    this._dataSource.setChildRemovedCallback(this._onChildRemoved);
                }
                break;
            case 'get':
                if(this._ready) {
                    handler.call(context, this);
                }
            default:
                break;
        }
    }
}
