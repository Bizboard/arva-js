/**


 @author: Hans van den Akker (mysim1)
 @license NPOSL-3.0
 @copyright Bizboard, 2017

 */
import merge                    from 'lodash/merge.js'
import extend                   from 'lodash/extend.js'

import AnimationController      from 'famous-flex/AnimationController.js'
import LayoutUtility            from 'famous-flex/LayoutUtility.js'
import Easing                   from 'famous/transitions/Easing.js'

import { Utils }                    from '../utils/view/Utils.js'
import { onOptionChange }           from '../utils/view/OptionObserver'
import { RenderablePrototype }      from 'famous/utilities/RenderablePrototype.js'


/**
 *
 * @param viewOrRenderable
 * @param renderableName
 * @param descriptor
 * @returns {*}
 */
function prepDecoratedRenderable (viewOrRenderable, renderableName, descriptor) {


  /* This function can also be called as prepDecoratedRenderable(renderable) */
  if (!renderableName && !descriptor) {
    let renderable = viewOrRenderable
    renderable.decorations = renderable.decorations || {}
    return renderable
  }
  let view = viewOrRenderable

  if (!view.renderableConstructors) {
    view.renderableConstructors = new Map()
  }

  let constructors = view.renderableConstructors

  /* Because the inherited views share the same prototype, we'll have to split it up depending on which subclass we're referring out */
  let specificRenderableConstructors = constructors.get(view.constructor)
  if (!specificRenderableConstructors) {
    specificRenderableConstructors = constructors.set(view.constructor, {}).get(view.constructor)
  }

  if (!specificRenderableConstructors[renderableName]) {
    /* Getters have a get() method on the descriptor, class properties have an initializer method.
     * get myRenderable(){ return new Surface() } => descriptor.get();
     * myRenderable = new Surface(); => descriptor.initializer();
     */
    if (descriptor.get) {
      Utils.warn(`Adding renderables on views through getters has been deprecated (${renderableName}).`)
      specificRenderableConstructors[renderableName] = descriptor.get
    } else if (descriptor.initializer) {
      specificRenderableConstructors[renderableName] = descriptor.initializer
    }
  }
  let constructor = specificRenderableConstructors[renderableName]
  if (!constructor.decorations) {
    constructor.decorations = {descriptor: descriptor}
  }

  return constructor
}

/**
 * Extracts a decorations object
 *
 * @param {View} prototype
 * @returns {Object} The decorations for the prototype
 */
function prepPrototypeDecorations (prototype) {

  /* To prevent inherited classes from taking each others class-level decorators, we need to store these decorations in
   * a map, similarly to function preparing a decorated renderable
   */
  if (!prototype.decorationsMap) {
    prototype.decorationsMap = new Map()
  }

  let {decorationsMap} = prototype

  let decorations = decorationsMap.get(prototype.constructor)
  if (!decorations) {
    decorations = decorationsMap.set(prototype.constructor, {}).get(prototype.constructor)
  }

  /* Return the class' prototype, so it can be extended by the decorator */
  return decorations
}

/**
 * Describes a set of decorators used for layouting of a renderable in a View.
 */
export const bindings = {
  /**
   * Sets the default and mandatory options
   *
   * @example
   * @options.setup({color: 'blue'})
   * class MyView extends View{
   *
   * @returns {Function} A decorator function
   */
  setup: (defaultOptions) => {
    return (target) => {
      prepPrototypeDecorations(target.prototype).defaultOptions = defaultOptions
    }
  },
  onChange: (transformFunction) => {
    return (optionsPassed, optionNameToBind, descriptor) => {
      let optionChangeListeners = optionsPassed[onOptionChange]
      if (!optionChangeListeners) {
        optionChangeListeners = optionsPassed[onOptionChange] = {}
      }
      optionChangeListeners[optionNameToBind] = transformFunction
    }
  },
  /**
   * Defines a preprocess function to use before the options are assigned. This can be used to simplify the
   * flow of your app. The preprocess function should modify the contents of the options passed.
   * Return value is ignored. It is important that the function doesn't modify defaultOptions
   *
   * @example
   * @bindings.preprocess()
   * propagateBackgroundColor((options, defaultOptions) {
   *  // Shortcut way of specifying the sideMenu.menuItem.backgroundColor
   *  options.sideMenu = combineOptions(defaultOptions.sideMenu, {menuItem: {backgroundColor: options.backgroundColor}})
   * })
   *
   * @returns {function(*)}
   */
  preprocess: () => {
    return (prototype, methodName, descriptor) => {
      let decorations = prepPrototypeDecorations(prototype);
        let {preprocessBindings} = decorations;
          if(!preprocessBindings){
            preprocessBindings = decorations.preprocessBindings = [];
          }
          let preprocessFunction  = descriptor.value;
          preprocessBindings.push({preprocessFunction, name: methodName});
    }
  }

};

let decoratorTypes = {childDecorator: 1, viewDecorator: 2, viewOrChild: 3};
let lastResult;

export let createChainableDecorator = function (method, type) {

  let methodToReturn = function (viewOrRenderable, renderableName, descriptor) {
    if (methodToReturn.lastResult) {
      methodToReturn.lastResult(viewOrRenderable, renderableName, descriptor);
    }
    if (type === decoratorTypes.viewOrChild) {
      type = typeof viewOrRenderable === 'function' ? decoratorTypes.viewDecorator : decoratorTypes.childDecorator;
    }
    let decorations = type === decoratorTypes.childDecorator ? prepDecoratedRenderable(...arguments).decorations : prepPrototypeDecorations(viewOrRenderable.prototype);

    /* If we are directly applying the decorator on a RenderablePrototype, we need to save the methods to be executed later,
     * rather than just executing the methods. This is needed so that decorators can be applied both directly as methods in
     * in combination with them being used actually as decorators, on the same renderable */
    if(!descriptor && viewOrRenderable instanceof RenderablePrototype){
      viewOrRenderable.addDirectlyAppliedDecoratorFunction(method)
    } else {

        method(decorations, type, viewOrRenderable, renderableName, descriptor);
    }


     if(!descriptor){
       /*  If the descriptor isn't present, we are not executing the decorator at decoration time.
        *  This means that we can utilize the return to provide the renderable. This allows you to do things like this:
        *
        *  this.myRenderable = this.addRenderable(layout.size(new Surface()))
        *
        *  Or this (in the class field):
        *
        *  items = this.options.items.map(itemInfo =>
        *    layout.size(...itemInfo.size)(
        *      new Surface({content: itemInfo.content})
        *    )
        *  );
        *
        *  */
         return viewOrRenderable;
     }
     return descriptor;
  };

  let root = this;
  if (root && root.originalObject) {
    methodToReturn.lastResult = root;
    root = methodToReturn.originalObject = root.originalObject;
  } else {
    methodToReturn.originalObject = this;
  }
  if (root) {
    lastResult = methodToReturn;
    methodToReturn.createChainableDecorator = createChainableDecorator.bind(methodToReturn);
    /* We are allowing for chaining here by defining the properties on the returning object having the same properties
    *  as the original object. For example, layout.fullSize() would return an object that has all the methods of layout */
    Object.defineProperties(methodToReturn, Object.getOwnPropertyDescriptors(root.__proto__));
  }

  return methodToReturn;
}


