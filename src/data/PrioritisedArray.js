/**
 This Source Code is licensed under the MIT license. If a copy of the
 MIT-license was not distributed with this file, You can obtain one at:
 http://opensource.org/licenses/mit-license.html.


 @author: Tom Clement (tjclement)
 @license MIT
 @copyright Bizboard, 2015

 */

import _                            from 'lodash';
import EventEmitter                 from 'eventemitter3';
import {Context}                    from '../utils/Context.js';
import {ObjectHelper}               from '../utils/ObjectHelper.js';
import {DataSource}                 from './DataSource.js';

export class PrioritisedArray extends Array {

    /* Extending Array does not work fluently yet. The length property always returns 0,
     * regardless of how many entries are in the array. We'll override the length prop to determine
     * the amount of enumerable properties in our PrioritisedArray instead of using the built-in length property.
     */
    get length() {
        return Object.keys(this).length;
    }

    set length(value) {
        return value;
    }


    /**
     *
     * @param {Function} dataType DataType of the models being added to the PrioritisedArray.
     * @param {DataSource} dataSource Optional: dataSource to load the models from. If none is given, a new DataSource is made with a path guessed from
     * the model's DataType name.
     * @param {Snapshot} dataSnapshot Optional: snapshot already containing model data. Prevents initial subscription on all values in the DataSource.
     * @param {Object} options Optional: options to pass to the dataSource if none is provided and a new one is constructed.
     * @returns {PrioritisedArray} PrioritisedArray instance.
     */
    constructor(dataType, dataSource = null, dataSnapshot = null, options = null, modelOptions = {}) {
        super();
        /**** Callbacks ****/
        this._valueChangedCallback = null;
        this._ids = {};

        /**** Private properties ****/
        this._dataType = dataType;
        this._dataSource = dataSource;
        this._isBeingReordered = false;
        this._modelOptions = modelOptions;
        /* Flag to determine when we're reordering so we don't listen to move updates */
        this._eventEmitter = new EventEmitter();

        /* Bind all local methods to the current object instance, so we can refer to "this"
         * in the methods as expected, even when they're called from event handlers.        */
        ObjectHelper.bindAllMethods(this, this);

        /* Hide all private properties (starting with '_') and methods from enumeration,
         * so when you do for( in ), only actual data properties show up. */
        ObjectHelper.hideMethodsAndPrivatePropertiesFromObject(this);

        /* Hide the priority field from enumeration, so we don't save it to the dataSource. */
        ObjectHelper.hidePropertyFromObject(Object.getPrototypeOf(this), 'length');

        /* If no dataSource is given, create own one with guessed path */
        if (!dataSource) {
            let path = Object.getPrototypeOf(this).constructor.name;
            /* Retrieve dataSource from the DI context */
            dataSource = Context.getContext().get(DataSource);

            if (options) {
                dataSource = dataSource.child(options.path || path, options);
            } else {
                dataSource = dataSource.child(path);
            }

            this._dataSource = dataSource;
        }

        /* If a snapshot is present use it, otherwise generate one by subscribing to the dataSource one time. */
        if (dataSnapshot) {
            this._buildFromSnapshot(dataSnapshot);
        } else {
            this._buildFromDataSource(dataSource);
        }
    }

