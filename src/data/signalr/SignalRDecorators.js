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
        this.serverCallbacks.push({fnName, fn});
    }
    static addClientMethod(fnName, fn) {
        if(!this.clientMethods) {
            this.clientMethods = [];
        }
        this.clientMethods.push({fnName, fn});
    }
    static mapClientMethods() {
        if(this.clientMethods) {
            for(const method of this.clientMethods) {
                this.proxy.on(method.fnName, () => {
                    method.fn.apply(this, [...arguments]);
                })
                this.connection.log(`[${this.hubName}] Mapping Client Method ${method.fnName} to ${method.fn.name}`);
            }
        }
    }
    static mapServerCallbacks() {
        if(this.serverCallbacks) {
            for(const method of this.serverCallbacks) {
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

export class SignalRConnection extends EventEmitter {
    
    constructor() {
        super();
        this.connection = null;
        this.proxies = {};
        this.proxyCount = 0;
        this.options = {};
    }

    setOptions(options) {
        if(options.url) {
            options.useDefaultUrl = false;
        }
        this.options = combineOptions(this.options, options);
        return this;
    }

    init() {
        if(window.jQuery) {
            this.connection = window.jQuery.hubConnection(this.options.url || null, this.options);
            if(this.options.logging) {
                this.connection.logging = true;
            }
            this.connection.qs = { "access_token": "kz-poUKVeU7Ba2lSZNnuJD4mjT_Kyjf3BSLM2CP8lC8TN5e-l_SDI_fsu9DgBoBWkYCHrTIIBZ_TUMM_1dkTmWzagRwJGTVRgqCXkNHvgNFRDZyj6FzyRNd1i7C8lKiCah7MQUIcELc4jclJWFvHEdbCR8R867cKNLuMgjOo_Tq619s8nDNkGecZvvfru-g8acYb1ha5Iu5jdoACQ1sWA2CGPzJQhvVQmiyizByenunbqhgJYsI-WbFFefIfd3m5CDXpWrIX42-cMsJFJTwd4uEZudHEJxei4hxtUtFCKYlj3G3VmCYefyvcc_XvW47tkLfesz9iqEdTLMtroMiu5w6HamK6vSqqYoyYnOAF7SofvhYzGGTd9kFtATC-A1yImuoTGOzE-mA5iObzc8P7zw" };
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
        if(this.connection && this.proxyCount > 0) {
            this.log('Starting connection');
            const start = this.connection.start();
            start.done(() => {
                this.emit('ready');
            });
            return start;
        }
    }

    restart() {

    }

    createHubProxy(hubName) {
        if(this.connection) {
            if(!this.proxies[hubName]) {
                this.proxies[hubName] = this.connection.createHubProxy(hubName);
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
}