let extraLayout = Symbol('extraLayout')

/**
 * Describes a set of decorators used for layouting of a renderable in a View.
 */
class Layout {

  /**
   * @ignore
   * Add to self in order to make the scope working
   */
  createChainableDecorator = createChainableDecorator

  /**
   * Merely marks a view property as a decorated renderable, which allows it to be rendered.
   * Use this in combination with a @layout.custom decorator on the view in which this renderable resides.
   *
   * @example
   * @layout.renderable()
   * renderable = Surface.with();
   *
   * @returns {Layout} A chainable function
   */
  renderable () {
    return this.createChainableDecorator(() => {
    }, decoratorTypes.childDecorator)
  }

  /**
   * Marks the renderable to cover the entire screen. Translate can also be specified on such a renderable.
   *
   * @example
   * @layout.fullSize()
   * // View will have a red background
   * background = Surface.with({properties: {backgroundColor: 'red'}});
   *
   * @returns {Layout} A decorator function
   */
  fullSize () {
    return this.createChainableDecorator((decorations) => {
      decorations.fullSize = true
    }, decoratorTypes.childDecorator)
  }

  /**
   * Specifies the space that should come before the docked renderable. Useful when not specifying the size in the
   * layout.dock function. Note that the space does not appear if there isn't any renderable with a size greater than
   * zero before it. Can also be specified for the view
   *
   * @example
   * // there's a 20px space before this box
   * @layout.dockSpace(20)
   *  .size(100, 100)
   *  .dock.left()
   * box = new Surface({properties: {backgroundColor: 'red'}});
   *
   * @param {Number} space The space that is inserted before the renderable.
   * @returns {Layout} A chainable function
   */
  dockSpace (space) {
    return this.createChainableDecorator((decorations, type) => {
      if (type === decoratorTypes.viewDecorator) {
        decorations.dockSpacing = space
      } else {
        decorations.dock = decorations.dock ? extend(decorations.dock, {space}) : {space}
      }
    }, decoratorTypes.viewOrChild)
  }

  /**
   * Internal function to do docking
   *
   * @param dockMethod
   * @param size
   * @param space
   * @param zIndex
   * @returns {Function}
   */
  _dockTo (dockMethod, size, space, zIndex) {
    return this.createChainableDecorator((decorations) => {

      if (decorations.dock) {
        space = space || decorations.dock.space
      }

      let width = dockMethod === 'left' || dockMethod === 'right' ? size : undefined
      let height = dockMethod === 'top' || dockMethod === 'bottom' ? size : undefined

      let twoDimensionalSize = [width, height]
      // Todo refactor also the z index to the dock, probably
      decorations.dock = {space, dockMethod, size: twoDimensionalSize}

      if (!decorations.translate) {
        decorations.translate = [0, 0, 0]
      }
      if (zIndex) {
        decorations.translate[2] = zIndex
      }
    }, decoratorTypes.childDecorator)
  }

  /**
   *
   * @typedef {Object} DockTypes
   * @property {dockLeft} left Dock to the left
   * @property {dockRight} right Dock to the right
   * @property {dockBottom} bottom Dock to the bottom
   * @property {dockTop} top Dock to the top
   * @property {fill} fill Fill the rest of the space
   */

