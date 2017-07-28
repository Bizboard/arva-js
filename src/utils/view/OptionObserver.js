/**
 * Created by lundfall on 23/02/2017.
 */
import cloneDeepWith            from 'lodash/cloneDeepWith'
import difference               from 'lodash/difference'
import each                     from 'lodash/each'
import Timer                    from 'famous/utilities/Timer.js'
import EventEmitter             from 'eventemitter3'

import { ArrayObserver }          from './ArrayObserver.js'
import { ObjectHelper }           from '../ObjectHelper'
import { combineOptions }         from '../CombineOptions'
import { PrioritisedObject }      from '../../data/PrioritisedObject'
import { Model }                  from '../../core/Model'
import { layout }                 from '../../layout/Decorators'
import { PrioritisedArray } from '../../data/PrioritisedArray'

let listeners = Symbol('listeners'),
  notFound = Symbol('notFound'),
  newChanges = Symbol('newChanges'),
  originalValue = Symbol('originalValue'),
  optionMetaData = Symbol('optionMetaData'),
  oldValue = Symbol('oldValue'),
  instanceIdentifier = Symbol('instanceIdentifier')

export let onOptionChange = Symbol('onOptionChange')


export class OptionObserver extends EventEmitter {
  _reverseListenerTree = {}
  _newReverseListenerTree = {}
  _listenerTreeMetaData = {}
  _listenerTree = {}
  /* We have to keep track of the models, because they use their own getter/setter hooks and we can't use the builtin ones */
  _modelListeners = {}
  _activeRecordings = {}
  /* This contains the option difference to indicate a value change */
  _newOptionUpdates = {}
  _updatesForNextTick = {}
  _forbiddenUpdatesForNextTick = {}
  _listeningToSetters = true
  _arrayObservers = []

  /* The max supported depth in deep-checking iterations */
  static maxSupportedDepth = 10
  /* Used for preprocessing of options, which is a special type of update */
  static preprocess = Symbol('preprocess')

  /**
   *
   * @param defaultOptions
   * @param options
   * @param preprocessBindings
   * @param debugName Used for displaying error messages and being able to trace them back more easily
   */
  constructor (defaultOptions, options, preprocessBindings, debugName) {
    super()
    this._errorName = debugName
    ObjectHelper.bindAllMethods(this, this)
    this._preprocessBindings = preprocessBindings
    OptionObserver._registerNewInstance(this)
    this.defaultOptions = defaultOptions
    this.options = options
    this._setupOptions(options, defaultOptions)
    if (!window.optionObservers) {
      window.optionObservers = []
    }
    window.optionObservers.push(this)

  }

  /**
   * Records the updates that happen in options and models (intended to be called before the construction of that renderable)
   * @param renderableName
   */
  recordForRenderable (renderableName, callback) {
    this._recordForEntry(renderableName, false)
    callback()
    this._stopRecordingForEntry(renderableName)
  }

  _recordForPreprocessing (callback) {
    this._recordForEntry(OptionObserver.preprocess, true)
    callback()
    this._stopRecordingForEntry(OptionObserver.preprocess)
  }

  /**
   * Records for a specific entry
   * @param {String} entryName
   * @param {Boolean} allowSetters
   * @private
   */
  _recordForEntry (entryName, allowSetters) {
    this._activeRecordings[entryName] = {}
    this._beginListenerTreeUpdates(entryName)
    this._listenForModelUpdates(entryName)
    let optionRecorder = this._activeRecordings[entryName].optionRecorder = ({type, propertyName, nestedPropertyPath}) => {
      if (type === 'setter') {
        if (allowSetters) {
          /* Be sure to avoid infinite loops if there are setters that trigger getters that are matched to this
           *  recording */
          this._preventEntryFromBeingUpdated(entryName)
        } else {
          this._throwError('Setting an option during instanciation of renderable')
        }
      } else {
        let localListenerTree = this._accessListener(nestedPropertyPath.concat(propertyName))
        this._addToListenerTree(entryName, localListenerTree)
      }
    }
    this.on('optionTrigger', optionRecorder)
  }

  _accessListener (nestedPropertyPath) {
    return this._accessObjectPath(this._listenerTree, nestedPropertyPath, true)
  }

