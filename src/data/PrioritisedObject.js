/**



 @author: Tom Clement (tjclement)
 @license NPOSL-3.0
 @copyright Bizboard, 2015

 */

import difference       from 'lodash/difference.js';
import isEqual          from 'lodash/isEqual.js';
import every            from 'lodash/every.js';
import EventEmitter     from 'eventemitter3';
import {ObjectHelper}   from '../utils/ObjectHelper.js';
import {Injection}      from '../utils/Injection.js';
import {DataSource}     from '../data/DataSource.js';

export class PrioritisedObject extends EventEmitter {

    get id() {
        return this._id;
    }

    set id(value) {
        this._id = value;
    }

    /** Priority (positioning) of the object in the dataSource */
    get priority() {
        return this._priority;
    }

    get dataSource() {
        return this._dataSource;
    }

    set priority(value) {
        if (this._priority !== value) {
            this._priority = value;
            this._dataSource.setPriority(value);
        }
    }

    /* TODO: refactor out after we've resolved SharepointDataSource specific issue. */
    get _inheritable() {
        return this._dataSource ? this._dataSource.inheritable : false;
    }

    /**
     * @param {DataSource} dataSource DataSource to construct this PrioritisedObject with.
     * @param {Snapshot} dataSnapshot Optional: dataSnapshot already containing model data, so we can skip subscribing to the full data on the dataSource.
     * @returns {PrioritisedObject} PrioritisedObject instance.
     */
    constructor(dataSource, dataSnapshot = null) {
        super();

        /**** Callbacks ****/
        this._valueChangedCallback = null;

        /**** Private properties ****/
        this._id = dataSource ? dataSource.key() : 0;
        this._locallySetProperties = {};
        this._events = this._events || [];
        this._dataSource = dataSource;
        this._priority = 0; // Priority of this object on remote dataSource
        this._isBeingWrittenByDatasource = false; // Flag to determine when dataSource is updating object

        /* Bind all local methods to the current object instance, so we can refer to "this"
         * in the methods as expected, even when they're called from event handlers.        */
        ObjectHelper.bindAllMethods(this, this);

        /* Hide all private properties (starting with '_') and methods from enumeration,
         * so when you do for( in ), only actual data properties show up. */
        ObjectHelper.hideMethodsAndPrivatePropertiesFromObject(this);

        /* Hide the id field from enumeration, so we don't save it to the dataSource. */
        ObjectHelper.hidePropertyFromObject(this, 'id');

        /* Hide the priority field from enumeration, so we don't save it to the dataSource. */
        ObjectHelper.hidePropertyFromObject(this, 'priority');

        /* Hide the dataSource field from enumeration, so we don't save it to the dataSource. */
        ObjectHelper.hidePropertyFromObject(this, 'dataSource');

        if (dataSnapshot) {
            this._buildFromSnapshot(dataSnapshot);
        } else {
            this._buildFromDataSource(dataSource);
        }
    }

    getDataSource() {
        return this._dataSource;
    }

    dataExists() {
        return this.getDataSource().dataExists();
    }

    _getParentDataSource() {
        if (!this._parentDataSource) {
            return this._parentDataSource = Injection.get(DataSource, this._dataSource.parent());
        }
        return this._parentDataSource;
    }

    /**
     *  Deletes the current object from the dataSource, and clears itself to free memory.
     *  @returns {void}
     */
    remove() {
        this.off();
        delete this; //TODO <---- This is cryptic, what does it do?
        return this._dataSource.remove(this);
    }

    /**
     * Subscribes to the given event type exactly once; it automatically unsubscribes after the first time it is triggered.
     * @param {String} event One of the following Event Types: 'value', 'child_changed', 'child_moved', 'child_removed'.
     * @param {Function} [handler] Function that is called when the given event type is emitted.
     * @param {Object} [context] Optional: context of 'this' inside the handler function when it is called.
     * @returns {Promise} A promise that resolves once the event has happened
     */
    once(event, handler, context = this) {
        return new Promise((resolve) => {
            this.on(event, function onceWrapper() {
                this.off(event, onceWrapper, context);
                handler && handler.call(context, ...arguments);
                resolve(...arguments);
            }, this);
        });
    }