  /**
   * Extra layout
   * @type {DockTypes}
   */
  get extra () {
    return extraLayout;
  }
  /**
   * Docks things. See method descriptors for "Dockings"
   * @type {DockTypes}
   */
  get dock () {
    return {
      /**
       * @typedef {dockLeft} dockLeft
       * Docks the renderable to the left.
       *
       * When using both a docked size and the layout.size decorator, then that layout.size becomes the actual inner size.
       * The renderable can then be stickd within the docking area with origin and align. When combined with align, treats
       * the context size the docking size.
       * When using layout.size without specifying a docked size, it will use that size as docking size. Useful for
       * automatic sizing when parent defines true size and orthogonal size (e.g. height for dock 'left') has to be defined.
       *
       * @example
       * @layout.dock.left(30, 0, 10)
       *   .size(15, undefined)
       *   .origin(0.5, 0)
       *   .align(0.5, 0)
       * dockedRenderable = Surface.with({properties: {backgroundColor: 'red'}});
       *
       * @memberOf dock
       * @param {Number|Function|Boolean} [size]. The size of the renderable in the one dimension that is being docked, e.g.
       * dock left or right will be width, whereas dock top or bottom will result in height. For more information about
       * different variations, see layout.size.
       * @param {Number} [space]. Any space that should be inserted before the docked renderable
       * @param {Number} [zIndex]. DEPRECATED: Use translate(0, 0, zIndex) instead.
       * @returns {Layout} A chainable function
       */
      left: function () {
        return this._dockTo('left', ...arguments)
      }.bind(this),

      /**
       * @typedef {Function} dockRight
       * Docks the renderable to the right.
       *
       * When using both a docked size and the layout.size decorator, then that layout.size becomes the actual inner size.
       * The renderable can then be stickd within the docking area with origin and align. When combined with align, treats
       * the context size the docking size.
       * When using layout.size without specifying a docked size, it will use that size as docking size. Useful for
       * automatic sizing when parent defines true size and orthogonal size (e.g. height for dock 'left') has to be defined.
       *
       * @example
       * @layout.dock.right(30, 0, 10)
       *   .size(15, undefined)
       *   .origin(0.5, 0)
       *   .align(0.5, 0)
       * dockedRenderable = new Surface({properties: {backgroundColor: 'red'}});
       *
       * @param {Number|Function|Boolean} [size]. The size of the renderable in the one dimension that is being docked, e.g.
       * dock left or right will be width, whereas dock top or bottom will result in height. For more information about
       * different variations, see layout.size.
       * @param {Number} [space]. Any space that should be inserted before the docked renderable
       * @param {Number} [zIndex]. DEPRECATED: Use translate(0, 0, zIndex) instead.
       * @returns {Layout} A chainable function
       */
      right: function () {
        return this._dockTo('right', ...arguments)
      }.bind(this),

      /**
       * @typedef {Function} dockTop
       * Docks the renderable to the top.
       *
       * When using both a docked size and the layout.size decorator, then that layout.size becomes the actual inner size.
       * The renderable can then be stickd within the docking area with origin and align. When combined with align, treats
       * the context size the docking size.
       * When using layout.size without specifying a docked size, it will use that size as docking size. Useful for
       * automatic sizing when parent defines true size and orthogonal size (e.g. height for dock 'left') has to be defined.
       *
       * @example
       * @layout.dock.top(30, 0, 10)
       *    .size(15, undefined)
       *    .origin(0.5, 0)
       *    .align(0.5, 0)
       * dockedRenderable = Surface.with({properties: {backgroundColor: 'red'}});
       *
       *
       * @param {Number|Function|Boolean} [size]. The size of the renderable in the one dimension that is being docked, e.g.
       * dock left or right will be width, whereas dock top or bottom will result in height. For more information about
       * different variations, see layout.size.
       * @param {Number} [space = 0]. Any space that should be inserted before the docked renderable
       * @param {Number} [zIndex = 0]. DEPRECATED: Use translate(0, 0, zIndex) instead.
       * @returns {Layout} A chainable function
       */
      top: function () {
        return this._dockTo('top', ...arguments)
      }.bind(this),

      /**
       * @typedef {Function} dockBottom
       * Docks the renderable to the bottom.
       *
       * When using both a docked size and the layout.size decorator, then that layout.size becomes the actual inner size.
       * The renderable can then be stickd within the docking area with origin and align. When combined with align, treats
       * the context size the docking size.
       * When using layout.size without specifying a docked size, it will use that size as docking size. Useful for
       * automatic sizing when parent defines true size and orthogonal size (e.g. height for dock 'left') has to be defined.
       *
       * @example
       * @layout.dock.bottom(30, 0, 10)
       *    .size(15, undefined)
       *    .origin(0.5, 0)
       *    .align(0.5, 0)
       * dockedRenderable = Surface.with({properties: {backgroundColor: 'red'}});
       *
       *
       * @param {Number|Function|Boolean} [size]. The size of the renderable in the one dimension that is being docked, e.g.
       * dock left or right will be width, whereas dock top or bottom will result in height. For more information about
       * different variations, see layout.size.
       * @param {Number} [space = 0]. Any space that should be inserted before the docked renderable
       * @param {Number} [zIndex = 0]. DEPRECATED: Use translate(0, 0, zIndex) instead.
       * @returns {Layout} A chainable function
       */
      bottom: function () {
        return this._dockTo('bottom', ...arguments)
      }.bind(this),

      /**
       * @typedef {Function} fill
       * Fills the space that is left after the docking with this renderable. When using layout.size, it will use that
       * size as an inner size. This works similarly to other docking, from where translate, size, origin, align, etc
       * can be specified.
       *
       * @example
       * @layout.dock.fill()
       * filledRenderable = Surface.with({properties: {backgroundColor: 'red'}});
       *
       * @returns {Layout} A chainable function
       */
      fill: function () {
        return this._dockTo('fill', ...arguments)
      }.bind(this),
      /**
       * Marks the renderable as not being docked anymore. Useful when dynamically changing decorations through
       * this.decorateRenderable or this.setRenderableFlowState
       *
       * @example
       * @layout.dock.fill()
       * @flow.stateStep('nonFilled', layout.dock.none(), layout.size(100, 100))
       * filledRenderable = Surface.with({properties: {backgroundColor: 'red'}});
       *
       * @returns {Layout} A chainable function
       */
      none: function () {
        return this.createChainableDecorator((decorations) => {
          decorations.disableDock = true
        }, decoratorTypes.childDecorator)
      }.bind(this)
    }
  }

  /**
   * Makes the renderable allowed to be dragged around. this.renderables[name] refers to a RenderNode containing this
   * draggable along with the renderable itself.
   *
   * @example
   * @layout.draggable({xRange: [0, 100}, yRange: [0, 200]})
   * .size(100, 100)
   * // Makes a draggable square that is red
   * draggableRenderable = Surface.with({properties: {backgroundColor: 'red'});
     *
   * @param {Object} [draggableOptions]. Same options that can be passed to a Famous Draggable.
   * @param {Number} [options.snapX] grid width for snapping during drag
   * @param {Number} [options.snapY] grid height for snapping during drag
   * @param {Array.Number} [options.xRange] maxmimum [negative, positive] x displacement from start of drag
   * @param {Array.Number} [options.yRange] maxmimum [negative, positive] y displacement from start of drag
   * @param {Number} [options.scale] one pixel of input motion translates to this many pixels of output drag motion
   * @param {Number} [options.projection] User should set to Draggable._direction.x or
   *    Draggable._direction.y to constrain to one axis.
   * @returns {Layout} a chainable decorator function
   */
  draggable (draggableOptions = {}) {
    return this.createChainableDecorator((decorations) => {
      decorations.draggableOptions = draggableOptions
    }, decoratorTypes.childDecorator)
  }

    /**
     * Makes modifications to a surface using old-style famous modifiers (e.g MapModifier for famous-map)
     * @example
     * @layout.mapModifier(new MapModifier{ mapView: map, position: {lat: 0, lng: 0} })
     * // Makes a surface that is linked to the position (0, 0)
     *
     * @param {Object} [modifier]. modifier object.
     * @returns {Function}
     */
    modifier(modifier = {}) {
        return this.createChainableDecorator((decorations) => {
            decorations.modifier = modifier;
        }, decoratorTypes.childDecorator);
    }

  /**
   * Makes the renderable swipable with physics-like velocity after the dragging is released. Emits event
   * 'thresholdReached' with arguments ('x'|'y', 0|1) when any thresholds have been reached. this.renderables[name]
   * now refers to a a RenderNode containing a positionModifier along with the renderable itself.
   *
   * @example
   * @layout.size(100, 100)
   *  .swipable({xRange: [0, 100], snapX: true})
   * //Make a red box that can slide to the right
   * swipable = Surface.with({properties: {backgroundColor: 'red'});
   * @param {Object} options
   * @param {Boolean} [options.snapX] Whether to snap to the x axis
   * @param {Boolean} [options.snapY] Whether to snap to the Y axis
   * @param {Boolean} [options.enabled] Whether the swipable should be initially enabled
   * @param {Array.Number} [options.xThreshold] Two values of the thresholds that trigger the thresholdReached event with
   * argument 'x' and second argument 0 or 1, depending on the direction.
   * Specify undefined in one of them to disable threshold to that direction.
   * @param {Array.Number} [options.yThreshold] Two values of the thresholds that trigger the thresholdReached event with
   * argument 'y'  and second argument 0 or 1, depending on the direction.
   * Specify undefined in one of them to disable threshold to that direction.
   * @returns {Layout} A chainable function
   */
  swipable (options) {
    return this.createChainableDecorator((decorations) => {
      decorations.swipableOptions = options
    }, decoratorTypes.childDecorator)
  }