  _addToListenerTree (renderableName, localListenerTree) {

    let listenerStructure = Array.isArray(localListenerTree) ? localListenerTree[0][listeners] : localListenerTree[listeners]

    /* Renderable already added to listener tree, so no need to do that again */
    let {listenersCanChange, listenersChanged, matchingListenerIndex} = this._listenerTreeMetaData[renderableName]

    this._newReverseListenerTree[renderableName].push(listenerStructure)

    if (listenersCanChange && !listenersChanged) {
      /* We optimize the most common use case, which is that no listeners change.
       *  In that case, the order of listeners will be the same, otherwise we need to accommodate*/

      if (this._reverseListenerTree[renderableName][matchingListenerIndex] !== listenerStructure) {
        this._listenerTreeMetaData[renderableName].listenersChanged = true
      }

      this._listenerTreeMetaData[renderableName].matchingListenerIndex++
    }

    if (listenerStructure[renderableName]) {
      return
    }

    listenerStructure[renderableName] = true

  }

  /**
   * Executes the preprocess function. The preprocess function is treated similarly to that of a renderable,
   * but it's identified with the symbol OptionObserver.preprocess instead of a string
   *
   * Different examples of preprocessing situations:
   * Scenario 1: Construction
   * A. The preprocessing function is called
   * B. Getters are detected for the pre-process function
   * C. this.options isn't set, so nothing more happens
   *
   * Scenario 2. Setter trigger of a preprocess function
   * A. After flushing, it is concluded to belong to the preprocess function (and other renderables)
   * B. The preprocess function is triggered immediately and firstly when flushing change events
   * C. The preprocess function re-executes the function and getters are triggered again
   * D. this.options is defined, and it setters will be notified.
   * E. An inner flush is forced within the flush, and it there might be new renderables needing update now
   * F. The flush completes and resets the _updatesForNextTick
   * G. The outer flush continues, and has nothing more to do
   * H. Since we made changes within a flush, the static OptionObserver loop _flushAllUpdates, will call the flush function once again, but doing nothing
   *
   * Scenario 3. Recombine options
   * A. After flushing, it is concluded that the option changes belong to the preprocess function (and other renderables)
   * B. Continues same as scenario 2.
   *
   * @private
   */
  _doPreprocessing (incomingOptions) {
    if (!this._preprocessBindings) {
      return
    }

    this._deepTraverse(this.defaultOptions, (nestedPropertyPath, defaultOptionParent, defaultOption, propertyName, [incomingOptionParent]) => {
      let incomingOption = incomingOptionParent[propertyName];
      let propertyDescriptor = Object.getOwnPropertyDescriptor(incomingOptionParent, propertyName);
      if(this._isMyOption(incomingOption) &&
        propertyDescriptor.get &&
        propertyDescriptor.get() === incomingOption
      ) {
        return true;
      }
      this._setupOptionLink(incomingOptionParent, propertyName, incomingOption, nestedPropertyPath)
      /* Unspecified option, bailing out */
      if (!incomingOptions[propertyName]) {
        return true
      }
    }, [incomingOptions])
    this._recordForPreprocessing(() =>
      this._preprocessBindings(incomingOptions, this.defaultOptions))
    /* Prevent the preprocess from being triggered within the next flush. This is important
     * to do in case the preprocess function sets variables that it also gets, (ie if(!options.color) options.color = 'red')
     */
    this._forbiddenUpdatesForNextTick[OptionObserver.preprocess] = true
  }

  _endListenerTreeUpdates (renderableName) {
    if (this._listenerTreeMetaData[renderableName].listenersChanged) {
      let oldListeners = this._reverseListenerTree[renderableName]
      /* Remove the old listeners and add the new ones again. In this way, we get O(n + m) complexity
       *  instead of O(m*n) */
      for (let listenerTree of oldListeners) {
        delete listenerTree[renderableName]
      }
      let newListeners = this._newReverseListenerTree[renderableName]

      for (let listenerTree of newListeners) {
        listenerTree[renderableName] = true
      }

    }
    this._reverseListenerTree[renderableName] = this._newReverseListenerTree[renderableName]
    delete this._newReverseListenerTree[renderableName]
  }

  _beginListenerTreeUpdates (renderableName) {
    /* The listener meta data sets a counter in order to match the new listeners in comparison to the old listeners*/
    let numberOfExistingListenerPaths = this._accessObjectPath(this._reverseListenerTree, [renderableName, length])
    if (numberOfExistingListenerPaths === notFound) {
      numberOfExistingListenerPaths = 0
    }
    this._listenerTreeMetaData[renderableName] = {
      matchingListenerIndex: 0,
      listenersCanChange: !!numberOfExistingListenerPaths,
      listenersChanged: false
    }
    this._newReverseListenerTree[renderableName] = []

  }

