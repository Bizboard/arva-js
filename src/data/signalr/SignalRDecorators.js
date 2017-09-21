import {combineOptions} from 'arva-js/utils/CombineOptions.js';
import {Injection}      from 'arva-js/utils/Injection.js';

import EventEmitter     from 'eventemitter3';
import idbKeyVal        from 'idb-keyval';


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
                    this.proxy.on(method.fnName, () => {
                        method.fn.apply(this, [...arguments]);
                    })
                    this.connection.log(`[${this.hubName}] Mapping Client Method ${method.fnName} to ${method.fn.name}`);
                }
            }
        }
    }

    static mapServerCallbacks() {
        for (const method of this.serverCallbacks || []) {
            if (method.model === this.constructor.name || method.model === this.constructor.__proto__.name) {
                let serverCallbackName = method.fnName;
                this[method.fn.name] = async (...params) => {


                    if (!this.connection.isConnected()) {
                        let cachedResult = await signalr.getFromLocalStorage(this, serverCallbackName);
                        if (cachedResult !== undefined) {
                            return cachedResult;
                        }
                    }

                    await this.connection.once('ready');

                    return this.proxy.invoke.call(this.proxy, serverCallbackName, ...params)
                        .done(async (...params) => {
                            let result = await method.fn.apply(this, params);
                            signalr.saveToLocalStorage(this, serverCallbackName, result);
                            this._eventEmitter.emit(method.fnName, result);
                            /* Catch common default behaviour */
                            if (result === undefined && params.length === 1) {
                                return params[0];
                            }
                            return result;
                        }).fail((e) => {
                            console.debug(e);
                        });
                }


                this.connection.log(`[${this.hubName}] Mapping Server Callback ${method.fnName} to ${method.fn.name}`);
            }
        }

    }

    static cache = {};

    static saveToLocalStorage(signalRArray, methodName, data) {
        let keyString = this.getKeyString(signalRArray, methodName);
        cache[keyString] = data;
        return idbKeyVal.set(keyString, data);
    }

    static getFromLocalStorage(signalRArray, methodName) {
        let keyString = this.getKeyString(signalRArray, methodName);
        return this.cache[keyString] || idbKeyVal.get(keyString);
    }

    static getKeyString(signalRArray, methodName) {
        return `${signalRArray._id}${methodName}`;
    }
}

export class SignalRConnection extends EventEmitter {

    constructor() {
        super();
        this.connection = null;
        this._connected = false;
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



    setOptions(options) {
        if (options.url) {
            options.useDefaultUrl = false;
        }
        this.options = combineOptions(this.options, options);
        return this;
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
                resolve()
            });
        });
    }

    async deauthenticateUser() {
        localStorage.removeItem('trsq-auth');
        this._userToken = null;
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
        this.connection.stateChanged(this.stateChangedCallback);

        if (this.connection && this.proxyCount > 0) {
            this.log('Starting connection');
            const start = this.connection.start();
            start.done(() => {
                this._connected = true;
                this.emit('ready');
                this.emit('connected');
            }).catch(() => {
                this._connected = false;
                this.emit('disconnected');
                this.restart()
            });

            return start;
        }
    }

    stateChangedCallback(state) {
        if (state.newState === this.connectionStates.connectected) {
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
        this._reconnectTimeout = setTimeout(() => {
            let start = this.connection.start();
            start.done(() => {
                this._connected = true;
                this.emit('ready');
                this.emit('connected');
            })
        }, 5000);
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