  /**
   * Clips the renderable by creating another DOM-element with overflow: hidden. Internally, creates a Famous
   * ContainerSurface.
   * The two size parameters can either be a number or undefined (equals the context size).
   *
   * @example
   * @layout.size(40,40)
   *   .clip(20, 20)
   * // Shows a quarter of a circle
   * renderable = Surface.with({properties: {backgroundColor: 'red', borderRadius: '50%'});
     *
   * @param {Number} width The width of the ContainerSurface
   * @param {Number} heigh The height of the ContainerSurface
   * @param {Object} [properties]. Properties that will be passed to the newly created parent DOM-element.
   * If specified, merged with {overflow: 'hidden'}
   * @returns {Layout} A chainable function
   */

  /**
   * Specifies the size of the renderable. For both of the parameters, sizes can be interpreted as follows:
   *
   * If specified as a function, then the argument passed is the context size of the specified dimension
   * (width or height). Note that if an arrow function is used, this scoping cannot be used when inside a
   * decorator, since the scope will be the global scope.
   *
   * If true is specified or a tilde with a size (e.g. ~300), then the renderable will be automatically sized.
   * If a tilde is used to indicate the size, then the size after the tilde will be used when/if the
   * renderable doesn't have a size, or turn into the actual size if it can be determined. This is useful when wanting
   * to reduce the flickering of surfaces who's size cannot be determined the first render tick.
   * Beware that true sizing of surfaces or other raw dom elements (input surfaces, image surfaces, text boxes etc)
   * often comes with a perfomance penalty and should only be used when necessary.
   * Also beware that any negative size will be interpreted as a tilde, since ~x = 1 - x
   *
   * If undefined is specified, then the size of that dimension will equal the entire context size.
   *
   * If a size between 0 and 1 is specified, then that will be interpreted as a proportion of the context size. For
   * example if 0.5 is specified, then the size will be half of the context size (the parent's size). Instead of
   * specifying 1 to cover the entire context size, use undefined instead.
   * @example
   * @layout.size(function(contextWidth) {return Math.max(contextWidth, this.options.maxWidth)}, ~300)
   * // Creates a renderable where the width is equal to the text width and the height is whatever is bigger,
   * // options.maxWidth, or the context size
   * text = Surface.with({content: 'This is some text', properties: {backgroundColor: 'red'}});
   *
   * @param {Number|Function|Boolean} x
   * @param {Number|Function|Boolean} y
   * @returns {Layout} A chainable function
   */
  size (x, y) {
    if (Array.isArray(x)) {
      throw Error('Please specify size as two arguments, and not as an array')
    }
    return this.createChainableDecorator((decorations) => {
      decorations.size = [x, y]
    }, decoratorTypes.childDecorator)
  }

  clip (width, height, properties = {}) {
    return this.createChainableDecorator((decorations) => {
      decorations.clip = {size: [width, height], properties}
    }, decoratorTypes.childDecorator)
  }

  /**
   * Rotates the renderable around any of the three axes (in radians).
   *
   * @example
   * @layout.size(100,100)
   *    .rotate(0, 0, Math.PI)
   * // Writes text upside down
   * renderable = Surface.with({content: 'upside down text'});
   *
   * @param {Number} x The rotation around the x axis (flips vertically)
   * @param {Number} y The rotation around the y axis (flips horizontally)
   * @param {Number} z The rotation around the z axis (rotatesin in the more intuitive sense)
   * @returns {Layout} A chainable function
   */
  rotate (x, y, z) {
    return this.createChainableDecorator((decorations) => {
      decorations.rotate = [x, y, z]
    }, decoratorTypes.childDecorator)
  }

  /**
   * Rotates the renderable around any of the three axes (in radians) relatively to the current rotation
   *
   * @example
   * @layout.size(100,100)
   *    .rotate(0, 0, Math.PI)
   * // Writes text upside down
   * renderable = Surface.with({content: 'upside down text'});
   *
   * @param {Number} x The rotation around the x axis (flips vertically)
   * @param {Number} y The rotation around the y axis (flips horizontally)
   * @param {Number} z The rotation around the z axis (rotatesin in the more intuitive sense)
   * @returns {Layout} A chainable function
   */
  rotateFrom (x, y, z) {
    return this.createChainableDecorator((decorations) => {
      let propertyName = 'rotate'
      let properties = decorations[propertyName] || [0, 0, 0]
      decorations[propertyName] = [properties[0] + x, properties[1] + y, properties[2] + z]
    }, decoratorTypes.childDecorator)
  }

  /**
   * Sets the opacity of a renderable.
   *
   * @example
   * @layout.opacity(0.5)
   *    .size(100, 10)
   *    .place.center()
   * // Writes text that is half invisible
   * renderable = Surface.with({content: 'Half invisible'});
   *
   * @param {Number} opacity The opacity, between 0 and 1
   * @returns {Layout} A chainable function
   */
  opacity (opacity) {
    return this.createChainableDecorator((decorations) => {
      decorations.opacity = opacity
    }, decoratorTypes.childDecorator)
  }

  _stickTo (stick) {
    return this.createChainableDecorator((decorations) => {
      let origin = [0, 0], align = [0, 0]
      switch (stick) {
        case 'center':
          origin = align = [0.5, 0.5]
          break
        case 'bottomRight':
          origin = align = [1, 1]
          break
        case 'bottomLeft':
          origin = align = [0, 1]
          break
        case 'topRight':
          origin = align = [1, 0]
          break
        case 'left':
          origin = align = [0, 0.5]
          break
        case 'right':
          origin = align = [1, 0.5]
          break
        case 'top':
          origin = align = [0.5, 0]
          break
        case 'bottom':
          origin = align = [0.5, 1]
          break
        default:
        case 'topLeft':
          origin = align = [0, 0]
          break

      }

      decorations.origin = origin
      decorations.align = align
    }, decoratorTypes.childDecorator)
  }

