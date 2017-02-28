/**
 * Created by lundfall on 23/02/2017.
 */
import each                     from 'lodash/each';
import Timer                    from 'famous/utilities/Timer.js';
import EventEmitter             from 'eventemitter3';

import {ObjectHelper}           from '../ObjectHelper';
import {combineOptions}         from '../CombineOptions';
import {PrioritisedObject}      from '../../data/PrioritisedObject';
import {Model}                  from '../../core/Model';

let listeners = Symbol();
let notFound = Symbol();
let changes = Symbol();

export class OptionObserver extends EventEmitter {
    _modelBindings = {};
    _listenerTree = {};
    /* We have to keep track of the models, because they use their own getter/setter hooks and we can't use the builtin ones */
    _modelListeners = {};
    _activeRecordings = {};
    /* This contains the option difference to indicate a value change */
    _newOptionUpdates = {};
    _renderableUpdatesForNextTick = {};

    constructor(defaultOptions, options) {
        super();
        this.options = combineOptions(defaultOptions, options);
        this._setupOptions(options);
        this._setupRecurringOptionChangeFlush();
    }


    recordForRenderable(renderableName) {
        PrioritisedObject.setPropertyGetterSpy((model, property, value) => {
            let modelListener = this._modelListeners[model.constructor.name][model.id];
            let { listenersByProperty } = modelListener;
            let propertyListeners = listenersByProperty[property];
            if (!propertyListeners) {
                propertyListeners = listenersByProperty[property] = {};
            }
            propertyListeners[renderableName] = true;
            modelListener.startListening();
        });
        let optionRecorder = this._activeRecordings[renderableName] = ({ type, propertyName, nestedPropertyPath }) => {
            if (type == 'setter') {
                console.log('Warning: Setting an option during instancation of renderable');
            } else {
                this._accessObjectPath(this._listenerTree, nestedPropertyPath.concat([propertyName, listeners]))[renderableName] = true;
            }
        };
        this._activeRecordings[renderableName] = optionRecorder;
        this.on('optionTrigger', optionRecorder);
    }

    stopRecordingForRenderable(renderableName) {
        PrioritisedObject.removePropertyGetterSpy();
        this.removeListener('optionTrigger', this._activeRecordings[renderableName]);
        delete this._activeRecordings[renderableName];
    }

    getOptions() {
        return this.options;
    }

    deleteRecordingForRenderable(renderableName){
        //todo implement this (is an efficient way)
    }

    recombineOptions(newOptions) {
        this._deepTraverse(this.options, (nestedPropertyPath, optionObject, value, key, newOptionObject) => {
            let newOptionValue = newOptionObject[key];
            if(!newOptionValue && optionObject[key] !== null){
                optionObject[key] = null;
                /* Cancel traverse in this direction */
                return true;
            } else if(!(newOptionValue && typeof newOptionValue === 'object' && newOptionValue.constructor.name === 'object') && value !== newOptionValue){
                /* Triggers the appriopriate events */
                optionObject[key] = newOptionValue;
            }
        }, newOptions);
    }

    _setupOptions() {
        this._deepTraverseOptions((nestedPropertyPath, object, value, key) => {
            this._accommodateObjectPath(this._listenerTree, nestedPropertyPath.concat(key))[listeners] = {};
            if (value instanceof Model) {
                //TODO This won't work if the id can be set to something else, so verify that this shouldn't be possible
                /* We assume that the constructor name is unique */
                let listenersByProperty = {};
                let onModelChanged = (model, { changedProperties, changedValues }) =>
                    this._onModelChanged(model, changedValues, changedProperties, key, nestedPropertyPath, listenersByProperty);
                let isListening = false;
                this._accommodateObjectPath(this._modelListeners, [value.constructor.name])[value.id] = {
                    startListening: () => {
                        if (!isListening) {
                            value.on('changed', onModelChanged);
                        }
                    },
                    stopListening: () => {
                        if (isListening) {
                            value.removeListener('changed', onModelChanged);
                        }
                    },
                    listenersByProperty
                };
            }
            this._addGetterSetterHook(object, key, value, nestedPropertyPath);
        });
    }

    _addGetterSetterHook(object, key, value, nestedPropertyPath) {
        ObjectHelper.addGetSetPropertyWithShadow(object, key, value, true, true,
            (info) =>
                this._onEventTriggered({ ...info, type: 'setter', parentObject: object, nestedPropertyPath })
            , (info) =>
                this._onEventTriggered({ ...info, type: 'getter', parentObject: object, nestedPropertyPath }));
    }

    _onModelChanged(model, changedValues, changedProperties, modelKeyInParent, nestedPropertyPath, listenersByProperty) {
        this._updateOptionsStructure(changedValues, changedProperties, model, nestedPropertyPath.concat(modelKeyInParent));
    }

