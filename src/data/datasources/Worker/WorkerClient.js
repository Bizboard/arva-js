/**
 * Created by Manuel on 29/09/16.
 */

import {combineOptions}             from 'arva-js/utils/CombineOptions.js';
import EventEmitter                 from 'eventemitter3';

export class WorkerClient extends EventEmitter {

    key;
    parent;
    root;

    static clientID = 0;
    static subscriberID = 0;
    static deferredTasks = {};

    constructor(path, options = {}, firebaseSettings = null) {
        super();

        this.options = options;
        this.options.path = path;
        this.options.clientID = WorkerClient.clientID++;

        if (firebaseSettings) {
            FBWorker.postMessage([JSON.stringify(firebaseSettings)]);
        }
    }

    static onWorkerMessage({data}){
        data = JSON.parse(data);
        if (data && data.subscriberID) {
            if (WorkerClient.deferredTasks[data.subscriberID] instanceof Promise) {
                WorkerClient.deferredTasks[data.subscriberID].resolve(data.result);
                delete WorkerClient.deferredTasks[data.subscriberID];
            } else if (WorkerClient.deferredTasks[data.subscriberID] instanceof Function) {
                WorkerClient.deferredTasks[data.subscriberID](data.event, data.result);
            }
        }
    }

    _sendMessage(options = {}) {

        let _resolve, _reject;
        let deferred = new Promise(function (resolve, reject) {
            _resolve = resolve;
            _reject = reject;
        });

        deferred.resolve = _resolve;
        deferred.reject = _reject;

        WorkerClient.deferredTasks[++WorkerClient.subscriberID] = deferred;
        options.subscriberID = WorkerClient.subscriberID;

        FBWorker.postMessage([JSON.stringify(combineOptions(options, this.options))]);
        return WorkerClient.deferredTasks[WorkerClient.subscriberID];
    }

    on(event = '', handler = ()=> {}, context = this) {
        WorkerClient.deferredTasks[++WorkerClient.subscriberID] = this._emitEvent.bind(this);
        let options = {
            action: 'subscribe',
            event
        };
        options.subscriberID = WorkerClient.subscriberID;
        FBWorker.postMessage([JSON.stringify(combineOptions(options, this.options))]);

        super.on(event, handler, context);
    }

    off(event, handler) {
        if (event && handler) {
            super.removeListener(event, handler);
        } else if (event) {
            super.removeAllListeners(event);
        }

        if (this.listeners(event).length === 0) {
            let options = {};
            options.action = 'unsubscribe';
            options.event = event;
            FBWorker.postMessage([JSON.stringify(combineOptions(options, this.options))]);
        }
    }

    once(event, handler, context = this) {
        this.on(event, function () {
            handler.call(context, ...arguments);
            this.off(event, handler, context);
        }.bind(this), context);
    }

    limitToFirst(limitValue) {
        return this._sendMessage({
            action: 'limitToFirst',
            data: limitValue
        });
    }

    limitToLast(limitValue) {
        return this._sendMessage({
            action: 'limitToLast',
            data: limitValue
        });
    }

    orderByPriority() {
        return this._sendMessage({
            action: 'orderByPriority'
        });
    }

    orderByValue() {
        return this._sendMessage({
            action: 'orderByValue'
        });
    }

    orderByChild(path = '') {
        return this._sendMessage({
            action: 'orderByValue',
            data: path
        });
    }

    set(newData) {
        return this._sendMessage({
            action: 'set',
            data: newData
        });
    }

    setWithPriority(newData = {}, newPriority = '') {
        return this._sendMessage({
            action: 'setWithPriority',
            data: newData,
            priority: newPriority
        });
    }

    setPriority(priority) {
        return this._sendMessage({
            action: 'setPriority',
            priority: priority
        });
    }

    remove() {
        return this._sendMessage({
            action: 'remove'
        });
    }

    push(newData) {
        return this._sendMessage({
            action: 'push',
            data: newData
        });
    }

    auth() {
        return {
            signInWithCustomToken(){
            },
            signInWithEmailAndPassword(){
            },
            signInWithCredential(){
            },
            signInAnonymously(){
            },
            signOut(){
            }
        }
    }

    _emitEvent(event = '', data = {}) {
        super.emit(event, data);
    }
}

/* Instantiate the worker and bind the events */
let FBWorker = new Worker('./Worker.js');
let workerEvents = new EventEmitter();
FBWorker.onmessage = (messageEvent) => {
    workerEvents.emit('message', messageEvent);
};
workerEvents.on('message', WorkerClient.onWorkerMessage);