  /**
   * @typedef {Object} StickTypes
   * @property {Function} center stick in the center
   * @property {Function} bottomRight stick to the bottom right
   * @property {Function} bottomLeft stick to the bottom left
   * @property {Function} topRight stick to the top right
   * @property {Function} topLeft stick to the top left
   * @property {Function} left stick to the left
   * @property {Function} right stick to the right
   * @property {Function} bottom stick to the bottom
   * @property {Function} top stick to the top
   */

  /**
   * @typedef {Function} StickTypes
   * @returns {Layout} A chainable layout function
   */

  /**
   * Places the renderable by settings origin/align. If nothing is set, it will default to topleft.
   *
   * @example
   * @layout.size(100,~300)
   *    .stick.center()
   * renderable = Surface.with({content: 'centered text'});
   *
   * @type {StickTypes}
   */
  get stick () {
    return {
      center: () => {
        return this._stickTo('center')
      }
      ,
      left: () => {
        return this._stickTo('left')
      }

      ,
      right: () => {
        return this._stickTo('right')
      }

      ,
      top: () => {
        return this._stickTo('top')
      }

      ,
      bottom: () => {
        return this._stickTo('bottom')
      }

      ,
      bottomLeft: () => {
        return this._stickTo('bottomLeft')
      }

      ,
      bottomRight: () => {
        return this._stickTo('bottomRight')
      }

      ,
      topLeft: () => {
        return this._stickTo('topLeft')
      }

      ,
      topRight: () => {
        return this._stickTo('topRight')
      }
    }
  }

  /**
   * Sets the point where the renderable has its anchor from where rotation and translation will be done.
   * You could consider it as translating the negative of the proportion times its size. The arguments are always
   * between and including 0 and 1.
   *
   * @example
   * @layout.origin(0.5, 0)
   *    .size(100,100)
   *    .align(0.5, 0.5)
   * //Displays a red box horizontically centered and displays just below the vertical mid point
   * renderable = Surface.with({properties: {backgroundColor: 'red'}});
   *
   *
   * @param {Number} x. The x of the origin.
   * @param {Number} y. The y of the origin.
   * @returns {Layout} A chainable function.
   */
  origin (x, y) {
    return this.createChainableDecorator((decorations) => {
      decorations.origin = [x, y]
    }, decoratorTypes.childDecorator)
  }

  /**
   * Translates the renderable by a proportion of the context size.
   *
   * @example
   * @layout.align(0.5, 0.5)
   *    .size(100,100)
   * //Displays a red box just below the vertical mid point and past the horizontal mid point
   * renderable = Surface.with({properties: {backgroundColor: 'red'}});
   *
   * @param {Number} x. The proportion of the context width that is going to be translated.
   * @param {Number} y. The proportion of the context height that is going to be translated.
   * @returns {Layout} A chainable function.
   */
  align (x, y) {

    return this.createChainableDecorator((decorations) => {
      decorations.align = [x, y]
    }, decoratorTypes.childDecorator)
  }

  /**
   * Specifies a translation of a renderable. Can be applied to every kind of renderable (docked, fullSize,
   * and normal). Can also be applied on view level to translate every renderable of that view. The view wide translation defaults
   * to [0, 0, 10] in order to always increase the z space of every level of the Famous rendering tree.
   *
   * @example
   * @layout.translate(0, 0, 20)
   * class myView extends View{
   *  @layout.translate(0, 0, -20)
   *    .fullSize()
   *  // Will display relatively at z level 0 (20 minus 20)
   *  myBackground = Surface.with({properties: {backgroudColor: 'red'}});
   * }
   *
   * @param {Number} x Moves the renderable along the x axis.
   * @param {Number} y Moves the renderable along the y axis.
   * @param {Number} z Moves the renderable along the z axis.
   * @returns {Layout} A chainable function.
   */
  translate (x, y, z) {
    if (Array.isArray(x)) {
      throw Error('Please specify translate as three arguments, and not as an array')
    }

    return this.createChainableDecorator((decorations, type) => {
      let propertyName
      if (type === decoratorTypes.viewDecorator) {
        propertyName = 'extraTranslate'
      } else {
        propertyName = 'translate'
      }
      decorations[propertyName] = [x, y, z]
    }, decoratorTypes.viewOrChild)
  }

  /**
   * Specifies a relative translation of a renderable. Can be applied to every kind of renderable (docked, fullSize,
   * and normal).
   * Can also be applied on view level to translate every renderable of that view. The view wide translation defaults
   * to [0, 0, 10] in order to always increase the z space of every level of the Famous rendering tree.
   *
   * @example
   * @layout.translateFrom(0, 0, 20)
   * class myView extends View{
   *  @layout.translateFrom(0, 0, -20)
   *    .fullSize()
   *  // Will display relatively at z level 0 (20 minus 20)
   *  myBackground = Surface.with({properties: {backgroudColor: 'red'}});
   * }
   *
   * @param {Number} x Moves the renderable along the x axis.
   * @param {Number} y Moves the renderable along the y axis.
   * @param {Number} z Moves the renderable along the z axis.
   * @returns {Layout} A chainable function.
   */
  translateFrom (x, y, z) {
    return this.createChainableDecorator((decorations, type) => {
      if (Array.isArray(x)) {
        throw Error('Please specify translate as three arguments, and not as an array')
      }
      let propertyName
      if (type === decoratorTypes.viewDecorator) {
        propertyName = 'extraTranslate'
      } else {
        propertyName = 'translate'
      }
      let properties = decorations[propertyName] || [0, 0, 0]
      decorations[propertyName] = [properties[0] + x, properties[1] + y, properties[2] + z]
    }, decoratorTypes.viewOrChild)
  }

  /**
   * Specifies the scale of a renderable. Can be applied to every kind of renderable.
   *
   * @example
   *  class myView extends View{
   *  @layout.scale(2, 2, 2)
   *    .fullSize()
   *  // Will scale the renderable by 2 in the x,y,z dimension
   *  myBackground = Surface.with({properties: {backgroudColor: 'red'}});
   * }
   *
   * @param {Number} x Scales the renderable along the x axis.
   * @param {Number} y Scales the renderable along the y axis.
   * @param {Number} z Scales the renderable along the z axis.
   * @returns {Layout} A chainable function.
   */
  scale (x,
         y = Utils.warn('Please specify y parameter for scaling'),
         z = Utils.warn('Please specify z parameter for scaling')) {
    return this.createChainableDecorator((decorations) => {
      decorations.scale = [x, y, z]
    }, decoratorTypes.childDecorator)
  }

