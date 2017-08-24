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
        debugger;
        if(this.connection && this.proxy) {
            
            this.connection.start().done(() => {
                this._init();
            })
        }
    }

    _init() {
        this.getAll();
    }

    @signalr.registerServerCallback('getAll')
    getAll(data) {
        for (const id of data) {
            this.add(Injection.get(this._dataType, id));
        }
    }

    

    // addServerCallback(fnName, fn) {
    //     if(!this.serverCallbacks) {
    //         this.serverCallbacks = [];
    //     }
    //     this.serverCallbacks.push({fnName, fn});
    // }

    // addClientMethod(fnName, fn) {
    //     if(!this.clientMethods) {
    //         this.clientMethods = [];
    //     }
    //     this.clientMethods.push({fnName, fn});
    // }
}