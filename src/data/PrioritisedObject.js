/**
 This Source Code is licensed under the MIT license. If a copy of the
 MIT-license was not distributed with this file, You can obtain one at:
 http://opensource.org/licenses/mit-license.html.


 @author: Tom Clement (tjclement)
 @license MIT
 @copyright Bizboard, 2015

 */

import _                from 'lodash';
import EventEmitter     from 'eventemitter3';
import {ObjectHelper}   from '../utils/ObjectHelper.js';

export class PrioritisedObject extends EventEmitter {

    get id() { return this._id; }

    set id(value) { this._id = value; }

    /** Priority (positioning) of the object in the dataSource */
    get priority() {
        return this._priority;
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

        if (dataSnapshot) {
            this._buildFromSnapshot(dataSnapshot);
        } else {
            this._buildFromDataSource(dataSource);
        }
    }

    /**
     *  Deletes the current object from the dataSource, and clears itself to free memory.
     *  @returns {void}
     */
    remove() {
        this.off();
        this._dataSource.remove(this);
        delete this;
    }

    /**
     * Subscribes to the given event type exactly once; it automatically unsubscribes after the first time it is triggered.
     * @param {String} event One of the following Event Types: 'value', 'child_changed', 'child_moved', 'child_removed'.
     * @param {Function} handler Function that is called when the given event type is emitted.
     * @param {Object} context Optional: context of 'this' inside the handler function when it is called.
     * @returns {void}
     */
    once(event, handler, context = this) {
        return this.on(event, function onceWrapper() {
            handler.call(context, ...arguments);
            this.off(event, onceWrapper, context);
        }, this);
    }

    /**
     * Subscribes to events emitted by this PrioritisedArray.
     * @param {String} event One of the following Event Types: 'value', 'child_changed', 'child_moved', 'child_removed'.
     * @param {Function} handler Function that is called when the given event type is emitted.
     * @param {Object} context Optional: context of 'this' inside the handler function when it is called.
     * @returns {void}
     */
    on(event, handler, context = this) {
        let haveListeners = this.listeners(event, true);
        super.on(event, handler, context);

        switch (event) {
            case 'ready':
                /* If we're already ready, fire immediately */
                if (this._dataSource && this._dataSource.ready) { handler.call(context, this); }
                break;
            case 'value':
                if (!haveListeners) {
                    /* Only subscribe to the dataSource if there are no previous listeners for this event type. */
                    this._dataSource.setValueChangedCallback(this._onChildValue);
                } else {
                    /* If there are previous listeners, fire the value callback once to present the subscriber with inital data. */
                    handler.call(context, this);
                }
                break;
            case 'added':
                if (!haveListeners) { this._dataSource.setChildAddedCallback(this._onChildAdded); }
                break;
            case 'moved':
                if (!haveListeners) { this._dataSource.setChildMovedCallback(this._onChildMoved); }
                break;
            case 'removed':
                if (!haveListeners) { this._dataSource.setChildRemovedCallback(this._onChildRemoved); }
                break;
            default:
                break;
        }
    }

    /**
     * Removes subscription to events emitted by this PrioritisedArray. If no handler or context is given, all handlers for
     * the given event are removed. If no parameters are given at all, all event types will have their handlers removed.
     * @param {String} event One of the following Event Types: 'value', 'child_changed', 'child_moved', 'child_removed'.
     * @param {Function} handler Function to remove from event callbacks.
     * @param {Object} context Object to bind the given callback function to.
     * @returns {void}
     */
    off(event, handler, context) {
        if (event && (handler || context)) {
            super.removeListener(event, handler, context);
        } else {
            super.removeAllListeners(event);
        }

        /* If we have no more listeners of this event type, remove dataSource callback. */
        if (!this.listeners(event, true)) {
            switch (event) {
                case 'ready':
                    break;
                case 'value':
                    this._dataSource.removeValueChangedCallback();
                    break;
                case 'added':
                    this._dataSource.removeChildAddedCallback();
                    break;
                case 'moved':
                    this._dataSource.removeChildMovedCallback();
                    break;
                case 'removed':
                    this._dataSource.removeChildRemovedCallback();
                    break;
                default:
                    break;
            }
        }
    }

    /**
     * Allows multiple modifications to be made to the model without triggering dataSource pushes and event emits for each change.
     * Triggers a push to the dataSource after executing the given method. This push should then emit an event notifying subscribers of any changes.
     * @param {Function} method Function in which the model can be modified.
     * @returns {void}
     */
    transaction(method) {
        this.disableChangeListener();
        method();
        this.enableChangeListener();
        this._onSetterTriggered();
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
            this._id = dataSnapshot.key();
        }

        /* If there is no data at this point yet, fire a ready event */
        if (numChildren === 0) {
            this._dataSource.ready = true;
            this.emit('ready');
        }

        for (let key in data) {

            /* Only map properties that exists on our model */
            if (Object.getOwnPropertyDescriptor(this, key)) {
                /* If child is a primitive, listen to changes so we can synch with Firebase */
                ObjectHelper.addPropertyToObject(this, key, data[key], true, true, this._onSetterTriggered);
            }

        }

        this._dataSource.ready = true;
        this.emit('ready');
    }

    /**
     * Clones a dataSource (to not disturb any existing callbacks defined on the original) and uses it
     * to get a dataSnapshot which is used in _buildSnapshot to build our object.
     * @param {DataSource} dataSource DataSource to build the PrioritisedObject from.
     * @returns {void}
     * @private
     */
    _buildFromDataSource(dataSource) {
        if (!dataSource) { return; }
        dataSource.once('value', this._buildFromSnapshot);
    }

    /**
     * Gets called whenever a property value is set on this object.
     * This can happen when local code modifies it, or when the dataSource updates it.
     * We only propagate changes to the dataSource if the change was local.
     * @returns {void}
     * @private
     */
    _onSetterTriggered() {
        if (!this._isBeingWrittenByDatasource) {
            this._dataSource.setWithPriority(ObjectHelper.getEnumerableProperties(this), this._priority);
        }
    }

    /**
     * Gets called whenever the current PrioritisedObject is changed by the dataSource.
     * @param {DataSnapshot} dataSnapshot Snapshot of the new object value.
     * @param {String} previousSiblingID ID of the model preceding the current one.
     * @returns {void}
     * @private
     */
    _onChildValue(dataSnapshot, previousSiblingID) {

        /* If the new dataSource data is equal to what we have locally,
         * this is an update triggered by a local change having been pushed
         * to the remote dataSource. We can ignore it.
         */
        if (_.isEqual(ObjectHelper.getEnumerableProperties(this), dataSnapshot.val())) {
            this.emit('value', this, previousSiblingID);
            return;
        }

        /* Make sure we don't trigger pushes to dataSource whilst repopulating with new dataSource data */
        this._isBeingWrittenByDatasource = true;
        this._buildFromSnapshot(dataSnapshot);
        this._isBeingWrittenByDatasource = false;

        this.emit('value', this, previousSiblingID);
    }

    /* TODO: implement partial updates of model */
    _onChildAdded(dataSnapshot, previousSiblingID) { this.emit('added', this, previousSiblingID); }

    _onChildMoved(dataSnapshot, previousSiblingID) { this.emit('moved', this, previousSiblingID); }

    _onChildRemoved(dataSnapshot, previousSiblingID) { this.emit('removed', this, previousSiblingID); }
}