  /**
   * Specifies the skew of a renderable. Can be applied to every kind of renderable.
   *
   * @example
   *  class myView extends View{
   *  @layout.skew(2, 2, 2)
   *    .fullSize()
   *  // Will skew the renderable by 2 in the x,y,z dimension
   *  myBackground = Surface.with({properties: {backgroudColor: 'red'}});
   * }
   *
   * @param {Number} x Skews the renderable along the x axis.
   * @param {Number} y Skews the renderable along the y axis.
   * @param {Number} z Skews the renderable along the z axis.
   * @returns {Layout} A chainable function.
   */
  skew (x, y, z) {
    return this.createChainableDecorator((decorations) => {
      decorations.skew = [x, y, z]
    }, decoratorTypes.childDecorator)
  }

  /**
   *
   * Creates an animation to show/hide the renderable. Renderables can be shown by calling
   * this.showRenderable(renderableName) and hidden using this.hideRenderable(renderableName) or
   * this.showRenderable(renderableName, false). When a renderable has been shown, it will emit the event 'shown'.
   *
   * @example
   * @layout.stick.center()
   *    .size(100,100)
   *    .animate({transition: {duration: 350}})
   * renderable = Surface.with({properties: {backgroundColor: 'red'}});
   *
   *
   *
   * @param {Object} [options] The same as famous-flex Animation Controller, plus 2 more:
   * @param {Boolean} [options.showInitially] Whether to show the renderable when the view is created. (Default: true).
   * @param {String} [options.waitFor] If specified, it will wait for the renderable with the specified name to show
   * before showing the renderable
   * @param {Object} [options.transition] Transition options.
   * @param {Function} [options.animation] Animation function (default: `AnimationController.Animation.FadedZoom`).
   * @param {Number} [options.zIndexOffset] Optional z-index difference between the hiding & showing renderable (default: 0).
   * @param {Number} [options.keepHiddenViewsInDOMCount] Keeps views in the DOM after they have been hidden (default: 0).
   * @param {Object} [options.show] Show specific options.
   * @param {Object} [options.show.transition] Show specific transition options.
   * @param {Function} [options.show.animation] Show specific animation function.
   * @param {Object} [options.hide] Hide specific options.
   * @param {Object} [options.hide.transition] Hide specific transition options.
   * @param {Function} [options.hide.animation] Hide specific animation function.
   * @param {Object} [options.transfer] Transfer options.
   * @param {Object} [options.transfer.transition] Transfer specific transition options.
   * @param {Number} [options.transfer.zIndex] Z-index the tranferables are moved on top while animating (default: 10).
   * @param {Bool} [options.transfer.fastResize] When enabled, scales the renderable i.s.o. resizing when doing the transfer animation (default: true).
   * @param {Array} [options.transfer.items] Ids (key/value) pairs (source-id/target-id) of the renderables that should be transferred.
   * @returns {Function}
   */
  animate (options = {}) {
    return this.createChainableDecorator((decorations) => {
      decorations.animation = merge({
        showInitially: true,
        animation: AnimationController.Animation.FadedZoom,
        show: {transition: options.transition || {curve: Easing.outCubic, duration: 250}},
        hide: {transition: options.transition || {curve: Easing.inCubic, duration: 250}}
      }, options)
    }, decoratorTypes.childDecorator)
  }

  /**
   * Makes the view flow by tweening all intermediate stages of a changed attribute of any renderable.
   *
   * @example
   * @layout.flow({spring: {dampingRatio: 0.8, period: 1000}})
   * class myView extends View{
     * ...
     * }
   *
   * @param {Object} Options to pass as flowOptions to the LayoutController
   * @param {Bool} [flowOptions.transition] If specified, sets the default transition to use
   * @param {Bool} [flowOptions.reflowOnResize] Smoothly reflows renderables on resize (only used when flow = true) (default: `true`).
   * @param {Object} [flowOptions.spring] Spring options used by nodes when reflowing (default: `{dampingRatio: 0.8, period: 300}`).
   * @param {Object} [flowOptions.properties] Properties which should be enabled or disabled for flowing.
   * @param {Spec} [flowOptions.insertSpec] Size, transform, opacity... to use when inserting new renderables into the scene (default: `{}`).
   * @param {Spec} [flowOptions.removeSpec] Size, transform, opacity... to use when removing renderables from the scene (default: undefined).
   * @returns {Layout} A chainable function
   */
  flow (flowOptions = {}) {
    return this.createChainableDecorator((decorations) => {
      decorations.useFlow = true
      decorations.flowOptions = flowOptions || {}
      decorations.transition = flowOptions.transition || undefined
    }, decoratorTypes.viewDecorator)
  }

  /**
   * Makes the view as scrollable. This will put the entire content in a ReflowingScrollView that uses getSize on the
   * view to determine scrolling size. If the size cannot be determined, you might consider declaring your own
   * getSize() on the View.
   *
   * @example
   * @layout.scrollable()
   * class myView extends View{
     * ...
     * }
   *
   *
   * @returns {Layout} A chainable function
   */

  scrollable (options = {}) {
    return this.createChainableDecorator((decorations) => {
      decorations.scrollableOptions = options
    }, decoratorTypes.viewDecorator)
  }

  /**
   * Make content scroll natively powered by the browser.
   *
   * @param {Object} [options] Options on how to scroll
   * @param {Boolean} [options.scrollY] Defaults to true
   * @param {Boolean} [options.scrollX] Defaults to false
   * @returns {Layout} A chainable function
   */
  nativeScrollable (options = {}) {
    let {scrollY = true, scrollX = false} = options
    return this.createChainableDecorator((decorations) => {
      decorations.nativeScrollable = {scrollY, scrollX}
    }, decoratorTypes.viewDecorator)
  }

  /**
   * Sets the margins for the docked content. This can be applied both to a child and a class. When in conflict,
   * the parent will override the child's setting. If the margin is set on a Surface, then CSS padding will be set.
   * margins can be 1, 2, or 4, parameters, which can be specified as shorthand in the same way
   * as CSS does it.
   *
   * @example
   * @layout.dockPadding(15)
   * //Creates a class with 15px margin on all sides for docked renderables
   * class myView extends View{
     *
     *  //Will be displayed with margin
   *  @layout.dock.top(20)
   *  onTop = Surface.with({content: "hello world"});
   *
   *  //Will be displayed without margin since we're using @layout.stick
   *  @layout.stick.bottom
   *  onButtom = Surface.with({content: "hey hey"});
   * }
   *

   *
   * @param {Number} firstMargin
   * @param {Number} [secondMargin]
   * @param {Number} [thirdMargin]
   * @param {Number} [fourthMargin]
   * @returns {Layout} A chainable function
   */
  dockPadding (...margins) {
    return this.createChainableDecorator((decorations) => {
      decorations.viewMargins = LayoutUtility.normalizeMargins(margins)
    }, decoratorTypes.viewDecorator)
  }

