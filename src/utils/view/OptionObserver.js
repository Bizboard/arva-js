/**
 * Created by lundfall on 23/02/2017.
 */
import cloneDeepWith            from 'lodash/cloneDeepWith'
import difference               from 'lodash/difference'
import each                     from 'lodash/each'
import Timer                    from 'famous/utilities/Timer.js'
import EventEmitter             from 'eventemitter3'

import { ObjectHelper }           from '../ObjectHelper'
import { combineOptions }         from '../CombineOptions'
import { PrioritisedObject }      from '../../data/PrioritisedObject'
import { Model }                  from '../../core/Model'

let listeners = Symbol(),
  notFound = Symbol(),
  newChanges = Symbol(),
  originalValue = Symbol(),
  optionMetaData = Symbol(),
  oldValue = Symbol()

//TODO Fix some support for arrays (keep it simple, not oftenly used!)

export class OptionObserver extends EventEmitter {
  _reverseListenerTree = {}
  _numberOfUpdatesPerRenderable = {}
  _listenerTree = {}
  /* We have to keep track of the models, because they use their own getter/setter hooks and we can't use the builtin ones */
  _modelListeners = {}
  _activeRecordings = {}
  /* This contains the option difference to indicate a value change */
  _newOptionUpdates = {}
  _renderableUpdatesForNextTick = {}

  /* The max supported depth in deep-checking iterations */
  static maxSupportedDepth = 10

  /**
   *
   * @param defaultOptions
   * @param options
   * @param debugName Used for displaying error messages and being able to trace them back more easily
   */
  constructor (defaultOptions, options, debugName) {
    super()
    this._errorName = debugName
    ObjectHelper.bindAllMethods(this, this)

    //todo remove
    window.optionObservers = window.optionObservers || []
    window.optionObservers.push(this)

    this.options = options
    this.defaultOptions = defaultOptions
    this._setupOptions(options, defaultOptions)
    this._setupRecurringOptionChangeFlush()
  }

  /**
   * Records the updates that happen in options and models (intended to be called before the construction of that renderable)
   * @param renderableName
   */
  recordForRenderable (renderableName) {
    this._beginListenerTreeUpdates()
    PrioritisedObject.setPropertyGetterSpy((model, property) => {
      /* TODO handle the case where this can be undefined */
      let modelListener = this._modelListeners[model.constructor.name][model.id]
      /* Add the renderable as listening to the tree */
      let localListenerTree = this._accommodateObjectPath(modelListener.localListenerTree, [property, listeners])
      this._addToListenerTree(renderableName, modelListener.nestedPropertyPath, property, localListenerTree)
      modelListener.startListening()
    })
    let optionRecorder = this._activeRecordings[renderableName] = ({type, propertyName, nestedPropertyPath}) => {
      if (type === 'setter') {
        this._throwError('Setting an option during instanciation of renderable')
      } else {
        let localListenerTree = this._accessObjectPath(this._listenerTree, nestedPropertyPath.concat([propertyName, listeners]))
        this._addToListenerTree(renderableName, nestedPropertyPath, propertyName, localListenerTree)
      }
    }
    this._activeRecordings[renderableName] = optionRecorder
    this.on('optionTrigger', optionRecorder)
  }

  _addToListenerTree (renderableName, nestedPropertyPath, lastProperty, localListenerTree) {
    /* Renderable already added to listener tree, so no need to do that again */
    if (localListenerTree[renderableName]) {
      return
    }
    let reverseListenerTree = this._accommodateObjectPath(this._reverseListenerTree, [renderableName].concat(nestedPropertyPath, lastProperty))
    if (!reverseListenerTree[listeners]) {
      reverseListenerTree[listeners] = []
    }
    reverseListenerTree.push(localListenerTree)
    localListenerTree[renderableName] = true
  }

  _beginListenerTreeUpdates (renderableName) {
    this._listenersToRemove = [...this._reverseListenerTree[renderableName]]
  }

