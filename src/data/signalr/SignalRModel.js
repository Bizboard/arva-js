import {LocalModel}     from 'arva-js/data/local/LocalModel.js';
import {Injection}      from 'arva-js/utils/Injection.js';
import {DataSource}     from 'arva-js/data/DataSource.js';

import {signalr}        from './SignalRDecorators.js';

import * as fooBar      from 'jquery';
import                  'ms-signalr-client';

export class SignalRModel extends LocalModel {
    constructor(id, data = null, options = {}) {
        let dataSource = options.dataSource || Injection.get(DataSource);
        super(id, data, options);
        this.argumentId = id;
        this.originalMethods = {};
        let modelName = this.constructor.name || Object.getPrototypeOf(this).constructor.name;
        modelName = this._toCamelCase(...modelName.split(''));
        this.hubConnection = options.hubConnection || `${modelName}sHub`;
        // TODO: Remove
        this.hubOptions = {
            hubUrl: 'http://localhost:30766/signalr',
            useDefaultUrl: false
        };
        if(options.hubUrl) {
            this.hubOptions.hubUrl = options.hubUrl;
            this.hubOptions.useDefaultUrl = false;
        }
        if(this.hubConnection) {
            this._initalizeHubConnection().done(() => {
                this._init();
            }).fail((e) => {
                this.connectionError(e);
            });
        }
        
    }

    _init() {
        this.onConnect();
        if(this.argumentId) {
            this.get(this.argumentId);
        }
    }

    @signalr.registerServerCallback('get')
    get(id) {
        let obj = arguments[0];
        if(Array.isArray(obj)) { obj = obj[0]; }
        for(let [key, value] of Object.entries(obj)) {
            this[key] = value;
        }
        this.emit('value');
    }

    @signalr.registerServerCallback('update')
    update(id, data) {
        debugger;
    }

    _onSetterTriggered({propertyName, newValue}) {

    }

    _toCamelCase(first, ...rest) {
        return [first.toLowerCase(), ...rest].join('');
    }

    _initalizeHubConnection() {
        this.connection = window.jQuery.hubConnection(this.hubOptions.hubUrl || null, this.hubOptions);
        this.connection.logging = true;
        this.proxy = this.connection.createHubProxy(this.hubConnection);
        this._setupLifecycleEvents();
        this._mapClientMethods();
        this._mapServerCallbacks();
        return this.connection.start()
    }

    _mapClientMethods() {
        for(const method of this.clientFns) {
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
        if(!this.clientFns) {
            this.clientFns = [];
        }
        this.clientFns.push({fnName, fn});
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
        console.log(`Connection ${this.connection.id} has connected`);
    }

    onDisconnect() {
        console.log(`Connection ${this.connection.id} has disconnected`);
    }

    onReconnecting() {
        console.log(`Connection ${this.connection.id} is reconnecting`);
    }

    connectionError(e) {
        console.log(`Connection error!\nMessage: ${e}`);
    }
}