  /**
   * Like @layout.dockPadding, sets the padding between this view and its docked content.
   * When the screen width plus this padding exceeds maxContentWidth, the padding
   * is increased, so that the content is never wider than maxContentWidth.
   *
   * @example
   * @layout.columnDockPadding(720, [16])
   * //Creates a class with 16px margin on all sides for docked renderables
   * class myView extends View{
     *
     *  //Will be displayed with margin to the top and sides, and will at max be 720px wide.
   *  @layout.dock.top(20)
   *  onTop = Surface.with({content: "hello world"});
   *
   *  //Will be displayed without margin since we're using @layout.stick instead of @layout.dock
   *  @layout.stick.bottom()
   *  onButtom = Surface.with({content: "hey hey"});
   * }
   *
   * @param {Number} maxContentWidth Maximum width the content should be allowed to be.
   * @param {[Number]} defaultPadding A 1-D, 2-D, or 4-D array of padding numbers, just like the padding spec in CSS.
   * @returns {Function}
   */
  columnDockPadding (maxContentWidth = 720, defaultPadding = [0, 16, 0, 16]) {
    return this.createChainableDecorator((decorations) => {
      let normalisedPadding = LayoutUtility.normalizeMargins(defaultPadding)

      /* Default to 16px dockPadding */
      this.dockPadding(normalisedPadding)

            /* Calculate the dockPadding dynamically every time the View's size changes.
             * The results from calling this method are further handled in View.js.
             *
             * The logic behind this is 16px padding by default, unless the screen is
             * wider than 720px. In that case, the padding is increased to make the content
             * in between be at maximum 720px. */
            decorations.dynamicDockPadding = function(size, newWidth = maxContentWidth) {
                let sideWidth = size[0] > newWidth + 32 ? (size[0] - newWidth) / 2 : normalisedPadding[1];
                return [normalisedPadding[0], sideWidth, normalisedPadding[2], sideWidth];
            }
        }, decoratorTypes.viewDecorator);
    }

  /**
   *
   * Adds a custom layout function to the view.
   * This decorator works directly on the object so you shouldn't pass any arguments nor use parentheses.
   *
   * @example
   * @layout.custom((context) => {
   *  context.set('myRenderable', {
   *  size: [100, 100]
   * })
   * class MyView extends View {
   *  constructor(options) {
   *      super(options);
   *      this.renderables.myRenderable = Surface.with({properties: {backgroundColor: 'red'}});
   *  }
   * }
   *
   *
   * @param customLayoutFunction
   * @returns {Layout} A chainable function
   */
  custom (customLayoutFunction) {
    return this.createChainableDecorator((decorations) => {
      decorations.customLayoutFunction = customLayoutFunction
    }, decoratorTypes.viewDecorator)
  }
}

export const layout = new Layout()

function getPreviousResults (lastResult) {
  let gatheredResults = []
  let currentResult = lastResult
  while (currentResult) {
    gatheredResults.push(currentResult)
    currentResult = currentResult.lastResult
  }
  return gatheredResults
}

/**
 * Function used to show things in a dynamic manner, depending on the options passed.
 *
 * @example
 * @dynamic(options =>
 *  @layout.size(options.width, options.height)
 * )
 * mainComponent = MainComponent.with({options: this.options})
 *
 *
 * @param dynamicFunction
 */
export const dynamic = (dynamicFunction) =>
  createChainableDecorator((decorations) => {
    if (!decorations.dynamicFunctions) {
      decorations.dynamicFunctions = []
    }
    decorations.dynamicFunctions.push(dynamicFunction)
  }, decoratorTypes.viewOrChild)

class Event {
  /**
   * @ignore
   * Add to self in order to make the scope working
   */
  createChainableDecorator = createChainableDecorator;

  /**
   * Internal function used by the event decorators to generalize the idea of on, once, and off.
   *
   * @param {String} subscriptionType A type of subscription function, e.g. on
   * @param {String} eventName The event name
   * @param {Function} callback that is called when event has happened
   * @returns {Function}
   */
  _subscribe (subscriptionType, eventName, callback, options = {}) {
    return this.createChainableDecorator((decorations) => {
      if (!decorations.eventSubscriptions) {
        decorations.eventSubscriptions = []
      }
      decorations.eventSubscriptions.push({
        subscriptionType,
        eventName,
        callback,
          options
      })
    }, decoratorTypes.childDecorator)
  }

  /**
   *
   * Adds an event listener to the renderable when specific event happened.
   *
   * @example
   * @event.on('click', function() {this._handleClick})
   * thing = Surface.with({properties: {backgroundColor: 'red'}});
   *
   * _handleClick() { ... }
   *
   *
   * @param eventName
   * @param callback
   * @param {Object} options Options that are forwarded to the EventHandler options
   * @returns {Layout} A chainable function
   */
  on (eventName, callback, options) {
    return this._subscribe('on', eventName, callback, options);
  }

  /**
   *
   * Adds an event listener to the renderable when specific event happened once.
   *
   * @example
   * @layout.size(100,100)
   *    .stick.center()
   *    .once('click', function() {this._handleClick})
   * thing = Surface.with({properties: {backgroundColor: 'red'}});
   *
   * _handleClick() { ... }
   *
   *
   * @param eventName
   * @param callback
   * @returns {Layout} A chainable function
   */
  once (eventName, callback) {
    return this._subscribe('once', eventName, callback)
  }

  /**
   * Pipes events from one renderable to another. The other renderable has to be declared above the one that is doing
   * the piping, otherwise an exception will be thrown.
   *
   * @example
   * @layout.fullSize()
   * @event.pipe('dbsv')
   * //Pipe events to another renderable declared above, called 'dbsv'
   * scrollableSurface = Surface.with();
   *
   * @param pipeToName
   * @returns {Function}
   */
  pipe (pipeToName) {
    return this.createChainableDecorator((decorations) => {
      if (!decorations.pipes) {
        decorations.pipes = [];
      }

      decorations.pipes.push(pipeToName)
    }, decoratorTypes.childDecorator)
  }
}

export const event = new Event()

class Flow {

  /**
   * @ignore
   * Add to self in order to make the scope working
   */
  createChainableDecorator = createChainableDecorator

