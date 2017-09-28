import {combineOptions} from 'arva-js/utils/CombineOptions.js';
import {Injection}      from 'arva-js/utils/Injection.js';

import EventEmitter     from 'eventemitter3';
import idbKeyVal        from 'idb-keyval';
import 'whatwg-fetch';


export class signalr {
    // Registers a client method. This method will be run when the server invokes the fnName specified. Defaults to the method name
    static registerClientMethod(fnName = null) {
        return function (target, name, descriptor) {
            if (!fnName) {
                fnName = descriptor.value.name;
            }
            signalr.addClientMethod.apply(target, [fnName, descriptor.value]);
            return descriptor;
        }
    }

    static cachedOffline() {
        return function (target, name, descriptor) {
            let {cachedOfflineMethods} = target;
            if (!cachedOfflineMethods) {
                cachedOfflineMethods = target.cachedOfflineMethods = {};
            }
            cachedOfflineMethods[name] = true;
            return descriptor;
        }
    }

    static registerServerCallback(fnName = null) {
        return function (target, name, descriptor) {
            if (!fnName) {
                fnName = descriptor.value.name;
            }
            signalr.addServerCallback.apply(target, [fnName, descriptor.value]);
            return descriptor;
        }
    }

    static createProxy(hubName = null) {
        return function (target, name, descriptor) {
            if (!hubName) {
                if (Object.getPrototypeOf(target).name === 'SignalRArray') {
                    hubName = target.name + 'Hub';
                } else {
                    hubName = target.name + 'sHub';
                }
            }
            const connection = Injection.get(SignalRConnection);
            if (!connection.decoratorProxies) {
                connection.decoratorProxies = [];
            }
            if (!connection.decoratorProxies.indexOf(hubName) >= 0) {
                connection.decoratorProxies.push(hubName);
            }
        }
    }

    static addServerCallback(fnName, fn) {
        if (!this.serverCallbacks) {
            this.serverCallbacks = [];
        }
        this.serverCallbacks.push({fnName, fn, model: this.constructor.name});
    }

    static addClientMethod(fnName, fn) {
        if (!this.clientMethods) {
            this.clientMethods = [];
        }
        this.clientMethods.push({fnName, fn, model: this.constructor.name});
    }

    static mapClientMethods() {
        if (this.clientMethods) {
            for (const method of this.clientMethods) {
                if (method.model === this.constructor.name || method.model === this.constructor.__proto__.name) {
                    this.proxy.on(method.fnName, (...params) => {
                        method.fn.apply(this, [...params]);
                    });
                    this.connection.log(`[${this.hubName}] Mapping Client Method ${method.fnName} to ${method.fn.name}`);
                }
            }
        }
    }

    static isFunctionAvailableOffline(object, methodName){
        return object.cachedOfflineMethods && object.cachedOfflineMethods[methodName];
    }

    static mapServerCallbacks() {
        for (const method of this.serverCallbacks || []) {
            if (![this.constructor.name, this.constructor.__proto__.name].includes(method.model)) {
                continue;
            }

            let serverCallbackName = method.fnName;
            this[method.fn.name] = async (...params) => {
                let isFunctionAvailableOffline = signalr.isFunctionAvailableOffline(this, method.fn.name)
                if(isFunctionAvailableOffline){
                    let cachedResult = await signalr.tryGetCachedResult(serverCallbackName, this);
                    if(cachedResult !== undefined){
                        return cachedResult;
                    }
                }

                await this.connection.once('ready');

                return new Promise((resolve, reject) =>
                    this.proxy.invoke.call(this.proxy, serverCallbackName, ...params)
                        .done(async (...params) => {
                            let result = await method.fn.apply(this, params);
                            if(isFunctionAvailableOffline){
                                signalr.saveToLocalStorage(this, keyString, this.serialize(result));
                            }
                            let emit = this.emit || this._eventEmitter.emit.bind(this._eventEmitter);
                            emit(method.fnName, result);
                            /* Catch common default behaviour */
                            if (result === undefined && params.length === 1) {
                                return params[0];
                            }
                            resolve(result)
                        }).fail((e) => {
                        reject(e)
                        // console.debug(e);
                    })
                )
            };

            this.connection.log(`[${this.hubName}] Mapping Server Callback ${method.fnName} to ${method.fn.name}`);

        }

    }

    static cache = {};

    static saveToLocalStorage(model, keyString, data) {
        this.cache[keyString] = data;
        return idbKeyVal.set(keyString, data);
    }

    static getFromLocalStorage(model, keyString) {
        return this.cache[keyString] || idbKeyVal.get(keyString);
    }

    static getKeyString(serverCallbackName, modelOrArray) {
        let keyString = `${serverCallbackName}-${modelOrArray.constructor.name}`;
        modelOrArray._id && (keyString += `-${modelOrArray._id}`);
        return keyString;
    }

    static async tryGetCachedResult(serverCallbackName, object) {
        let keyString = signalr.getKeyString(object, serverCallbackName);

        if (!object.connection.isConnected()) {
            let cachedResult = await signalr.getFromLocalStorage(object, keyString);
            if (cachedResult !== undefined) {
                let emit = object.emit || object._eventEmitter.emit.bind(object._eventEmitter);
                emit(method.fnName, cachedResult);
                return cachedResult;
            }
        }
    }
}

export class SignalRConnection extends EventEmitter {

