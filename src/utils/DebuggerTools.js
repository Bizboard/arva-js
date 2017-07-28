/**
 * Created by lundfall on 06/07/2017.
 */
import {Surface}          from 'arva-js/surfaces/Surface.js';
import Entity             from 'famous/core/Entity.js'
import { View }           from 'arva-js/core/View.js'
import { ObjectHelper }   from 'arva-js/utils/ObjectHelper.js'
import { OptionObserver } from 'arva-js/utils/view/OptionObserver.js'
import { Utils }          from 'arva-js/utils/view/Utils.js'
import { layout }         from 'arva-js/layout/Decorators.js'
import EventEmitter       from 'famous/core/EventEmitter.js'

window.getFromID = (id) => {
  return Entity.get(id)
}

window.views = {};



let originalCopyPrototypeProperties= View.prototype._copyPrototypeProperties
View.prototype._copyPrototypeProperties = function () {
  window.views[this._name()] = this;
  return originalCopyPrototypeProperties.call(this, ...arguments)
}

let originalConstructLayoutController = View.prototype._createLayoutController
View.prototype._createLayoutController = function () {
  originalConstructLayoutController.call(this, ...arguments)
  this.layout._view = this
}

let secretRedBackground = Symbol('secretRedBackground');
View.prototype.makeRED = function () {
  this._arrangeRenderableAssignment(this[secretRedBackground], Surface.with({properties: {backgroundColor: 'red'}}),
    [], secretRedBackground, [layout.fullSize()])
  this.reflowRecursively();
}

let originalWarn = Utils.prototype._warn
Utils._warn = function () {
  originalWarn.call(this, ...arguments)
  debugger
}

let originaloptionObserverErrorThrower = OptionObserver.prototype._throwError
OptionObserver.prototype._throwError = function () {
  debugger
  return originaloptionObserverErrorThrower.call(this, ...arguments)
}



let originalRegisterNewInstance = OptionObserver._registerNewInstance
OptionObserver._registerNewInstance = function (instance) {
  instance.on('needUpdate', (renderableName) => {
    console.log(`%c ${instance._errorName}:${renderableName} is invalidated`, 'color: rgba(125, 125, 125, 0.7')
  })
  return originalRegisterNewInstance.call(this, ...arguments)
}

let originalOptionObserverMarkPropertyAsUpdated = OptionObserver.prototype._markPropertyAsUpdated
OptionObserver.prototype._markPropertyAsUpdated = function (nestedPropertyPath, property, value) {
  let result = originalOptionObserverMarkPropertyAsUpdated.call(this, ...arguments)
  console.log(`%c ${this._errorName} updated ${nestedPropertyPath.concat(property).join('->')}=${this._isPlainObject(value) ? JSON.stringify(value) : value}`, 'color: green')
  return result
}

window.ObjectHelper = ObjectHelper

let originalEmit = EventEmitter.prototype.emit
EventEmitter.prototype.emit = function (type) {
  let result = originalEmit.call(this, ...arguments)
  if (typeof document.body['on' + type] === 'undefined' && ![
    /* Exclude common events that emit too often */
      'layoutstart',
      'layoutend',
      'sizeChanged',
      'reflow',
      'start',
      'end',
      'update',
      'layoutControllerReflow',
      'deploy',
      'recursiveReflow',
      'postrender',
      'prerender',
      'change'].includes(type) && Number.isNaN(+type)) {
    console.log(`Event emitted: ${type}`, this._owner)
  }
  return result
}