    _onEventTriggered(info) {
        this.emit('optionTrigger', info);
        if (info.type === 'setter') {
            let { nestedPropertyPath, propertyName, newValue, parentObject } = info;
            this._updateOptionsStructure([newValue], [propertyName], parentObject, nestedPropertyPath);
        }
    }

    _deepUpdateStructure(changedProperties, parentObject, listenerTree, nestedPropertyPath) {

        for (let property of changedProperties) {
            let listenerTreeForProperty = listenerTree[property];
            if(!listenerTreeForProperty){
                listenerTreeForProperty = listenerTree[property] = {};
            }
            let value = parentObject[property];
            if (value && typeof value === 'object' && value.constructor.name === 'Object') {
                let changedProperties = Object.keys(value);
                let changedValues = changedProperties.map((property) => value[property]);
                this._deepUpdateStructure(
                    changedProperties,
                    value,
                    listenerTreeForProperty,
                    nestedPropertyPath
                );
            }
            for (let renderableName in listenerTreeForProperty[listeners]) {
                this._renderableUpdatesForNextTick[renderableName] = true;
            }
        }
    }

    _updateOptionsStructure(changedValues, changedProperties, parentObject, nestedPropertyPath) {
        if (changedProperties.length !== changedValues.length) {
            console.log('Internal error in Options Observer! the properties are not the same count as the changed values!');
        }


        this._deepUpdateStructure(
            changedProperties,
            parentObject,
            this._accessObjectPath(this._listenerTree, nestedPropertyPath),
            nestedPropertyPath
        );
        for(let property of changedProperties){
            let allButLastProperty = nestedPropertyPath;
            let lastProperty = property;
            /* Mark the object as changes in the most common path */
            let updateObject = this._accommodateObjectPathUnless(this._newOptionUpdates, allButLastProperty, (object) =>
                object[changes]
            );
            if(updateObject !== notFound){
                updateObject[lastProperty] = {[changes]: true};
            }
        }
    }

    _isPredictablyEqual(firstThing, secondThing) {
        /* Object comparison is not reliable */
        if (firstThing === 'object' && this.constructor.name === 'object') {
            return false;
        }
        return firstThing === secondThing;
    }

    /**
     * Stops when any path is found with certain criteria
     * @param object
     * @param path
     * @returns {*}
     * @private
     */
    _accommodateObjectPathUnless(object, path, criteriaCallback) {
        for (let property of path) {
            if (object[property] && criteriaCallback(object[property])) {
                return notFound;
            }
            object[property] = {};
            object = object[property];
        }
        return object;
    }


    _accommodateObjectPath(object, path) {
        for (let property of path) {
            if (!object[property]) {
                object[property] = {};
            }
            object = object[property];
        }
        if (!object) {
            object = {};
        }
        return object;
    }

    _accessObjectPathAsPossible(object, path) {
        for (let pathString of path) {
            if (!object[pathString]) {
                return object;
            }
            object = object[pathString];
        }
        return object;
    }

    _accessObjectPath(object, path) {
        for (let pathString of path) {
            object = object[pathString];
            if (!object) {
                return notFound;
            }
        }
        return object;
    }

    _deepTraverseOptions(callback) {
        return this._deepTraverse(this.options, callback);
    }
    _deepTraverse(object, callback, extraObjectToTraverse = {}, onlyForLeaves = false, nestedPropertyPath = []) {
        each(object, (value, key) => {
            let valueIsPlainObject = value && typeof value === 'object' && value.constructor.name === 'Object';
            let valueIsLeaf = valueIsPlainObject && Object.keys(value).length === 0;
            if(!onlyForLeaves || valueIsLeaf){
                /* If the callback returns true, then cancel traversion */
                if(callback(nestedPropertyPath, object, value, key, extraObjectToTraverse)){
                    return; //canceled traverse
                }
            }
            if (valueIsPlainObject) {
                let valueOfExtraObject = extraObjectToTraverse[key];
                this._deepTraverse(value, callback, valueOfExtraObject, onlyForLeaves, nestedPropertyPath.concat(key));
            }
        });

    }


    _setupRecurringOptionChangeFlush() {
        Timer.every(() => {
            for (let renderableName in this._renderableUpdatesForNextTick) {
                this.emit('needUpdate', renderableName);
            }
            this._renderableUpdatesForNextTick = {};
            /* Do a traverse only for the leafs of the new updates, to avoid doing extra work */
            this._deepTraverse(this._newOptionUpdates, (nestedPropertyPath, updateObject, value, key, optionObject) => {
                let outerNestedPropertyPath = nestedPropertyPath.concat(key);
                this._deepTraverse(optionObject[key], (innerNestedPropertyPath, object, value, key) => {
                    this._addGetterSetterHook(object, key, value, outerNestedPropertyPath.concat(innerNestedPropertyPath));
                });
            }, this.options, true);
            this._newOptionUpdates = {};
        });
    }
}