    /**
     * Subscribes to events emitted by this PrioritisedArray.
     * @param {String} event One of the following Event Types: 'value', 'changed', 'removed', 'ready', 'moved', 'added'.
     * @param {Function} handler Function that is called when the given event type is emitted.
     * @param {Object} [context] Optional: context of 'this' inside the handler function when it is called.
     * @returns {void}
     */
    on(event, handler, context = this) {
        let haveListeners = this._hasListenersOfType(event);
        let haveValueListeners = this._hasListenersForValueEvent();
        super.on(event, handler, context);

        switch (event) {
            case 'ready':
                /* If we're already ready, fire immediately */
                if (this._dataSource && this._dataSource.ready) {
                    handler.call(context, this);
                }
                break;
            case 'value':
                if (!haveValueListeners) {
                    /* Only subscribe to the dataSource if there are no previous listeners for this event type. */
                    this._dataSource.setValueChangedCallback(this._onChildValue);
                } else {
                    if (this._dataSource.ready) {
                        /* If there are previous listeners, fire the value callback once to present the subscriber with inital data. */
                        handler.call(context, this);
                    }
                }
                break;
            /*
             * TODO: If we want to support these use cases (added and move), they might be named more appropriately
             * since they (in the current implementation) will listen for these things happening on properties,
             * e.g. property added and property moved
             */
            case 'added':
                if (!haveListeners) {
                    this._dataSource.setChildAddedCallback(this._onChildAdded);
                }
                break;
            case 'moved':
                if (!haveListeners) {
                    this._dataSource.setChildMovedCallback(this._onChildMoved);
                }
                break;
            case 'changed':
                /* We include the changed event in the value callback */
                if (!haveValueListeners) {
                    this._dataSource.setValueChangedCallback(this._onChildValue);
                }
                break;
            case 'removed':
                /* We include the removed event in the value callback */
                if (!haveValueListeners) {
                    this._dataSource.setValueChangedCallback(this._onChildValue);
                }
                break;
            default:
                break;
        }
    }

    /**
     * Removes subscription to events emitted by this PrioritisedArray. If no handler or context is given, all handlers for
     * the given event are removed. If no parameters are given at all, all event types will have their handlers removed.
     * @param {String} event One of the following Event Types: 'value', 'child_changed', 'child_moved', 'child_removed'.
     * @param {Function} [handler] Function to remove from event callbacks.
     * @param {Object} [context] Object to bind the given callback function to.
     * @returns {void}
     */
    off(event, handler, context) {
        if (event && (handler || context)) {
            super.removeListener(event, handler, context);
        } else {
            super.removeAllListeners(event);
        }
        /* Value, remove, and changed share the same callback */

        if (!this._hasListenersForValueEvent()) {
            this._dataSource.removeValueChangedCallback();
            /* If we have no more listeners of this event type, remove dataSource callback. */
        } else if (!this._hasListenersOfType(event)) {
            switch (event) {
                case 'ready':
                    break;
                case 'added':
                    this._dataSource.removeChildAddedCallback();
                    break;
                case 'moved':
                    this._dataSource.removeChildMovedCallback();
                    break;
                default:
                    break;
            }
        }
    }

    /**
     * Changed, removed and value are triggered from the same function: _onChildValue.
     * This function determines whether there are listeners requiring this function
     * @returns {boolean}
     * @private
     */
    _hasListenersForValueEvent() {
        return this._hasListenersOfType('changed')
        || this._hasListenersOfType('removed')
        || this._hasListenersOfType('value');
    }

    /**
     * Allows multiple modifications to be made to the model without triggering dataSource pushes and event emits for each change.
     * Triggers a push to the dataSource after executing the given method. This push should then emit an event notifying subscribers of any changes.
     * @param {Function} method Function in which the model can be modified.
     * @returns {Promise}
     */
    transaction(method) {
        this.disableChangeListener();
        method();
        this.enableChangeListener();
        return this._onSetterTriggered();
    }

    /**
     * Disables pushes of local changes to the dataSource, and stops event emits that refer to the model's data.
     * @returns {void}
     */
    disableChangeListener() {
        this._isBeingWrittenByDatasource = true;
    }


    /**
     * Enables pushes of local changes to the dataSource, and enables event emits that refer to the model's data.
     * The change listener is active by default, so you'll only need to call this method if you've previously called disableChangeListener().
     * @returns {void}
     */
    enableChangeListener() {
        this._isBeingWrittenByDatasource = false;
    }

    getDataSourcePath() {
        return this._dataSource.path();
    }

    /**
     * Recursively builds getter/setter based properties on current PrioritisedObject from
     * a given dataSnapshot. If an object value is detected, the object itself gets built as
     * another PrioritisedObject and set to the current PrioritisedObject as a property.
     * @param {Snapshot} dataSnapshot DataSnapshot to build the PrioritisedObject from.
     * @returns {void}
     * @private
     */
    _buildFromSnapshot(dataSnapshot) {

        /* Set root object _priority */
        this._priority = dataSnapshot.getPriority();
        let data = dataSnapshot.val();
        let numChildren = dataSnapshot.numChildren();

        if (!this._id) {
            this._id = dataSnapshot.key;
        }

        if (!this._dataSource) {
            this._dataSource = dataSnapshot.ref;
        }

        /* If there is no data at this point yet, fire a ready event */
        if (numChildren === 0) {
            this._dataSource.ready = true;
            this.emit('ready');
            return;
        }

        this._buildFromData(data);

        this._dataSource.ready = true;
        this.emit('ready');
    }