  /**
   * Called when a renderable shouldn't be recorded anymore
   * @param renderableName
   */
  stopRecordingForRenderable (renderableName) {
    PrioritisedObject.removePropertyGetterSpy()
    this.removeListener('optionTrigger', this._activeRecordings[renderableName])
    delete this._activeRecordings[renderableName]
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

    this._deepTraverse(this.options, (nestedPropertyPath, optionObject, existingOptionValue, key, [newOptionObject, defaultOption]) => {

      let newOptionValue = newOptionObject[key]
      if (!newOptionValue && optionObject[key] !== null) {
        if (defaultOption[key] !== newOptionValue) {
          this._markPropertyAsUpdated(nestedPropertyPath, key, newOptionObject[key], existingOptionValue)
        }
        return true
      } else if (!(newOptionValue && this._isPlainObject(newOptionValue)) && existingOptionValue !== newOptionValue) {
        /* Triggers the appriopriate events */
        this._markPropertyAsUpdated(nestedPropertyPath, key, newOptionObject[key], existingOptionValue)
      }
    }, [newOptions, this.defaultOptions])
    //TODO Comment this if-clause/see if it should be removed
    if (newOptionsAreAlsoOptions) {
      this.options = newOptions
    }

    /* Flush the updates in order to trigger the updates immediately */
    this._flushUpdates()
  }

  _setupOptions (options, defaultOptions) {
    let rootProperties = Object.keys(defaultOptions)
    this._createListenerTree()
    this._updateOptionsStructure(rootProperties, options, [], rootProperties.map((rootProperty) => undefined))
    //TODO block events so that we don't have to do a lot on startup
    this._flushUpdates()
  }

  _setupOptionLink (object, key, value, nestedPropertyPath) {
    /* Only add the getter/setter hook if there isn't one yet */
    this._addGetterSetterHook(object, key, value, nestedPropertyPath)
    //TODO there might be more optimal ways of doing this, the option will be marked 4-5 times on setup
    this._markAsOption(object)
    this._markAsOption(value)

  }