  /**
   * Called when a renderable shouldn't be recorded anymore
   * @param entryName
   */
  _stopRecordingForEntry (entryName) {
    this._endListenerTreeUpdates(entryName)
    PrioritisedObject.removePropertyGetterSpy()
    this.removeListener('optionTrigger', this._activeRecordings[entryName].optionRecorder)
    this.removeListener('mapCalled', this._activeRecordings[entryName].arrayRecorder)
    delete this._activeRecordings[entryName]
  }

  /**
   * Returns the options that are being observed
   * @returns {*}
   */
  getOptions () {
    return this.options
  }

  /**
   * Should be called when the renderable isn't relevant anymore
   * @param {String} renderableName
   */
  deleteRecordingForRenderable (renderableName) {
    //todo implement this (is an efficient way)
  }

  /**
   * Updates the options from an external reason
   * @param newOptions
   */
  recombineOptions (newOptions) {
    let newOptionsAreAlsoOptions = !!newOptions[optionMetaData]
    if (newOptionsAreAlsoOptions) {
      if(newOptions === this.options){
        return;
      }
      this.options = newOptions
      this._markAllOptionsAsUpdated()
      return;
    }
    this._deepTraverse(this.options, (nestedPropertyPath, optionObject, existingOptionValue, key, [newOptionObject, defaultOption]) => {
      //todo confirm whether this check is appropriate (I don't think it is)
      let newOptionValue = newOptionObject[key]
      if (!newOptionValue && optionObject[key] !== null) {
        let defaultOptionValue = defaultOption[key]
        if (defaultOptionValue !== newOptionValue && (defaultOptionValue !== existingOptionValue &&
          /* If new value is undefined, and the previous one was already the default, then don't update (will go false)*/
          !this._isPlainObject(existingOptionValue) && existingOptionValue[optionMetaData].isDefault)
        ) {
          this._markPropertyAsUpdated(nestedPropertyPath, key, newOptionObject[key], existingOptionValue)
        }
        /* Cancel traversion in this direction */
        return true
      } else if (!(newOptionValue && this._isPlainObject(newOptionValue)) && existingOptionValue !== newOptionValue) {
        /* Triggers the appriopriate events */
        this._markPropertyAsUpdated(nestedPropertyPath, key, newOptionObject[key], existingOptionValue)
      }
    }, [newOptions, this.defaultOptions])
    this._copyImportantSymbols(newOptions, this.options);

    /* Flush the updates in order to trigger the updates immediately */
    this._flushUpdates()
  }

  _setupOptions (options, defaultOptions) {

    this._createListenerTree()
    this._doPreprocessing(options)
    this._markAllOptionsAsUpdated();
  }

  _markAllOptionsAsUpdated() {
    let rootProperties = Object.keys(this.defaultOptions)
    this._updateOptionsStructure(rootProperties, this.options, [], rootProperties.map((rootProperty) => undefined))
    this._flushUpdates()
  }

  _setupOptionLink (object, key, newValue, nestedPropertyPath) {

    if (this._isMyOption(newValue)) {
      /* Shallow clone at this level, which will become a deep clone when we're finished traversing */
      newValue = this._shallowCloneOption(newValue)
    }

    /* Only add the getter/setter hook if there isn't one yet */
    this._addGetterSetterHook(object, key, newValue, nestedPropertyPath)
    //TODO there might be more optimal ways of doing this, the option will be marked 4-5 times on setup
    this._markAsOption(object)
    this._markAsOption(newValue)
    return newValue
  }

  _isMyOption(value) {
    return this._isPlainObject(value) && value[optionMetaData] && value[optionMetaData].owners.includes(this);
  }

  _shallowCloneOption (optionToShallowClone) {
    if (!this._isPlainObject(optionToShallowClone)) {
      return optionToShallowClone
    }
    let result = {}
    Object.defineProperties(result, Object.getOwnPropertyDescriptors(optionToShallowClone))
    return result
  }

  /**
   * Adds a getter/setter hook to a certain object for a key with a value, where object[key]===value.
   * @param object
   * @param key
   * @param value
   * @param {Array} nestedPropertyPath
   * @private
   */
  _addGetterSetterHook (object, key, value, nestedPropertyPath) {
    ObjectHelper.addGetSetPropertyWithShadow(object, key, value, true, true,
      (info) =>
        this._onEventTriggered({...info, type: 'setter', parentObject: object, nestedPropertyPath})
      , (info) =>
        this._onEventTriggered({...info, type: 'getter', parentObject: object, nestedPropertyPath}))
      /* The last argument makes the previous triggers, whatever they might have been, execute afterwards */
    ,true
  }

  /**
   * Called when a model is changed
   * @param model
   * @param {Array} changedProperties
   * @param {String} modelKeyInParent The key of the parent object
   * @param {Array} nestedPropertyPath
   * @private
   */
  _onModelChanged (model, changedProperties, modelKeyInParent, nestedPropertyPath) {
    this._updateOptionsStructure(changedProperties, model, nestedPropertyPath.concat(modelKeyInParent))
  }

