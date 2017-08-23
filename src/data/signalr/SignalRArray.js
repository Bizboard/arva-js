import {LocalPrioritisedArray}      from 'arva-js/data/local/LocalPrioritisedArray.js';
import {Injection}                  from 'arva-js/utils/Injection.js';
import {DataSource}                 from 'arva-js/data/DataSource.js';

import {signalr}                    from './SignalRDecorators.js';
import                              'ms-signalr-client';

export class SignalRArray extends LocalPrioritisedArray {
    constructor(dataType) {
        let dataSource = Injection.get(DataSource);
        super(dataType, dataSource);

        this.originalMethods = {};
        let modelName = dataType.name || Object.getPrototypeOf(dataType).name;
        debugger;
    }

    @signalr.registerServerCallback('getAll')
    getAll(data) {
        debugger;
    }

    addServerCallback() {

    }

    addClientMethod() {

    }
}