    /**
     * Subscribes to events emitted by this PrioritisedArray.
     * @param {String} event One of the following Event Types: 'value', 'child_changed', 'child_moved', 'child_removed'.
     * @param {Function} handler Function that is called when the given event type is emitted.
     * @param {Object} context Optional: context of 'this' inside the handler function when it is called.
     * @returns {void}
     */
    on(event, handler, context) {
        /* If we're already ready, fire immediately */
        if ((event === 'ready' || event === 'value') && this._dataSource && this._dataSource.ready) {
            handler.call(context, this);
        }

        /* If we already have children stored locally when the subscriber calls this method,
         * fire their callback for all pre-existing children. */
        if (event === 'child_added') {
            for (let i = 0; i < this.length; i++) {
                let model = this[i];
                let previousSiblingID = i > 0 ? this[i - 1].id : null;
                handler.call(context, model, previousSiblingID);
            }
        }

        this._eventEmitter.on(event, handler, context);
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
     * Removes subscription to events emitted by this PrioritisedArray. If no handler or context is given, all handlers for
     * the given event are removed. If no parameters are given at all, all event types will have their handlers removed.
     * @param {String} event One of the following Event Types: 'value', 'child_changed', 'child_moved', 'child_removed'.
     * @param {Function} handler Function to remove from event callbacks.
     * @param {Object} context Object to bind the given callback function to.
     * @returns {void}
     */
    off(event, handler, context) {
        if (event && (handler || context)) {
            this._eventEmitter.removeListener(event, handler, context);
        } else {
            this._eventEmitter.removeAllListeners(event);
        }
    }

    /**
     * Adds a model instance to the rear of the PrioritisedArray, and emits a 'child_added' and possibly 'new_child' event after successful addition.
     * @param {Model} model Instance of a Model.
     * @param {String} prevSiblingId ID of the model preceding the one that will be added.
     * @returns {Object} Same model as the one originally passed as parameter.
     */
    add(model, prevSiblingId = null) {
        if (model instanceof this._dataType) {
            if (this.findIndexById(model.id) < 0) {

                if (prevSiblingId) {
                    let newPosition = this.findIndexById(prevSiblingId) + 1;
                    this._ids[model._id] = newPosition;
                    this.insertAt(model, newPosition);
                } else {
                    this.push(model);
                    this._ids[model._id] = this.length - 1;
                }

                /* If we've already received an on('value') result, this child addition is
                 * a new entry that wasn't on the dataSource before. */
                if(this._dataSource.ready) {
                    this._eventEmitter.emit('new_child', model, prevSiblingId);
                }

                this._eventEmitter.emit('child_added', model, prevSiblingId);
                return model;
            }
        } else if (model instanceof Object) {
            /* Let's try to parse the object using property reflection */
            var options = {dataSource: this._dataSource};
            let newModel = new this._dataType(null, model, _.extend({}, this._modelOptions, options));
            this.add(newModel);
            return newModel;
        } else {
            /* TODO: change to throw exception */
            console.log('Tried to append an object that is not the same type as the one this PrioritisedArray was created with.');
        }

        /* Return model so we can do this: let newModel = PrioArray.add(new Model()); newModel.someProperty = true; */
        return  null;
    }


    /**
     * Inserts a model instance at the given position of the PrioritisedArray, and recalculates the priority (position)
     * of all models after the inserted position.
     * @param {Model} model Subclass of Model
     * @param {Number} position Zero-based index where to put the new model instance.
     * @returns {Object} Same model as the one originally passed as parameter.
     */
    insertAt(model, position) {
        if (model instanceof this._dataType) {
            this.splice(position, 0, model);
            this._ids[model._id] = position;
        } else {
            /* TODO: change to throw exception */
            console.log('Tried to append an object that is not the same type as the PrioritisedArray was created with.');
        }

        /* Return model so we can do this: let newModel = PrioArray.add(new Model()); newModel.someProperty = true; */
        return model;
    }

    /**
     * Moves a model instance from one position to another.
     * @param {Number} fromPosition Zero-based index of original position
     * @param {Number} toPosition Zero-based index of target position
     * @returns {void}
     */
    move(fromPosition, toPosition) {
        let model = this[fromPosition];
        this._ids[model._id] = toPosition;
        this._ids[fromPosition] = null;
        this.splice(fromPosition, 1);
        this.splice(toPosition, 0, model);

    }

    /**
     * Removes the model instance at the given position. Does not remove the model from the datasource, to do that
     * call model.remove() directly, or PrioArray[index].remove().
     * @param {Number} position Index in the PrioritisedArray of the model to remove.
     * @returns {void}
     */
    remove(position) {
        this.splice(position, 1);
    }


    /**
     * Interprets all childs of a given snapshot as instances of the given data type for this PrioritisedArray,
     * and attempts to instantiate new model instances based on these sub-snapshots. It adds them to the
     * PrioritisedArray, which also assigns their priority based on their inserted position.
     * @param {Snapshot} dataSnapshot Snapshot to build the PrioritisedArray from.
     * @returns {void}
     * @private
     */
    _buildFromSnapshot(dataSnapshot) {

        let numChildren = dataSnapshot.numChildren(), currentChild = 1;

        /* If there is no data at this point yet, fire a ready event */
        if (numChildren === 0) {
            this._dataSource.ready = true;
            this._eventEmitter.emit('ready');
            this._eventEmitter.emit('value', this);
        }

        dataSnapshot.forEach(
            function (child) {
                /* Create a new instance of the given data type and prefill it with the snapshot data. */
                let options = {dataSnapshot: child};
                let childRef = this._dataSource.child(child.key());

                /* whenever the ref() is a datasource, we can bind that source to the model.
                 * whenever it's not a datasource, we assume the model should instantiate a new
                 * datasource to bind the model */

                if (childRef instanceof DataSource) {
                    options.dataSource = childRef;
                } else {
                    var rootPath = dataSnapshot.ref().root().toString();
                    options.path = dataSnapshot.ref().toString().replace(rootPath, '/');
                }

                let newModel = new this._dataType(child.key(), child.val(), _.extend({}, this._modelOptions, options));
                this.add(newModel);

                /* If this is the last child, fire a ready event */
                if (currentChild++ === numChildren) {
                    this._dataSource.ready = true;
                    this._eventEmitter.emit('ready');
                    this._eventEmitter.emit('value', this);
                }

            }.bind(this));
    }


    /**
     * Clones a dataSource (to not disturb any existing callbacks defined on the original) and uses it
     * to get a dataSnapshot which is used in _buildSnapshot to build our array.
     * @param {DataSource} dataSource DataSource to subscribe to for building the PrioritisedArray.
     * @returns {void}
     * @private
     */
    _buildFromDataSource(dataSource) {
        dataSource.once('value', (dataSnapshot) => {
            this._buildFromSnapshot(dataSnapshot);
            this._registerCallbacks(dataSource);
        });
    }

    /**
     * Registers the added, moved, changed, and removed callbacks to the given DataSource.
     * @param {DataSource} dataSource DataSource to register callbacks on.
     * @return {void}
     * @private
     */
    _registerCallbacks(dataSource) {
        dataSource.on('child_added', this._onChildAdded);
        dataSource.on('child_moved', this._onChildMoved);
        dataSource.on('child_changed', this._onChildChanged);
        dataSource.on('child_removed', this._onChildRemoved);
    }

    /**
     * Called by dataSource when a new child is added.
     * @param {Snapshot} snapshot Snapshot of the added child.
     * @param {String} prevSiblingId ID of the model preceding the added model.
     * @returns {void}
     * @private
     */
    _onChildAdded(snapshot, prevSiblingId) {
        let id = snapshot.key();
        let model = new this._dataType(id, null, _.extend({}, this._modelOptions, {
            dataSnapshot: snapshot,
            dataSource: this._dataSource.child(id)
        }));

        let previousPosition = this.findIndexById(id);
        if(previousPosition >= 0) {
            let oldModel = this[previousPosition];
            let oldProperties = ObjectHelper.getEnumerableProperties(oldModel);
            let newProperties = ObjectHelper.getEnumerableProperties(model);
            if (_.isEqual(oldProperties, newProperties)) { /* Child already exists. */
                return;
            }
        }

        this.add(model, prevSiblingId);

        if (!this._dataSource.ready) {
            this._dataSource.ready = true;
            this._eventEmitter.emit('ready');
        }
        this._eventEmitter.emit('value', this);
    }

    /**
     * Called by dataSource when a child is changed.
     * @param {Snapshot} snapshot Snapshot of the added child.
     * @param {String} prevSiblingId ID of the model preceding the added model.
     * @returns {void}
     * @private
     */
    _onChildChanged(snapshot, prevSiblingId) {
        let id = snapshot.key();

        let changedModel = new this._dataType(id, null, _.extend({}, this._modelOptions, {dataSnapshot: snapshot,  dataSource: this._dataSource.child(id)}));

        let previousPosition = this.findIndexById(id);
        if (previousPosition < 0) {
            /* The model doesn't exist, so we won't emit a changed event. */
            return;
        }



        this.remove(previousPosition);

        let newPosition = this.findIndexById(prevSiblingId) + 1;
        this.insertAt(changedModel, newPosition);

        this._eventEmitter.emit('child_changed', changedModel, prevSiblingId);
        this._eventEmitter.emit('value', this);
    }

    /**
     * Called by dataSource when a child is moved, which changes its priority.
     * @param {Snapshot} snapshot Snapshot of the added child.
     * @param {String} prevSiblingId ID of the model preceding the added model.
     * @returns {void}
     * @private
     */
    _onChildMoved(snapshot, prevSiblingId) {
        /* Ignore priority updates whilst we're reordering to avoid floods */
        if (!this._isBeingReordered) {

            let id = snapshot.key();
            let previousPosition = this.findIndexById(id);
            let tempModel = this[previousPosition];
            this._ids[id] = null;
            this.remove(previousPosition);

            let newPosition = this.findIndexById(prevSiblingId) + 1;
            this.insertAt(tempModel, newPosition);

            let model = this[newPosition];

            this._eventEmitter.emit('child_moved', model, previousPosition);
            this._eventEmitter.emit('value', this);
        }
    }

    /**
     * Called by dataSource when a child is removed.
     * @param {Snapshot} oldSnapshot Snapshot of the added child.
     * @returns {void}
     * @private
     */
    _onChildRemoved(oldSnapshot) {
        /* TODO: figure out if we can use the snapshot's priority as our array index reliably, to avoid big loops. */
        let id = oldSnapshot.key();
        let position = this.findIndexById(id);
        let model = this[position];

        if (position !== -1) {
            this._ids[id] = null;
            this.remove(position);

            this._eventEmitter.emit('child_removed', model);
            this._eventEmitter.emit('value', this);
        }
    }

    /**
     * Return the position of model's id, saved in an associative array
     * @param {Number} id Id field of the model we're looking for
     * @returns {Number} Zero-based index if found, -1 otherwise
     * @private
     */
    findIndexById(id) {
        let position = this._ids[id];
        return (position == undefined || position == null) ? -1 : position;
    }

}