  //TODO call when appropriate
  _shallowCloneOption (optionToShallowClone) {
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
    if (info.type === 'setter') {
      let {nestedPropertyPath, propertyName, parentObject, oldValue} = info
      this._updateOptionsStructure([propertyName], parentObject, nestedPropertyPath, [oldValue])
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
    this._deepTraverse(this._newOptionUpdates, (nestedPropertyPath, updateObjectParent, updateObject, propertyName, [optionObject, defaultOptionParent, listenerTree]) => {

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

      this._deepTraverse(defaultOption, (innerNestedPropertyPath, defaultOptionParent, defaultOption, propertyName, [newValueParent, listenerTreeParent]) => {
        this._processNewOptionUpdates({
          nestedPropertyPath: outerNestedPropertyPath.concat(nestedPropertyPath),
          defaultOption,
          newValueParent: newValueParent,
          newValue: newValueParent[propertyName],
          propertyName,
          defaultOptionParent,
          listenerTree: listenerTreeParent[propertyName]
        })
      }, [optionObject[propertyName], innerListenerTree])
    }, [this.options, this.defaultOptions, this._listenerTree], true)
    this._newOptionUpdates = {}
    this._notifyRenderableUpdates()

  }

  /**
   * Marks a certain property as updated
   * @param nestedPropertyPath
   * @param property
   * @param value
   * @private
   */
  _markPropertyAsUpdated (nestedPropertyPath, property, value, oldValue) {
    let allButLastProperty = nestedPropertyPath
    let lastProperty = property
    /* Mark the object as changes in the most common path */
    let updateObject = this._accommodateObjectPathUnless(this._newOptionUpdates, allButLastProperty, (object) =>
      object[newChanges]
    )
    if (updateObject !== notFound) {
      updateObject[lastProperty] = {[newChanges]: value, [originalValue]: oldValue}
    }
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
   * @param callback
   * @param {Array} extraObjectsToTraverse A couple of extra objects that are assumed to have the same structure
   * @param onlyForLeaves
   * @param nestedPropertyPath
   * @private
   */
  _deepTraverse (object, callback, extraObjectsToTraverse = [], onlyForLeaves = false, nestedPropertyPath = [], depthCount = 0) {
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
          extraObjectsToTraverse.map((extraObjectToTraverse) => extraObjectToTraverse[key] || {}),
          onlyForLeaves,
          nestedPropertyPath.concat(key),
          depthCount + 1
        )
      }
    })
  }

  /**
   * When properties are removed from options, they are reset to the value specified
   * @param removedProperties
   * @param defaultOption
   * @param parentObject
   * @private
   */
  _resetRemovedPropertiesIfNeeded (oldValue, newValue, defulatOptionValue) {
    if (!newValue || !this._isPlainObject(newValue)) {
      return
    }
    let properties = Object.keys(newValue)
    let oldProperties = Object.keys(oldValue)

    let removedProperties = difference(oldProperties, properties)

    for (let property of removedProperties) {
      newValue[property] = defulatOptionValue[property]
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
   * @returns {*}
   * @private
   */
  _accessObjectPath (object, path) {
    for (let pathString of path) {
      object = object[pathString]
      if (!object) {
        return notFound
      }
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

  /**
   * Every tick, the changes are flushed in the options object
   * @private
   */
  _setupRecurringOptionChangeFlush () {
    Timer.every(this._flushUpdates)
  }

  _notifyRenderableUpdates () {
    for (let renderableName in this._renderableUpdatesForNextTick) {
      this.emit('needUpdate', renderableName)
    }
    this._renderableUpdatesForNextTick = {}
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

    for (let renderableName in listenerTree[listeners]) {
      this._renderableUpdatesForNextTick[renderableName] = true
    }
    let valueToLinkTo
    let linkIsPlainObject = false

    if (!newValue) {
      newValue = defaultOption
      if (this._isPlainObject(newValue)) {
        valueToLinkTo = {}
      }
    }

    if (valueToLinkTo === undefined) {
      valueToLinkTo = newValue
    }

    if (newValueParent instanceof Model && typeof defaultOptionParent === 'function') {
      return
    } else if (valueToLinkTo !== undefined) {
      this._setupOptionLink(newValueParent, propertyName, valueToLinkTo, nestedPropertyPath)

    }

    if (defaultOption === undefined) {
      this._throwError(`Assignment to undefined option`)
    }
    if (typeof defaultOption === 'function' && (defaultOption.prototype instanceof Model || defaultOption === Model)) {
      if (!newValue || !(newValue instanceof defaultOption)) {
        this._throwError(`Failed to specify required model: ${propertyName} (${nestedPropertyPath.join('->')})`)
      }
    }

    if (newValue[optionMetaData] && newValue[optionMetaData].owners.includes(this)) {
      /* Shallow clone at this level, which will become a deep clone when we're finished traversing */
      newValue = this._shallowCloneOption(newValue)
    }

    if (newValue instanceof Model) {
      this._handleNewModelUpdate(nestedPropertyPath, newValue, listenerTree, propertyName)
    }

    //TODO clean up code
    for (let property of Object.keys(defaultOptionParent)
      .filter((property) => this._isPlainObject(defaultOptionParent[property]) && !newValueParent[property])
      ) { newValueParent[property] = {} }

    return newValue
  }

  _handleNewModelUpdate (nestedPropertyPath, newValue, listenerTree, key) {
    //TODO This implementation is a bit naive, won't work always
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
    let valuesToAddListenersTo = []
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
    let isPlainObject = this._isPlainObject(value)
    if (value[listeners] && !Object.keys(value).length) {
      return value
    }
    if (isPlainObject) {
      if (!value[listeners]) {
        let newValue = cloneDeepWith({...value, [listeners]: {}}, this._listenerTreeCloner)
        return newValue
      }
    } else {
      return {[listeners]: {}}
    }
  }

}