  /**
   * Happens when an event is triggered (getter/setter)
   * @param {Object} info ({ nestedPropertyPath, propertyName, parentObject })
   * @private
   */
  _onEventTriggered (info) {
    this.emit('optionTrigger', info)
    if (info.type === 'setter' && this._listeningToSetters) {
      let {nestedPropertyPath, propertyName, parentObject, oldValue} = info
      /* If reassignment to exactly the same thing, then don't do any update */
      if (oldValue !== parentObject[propertyName]) {
        this._updateOptionsStructure([propertyName], parentObject, nestedPropertyPath, [oldValue])
      }
    }
  }

  /**
   * Deep updates the options based on parameter
   * @param changedProperties
   * @param parentObject
   * @param nestedPropertyPath
   * @param oldValues
   * @private
   */
  _updateOptionsStructure (changedProperties, parentObject, nestedPropertyPath, oldValues = []) {
    for (let [index, property] of changedProperties.entries()) {
      this._markPropertyAsUpdated(nestedPropertyPath, property, parentObject[property], oldValues[index])
    }
  }

  _flushUpdates () {
    /* Do a traverse only for the leafs of the new updates, to avoid doing extra work */
    if (this._updatesForNextTick[OptionObserver.preprocess]) {
      this._doPreprocessing(this.options)
    }
    this._deepTraverseWithShallowArrays(this._newOptionUpdates, (nestedPropertyPath, updateObjectParent, updateObject, propertyName, [defaultOptionParent, listenerTree, optionObject]) => {

        let newValue = updateObject[newChanges],
          oldValue = updateObject[originalValue]
        let defaultOption = defaultOptionParent[propertyName]
        let innerListenerTree = listenerTree[propertyName]

        if (this._isPlainObject(defaultOptionParent)) {
          this._processImmediateOptionReassignment({
            newValue, oldValue, defaultOption
          })
        }

        this._processNewOptionUpdates({
          defaultOptionParent: defaultOptionParent,
          nestedPropertyPath,
          defaultOption,
          newValueParent: optionObject,
          newValue,
          propertyName,
          listenerTree: innerListenerTree
        })

        /* If the parent is a model or function, then no need to continue */
        if (!this._isPlainObject(defaultOption)) {
          return
        }

        let outerNestedPropertyPath = nestedPropertyPath.concat(propertyName)

        this._deepTraverseWithShallowArrays(defaultOption, (innerNestedPropertyPath, defaultOptionParent, defaultOption, propertyName, [listenerTreeParent, newValueParent]) => {
          this._processNewOptionUpdates({
            nestedPropertyPath: outerNestedPropertyPath.concat(innerNestedPropertyPath),
            defaultOption,
            newValueParent,
            newValue: newValueParent[propertyName],
            propertyName,
            defaultOptionParent,
            listenerTree: listenerTreeParent[propertyName]
          })
        }, [innerListenerTree, optionObject[propertyName]], [true, false])
      }, [this.defaultOptions, this._listenerTree, this.options],
      [true, true, false],
      true
    )
    this._flushArrayObserverChanges()
    this._handleResultingUpdates()
    this._newOptionUpdates = {}
  }

  /**
   * Marks a certain property as updated
   * @param nestedPropertyPath
   * @param propertyName
   * @param value
   * @private
   */
  _markPropertyAsUpdated (nestedPropertyPath, propertyName, value, oldValue) {
    OptionObserver._markInstanceAsDirty(this)
    /* Mark the object as changes in the most common path */
    let updateObject = this._accommodateObjectPathUnless(this._newOptionUpdates, nestedPropertyPath, (object) =>
      object[newChanges]
    )
    /* We rest upon the assumption that no function can access a nested path (options.nested.myString)
     * without also accessing intermediary properties (options.nested getter is triggered). If this isn't
     * true for some reason, updates will be missed */
    if (updateObject !== notFound) {
      let fullNestedPropertyPath = nestedPropertyPath.concat([propertyName]);
      let localListenerTree = this._accessListener(fullNestedPropertyPath)
      if(!(localListenerTree[listeners] || localListenerTree[0])){
        this._throwError(`Assignment to undefined option ${fullNestedPropertyPath.join('->')}`);
      }
      let localListeners = localListenerTree[listeners] || localListenerTree[0][listeners];
      for (let entryName of this._getUpdatesEntriesForLocalListenerTree(localListeners)) {
        this._updatesForNextTick[entryName] = true
      }
      updateObject[propertyName] = {
        [newChanges]: value,
        [originalValue]: oldValue
      }
    }
  }

