/**



 @author: Tom Clement (tjclement)
 @license NPOSL-3.0
 @copyright Bizboard, 2015

 */

import extend                       from 'lodash/extend.js';
import EventEmitter                 from 'eventemitter3';
import {DataSource}                 from './DataSource.js';
import {Model}                      from '../core/Model.js';
import {LocalModel}                 from './local/LocalModel.js';
import {Injection}                  from '../utils/Injection.js';
import {Throttler}                  from '../utils/Throttler.js';
import {ObjectHelper}               from '../utils/ObjectHelper.js';

/**
 * An array of two-way bound data Models that are automatically synced with the currently used DataSource
 */
export class PrioritisedArray {

  _children = [];
  _referenceLength = 0;
  /* The amount of numerical properties on this PrioArray that refer to this._children */
  get length() {
    return this._children.length;
  }

  /**
   *
   * @param {Function} dataType DataType of the models being added to the PrioritisedArray.
   * @param {DataSource} [dataSource] dataSource to load the models from. If none is given, a new DataSource is made with a path guessed from
   * the model's DataType name.
   * @param {Snapshot} [dataSnapshot] snapshot already containing model data. Prevents initial subscription on all values in the DataSource.
   * @param {Object} [options] options to pass to the dataSource if none is provided and a new one is constructed.
   * @param {Object} [modelOptions] options to merge into the construction of every new Model.
   * @returns {PrioritisedArray} PrioritisedArray instance.
   */
  constructor(dataType, dataSource = null, dataSnapshot = null, options = {}, modelOptions = {}) {
    /**** Callbacks ****/
    this._valueChangedCallback = null;

    options = options || {};

    /* Bind all local methods to the current object instance, so we can refer to "this"
     * in the methods as expected, even when they're called from event handlers.        */
    ObjectHelper.bindAllMethods(this, this);

    /**** Private properties ****/
    this._ids = {};
    this._dataType = dataType;
    this._dataSource = dataSource;
    this._isBeingReordered = false;
    this._modelOptions = modelOptions;
    /* Flag to determine when we're reordering so we don't listen to move updates */
    this._eventEmitter = new EventEmitter();
    this._childAddedThrottler = new Throttler(options.noThrottle || typeof window === 'undefined' ? 0 : 1, true, this, true);
    this._overrideChildAddedForId = null;

    /* We do the bindAllMethods before this happens in order to make sure that dataType.prototype isn't modified so
     * that this check would break
     */
    if (dataType && !(dataType.prototype instanceof Model)) {
      throw new Error(`${dataType.toString()} passed to PrioritisedArray is not an instance of a model`);
    }

    /* Hide all private properties (starting with '_') and methods from enumeration,
     * so when you do for( in ), only actual data properties show up. */
    ObjectHelper.hideMethodsAndPrivatePropertiesFromObject(this);

    /* Hide the priority field from enumeration, so we don't save it to the dataSource. */
    // ObjectHelper.hidePropertyFromObject(Object.getPrototypeOf(this), 'length');

    /* If no dataSource is given, create own one with guessed path */
    if (!dataSource) {
      /* The this._name property can be set by Arva's babel-plugin-transform-runtime-constructor-name plugin.
       * This allows Arva code to be minified and mangled without losing automated model name resolving.
       * If the plugin is not set up to run, which is done e.g. when not minifying your code, we default back to the runtime constructor name. */
      let path = this.constructor._name || Object.getPrototypeOf(this).constructor.name;
      /* Retrieve dataSource from the DI context */
      dataSource = Injection.get(DataSource);
      dataSource = dataSource.child(options.path || path, options);

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
        this._childAddedThrottler.add(() => {
          let model = this._children[i];
          let previousSiblingID = i > 0 ? this._children[i - 1].id : null;
          handler.call(context, model, previousSiblingID);
        });
      }
    }

