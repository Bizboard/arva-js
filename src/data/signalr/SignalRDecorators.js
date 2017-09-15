
import {combineOptions} from 'arva-js/utils/CombineOptions.js';
import {Injection}      from 'arva-js/utils/Injection.js';

import EventEmitter     from 'eventemitter3';


export class signalr {
    // Registers a client method. This method will be run when the server invokes the fnName specified. Defaults to the method name
    static registerClientMethod(fnName = null) {
        return function(target, name, descriptor) {
            if(!fnName) {
                fnName = descriptor.value.name;
            }
            signalr.addClientMethod.apply(target, [fnName, descriptor.value]);
            return descriptor;
        }
    }
    static registerServerCallback(fnName = null) {
        return function(target, name, descriptor) {
            if(!fnName) {
                fnName = descriptor.value.name;
            }
            signalr.addServerCallback.apply(target, [fnName, descriptor.value]);
            return descriptor;
        }
    }
    static createProxy(hubName = null) {
        return function(target, name, descriptor) {
            if(!hubName) {
                if(Object.getPrototypeOf(target).name === 'SignalRArray') {
                    hubName = target.name + 'Hub';
                } else {
                    hubName = target.name + 'sHub';
                }
            }
            const connection = Injection.get(SignalRConnection);
            if(!connection.decoratorProxies) {
                connection.decoratorProxies = [];
            }
            if(!connection.decoratorProxies.indexOf(hubName) >= 0) {
                connection.decoratorProxies.push(hubName);
            }
        }
    }
    static addServerCallback(fnName, fn) {
        if(!this.serverCallbacks) {
            this.serverCallbacks = [];
        }
        this.serverCallbacks.push({fnName, fn, model: this.constructor.name});
    }
    static addClientMethod(fnName, fn) {
        if(!this.clientMethods) {
            this.clientMethods = [];
        }
        this.clientMethods.push({fnName, fn, model: this.constructor.name});
    }
    static mapClientMethods() {
        if(this.clientMethods) {
            for(const method of this.clientMethods) {
                if(method.model === this.constructor.name || method.model === this.constructor.__proto__.name) {
                    this.proxy.on(method.fnName, (...params) => {
                        method.fn.apply(this, [...params]);
                    })
                    this.connection.log(`[${this.hubName}] Mapping Client Method ${method.fnName} to ${method.fn.name}`);
                }
            }
        }
    }
    static mapServerCallbacks() {
        if(this.serverCallbacks) {
            for(const method of this.serverCallbacks) {
                if(method.model === this.constructor.name || method.model === this.constructor.__proto__.name) {
                    const originalMethod = this[method.fn.name];
                    this[method.fn.name] = (...params) => {
                        return this.proxy.invoke.apply(this.proxy, [method.fnName, ...params])
                            .done((...params) => {
                                method.fn.apply(this, [...params]);
                            }).fail((e) => {
                                console.debug(e);
                            });
                    }
                    this.connection.log(`[${this.hubName}] Mapping Server Callback ${method.fnName} to ${method.fn.name}`);
                }
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
        if(options.url) {
            options.useDefaultUrl = false;
        }
        this.options = combineOptions(this.options, options);
        return this;
    }

    on(event, handler, context) {
        super.on(event, handler, context);
        switch(event) {
            case "authChange": 
                if(this._userToken) {
                    handler.call(context, this);
                }
                this.onAuthChange = super.on('stateChange', (state) => {
                    if(state.newState === 1) {
                        if(this._userToken) {
                            handler.call(context, this);
                        }
                    }
                });
                break;
            default:
                break;
        }
    }

    getUserToken(){
        let token = localStorage.getItem('trsq-auth');
        if (token !== undefined && token !== null){
            this._userToken = token;
            return token;
        }
    }

    setUserToken(token){
        localStorage.setItem('trsq-auth', token);
        this._userToken = token;
        return token;
    }

    isAuthenticated(){
        return !!this._userToken;
    }

    async authenticateUser({username, password}){

        let formData = `username=${username}&password=${password}&grant_type=password`;

        try {
            let response = await fetch(`${this.options.url}/api/Token`, {
                method: "POST",
                body: formData
            });

            if (response.ok){
                const { access_token } = await response.json();
                this.setUserToken(access_token);

                let refreshedStart = await this.refreshConnectionAuth();

                this.emit('login');
                return true;

            } else {
                return false;
            }
        } catch( e ){
            console.log("error", e)
            // return false
        }
    }

    refreshConnectionAuth(){
        this.connection.stop();
        this.connection.qs.access_token = this.getUserToken();
        let start = this.connection.start();
        return new Promise( (resolve) => {
            start.done(()=> {
                this._authorised = true;
                resolve()
            });
        });
    }

    async deauthenticateUser(){
        localStorage.removeItem('trsq-auth');
        this._userToken = null;
        let refreshedStart = await this.refreshConnectionAuth();
        this.emit('logout');
    }

    init() {
        if(window.jQuery) {
            this.connection = window.jQuery.hubConnection(this.options.url || null, this.options);
            if(this.options.logging) {
                this.connection.logging = true;
            }

            this.connection.qs = {
                access_token: this.getUserToken(),
                "lang": this.options.lang
            };

            if(this.decoratorProxies) {
                for(const hubName of this.decoratorProxies) {
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

        if(this.connection && this.proxyCount > 0) {
            this.log('Starting connection');
            const start = this.connection.start();
            start.done(() => {
                this._connected = true;
                this.emit('ready');
                this.emit('connected');
            }).catch( ()=>{
                this._connected = false;
                this.emit('disconnected');
                this.restart()
            });

            return start;
        }
    }

    stateChangedCallback(state){
        this.emit('stateChange', state);
        if (state.newState === this.connectionStates.connectected){
            this._connected = true;
        } else if (state.newState === this.connectionStates.disconnected){
            this._connected = false;
            this.emit('disconnected');
            if (this.options.shouldAttemptReconnect){
                this.restart();
            }
        }
    }

    restart() {
        this._reconnectTimeout = setTimeout(()=>{
            let start = this.connection.start();
            start.done(()=>{
                this._connected = true;
                this.emit('ready');
                this.emit('connected');
            })
        }, 5000);
    }

    createHubProxy(hubName) {
        if(this.connection) {
            if(!this.proxies[hubName]) {
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
        if(this.proxies[name]) {
            return this.proxies[name];
        } else {
            return false;
        }
    }

    log(message) {
        if(this.options.logging) {
            console.log(message);
        }
    }

    isConnected(){
        return this._connected;
    }
}