  /**
   * Traverses an object with shallow arrays. Thin wrapper around deepTraverse
   *
   * @param object
   * @param callback with arguments (nestedPropertyPath, object, value, key, {Array} extraObjectsToTraverse)
   * @param {Array} extraObjectsToTraverse A couple of extra objects that are assumed to have the same structure
   * @param {Array} isShallowObjects An array with the same length as extraObjectsToTraverse, with booleans indicating whether
   * the objects are shallow (for example, the default options specified for arrays)
   * @param {Boolean} onlyForLeaves
   * @param {Array} nestedPropertyPath Used to keep track of the current nestedPropertyPath
   * @param {Number} depthCount Internally used depth count to prevent infinite (or too nested) recursion
   * @private
   */
  _deepTraverseWithShallowArrays (object,
                                  callback,
                                  extraObjectsToTraverse = [],
                                  isShallowObjects = [],
                                  onlyForLeaves = false,
                                  nestedPropertyPath = [],
                                  depthCount = 0) {
    return this._deepTraverse(
      object,
      callback,
      extraObjectsToTraverse,
      (suggestedTraversals, key, parents) =>
        Array.isArray(parents[0]) ? isShallowObjects.map((isShallowObject, index) => isShallowObject ? parents[index][0] : suggestedTraversals[index])
          : suggestedTraversals,
      onlyForLeaves,
      nestedPropertyPath,
      depthCount
    )
  }

  _getUpdatesEntriesForLocalListenerTree (localListenerTree) {
    return Object.keys(localListenerTree)
      .concat(localListenerTree[OptionObserver.preprocess] ? OptionObserver.preprocess : []).filter((entryName) =>
        !this._forbiddenUpdatesForNextTick[entryName]
      )
  }

  /**
   * Mark an object as being part of an option
   * @param objectInOptionStructure
   * @private
   */
  _markAsOption (objectInOptionStructure) {
    if (!this._isPlainObject(objectInOptionStructure)) {
      return
    }
    //TODO This might be able to be optimized
    let originalOwners = (objectInOptionStructure[optionMetaData] && objectInOptionStructure[optionMetaData].owners) || []
    if (!originalOwners.includes(this)) {
      objectInOptionStructure[optionMetaData] = {
        owners: originalOwners.concat(this)
      }
    }

  }

  _throwError (message) {
    throw new Error(`${this._errorName}: ${message}`)
  }

  /**
   * Sets up a model that will be synchronized to update the options object whenever something is updated, after startListener() is called
   *
   * @param nestedPropertyPath
   * @param model
   * @param localListenerTree
   * @private
   */
  _setupModel (nestedPropertyPath, model, localListenerTree, property) {

    //TODO This won't work if the id can be set to something else, so verify that this shouldn't be possible
    /* We assume that the constructor name is unique */
    let onModelChanged = (model, changedProperties) =>
      this._onModelChanged(model, changedProperties, property, nestedPropertyPath)
    let isListening = false
    return this._accommodateObjectPath(this._modelListeners, [model.constructor.name])[model.id] = {
      startListening: () => {
        if (!isListening) {
          model.on('changed', onModelChanged)
          isListening = true
        }
      },
      stopListening: () => {
        if (isListening) {
          model.removeListener('changed', onModelChanged)
          isListening = false
        }
      },
      localListenerTree,
      nestedPropertyPath: nestedPropertyPath.concat(property),
      isListening: () => isListening
    }
  }

  _isPlainObject (object) {
    return typeof object === 'object' && object.constructor.name === 'Object'
  }