  /**
   *
   * Sets the default flow options for a View. These options will be overridden by
   * each of its renderables, if they have flow options defined through e.g. flow.stateStep()
   *
   * @example
   * @flow.defaultOptions({ transition: { curve: Easing.outCubic, duration: 200 } })
   * class MyView extends View {
     * }
   *
   * @param {Object} flowOptions Options to set as default.
   * @param {Object} [flowOptions.delay] The amount of milliseconds to wait in between state transitions.
   * @param {Object} [flowOptions.transition] A Famo.us-compatible transition object defining the animation specifics.
   * @param {Object} [flowOptions.transition.curve] The animation curve to use when flowing from one state to another, e.g. Easing.outCubic.
   * @param {Object} [flowOptions.transition.duration] The amount of milliseconds a flow animation should take.
   * @returns {Function}
   */
  defaultOptions (flowOptions = {}) {
    return this.createChainableDecorator((decorations) => {
      if (!decorations.flow) {
        decorations.flow = {states: {}}
      }
      decorations.flow.defaults = {...flowOptions}
    }, decoratorTypes.childDecorator)
  }

  /**
   * Functions the same as @flow.stateStep(), and additionally also immediately applies the decorators passed into the 'transformations' argument.
   * Used to define a state step, without having to also manually apply the same decorators to the renderable to ensure it is rendered this way
   * on initial show.
   *
   * @example
   * // Initial size is [100, 100], and rendered at center of parent.
   * @flow.defaultState('active', {}, layout.size(100, 100), layout.stick.center())
   * myRenderable = Surface.with();
   *
   * @param {String} stateName The state name to assign to this state step.
   * @param {Object} [stateOptions] Flow options to use in the state step.
   * @param {Object} [stateOptions.delay] The amount of milliseconds to wait in between state transitions.
   * @param {Object} [stateOptions.transition] A Famo.us-compatible transition object defining the animation specifics.
   * @param {Object} [stateOptions.transition.curve] The animation curve to use when flowing from one state to another, e.g. Easing.outCubic.
   * @param {Object} [stateOptions.transition.duration] The amount of milliseconds a flow animation should take.
   * @param {Layout} transformations Decorators to assign to this state, and to apply initially, passed in as regular comma-separated arguments.
   * @returns {Function}
   */
  defaultState (stateName = '', stateOptions = {}, ...transformations) {
    return this.createChainableDecorator((decorations, decoratorTypes, target, renderableName, descriptor) => {
      if (decorations.flow && decorations.flow.defaultState) {
        return Utils.warn(`Default state defined twice. First as state ${decorations.flow.defaultState} and then as state ${stateName}`)
      }
      if (!decorations.flow) {
        decorations.flow = {}
      }
      decorations.flow.defaultState = stateName

      this.stateStep(stateName, stateOptions, ...transformations)(target, renderableName, descriptor)
      for (let transformation of transformations) {
        transformation(target, renderableName, descriptor)
      }
    }, decoratorTypes.childDecorator)
  }

  /**
   * Used to define a state that the renderable is able to flow to. When multiple state steps with the same state name
   * are defined, flowing into that state will sequentially execute all defined steps with that state name.
   *
   * @example
   * // Initial size is [0, 0], and rendered at top left of parent, because no @flow.defaultStep() was done,
   * // and no other decorators are applied to the renderable.
   * @flow.stateStep('active', {}, layout.size(100, 100), layout.stick.center())
   * myRenderable = Surface.with();
   *
   * @param {String} stateName The state name to assign to this state step.
   * @param {Object} [stateOptions] Flow options to use in the state step.
   * @param {Object} [stateOptions.delay] The amount of milliseconds to wait in between state transitions.
   * @param {Object} [stateOptions.transition] A Famo.us-compatible transition object defining the animation specifics.
   * @param {Object} [stateOptions.transition.curve] The animation curve to use when flowing from one state to another, e.g. Easing.outCubic.
   * @param {Object} [stateOptions.transition.duration] The amount of milliseconds a flow animation should take.
   * @param {Array.Function} transformations Decorators to assign to this state, and to apply initially, passed in as regular comma-separated arguments.
   * @returns {Function}
   */
  stateStep (stateName = '', stateOptions = {}, ...transformations) {
    return this.createChainableDecorator((decorations) => {
      if (!decorations.flow) {
        decorations.flow = {}
      }
      if (!decorations.flow.states) {
        decorations.flow.states = {}
      }
      if (!decorations.flow.states[stateName]) {
        decorations.flow.states[stateName] = {steps: []}
      }
      decorations.flow.states[stateName].steps.unshift({transformations, options: stateOptions})
    }, decoratorTypes.childDecorator)
  }

  /**
   * Defines the View-level states, that exist of concurrently and sequentially executed renderable-level states.
   * When e.g. View.setViewFlowState('active') is called, the renderable states defined in the view-level state 'active' are executed.
   *
   * @example
   * // Calling setViewFlowState('active') will first hide the loader, and when that is completed, show both buttons at the same time.
   * @flow.viewStates({ 'active': [{loader: 'hidden'}, { button1: 'active', button2: 'active' }] })
   * class MyView extends View {
     *
   *   @flow.defaultState('shown', {}, layout.opacity(1), layout.fullSize())
   *   @flow.stateStep('hidden', {}, layout.opacity(0))
   *   loader = Surface.with();
   *
   *   @flow.defaultState('inactive', {}, layout.opacity(0), layout.size(100, 100), layout.stick.top())
   *   @flow.stateStep('active', {}, layout.opacity(1))
   *   button1 = Surface.with();
   *
   *   @flow.defaultState('inactive', {}, layout.opacity(0), layout.size(100, 100), layout.stick.bottom())
   *   @flow.stateStep('active', {}, layout.opacity(1))
   *   button1 = Surface.with();
   * }
   *
   * @param {Object} states An object keyed by View-level state names, with values of arrays of objects.
   * @returns {Function}
   */
  viewStates (states = {}) {
    return this.createChainableDecorator((decorations) => {
      if (!decorations.viewFlow) {
        decorations.viewFlow = {}
      }

      decorations.viewFlow.viewStates = states
    }, decoratorTypes.viewDecorator)
  }

  /**
   * A wrapper around @flow.stateStep, to allow defining multiple steps with the same state name.
   *
   * @param {String} stateName State name to assign states to.
   * @param {Array.Object} states An array of {stateOptions: [..], transformations: [..]} objects, with stateOptions and transformations
   * being the same usage as @flow.stateStep().
   * @returns {Flow}
   */
  multipleStateStep (stateName = '', states = []) {
    return this.createChainableDecorator((decorations, decoratorType, target, renderableName, descriptor) => {
      for (let {stateOptions, transformations} of states) {
        flow.stateStep(stateName, stateOptions, ...transformations)(target, renderableName, descriptor)
      }
    })
  }
}

export const flow = new Flow()