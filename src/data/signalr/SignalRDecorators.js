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

    static saveRequestIfOffline(){
        return function (target, name, descriptor) {
            let {saveRequestIfOffline} = target;
            if (!saveRequestIfOffline) {
                saveRequestIfOffline = target.saveRequestIfOffline = {};
            }
            saveRequestIfOffline[name] = true;
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

            let emit = this.emit || this._eventEmitter.emit.bind(this._eventEmitter);
            let serverCallbackName = method.fnName;
            let clientCallbackName = method.fn.name;

            this[method.fn.name] = async (...params) => {
                let isFunctionAvailableOffline = signalr.isFunctionAvailableOffline(this, method.fn.name);
                let saveRequestIfOffline = signalr.saveRequestIfOffline(this, method.fn.name);
                if(method.fn.name === "value") { this._fetching = true; }
                if(isFunctionAvailableOffline){
                    let cachedResult = await signalr.tryGetCachedResult(serverCallbackName, this);
                    if(cachedResult !== undefined){
                        cachedResult = await method.fn.apply(this, cachedResult);
                        /* Catch common default behaviour */
                        if (cachedResult === undefined && params.length === 1) {
                            cachedResult = params[0];
                        }

                        return cachedResult;
                    }
                } else if (saveRequestIfOffline){
                    await this.connection.once('ready');
                    if (!this.connection.isConnected()) {
                        // if we are offline & should save the request)
                        this.connection.saveRequestQueue.push([this.proxy, serverCallbackName, ...params]);
                        return await method.fn.call(this, [...params, {savedRequest: true}]);
                    }
                }

                await this.connection.once('ready');

                return new Promise((resolve, reject) =>
                    this.proxy.invoke.call(this.proxy, serverCallbackName, ...params)
                        .done(async (...params) => {
                            let result = await method.fn.apply(this, params);
                            if(isFunctionAvailableOffline){
                                try {
                                    signalr.saveToLocalStorage(this, signalr.getKeyString(serverCallbackName, this), params);
                                } catch (e){
                                    console.log("error saving to localstorage", e)
                                }
                            }

                            /* Catch common default behaviour */
                            if (result === undefined && params.length === 1) {
                                result = params[0];
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

    static fileNames = ["ProfilePicture"];

    static async saveToLocalStorage(model, keyString, data) {
        for(let [key, value] of Object.entries(data)) {
            if (signalr.fileNames.includes(key)){
                try {
                    let response = await fetch(`${model.connection.options.url}/${value}`);
                    if (response.ok){
                        let file = response.blob();
                        data[key] = file;
                    }
                } catch (e){
                    console.log("error saving file", value, "error", e)
                }
            }
        };

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
        let keyString = signalr.getKeyString(serverCallbackName, object);

        // make sure we've already tried to connect once.
        await object.connection.once('ready');

        if (!object.connection.isConnected()) {
            let cachedResult = await signalr.getFromLocalStorage(object, keyString);

            if (cachedResult !== undefined) {
                // let emit = object.emit || object._eventEmitter.emit.bind(object._eventEmitter);
                // emit(serverCallbackName, cachedResult);
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
        // ready is set & fires an event when the first connection promise resolves or fails
        // because App.js' loadad() isn't async it won't wait for the promise to resolve there,
        // so we have to do it here.
        this._ready = false;
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

        this.saveRequestQueue = [];

        this.stateChangedCallback = this.stateChangedCallback.bind(this);
    }

    /**
     * force offline state based on Cordova Network Information plugin offline event
     *
     */

    goOffline(){
        this._connected = false;
        this._ready = true;
        this.emit('ready', this._connected);
        this.emit('disconnected');
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
            if((event === 'ready') && this._ready) {
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
                    this._ready = true;
                    this._connected = true;
                    // ready indicates that we've tried to connect once so we know if we're actually on/offline
                    this.emit('ready', this._connected);
                    this.emit('connected');
                    resolve(start)
                }).catch(() => {
                    this._connected = false;
                    this._ready = true;
                    this.emit('ready', this._connected);
                    this.emit('disconnected');
                    resolve(this.restart());
                });

            }
        })
    }

    stateChangedCallback(state) {
        if (state.newState === this.connectionStates.connected) {
            let promises;
            if (this.saveRequestQueue.length){
                promises = Promise.all(this.saveRequestQueue.map(([proxy, serverCallbackName, ...params], idx)=> {
                    return new Promise((resolve, reject) => {
                        proxy.invoke.call(proxy, serverCallbackName, ...params)
                            .done(async (...params) => {
                                this.saveRequestQueue.splice(idx, 1);
                                resolve();
                            })
                            .fail( ()=>{
                                reject()
                            })
                    })
                }))
            } else {
                promises = Promise.resolve();
            }

            promises.then(()=>{
                this._connected = true;
                this.emit('stateChange', state);
                this.emit('connected');
            });
        } else if (state.newState === this.connectionStates.reconnecting) {
            this._connected = false;
            this.emit('disconnected');
        } else if (state.newState === this.connectionStates.disconnected && this.options.shouldAttemptReconnect) {
            this._connected = false;
            this.emit('disconnected');
            this.restart();
        }
    };

    restart() {
        return new Promise((resolve) => {
            this._reconnectTimeout = setTimeout(() => {
                let start = this.connection.start();
                start.done(() => {
                    this._connected = true;
                    this.emit('ready', this._connected);
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