  /**
   * Deep traverses an object
   * @param object
   * @param callback with arguments (nestedPropertyPath, object, value, key, {Array} extraObjectsToTraverse)
   * @param {Array} extraObjectsToTraverse A couple of extra objects that are assumed to have the same structure
   * @param {Function} extraObjectProcessor Function to do extra work for the extra objects to process
   * @param {Boolean} onlyForLeaves
   * @param {Array} nestedPropertyPath Used to keep track of the current nestedPropertyPath
   * @param {Number} depthCount Internally used depth count to prevent infinite (or too nested) recursion
   * @private
   */
  _deepTraverse (object,
                 callback,
                 extraObjectsToTraverse = [],
                 extraObjectProcessor = (item) => item,
                 onlyForLeaves = false,
                 nestedPropertyPath = [],
                 depthCount = 0) {
    if (!this._isPlainObject(object)) {
      return
    }
    if (depthCount > OptionObserver.maxSupportedDepth) {
      this._throwError(`Encountered circular structure or an exceeded maximum depth of ${OptionObserver.maxSupportedDepth} exceeded`)
    }
    each(object, (value, key) => {

      let valueIsPlainObject = value && typeof value === 'object' && value.constructor.name === 'Object'
      let valueIsLeaf = valueIsPlainObject && Object.keys(value).length === 0
      if (!onlyForLeaves || valueIsLeaf) {
        /* If the callback returns true, then cancel traversion */
        if (callback(nestedPropertyPath, object, value, key, extraObjectsToTraverse)) {
          return //canceled traverse
        }
      }
      if (valueIsPlainObject) {
        this._deepTraverse(
          value,
          callback,
          extraObjectProcessor(extraObjectsToTraverse.map(
            (extraObjectToTraverse) => extraObjectToTraverse[key] || {}
          ), key, extraObjectsToTraverse),
          extraObjectProcessor,
          onlyForLeaves,
          nestedPropertyPath.concat(key),
          depthCount + 1
        )
      }
    })
  }

  /**
   * When properties are removed from options, they are reset to the value specified
   * @private
   * @param newValue
   * @param oldValue
   * @param defaultOptionValue
   */
  _resetRemovedPropertiesIfNeeded (newValue, oldValue, defaultOptionValue) {
    if (!oldValue || !this._isPlainObject(oldValue) || !defaultOptionValue) {
      return
    }
    let properties = Object.keys(newValue)
    let oldProperties = Object.keys(oldValue)

    let removedProperties = difference(oldProperties, properties)

    for (let property of removedProperties) {
      newValue[property] = defaultOptionValue[property]
    }
  }

  /**
   * Compares something to see if it's predictibly equal
   * @param firstThing
   * @param secondThing
   * @returns {boolean}
   * @private
   */
  _isPredictablyEqual (firstThing, secondThing) {
    /* Object comparison is not reliable */
    if (this._isPlainObject(firstThing)) {
      return false
    }
    return firstThing === secondThing
  }

  /**
   * Stops when any path is found with certain criteria
   * @param object
   * @param path
   * @returns {*}
   * @private
   */
  _accommodateObjectPathUnless (object, path, criteriaCallback) {
    for (let property of path) {
      if (object[property] && criteriaCallback(object[property])) {
        return notFound
      }
      object[property] = {}
      object = object[property]
    }
    return object
  }

  /**
   * Accommodates a path in an object
   * @param object
   * @param {Array<String>} path
   * @returns {*}
   * @private
   */
  _accommodateObjectPath (object, path) {
    for (let property of path) {
      if (!object[property]) {
        object[property] = {}
      }
      object = object[property]
    }
    if (!object) {
      object = {}
    }
    return object
  }

  /**
   * Similar to _.get, except that it returns notFound (a symbol) when not found
   * @param object
   * @param path
   * @param allowShallowArrays
   * @returns {*}
   * @private
   */
  _accessObjectPath (object, path, allowShallowArrays = false) {
    for (let pathString of path) {
      if (!object || !object.hasOwnProperty(pathString)) {
        if (allowShallowArrays && Array.isArray(object)) {
          pathString = 0
        } else {
          return notFound
        }
      }
      object = object[pathString]
    }
    return object
  }

  _iterateInObjectPath (object, path, callback) {
    for (let pathString of path) {
      let objectToPassToCallback = notFound
      if (object.hasOwnProperty(pathString)) {
        object = object[pathString]
        objectToPassToCallback = object
      }
      callback(objectToPassToCallback)
    }
    return object
  }

  /**
   * Deep traverses the entire options structure
   * @param callback
   * @returns {*}
   * @private
   */
  _deepTraverseOptions (callback) {
    return this._deepTraverse(this.options, callback)
  }

  _handleResultingUpdates () {
    if (this._updatesForNextTick[OptionObserver.preprocess]) {
      delete this._updatesForNextTick[OptionObserver.preprocess]
      /* TODO extract the incomingOption by checking this._newOptionUpdates */
      /*this._doPreprocessing()*/
    }
    for (let renderableName in this._updatesForNextTick) {
      this.emit('needUpdate', renderableName)
    }
    this._updatesForNextTick = {}
    this._forbiddenUpdatesForNextTick = {}
  }

  /**
   *
   * @param newValue
   * @param oldValue
   * @param defaultOptionValue
   * @private
   */
  _processImmediateOptionReassignment ({newValue, oldValue, defaultOptionValue}) {
    //This is kept a stub if there's more stuff needed to be added here. TODO Refactor function if not
    this._resetRemovedPropertiesIfNeeded(newValue, oldValue, defaultOptionValue)
  }