    this._eventEmitter.on(event, handler, context);
  }

  /**
   * Subscribes to the given event type exactly once; it automatically unsubscribes after the first time it is triggered.
   * @param {String} event One of the following Event Types: 'value', 'child_changed', 'child_moved', 'child_removed'.
   * @param {Function} [handler] Function that is called when the given event type is emitted.
   * @param {Object} [context] context of 'this' inside the handler function when it is called.
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
   * @param {Model|Object} model Instance of a Model.
   * @param {String|undefined} prevSiblingId ID of the model preceding the one that will be added.
   * @param {Boolean} [emitValueEvent] Set to false to prevent emitting value event in this method.
   * @returns {Object} Same model as the one originally passed as parameter.
   */
  add(model, prevSiblingId = null, emitValueEvent = true) {
    if (model instanceof this._dataType) {
      if (this.findIndexById(model.id) < 0) {

        if (prevSiblingId) {
          let newPosition = this.findIndexById(prevSiblingId) + 1;
          this.insertAt(model, newPosition);
        } else {
          this.push(model);
        }

        /* If we've already received an on('value') result, this child addition is
         * a new entry that wasn't on the dataSource before. */
        if (this._dataSource.ready) {
          this._eventEmitter.emit('new_child', model, prevSiblingId);
        }

        this._eventEmitter.emit('child_added', model, prevSiblingId);
        if (emitValueEvent) {
          this._eventEmitter.emit('value', this);
        }

        return model;
      }
    } else if (model instanceof Object) {
      /* Let's try to parse the object using property reflection */
      var options = { dataSource: this._dataSource };
      /* Prevent child_added from being fired immediately when the model is created by creating a promise that resolves
       * the ID that shouldn't be synced twice
       */

      this._overrideChildAddedForId = this.once('local_child_added');
      let newModel = new this._dataType(null, model, extend({}, this._modelOptions, options));

      this.add(newModel, undefined, emitValueEvent);
      /* Remove lock */
      this._eventEmitter.emit('local_child_added', newModel);
      this._overrideChildAddedForId = null;
      return newModel;
    } else {
      /* TODO: change to throw exception */
      console.log('Tried to append an object that is not the same type as the one this PrioritisedArray was created with.');
    }

    /* Return model so we can do this: let newModel = PrioArray.add(new Model()); newModel.someProperty = true; */
    return null;
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
      for (let i = position; i < this.length; i++) {
        /* Increase the index of items further on in the prio array */
        this._ids[this._children[i].id]++;
      }
      this._children.splice(position, 0, model);
      this._ids[model._id] = position;
    } else {
      /* TODO: change to throw exception */
      console.log('Tried to append an object that is not the same type as the PrioritisedArray was created with.');
    }

    this._updateReferenceProperties();

    /* Return model so we can do this: let newModel = PrioArray.add(new Model()); newModel.someProperty = true; */
    return model;
  }

  /**
   * Adds a model or object to the end of the list.
   * @param {Object|Model} model
   * @returns {Model} The newly inserted model
   */
  push(model) {
    return this.insertAt(model, this.length);
  }

  /**
   * Removes the model instance at the given position. Does not remove the model from the datasource, to do that
   * call model.remove() directly, or PrioArray[index].remove().
   * @param {Number} position Index in the PrioritisedArray of the model to remove.
   * @returns {void}
   */
  remove(position) {
    /*
     * TODO: Beware, there might be hard to reproduce prone to errors going on sometimes when deleting many things at once
     * Sometimes, there is an inconsistent state, but I haven't been able to figure out how that happens. /Karl
     */
    if (this.length === 1) {
      this._ids = {};
    } else {
      for (let i = position + 1; i < this.length; i++) {
        /* Decrease the index of items further on in the prio array */
        if (!this._ids[this._children[i].id] && this._ids[this._children[i].id] !== 0) {
          console.log("Internal error, decreasing index of non-existing id. For ID: " + this._children[i].id);
        }
        this._ids[this._children[i].id]--;
      }
      delete this._ids[this._children[position].id];

    }
    this.splice(position, 1);
    this._updateReferenceProperties();
  }


  /**
   * Return the position of model's id, saved in an associative array
   * @param {String} id Id field of the model we're looking for
   * @returns {Number} Zero-based index if found, -1 otherwise
   */
  findIndexById(id) {
    let position = this._ids[id];
    return (position == undefined || position == null) ? -1 : position;
  }


  /**
   * Finds an item based on its Id in the datasource.
   * @param id
   * @returns {Model}
   */
  findById(id) {
    return this._children[this.findIndexById(id)];
  }

  getDataSourcePath() {
    return this._dataSource.path();
  }

  /**
   * Replaces all items in this PrioritisedArray with items from newContents.
   * @param {PrioritisedArray} newContents PrioritisedArray to take elements from.
   */
  replaceContents(newContents) {
    while (this.length) {
      this._children[0].remove();
    }
    this._referenceLength = 0;
    for (let item of newContents) {
      this.add(LocalModel.cloneModelProperties(item));
    }
  }

  /**
   * Proxies PrioArray.find() to its underlying Array cache.
   * @returns {*}
   */
  find() {
    return this._children.find.apply(this._children, arguments);
  }
  /**
   * Proxies PrioArray.findIndex() to its underlying Array cache.
   * @returns {*}
   */
  findIndex() {
    return this._children.findIndex.apply(this._children, arguments);
  }
  /**
   * Proxies PrioArray.keys() to its underlying Array cache.
   * @returns {*}
   */
  keys() {
    return this._children.keys.apply(this._children, arguments);
  }
  /**
   * Proxies PrioArray.keys() to its underlying Array cache.
   * @returns {*}
   */
  includes() {
    return this._children.includes.apply(this._children, arguments);
  }

  /**
   * Proxies PrioArray.entries() to its underlying Array cache.
   * @returns {*}
   */
  entries() {
    return this._children.entries.apply(this._children, arguments);
  }

  /**
   * Proxies PrioArray.reduce() to its underlying Array cache.
   * @returns {*}
   */
  reduce() {
    return this._children.reduce.apply(this._children, arguments);
  }

  /**
   * Proxies PrioArray.map() to its underlying Array cache.
   * @returns {*}
   */
  map() {
    return this._children.map.apply(this._children, arguments);
  }

  /**
   * //TODO Why is this necessary? Would be better never to access this method
   * Proxies PrioArray.splice() to its underlying Array cache.
   * @returns {*}
   */
  splice() {
    let result = this._children.splice.apply(this._children, arguments);
    this._updateReferenceProperties();
    return result;
  }

  /**
   * Proxies PrioArray.filter() to its underlying Array cache.
   * @returns {*}
   */
  filter() {
    return this._children.filter.apply(this._children, arguments);
  }

  /**
   * Proxies PrioArray.concat() to its underlying Array cache.
   * @returns {*}
   */
  concat() {
      for(let index in arguments){
          if(arguments[index] instanceof PrioritisedArray){
              arguments[index] = arguments[index]._children;
          }
      }
      return this._children.concat.apply(this._children, arguments);
  }

  /**
   * Proxies PrioArray.every() to its underlying Array cache.
   * @returns {*}
   */
  every() {
    return this._children.every.apply(this._children, arguments);
  }
  /**
   * Proxies PrioArray.filter() to its underlying Array cache.
   * @returns {*}
   */
  includes() {
    return this._children.includes.apply(this._children, arguments);
  }
  /**
   * Proxies PrioArray.join() to its underlying Array cache.
   * @returns {*}
   */
  join() {
    return this._children.join.apply(this._children, arguments);
  }
  /**
   * Proxies PrioArray.lastIndexOf() to its underlying Array cache.
   * @returns {*}
   */
  lastIndexOf() {
    return this._children.lastIndexOf.apply(this._children, arguments);
  }
  /**
   * Proxies PrioArray.reduceRight() to its underlying Array cache.
   * @returns {*}
   */
  reduceRight() {
    return this._children.reduceRight.apply(this._children, arguments);
  }
  /**
   * Proxies PrioArray.some() to its underlying Array cache.
   * @returns {*}
   */
  some() {
    return this._children.some.apply(this._children, arguments);
  }


  /**
   * Allows 'for of' loops on the PrioArray.
   */
  *[Symbol.iterator]() {
    for (let child of this._children) {
      yield child;
    }
  }

  /**
   * Whenever this PrioArray is typecasted, its underlying Array cache is returned.
   * @param hint
   * @returns {Array}
   */
  [Symbol.toPrimitive](hint) {
    return "" + this._children;
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

    dataSnapshot.forEach(function (child) {
      this._childAddedThrottler.add(function (child) {
        /* Create a new instance of the given data type and prefill it with the snapshot data. */
        let options = { dataSnapshot: child, noInitialSync: true };
        let childRef = this._dataSource.child(child.key);

        /* whenever the ref() is a datasource, we can bind that source to the model.
         * whenever it's not a datasource, we assume the model should instantiate a new
         * datasource to bind the model */

        if (childRef instanceof DataSource) {
          options.dataSource = childRef;
        } else {
          var rootPath = dataSnapshot.ref().root().toString();
          options.path = dataSnapshot.ref().toString().replace(rootPath, '/');
        }

        let newModel = new this._dataType(child.key, child.val(), extend({}, this._modelOptions, options));
        this.add(newModel, undefined, false);

        /* If this is the last child, fire a ready event */
        if (currentChild++ === numChildren) {
          this._dataSource.ready = true;
          this._eventEmitter.emit('ready');
          this._eventEmitter.emit('value', this);
        }

      }.bind(this, child));
    }.bind(this))
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
    dataSource.on('child_added', this._doOnceReady(this._onChildAdded));
    dataSource.on('child_moved', this._doOnceReady(this._onChildMoved));
    dataSource.on('child_changed', this._doOnceReady(this._onChildChanged));
    dataSource.on('child_removed', this._doOnceReady(this._onChildRemoved));
  }

  _doOnceReady(callback) {
    return (...otherArgs) => {
      if (!this._dataSource.ready) {
        this.once('ready', () => {
          return callback(...otherArgs)
        });
      } else {
        return callback(...otherArgs)
      }
    }
  }

  /**
   * Called by dataSource when a new child is added.
   * @param {Snapshot} snapshot Snapshot of the added child.
   * @param {String} prevSiblingId ID of the model preceding the added model.
   * @returns {void}
   * @private
   */
  _onChildAdded(snapshot, prevSiblingId) {
    let id = snapshot.key;
    if (this._overrideChildAddedForId) {
      this._overrideChildAddedForId.then((newModel) => {
        /* If the override is concerning another id, then go ahead and make the _onChildAdded */
        if (newModel.id !== id) {
          this._onChildAdded(snapshot, prevSiblingId)
        } else {
          this._eventEmitter.emit('value', this);
        }
        /* Otherwise, don't recreate the same model twice */
      });

      return;
    }

    /* Skip addition if an item with identical ID already exists. */
    let previousPosition = this.findIndexById(id);
    if (previousPosition >= 0) {
      return;
    }

    let model = new this._dataType(id, null, extend({}, this._modelOptions, {
      noInitialSync: true,
      dataSnapshot: snapshot
    }));
    this.add(model, prevSiblingId, false);

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
    let id = snapshot.key;

    let previousPosition = this.findIndexById(id);
    if (previousPosition < 0) {
      /* The model doesn't exist, so we won't emit a changed event. */
      return;
    }


    let model = this._children[previousPosition];
    model._onChildValue(snapshot, prevSiblingId);
    let newPosition = this.findIndexById(prevSiblingId) + 1;

    this._moveItem(previousPosition, newPosition, model);

    this._eventEmitter.emit('child_changed', model, prevSiblingId);
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

      let id = snapshot.key;
      let previousPosition = this.findIndexById(id);
      let newPosition = this.findIndexById(prevSiblingId) + 1;
      let tempModel = this._children[previousPosition];
      this._moveItem(previousPosition, newPosition, tempModel);

      let model = this._children[newPosition];

      this._eventEmitter.emit('child_moved', model, previousPosition);
      this._eventEmitter.emit('value', this);
    }
  }

  _moveItem(previousPosition, newPosition, modelToMove) {
    this._ids[modelToMove._id] = newPosition;
    /* Update the positions of things coming inbetween */
    for (let positionAhead = previousPosition; positionAhead < newPosition; positionAhead++) {
      this._ids[this._children[positionAhead].id]--;
    }
    for (let positionBefore = newPosition; positionBefore < previousPosition; positionBefore++) {
      this._ids[this._children[positionBefore].id]++;
    }

    if (previousPosition === newPosition) {
      this._children[newPosition] = modelToMove;
    } else {
      this._children.splice(previousPosition, 1);
      this._children.splice(newPosition, 0, modelToMove);
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
    let id = oldSnapshot.key;
    let position = this.findIndexById(id);
    let model = this._children[position];

    if (position !== -1) {
      this.remove(position);
      delete this._ids[id];

      this._eventEmitter.emit('child_removed', model);
      this._eventEmitter.emit('value', this);
    }
  }

  /**
   * Updates the local properties [0]...[n] on this PrioArray instance, each of which is a getter to
   * the entry in the underlying Array cache at the same index.
   * @private
   */
  _updateReferenceProperties() {
    let wantedLength = this.length;
    let currentLength = this._referenceLength;
    let difference = wantedLength - currentLength;

    if (difference > 0) {
      for (let i = 0; i < difference; i++) {
        Object.defineProperty(this, `${currentLength + i}`, {
          get: () => this._children[currentLength + i],
          configurable: true,
          enumerable: true
        });
      }
    } else if (difference < 0) {
      for (let i = 0; i < (difference * -1); i++) {
        delete this[currentLength - 1 - i];
      }
    }

    this._referenceLength = this.length;
  }
}