    constructor() {
        super();
        this.connection = null;
        this._connected = false;
        this._authorised = false;
        this.onAuthChange = null;
        this.hasAuthChanged = false;
        this.proxies = {};
        this.proxyCount = 0;
        this.options = {
            lang: 'NL',
            shouldAttemptReconnect: false
        };
        this.connectionStates = {
            connecting: 0,
            connected: 1,
            reconnecting: 2,
            disconnected: 4
        };

        this.stateChangedCallback = this.stateChangedCallback.bind(this);
    }

    /**
     * Makes the once function return a promise
     * @param event
     * @param handler
     * @param context
     * @returns {Promise}
     */
    once(event, handler, context = this) {
        return new Promise((resolve)=>{
            if((event === 'ready') && this._connected) {
                handler && handler.call(context, this);
                resolve(...arguments);
            } else {
                this.on(event, function onceWrapper() {
                    this.off(event, onceWrapper, context);
                    handler && handler.call(context, ...arguments);
                    resolve(...arguments);
                }, this);
            }
        });
    }


    setOptions(options) {
        if (options.url) {
            options.useDefaultUrl = false;
        }
        this.options = combineOptions(this.options, options);
        return this;
    }

    on(event, handler, context) {
        super.on(event, handler, context);
        switch (event) {
            case "authChange":
                if (this._userToken) {
                    handler.call(context, this);
                }
                this.onAuthChange = super.on('stateChange', (state) => {
                    if (state.newState === 1) {
                        if (this.hasAuthChanged) {
                            handler.call(context, this);
                            this.hasAuthChanged = false;
                        }
                    }
                });
                break;
            default:
                break;
        }
    }

    getUserToken() {
        let token = localStorage.getItem('trsq-auth');
        if (token !== undefined && token !== null) {
            this._userToken = token;
            return token;
        }
    }

    setUserToken(token) {
        localStorage.setItem('trsq-auth', token);
        this._userToken = token;
        return token;
    }

    isAuthenticated() {
        return !!this._userToken;
    }

    async authenticateUser({username, password}) {

        let formData = `username=${username}&password=${password}&grant_type=password`;

        try {
            let response = await fetch(`${this.options.url}/api/Token`, {
                method: "POST",
                body: formData
            });

            if (response.ok) {
                const {access_token} = await response.json();
                this.setUserToken(access_token);

                let refreshedStart = await this.refreshConnectionAuth();
                this.hasAuthChanged = true;
                this.emit('login');
                return true;

            } else {
                return false;
            }
        } catch (e) {
            console.log("error", e)
            // return false
        }
    }

    refreshConnectionAuth() {
        this.connection.stop();
        this.connection.qs.access_token = this.getUserToken();
        let start = this.connection.start();
        return new Promise((resolve) => {
            start.done(() => {
                this._authorised = true;
                resolve()
            });
        });
    }

    async deauthenticateUser() {
        localStorage.removeItem('trsq-auth');
        this._userToken = null;
        this.hasAuthChanged = true;
        let refreshedStart = await this.refreshConnectionAuth();
        this.emit('logout');
    }

    init() {
        if (window.jQuery) {
            this.connection = window.jQuery.hubConnection(this.options.url || null, this.options);
            if (this.options.logging) {
                this.connection.logging = true;
            }

            this.connection.qs = {
                access_token: this.getUserToken(),
                "lang": this.options.lang
            };

            if (this.decoratorProxies) {
                for (const hubName of this.decoratorProxies) {
                    this.createHubProxy(hubName);
                }
            }
        } else {
            throw 'jQuery missing!';
        }
        return this;
    }

    start() {
        return new Promise((resolve) => {
            this.connection.stateChanged(this.stateChangedCallback);
            if (this.connection && this.proxyCount > 0) {
                this.log('Starting connection');
                const start = this.connection.start();
                start.done(() => {
                    this._connected = true;
                    this.emit('ready');
                    this.emit('connected');
                    resolve(start)
                }).catch(() => {
                    this._connected = false;
                    this.emit('disconnected');
                    resolve(this.restart());
                });

            }
        })
    }

    stateChangedCallback(state) {
        if (state.newState === this.connectionStates.connectected) {
            this.emit('stateChange', state);
            this._connected = true;
        } else if (state.newState === this.connectionStates.disconnected) {
            this._connected = false;
            this.emit('disconnected');
            if (this.options.shouldAttemptReconnect) {
                this.restart();
            }
        }
    }

    restart() {
        return new Promise((resolve) => {
            this._reconnectTimeout = setTimeout(() => {
                let start = this.connection.start();
                start.done(() => {
                    this._connected = true;
                    this.emit('ready');
                    this.emit('connected');
                    resolve(start);
                })
            }, 5000);
        })
    }

    createHubProxy(hubName) {
        if (this.connection) {
            if (!this.proxies[hubName]) {
                this.proxies[hubName] = this.connection.createHubProxy(hubName);
                this.proxies[hubName].qs = {
                    "lang": this.options.lang
                };
                this.proxyCount++;
                this.log(`Creating Hub Proxy: ${hubName}`);
                this.registerMockMethod(hubName);
            } else {
                this.log(`Skipping Hub: ${hubName}`);
            }
        } else {
            throw 'Run connection.init() before creating Hub Proxies';
        }
        return this;
    }

    // We need to register a mock method in order to make it possible to register new functions after we have
    // connected.
    registerMockMethod(hubName) {
        this.connection.log(`Registering mock method on hub: ${hubName}`);
        this.getProxy(hubName).on('ping', () => {
            this.log(`Ping received from ${hubName}`);
        })
    }

    getProxy(name) {
        if (this.proxies[name]) {
            return this.proxies[name];
        } else {
            return false;
        }
    }

    log(message) {
        if (this.options.logging) {
            console.log(message);
        }
    }

    isConnected() {
        return this._connected;
    }
}