  /**
   * The most important function of the class. It traverses an ontouched level in the hierarchy of options
   * and acts accordingly
   *
   * @param nestedPropertyPath
   * @param defaultOption
   * @param newValue
   * @param propertyName
   * @param newValueParent
   * @param listenerTree
   * @param defaultOptionParent
   * @returns {*}
   * @private
   */
  _processNewOptionUpdates ({nestedPropertyPath, defaultOption, newValue, propertyName, newValueParent, listenerTree, defaultOptionParent}) {

    let valueIsModelProperty = newValueParent instanceof Model && typeof defaultOptionParent === 'function'

    if (!valueIsModelProperty && !defaultOptionParent.hasOwnProperty(propertyName)) {
      if (Array.isArray(defaultOptionParent)) {
        defaultOption = defaultOptionParent[0]
      } else {
        this._throwError(`Assignment to undefined option: ${nestedPropertyPath.concat(propertyName).join('->')}`)
      }
    }

    if (typeof defaultOption === 'function' &&
      ( (defaultOption.prototype instanceof Model || defaultOption === Model) ||
        (defaultOption.prototype instanceof PrioritisedArray || defaultOption === PrioritisedArray)
      )
    ) {
      if (!newValue || !(newValue instanceof defaultOption)) {
        this._throwError(`Failed to specify required: ${nestedPropertyPath.concat(propertyName).join('->')}.
          ${newValue} is not of type ${defaultOption.name}!`);
      }
    }

    let onChangeFunction = this._accessObjectPath(newValueParent, [onOptionChange, propertyName])

    if (onChangeFunction !== notFound) {
      onChangeFunction(newValue)
    }

    if (valueIsModelProperty) {
      return
    }

    let valueToLinkTo

    if (newValue === undefined) {
      newValue = defaultOption
      if (this._isPlainObject(newValue)) {
        valueToLinkTo = {}
        this._markAsOption(valueToLinkTo)
        valueToLinkTo[optionMetaData].isDefault = true
      }
    }

    if (valueToLinkTo === undefined) {
      valueToLinkTo = newValue
    }

    if (valueToLinkTo !== undefined) {
      this._setupOptionLink(newValueParent, propertyName, valueToLinkTo, nestedPropertyPath)
    }

    //TODO clean up code if needed (why is it even needed?)
    for (let property of Object.keys(defaultOptionParent)
      .filter((property) => this._isPlainObject(defaultOptionParent[property]) && newValueParent[property] === undefined)
      ) { newValueParent[property] = {} }

    if (newValue instanceof Model) {
      this._handleNewModelUpdate(nestedPropertyPath, newValue, listenerTree, propertyName)
    }

    if (Array.isArray(newValue)) {
      this._setupArray(nestedPropertyPath, newValue, listenerTree, propertyName, defaultOption)
    }

    return newValue
  }

  /**
   *
   * @param nestedPropertyPath
   * @param newValue
   * @param listenerTree
   * @param key
   * @param defaultOptionParent
   * @private
   */
  _setupArray (nestedPropertyPath, newValue, listenerTree, outerPropertyName, defaultOption) {
    if (ArrayObserver.isArrayObserved(newValue)) {
      //TODO Confirm that this is wished for
      return
    }
    let arrayObserver = new ArrayObserver(newValue, (index, value) => {
      /* Continue traversing down the array */
      this._deepTraverse(defaultOption[0], (innerNestedPropertyPath, defaultOptionParent, defaultOption, propertyName, [newValueParent, listenerTreeParent]) => {
        this._processNewOptionUpdates({
          nestedPropertyPath: nestedPropertyPath.concat(outerPropertyName, index, innerNestedPropertyPath),
          newValue: newValueParent[propertyName],
          propertyName,
          defaultOption,
          defaultOptionParent,
          listenerTree: listenerTreeParent[propertyName],
          newValueParent
        })
      }, [value, listenerTree[0]])
    })
    //TODO utilize optimizations from partial updates (probably by implementing special events for this, aside from 'needUpdate')
    arrayObserver.on('mapCalled',
      (originalMapFunction, passedMapper) =>
        this.emit('mapCalled', {nestedPropertyPath, listenerTree, originalMapFunction, passedMapper})
    )
    let onArrayChanged = ({index, newValue, oldValue}) => {
      this._markPropertyAsUpdated(nestedPropertyPath.concat(outerPropertyName), index, newValue, oldValue)
    }
    arrayObserver.on('replaced', onArrayChanged)
    arrayObserver.on('added', onArrayChanged)
    arrayObserver.on('removed', onArrayChanged)
    this._arrayObservers.push(arrayObserver)

  }

