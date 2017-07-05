/**
 * Created by lundfall on 04/07/2017.
 */
import EventEmitter     from 'eventemitter3'
import { ObjectHelper }               from 'arva-js/utils/ObjectHelper.js'

class ArrayObserver extends EventEmitter {
  constructor (array) {
    super()
    if (!Array.isArray(array)) {
      throw new Error(`Array observer created without array!`)
    }
    this._array = array
    this._adjustForNewLength()
    this._overrideMethods()

  }

  //TODO listen for access and replacement

  _overrideModificaitionMethod (methodName, newMethod) {
    let originalMethod = this._array[methodName]
    Object.defineProperty(this._array, methodName, {
      value: function () {
        let result = originalMethod.apply(this._array, arguments)
        newMethod.call(this, ...arguments, result)
        this._adjustForNewLength()
        this.emit('modified', {methodName})
        return result
      }.bind(this), enumerable: false
    })
  }

  _adjustForNewLength () {
    if (this._arrayLength) {
      //todo fill in, if needed
    }
    for (let index = 0; index < this._array.length; index++) {
      ObjectHelper.addGetSetPropertyWithShadow(this._array, index, this._array[index], false, true, ({newValue}) => {
        this.emit('replaced', {item: newValue, index})
      }, () => {
        this.emit('accessed', {index})
      })
    }

    this._arrayLength = this._array.length
  }

  _overrideMethods () {
    this._overrideModificaitionMethod('pop', this._pop)
    this._overrideModificaitionMethod('push', this._push)
    this._overrideModificaitionMethod('reverse', this._reverse)
    this._overrideModificaitionMethod('shift', this._shift)
    this._overrideModificaitionMethod('unshift', this._unshift)
    this._overrideModificaitionMethod('sort', this._sort)
    this._overrideModificaitionMethod('splice', this._splice)
    this._overrideReadMethod('map')
    this._overrideReadMethod('foreach')
  }

  _overrideReadMethod(methodName){
    let originalMethod = this._array[methodName]
    Object.defineProperty(this._array, methodName, {
      value: function () {
        let result = originalMethod.apply(this._array, arguments)
        this.emit('read', {methodName})
        return result
      }.bind(this), enumerable: false
    })
  }

  _pop (removedElement) {
    if (this._array.length) {
      this.emit('removed', {index: this._array.length, item: removedElement})
    }
  }

  _push (element, newLength) {
    this.emit('added', {index: newLength - 1, item: element})
  }

  _reverse (reversedArray) {
    for (let [index, item] of reversedArray.entries()) {
      this.emit('replaced', {item, index})
    }
  }

  _shift (shiftedElement) {
    let index, item
    this.emit('accessed', {index: 0, item: shiftedElement})
    for ([index, item] of this._array.entries()) {
      this.emit('replaced', {item, index})
    }
    this.emit('removed', {index: this._array.length, item})
  }

  _sort () {
    for (let [index, item] of this._array.entries()) {
      this.emit('replaced', {item, index})
    }
  }

  _splice (start, deleteCount, ...itemsToAddAndDeletedElements) {

    let deletedElements =
      itemsToAddAndDeletedElements.slice(-deleteCount)
    let itemsToAdd = itemsToAddAndDeletedElements.slice(0, -deleteCount)

    let maxIndex = Math.max(deletedElements.length, itemsToAdd.length)
    for (let index = start; index < maxIndex; index++) {
      if (index < deletedElements.length) {
        this.emit('removed')
      }
    }

  }

  _unshift (newLength) {
    let item, index
    for ([index, item] of this._array.entries()) {
      if (index === this._array.length - 1) {
        this.emit('added', {index: index, item})
      }
      else {
        this.emit('replaced', {item, index})
      }
    }
  }

}
//TODO remove this!
window.o = [1, 2, 3]

window.arr = ArrayObserver
window.test = new ArrayObserver(o)

let debugListen = (eventName) => {
  window.test.on(eventName, function () {
    console.log(eventName, ...arguments)
  })
}

debugListen('removed')
debugListen('replaced')
debugListen('added')
debugListen('accessed')
debugListen('modified')