    _buildFromData(data) {
        for (let key in data) {
            /* Only map properties that exists on our model */
            let ownPropertyDescriptor = Object.getOwnPropertyDescriptor(this, key);
            if (ownPropertyDescriptor && ownPropertyDescriptor.enumerable) {
                /* If child is a primitive, listen to changes so we can sync with Firebase */
                ObjectHelper.addPropertyToObject(this, key, data[key], true, true, this._onSetterTriggered.bind(this, key));
            }
        }
    }

    /**
     * Clones a dataSource (to not disturb any existing callbacks defined on the original) and uses it
     * to get a dataSnapshot which is used in _buildSnapshot to build our object.
     * @param {DataSource} dataSource DataSource to build the PrioritisedObject from.
     * @returns {void}
     * @private
     */
    _buildFromDataSource(dataSource) {
        if (!dataSource) {
            return;
        }
        dataSource.once('value', this._buildFromSnapshot);
    }

    /**
     * Gets called whenever a property value is set on this object.
     * This can happen when local code modifies it, or when the dataSource updates it.
     * We only propagate changes to the dataSource if the change was local.
     * @returns {Promise}
     * @private
     */
    _onSetterTriggered(property) {
        if (!this._isBeingWrittenByDatasource) {
            this.emit('changed', this);
            this._locallySetProperties = {};
            return this._dataSource.setWithPriority(ObjectHelper.getEnumerableProperties(this), this._priority);
        }
        if (property !== undefined) {
            this._locallySetProperties[property] = true;
        }
    }

    /**
     * Gets called whenever the current PrioritisedObject is changed by the dataSource.
     * @param {Snapshot} dataSnapshot Snapshot of the new object value.
     * @param {String} previousSiblingID ID of the model preceding the current one.
     * @returns {void}
     * @private
     */
    _onChildValue(dataSnapshot, previousSiblingID) {

        /* If the new dataSource data is equal to what we have locally,
         * this is an update triggered by a local change having been pushed
         * to the remote dataSource. We can ignore it.
         */
        let incomingData = dataSnapshot.val() || {};

        /* Get the fields that currently are set by external data source */
        let fieldsSetByData = difference(Object.keys(ObjectHelper.getEnumerableProperties(this)), Object.keys(this._locallySetProperties));
        let deletedPropertyNames = difference(fieldsSetByData, Object.keys(incomingData));

        /* If data is equal */
        if (!deletedPropertyNames.length && this._incomingDataDiffersFromLocalData(incomingData)) {
            this.emit('value', this, previousSiblingID);
            return;
        }

        this._rebuildFromSnapshot(dataSnapshot, deletedPropertyNames);

        this.emit('value', this, previousSiblingID);
        if (dataSnapshot.val() === null) {
            this.emit('removed', this, previousSiblingID);
        } else {
            this.emit('changed', this, previousSiblingID);
        }

    }

    _hasListenersOfType(type) {
        return this.listeners(type, true);
    }

    _incomingDataDiffersFromLocalData(incomingData){
        return every(incomingData, (val, key) => {
            let ownPropertyDescriptor = Object.getOwnPropertyDescriptor(this, key);
            if (ownPropertyDescriptor && ownPropertyDescriptor.enumerable) {
                return isEqual(this[key], val);
            } else {
                return true;
            }
        })
    }

    _rebuildFromSnapshot(dataSnapshot, deletedPropertyNames) {
        /* Make sure we don't trigger pushes to dataSource whilst repopulating with new dataSource data */
        this.disableChangeListener();
        this._buildFromSnapshot(dataSnapshot);
        for (let field of deletedPropertyNames) {
            this[field] = undefined;
        }
        this.enableChangeListener();
    }

    /* TODO: implement partial updates of model */
    _onChildAdded(dataSnapshot, previousSiblingID) {
        this.emit('added', this, previousSiblingID);
    }

    _onChildMoved(dataSnapshot, previousSiblingID) {
        this.emit('moved', this, previousSiblingID);
    }

    _onChildRemoved(dataSnapshot, previousSiblingID) {
        this.emit('removed', this, previousSiblingID);
    }
}