  _handleNewModelUpdate (nestedPropertyPath, newValue, listenerTree, key) {
    //TODO This implementation is a bit naive, won't work always (or in second thought, won't it?)
    let oldListenerStructureBase = this._accessObjectPath(this._modelListeners, [oldValue.constructor.name])

    if (oldListenerStructureBase === notFound || !oldListenerStructureBase[oldValue.id]) {
      return this._setupModel(nestedPropertyPath, newValue, listenerTree, key).startListening()
    }

    let oldListenerStructure = oldListenerStructureBase[oldValue.id]

    if (oldListenerStructure.isListening()) {
      oldListenerStructure.stopListening()
      delete oldListenerStructureBase[oldValue.id]
      this._setupModel(nestedPropertyPath, newValue, listenerTree, key).startListening()
    }
  }

  _createListenerTree () {
    this._listenerTree = cloneDeepWith(this.defaultOptions, this._listenerTreeCloner) || {[listeners]: {}}
  }

  /**
   * Creates the listener tree
   * We are interested in a tree that is a copy of the defaultOptions and with a symbol [listeners] set to {} everywhere applicable
   * @param value
   * @returns {*}
   * @private
   */
  _listenerTreeCloner (value, propertyName) {
    if (propertyName === listeners) {
      return value
    }
    let isPlainObject = this._isPlainObject(value), isArray = Array.isArray(value)
    /* If the object already has the listeners set*/
    if (typeof value === 'object' && value[listeners] && !Object.keys(value).length) {
      return value
    }
    if (isPlainObject || isArray) {

      let listenersIfExists = isArray ? (value[0] && value[0][listeners]) : value[listeners]
      if (!listenersIfExists) {
        let valueToClone = {...value, [listeners]: {}}
        if (isArray) {
          valueToClone = [{...value[0], [listeners]: {}}]
        }
        let newValue = cloneDeepWith(valueToClone, this._listenerTreeCloner)
        return newValue
      }
    } else {
      return {[listeners]: {}}
    }
  }

  static _instances = []
  static _dirtyInstances = {}

  static _tickCount = 0

  /**
   * Every tick, the changes are flushed in the options object. The _isFlushingUpdates flag gives an indication whether
   * the flushings are in progress or not
   *
   * @private
   */
  static _flushAllUpdates () {
    this._isFlushingUpdates = true
    OptionObserver._tickCount++
    /* Reset dirty instances, because we are going to traverse all instances anyways */
    OptionObserver._dirtyInstances = {}
    for (let optionObserver of OptionObserver._instances) {
      optionObserver._flushUpdates()
    }
    /* Flush dirty instances until there are no more dirty instances left */
    while (Object.keys(OptionObserver._dirtyInstances).length) {
      let dirtyInstances = {...OptionObserver._dirtyInstances}
      OptionObserver._dirtyInstances = {}
      for (let optionObserverID in dirtyInstances) {
        dirtyInstances[optionObserverID]._flushUpdates()
      }
    }
    this._isFlushingUpdates = false
  }

  static _registerNewInstance (newInstance) {
    this._instances.push(newInstance)
    newInstance[instanceIdentifier] = this._instances.length
  }

  static _markInstanceAsDirty (dirtyInstance) {
    OptionObserver._dirtyInstances[dirtyInstance[instanceIdentifier]] = dirtyInstance
  }

  _preventEntryFromBeingUpdated (entryName) {
    this._forbiddenUpdatesForNextTick[entryName] = true
  }

  _flushArrayObserverChanges () {
    for (let arrayObserver of this._arrayObservers) {
      arrayObserver.rebuild()
    }
  }

  _listenForModelUpdates (entryName) {
    PrioritisedObject.setPropertyGetterSpy((model, propertyName) => {
      /* TODO handle the case where this can be undefined */
      let modelListener = this._modelListeners[model.constructor.name][model.id]
      /* Add the renderable as listening to the tree */
      let localListenerTree = this._accommodateObjectPath(modelListener.localListenerTree,
        [propertyName])
      localListenerTree[listeners] = localListenerTree[listeners] || {}
      this._addToListenerTree(entryName, localListenerTree)
      modelListener.startListening()
    })
  }

  /**
   * Copies symbols that aren't enumerable and/or defined (so they won't be copied in the process of flushing updates)
   *
   * @param copyFrom
   * @param copyTo
   * @private
   */
  _copyImportantSymbols (copyFrom, copyTo) {
    copyTo[layout.extra] = copyFrom[layout.extra];
  }
}

Timer.every(OptionObserver._flushAllUpdates)