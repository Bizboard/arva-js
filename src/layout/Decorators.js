/**


 @author: Hans van den Akker (mysim1)
 @license NPOSL-3.0
 @copyright Bizboard, 2016

 */
import merge                    from 'lodash/merge.js';
import extend                   from 'lodash/extend.js';

import AnimationController      from 'famous-flex/AnimationController.js';
import LayoutUtility            from 'famous-flex/LayoutUtility.js';
import Easing                   from 'famous/transitions/Easing.js';

import {Utils}                    from '../utils/view/Utils.js';

function prepDecoratedRenderable(viewOrRenderable, renderableName, descriptor) {
    /* This function can also be called as prepDecoratedRenderable(renderable) */
    if (!renderableName && !descriptor) {
        let renderable = viewOrRenderable;
        renderable.decorations = renderable.decorations || {};
        return renderable;
    }
    let view = viewOrRenderable;

    if (!view.renderableConstructors) {
        view.renderableConstructors = new Map();
    }

    let constructors = view.renderableConstructors;

    /* Because the inherited views share the same prototype, we'll have to split it up depending on which subclass we're referring out */
    let specificRenderableConstructors = constructors.get(view.constructor);
    if (!specificRenderableConstructors) {
        specificRenderableConstructors = constructors.set(view.constructor, {}).get(view.constructor);
    }

    if (!specificRenderableConstructors[renderableName]) {
        /* Getters have a get() method on the descriptor, class properties have an initializer method.
         * get myRenderable(){ return new Surface() } => descriptor.get();
         * myRenderable = new Surface(); => descriptor.initializer();
         */
        if (descriptor.get) {
            specificRenderableConstructors[renderableName] = descriptor.get;
        } else if (descriptor.initializer) {
            specificRenderableConstructors[renderableName] = descriptor.initializer;
        }
    }
    let constructor = specificRenderableConstructors[renderableName];
    if (!constructor.decorations) {
        constructor.decorations = {descriptor: descriptor};
    }

    return constructor;
}

/**
 * Extracts a decorations object
 *
 * @param {View} prototype
 * @returns {Object} The decorations for the prototype
 */
function prepPrototypeDecorations(prototype) {

    /* To prevent inherited classes from taking each others class-level decorators, we need to store these decorations in
     * a map, similarly to function preparing a decorated renderable
     */
    if (!prototype.decorationsMap) {
        prototype.decorationsMap = new Map();
    }

    let {decorationsMap} = prototype;

    let decorations = decorationsMap.get(prototype.constructor);
    if (!decorations) {
        decorations = decorationsMap.set(prototype.constructor, {}).get(prototype.constructor);
    }

    /* Return the class' prototype, so it can be extended by the decorator */
    return decorations;
}

/**
 * Describes a set of decorators used for layouting of a renderable in a View.
 */
export const layout = {


    /**
     * Merely marks a view property as a decorated renderable, which allows it to be rendered.
     * Use this in combination with a @layout.custom decorator on the view in which this renderable resides.
     *
     * @example
     * @layout.renderable
     * renderable = new Surface();
     *
     * @returns {Function} A decorator function
     */
    renderable: function () {
        return function (view, renderableName, descriptor) {
            prepDecoratedRenderable(view, renderableName, descriptor);
        }
    },

    /**
     * Marks the renderable to cover the entire screen. Translate can also be specified on such a renderable.
     *
     * @example
     * @layout.fullSize()
     * // View will have a red background
     * background = new Surface({properties: {backgroundColor: 'red'}});
     *
     * @returns {Function} A decorator function
     */
    fullSize: function () {
        return function (view, renderableName, descriptor) {
            let renderable = prepDecoratedRenderable(view, renderableName, descriptor);
            renderable.decorations.fullSize = true;
        }
    },

    /**
     * Specifies the space that should come before the docked renderable. Useful when not specifying the size in the
     * layout.dock function. Note that the space does not appear if there isn't any renderable with a size greater than
     * zero before it.
     *
     * @example
     * // there's a 20px space before this box
     * @layout.dockSpace(20)
     * @layout.size(100, 100)
     * @layout.dock.left()
     * box = new Surface({properties: {backgroundColor: 'red'}});
     *
     * @param {Number} space The space that is inserted before the renderable.
     * @returns {Function} A decorator function
     */
    dockSpace: function (space) {
        return function (view, renderableName, descriptor) {
            let renderable = prepDecoratedRenderable(view, renderableName, descriptor);
            // Todo refactor also the z index to the dock
            renderable.decorations.dock = renderable.decorations.dock ? extend(renderable.decorations.dock, {space}) : {space};
        };
    },

    /**
     * Internal function to do docking
     *
     * @param dockMethod
     * @param size
     * @param space
     * @param zIndex
     * @returns {Function}
     */
    _dockTo: function (dockMethod, size, space = 0, zIndex) {
        return function (view, renderableName, descriptor) {
            let renderable = prepDecoratedRenderable(view, renderableName, descriptor);

            if (renderable.decorations.dock) {
                space = space || renderable.decorations.dock.space;
            }

            let width = dockMethod === 'left' || dockMethod === 'right' ? size : undefined;
            let height = dockMethod === 'top' || dockMethod === 'bottom' ? size : undefined;

            let twoDimensionalSize = [width, height];
            // Todo refactor also the z index to the dock, probably
            renderable.decorations.dock = {space, dockMethod, size: twoDimensionalSize};

            if (!renderable.decorations.translate) {
                renderable.decorations.translate = [0, 0, 0];
            }
            if (zIndex) {
                renderable.decorations.translate[2] = zIndex;
            }
        };
    },

    dock: {
        /**
         * Docks the renderable to the left.
         * When using both a docked size and the layout.size decorator, then that layout.size becomes the actual inner size.
         * The renderable can then be stickd within the docking area with origin and align. When combined with align, treats
         * the context size the docking size.
         * When using layout.size without specifying a docked size, it will use that size as docking size. Useful for
         * automatic sizing when parent defines true size and orthogonal size (e.g. height for dock 'left') has to be defined.
         *
         * @example
         * @layout.dock.left(30, 0, 10)
         * @layout.size(15, undefined)
         * @layout.origin(0.5, 0)
         * @layout.align(0.5, 0)
         * dockedRenderable = new Surface({properties: {backgroundColor: 'red'}});
         *
         *
         * @param {Number|Function} [size]. The size of the renderable in the one dimension that is being docked, e.g.
         * dock left or right will be width, whereas dock top or bottom will result in height. For more information about
         * different variations, see layout.size.
         * @param {Number} [space]. Any space that should be inserted before the docked renderable
         * @param {Number} [zIndex]. DEPRECATED: Use translate(0, 0, zIndex) instead.
         * @returns {Function} A decorator function
         */
        left: function () {
            return layout._dockTo('left', ...arguments)
        },

        /**
         * Docks the renderable to the right.
         * When using both a docked size and the layout.size decorator, then that layout.size becomes the actual inner size.
         * The renderable can then be stickd within the docking area with origin and align. When combined with align, treats
         * the context size the docking size.
         * When using layout.size without specifying a docked size, it will use that size as docking size. Useful for
         * automatic sizing when parent defines true size and orthogonal size (e.g. height for dock 'left') has to be defined.
         *
         * @example
         * @layout.dock.right(30, 0, 10)
         * @layout.size(15, undefined)
         * @layout.origin(0.5, 0)
         * @layout.align(0.5, 0)
         * dockedRenderable = new Surface({properties: {backgroundColor: 'red'}});
         *
         * @param {Number|Function} [size]. The size of the renderable in the one dimension that is being docked, e.g.
         * dock left or right will be width, whereas dock top or bottom will result in height. For more information about
         * different variations, see layout.size.
         * @param {Number} [space]. Any space that should be inserted before the docked renderable
         * @param {Number} [zIndex]. DEPRECATED: Use translate(0, 0, zIndex) instead.
         * @returns {Function} A decorator function
         */
        right: function () {
            return layout._dockTo('right', ...arguments)
        },

        /**
         *
         * Docks the renderable to the top.
         * When using both a docked size and the layout.size decorator, then that layout.size becomes the actual inner size.
         * The renderable can then be stickd within the docking area with origin and align. When combined with align, treats
         * the context size the docking size.
         * When using layout.size without specifying a docked size, it will use that size as docking size. Useful for
         * automatic sizing when parent defines true size and orthogonal size (e.g. height for dock 'left') has to be defined.
         *
         * @example
         * @layout.dock.top(30, 0, 10)
         * @layout.size(15, undefined)
         * @layout.origin(0.5, 0)
         * @layout.align(0.5, 0)
         * dockedRenderable = new Surface({properties: {backgroundColor: 'red'}});
         *
         *
         * @param {Number|Function} [size]. The size of the renderable in the one dimension that is being docked, e.g.
         * dock left or right will be width, whereas dock top or bottom will result in height. For more information about
         * different variations, see layout.size.
         * @param {Number} [space = 0]. Any space that should be inserted before the docked renderable
         * @param {Number} [zIndex = 0]. DEPRECATED: Use translate(0, 0, zIndex) instead.
         * @returns {Function} A decorator function
         */
        top: function () {
            return layout._dockTo('top', ...arguments)
        },

        /**
         *
         * Docks the renderable to the bottom.
         * When using both a docked size and the layout.size decorator, then that layout.size becomes the actual inner size.
         * The renderable can then be stickd within the docking area with origin and align. When combined with align, treats
         * the context size the docking size.
         * When using layout.size without specifying a docked size, it will use that size as docking size. Useful for
         * automatic sizing when parent defines true size and orthogonal size (e.g. height for dock 'left') has to be defined.
         *
         * @example
         * @layout.dock.bottom(30, 0, 10)
         * @layout.size(15, undefined)
         * @layout.origin(0.5, 0)
         * @layout.align(0.5, 0)
         * dockedRenderable = new Surface({properties: {backgroundColor: 'red'}});
         *
         *
         * @param {Number|Function} [size]. The size of the renderable in the one dimension that is being docked, e.g.
         * dock left or right will be width, whereas dock top or bottom will result in height. For more information about
         * different variations, see layout.size.
         * @param {Number} [space = 0]. Any space that should be inserted before the docked renderable
         * @param {Number} [zIndex = 0]. DEPRECATED: Use translate(0, 0, zIndex) instead.
         * @returns {Function} A decorator function
         */
        bottom: function () {
            return layout._dockTo('bottom', ...arguments)
        },

        /**
         * Fills the space that is left after the docking with this renderable. When using layout.size, it will use that
         * size as an inner size. This works similarly to other docking, from where translate, size, origin, align, etc
         * can be specified.
         *
         * @example
         * @layout.dock.fill()
         * filledRenderable = new Surface({properties: {backgroundColor: 'red'}});
         *
         * @returns {Function} A decorator function
         */
        fill: function () {
            return layout._dockTo('fill', ...arguments)
        },
        /**
         * Marks the renderable as not being docked anymore. Useful when dynamically changing decorations through
         * this.decorateRenderable or this.setRenderableFlowState
         *
         * @example
         * @layout.dock.fill()
         * @flow.stateStep('nonFilled', layout.dock.none(), layout.size(100, 100))
         * filledRenderable = new Surface({properties: {backgroundColor: 'red'}});
         *
         * @returns {Function} A decorator function
         */
        none: function () {
            return function (view, renderableName, descriptor) {
                let renderable = prepDecoratedRenderable(view, renderableName, descriptor);
                renderable.decorations.disableDock = true;
            }
        }

    },

    /**
     * Makes the renderable allowed to be dragged around. this.renderables[name] refers to a RenderNode containing this
     * draggable along with the renderable itself.
     *
     * @example
     * @layout.draggable({xRange: [0, 100}, yRange: [0, 200]})
     * @layout.size(100, 100)
     * // Makes a draggable square that is red
     * draggableRenderable = new Surface({properties: {backgroundColor: 'red'});
     *
     * @param {Object} [draggableOptions]. Same options that can be passed to a Famous Draggable.
     * @param {Number} [options.snapX] grid width for snapping during drag
     * @param {Number} [options.snapY] grid height for snapping during drag
     * @param {Array.Number} [options.xRange] maxmimum [negative, positive] x displacement from start of drag
     * @param {Array.Number} [options.yRange] maxmimum [negative, positive] y displacement from start of drag
     * @param {Number} [options.scale] one pixel of input motion translates to this many pixels of output drag motion
     * @param {Number} [options.projection] User should set to Draggable._direction.x or
     *    Draggable._direction.y to constrain to one axis.
     * @returns {Function}
     */
    draggable: function (draggableOptions = {}) {
        return function (view, renderableName, descriptor) {
            let renderable = prepDecoratedRenderable(view, renderableName, descriptor);
            renderable.decorations.draggableOptions = draggableOptions;
        }
    },

    /**
     * Makes the renderable swipable with physics-like velocity after the dragging is released. Emits event
     * 'thresholdReached' with arguments ('x'|'y', 0|1) when any thresholds have been reached. this.renderables[name]
     * now refers to a a RenderNode containing a positionModifier along with the renderable itself.
     *
     * @example
     * @layout.size(100, 100)
     * @layout.swipable({xRange: [0, 100], snapX: true})
     * //Make a red box that can slide to the right
     * swipable = new Surface({properties: {backgroundColor: 'red'});
     *
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
     * @returns {Function} A decorator function
     */
    swipable: function (options) {
        return function (view, renderableName, descriptor) {
            let renderable = prepDecoratedRenderable(view, renderableName, descriptor);
            renderable.decorations.swipableOptions = options;
        }
    },


    /**
     * Clips the renderable by creating another DOM-element with overflow: hidden. Internally, creates a Famous
     * ContainerSurface.
     * The two size parameters can either be a number or undefined (equals the context size).
     *
     * @example
     * @layout.size(40,40)
     * @layout.clip(20, 20)
     * // Shows a quarter of a circle
     * renderable = new Surface({properties: {backgroundColor: 'red', borderRadius: '50%'});
     *
     * @param {Number} width The width of the ContainerSurface
     * @param {Number} heigh The height of the ContainerSurface
     * @param {Object} [properties]. Properties that will be passed to the newly created parent DOM-element.
     * If specified, merged with {overflow: 'hidden'}
     * @returns {Function} A decorator function
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
     * text = new Surface({content: 'This is some text', properties: {backgroundColor: 'red'}});
     *
     * @param {Number|Function} x
     * @param {Number|Function} y
     * @returns {Function} A decorator function
     */
    size: function (x, y) {
        return function (view, renderableName, descriptor) {
            if (Array.isArray(x)) {
                throw Error('Please specify size as two arguments, and not as an array');
            }
            let renderable = prepDecoratedRenderable(view, renderableName, descriptor);
            renderable.decorations.size = [x, y];
        };
    },
    clip: function (width, height, properties = {}) {
        return function (view, renderableName, descriptor) {
            let renderable = prepDecoratedRenderable(view, renderableName, descriptor);
            renderable.decorations.clip = {size: [width, height], properties};
        }
    },

    /**
     * Rotates the renderable around any of the three axes (in radians).
     *
     * @example
     * @layout.size(100,100)
     * @layout.rotate(0, 0, Math.PI)
     * // Writes text upside down
     * renderable = new Surface({content: 'upside down text'});
     *
     * @param {Number} x The rotation around the x axis (flips vertically)
     * @param {Number} y The rotation around the y axis (flips horizontally)
     * @param {Number} z The rotation around the z axis (rotatesin in the more intuitive sense)
     * @returns {Function} A decorator function
     */
    rotate: function (x, y, z) {
        return function (view, renderableName, descriptor) {
            let renderable = prepDecoratedRenderable(view, renderableName, descriptor);
            renderable.decorations.rotate = [x, y, z];
        }
    },

    /**
     * Rotates the renderable around any of the three axes (in radians) relatively to the current rotation
     *
     * @example
     * @layout.size(100,100)
     * @layout.rotate(0, 0, Math.PI)
     * // Writes text upside down
     * renderable = new Surface({content: 'upside down text'});
     *
     * @param {Number} x The rotation around the x axis (flips vertically)
     * @param {Number} y The rotation around the y axis (flips horizontally)
     * @param {Number} z The rotation around the z axis (rotatesin in the more intuitive sense)
     * @returns {Function} A decorator function
     */
    rotateFrom: function (x, y, z) {
        return function (view, renderableName, descriptor) {
            let renderable = prepDecoratedRenderable(view, renderableName, descriptor);
            let propertyName = 'rotate';
            let properties = renderable.decorations[propertyName] || [0,0,0];
            renderable.decorations[propertyName] = [properties[0]+x, properties[1]+y, properties[2]+z];
        }
    },

    /**
     * Sets the opacity of a renderable.
     *
     * @example
     * @layout.opacity(0.5)
     * @layout.size(100, 10)
     * @layout.place.center()
     * // Writes text that is half invisible
     * renderable = new Surface({content: 'Half invisible'});
     *
     * @param {Number} opacity The opacity, between 0 and 1
     * @returns {Function} A decorator function
     */
    opacity: function (opacity) {
        return function (view, renderableName, descriptor) {
            let renderable = prepDecoratedRenderable(view, renderableName, descriptor);
            renderable.decorations.opacity = opacity;
        }
    },


    _stickTo: function (stick) {
        return function (view, renderableName, descriptor) {
            let origin = [0, 0], align = [0, 0];
            switch (stick) {
                case 'center':
                    origin = align = [0.5, 0.5];
                    break;
                case 'bottomRight':
                    origin = align = [1, 1];
                    break;
                case 'bottomLeft':
                    origin = align = [0, 1];
                    break;
                case 'topRight':
                    origin = align = [1, 0];
                    break;
                case 'left':
                    origin = align = [0, 0.5];
                    break;
                case 'right':
                    origin = align = [1, 0.5];
                    break;
                case 'top':
                    origin = align = [0.5, 0];
                    break;
                case 'bottom':
                    origin = align = [0.5, 1];
                    break;
                default:
                case 'topLeft':
                    origin = align = [0, 0];
                    break;

            }

            let renderable = prepDecoratedRenderable(view, renderableName, descriptor);
            renderable.decorations.origin = origin;
            renderable.decorations.align = align;
        };
    },
    /**
     * Places the renderable by settings origin/align. If nothing is set, it will default to topleft.
     *
     * @example
     * @layout.size(100,~300)
     * @layout.stick.center()
     * renderable = new Surface({content: 'centered text'});
     *
     * @param {String} stick. Can be either of 'center', 'left', 'right', 'bottom', 'top', 'bottomleft', 'bottomright',
     * 'topright', 'topleft'
     * @returns {Function} A decorator function
     */
    stick: {
        center: function () {
            return layout._stickTo('center');
        },
        left: function () {
            return layout._stickTo('left');
        },
        right: function () {
            return layout._stickTo('right');
        },
        top: function () {
            return layout._stickTo('top');
        },
        bottom: function () {
            return layout._stickTo('bottom');
        },
        bottomLeft: function () {
            return layout._stickTo('bottomLeft');
        },
        bottomRight: function () {
            return layout._stickTo('bottomRight');
        },
        topLeft: function () {
            return layout._stickTo('topLeft');
        },
        topRight: function () {
            return layout._stickTo('topRight');
        }
    },

    /**
     * Sets the point where the renderable has its anchor from where rotation and translation will be done.
     * You could consider it as translating the negative of the proportion times its size. The arguments are always
     * between and including 0 and 1.
     *
     * @example
     * @layout.origin(0.5, 0)
     * @layout.align(0.5, 0.5)
     * @layout.size(100,100)
     * //Displays a red box horizontically centered and displays just below the vertical mid point
     * renderable = new Surface({properties: {backgroundColor: 'red'}});
     *
     *
     * @param {Number} x. The x of the origin.
     * @param {Number} y. The y of the origin.
     * @returns {Function} A decorator function.
     */
    origin: function (x, y) {
        return function (view, renderableName, descriptor) {
            let renderable = prepDecoratedRenderable(view, renderableName, descriptor);
            renderable.decorations.origin = [x, y];
        };
    },

    /**
     * Translates the renderable by a proportion of the context size.
     *
     * @example
     * @layout.align(0.5, 0.5)
     * @layout.size(100,100)
     * //Displays a red box just below the vertical mid point and past the horizontal mid point
     * renderable = new Surface({properties: {backgroundColor: 'red'}});
     *
     * @param {Number} x. The proportion of the context width that is going to be translated.
     * @param {Number} y. The proportion of the context height that is going to be translated.
     * @returns {Function} A decorator function.
     */
    align: function (x, y) {
        return function (view, renderableName, descriptor) {
            let renderable = prepDecoratedRenderable(view, renderableName, descriptor);
            renderable.decorations.align = [x, y];
        };
    },

    /**
     * Specifies a translation of a renderable. Can be applied to every kind of renderable (docked, fullSize,
     * and normal). Can also be applied on view level to translate every renderable of that view. The view wide translation defaults
     * to [0, 0, 10] in order to always increase the z space of every level of the Famous rendering tree.
     *
     * @example
     * @layout.translate(0, 0, 20)
     * class myView extends View{
     *  @layout.translate(0, 0, -20)
     *  @layout.fullSize()
     *  // Will display relatively at z level 0 (20 minus 20)
     *  myBackground = new Surface({properties: {backgroudColor: 'red'}});
     * }
     *
     * @param {Number} x Moves the renderable along the x axis.
     * @param {Number} y Moves the renderable along the y axis.
     * @param {Number} z Moves the renderable along the z axis.
     * @returns {Function} A decorator function.
     */
    translate: function (x, y, z) {
        return function (target, renderableName, descriptor) {
            if (Array.isArray(x)) {
                throw Error('Please specify translate as three arguments, and not as an array');
            }
            let propertyName, decorations;
            if (typeof target == 'function') {
                decorations = prepPrototypeDecorations(target.prototype);
                propertyName = 'extraTranslate';
            } else {
                decorations = prepDecoratedRenderable(...arguments).decorations;
                propertyName = 'translate';
            }
            decorations[propertyName] = [x, y, z];
        };
    },

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
     *  @layout.fullSize()
     *  // Will display relatively at z level 0 (20 minus 20)
     *  myBackground = new Surface({properties: {backgroudColor: 'red'}});
     * }
     *
     * @param {Number} x Moves the renderable along the x axis.
     * @param {Number} y Moves the renderable along the y axis.
     * @param {Number} z Moves the renderable along the z axis.
     * @returns {Function} A decorator function.
     */
    translateFrom: function (x, y, z) {
        return function (target, renderableName, descriptor) {
            if (Array.isArray(x)) {
                throw Error('Please specify translate as three arguments, and not as an array');
            }
            let propertyName, decorations;
            if (typeof target == 'function') {
                decorations = prepPrototypeDecorations(target.prototype);
                propertyName = 'extraTranslate';
            } else {
                decorations = prepDecoratedRenderable(...arguments).decorations;
                propertyName = 'translate';
            }
            let properties = decorations[propertyName] || [0,0,0];
            decorations[propertyName] = [properties[0]+x, properties[1]+y, properties[2]+z];
        };
    },

    /**
     * Specifies the scale of a renderable. Can be applied to every kind of renderable.
     *
     * @example
     *  class myView extends View{
     *  @layout.scale(2, 2, 2)
     *  @layout.fullscreen
     *  // Will scale the renderable by 2 in the x,y,z dimension
     *  myBackground = new Surface({properties: {backgroudColor: 'red'}});
     * }
     *
     * @param {Number} x Scales the renderable along the x axis.
     * @param {Number} y Scales the renderable along the y axis.
     * @param {Number} z Scales the renderable along the z axis.
     * @returns {Function} A decorator function.
     */
    scale: function (x,
                     y = Utils.warn('Please specify y parameter for scaling'),
                     z = Utils.warn('Please specify z parameter for scaling')) {
        return function (target, renderableName, descriptor) {
            let decorations = prepDecoratedRenderable(...arguments).decorations;
            let propertyName = 'scale';
            decorations[propertyName] = [x, y, z];
        };
    },

    /**
     * Specifies the skew of a renderable. Can be applied to every kind of renderable.
     *
     * @example
     *  class myView extends View{
     *  @layout.skew(2, 2, 2)
     *  @layout.fullscreen
     *  // Will skew the renderable by 2 in the x,y,z dimension
     *  myBackground = new Surface({properties: {backgroudColor: 'red'}});
     * }
     *
     * @param {Number} x Skews the renderable along the x axis.
     * @param {Number} y Skews the renderable along the y axis.
     * @param {Number} z Skews the renderable along the z axis.
     * @returns {Function} A decorator function.
     */
    skew: function (x, y, z) {
        return function (target, renderableName, descriptor) {
            let decorations = prepDecoratedRenderable(...arguments).decorations;
            let propertyName = 'skew';
            decorations[propertyName] = [x, y, z];
        };
    },

    /**
     *
     * Creates an animation controller to show/hide the renderable. Renderables can be shown by calling
     * this.showRenderable(renderableName) and hidden using this.hideRenderable(renderableName) or
     * this.showRenderable(renderableName, false). When a renderable has been shown, it will emit the event 'shown'.
     *
     * @example
     * @layout.stick.center()
     * @layout.size(100,100)
     * @layout.animate({transition: {duration: 350}})
     * renderable = new Surface({properties: {backgroundColor: 'red'}});
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
    animate: function (options = {}) {
        return function (view, renderableName, descriptor) {
            let renderableConstructor = prepDecoratedRenderable(view, renderableName, descriptor);
            options = merge({
                showInitially: true,
                animation: AnimationController.Animation.FadedZoom,
                show: {transition: options.transition || {curve: Easing.outCubic, duration: 250}},
                hide: {transition: options.transition || {curve: Easing.inCubic, duration: 250}}
            }, options);

            renderableConstructor.decorations.animation = options;

            constructor.decorations = renderableConstructor.decorations;

        };
    },

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
     * @returns {Function} A decorator function
     */
    flow: function (flowOptions = {}) {
        return function (target) {
            let decorations = prepPrototypeDecorations(target.prototype);
            decorations.useFlow = true;
            decorations.flowOptions = flowOptions || {};
            decorations.transition = flowOptions.transition || undefined;
        }
    },

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
     * @returns {Function} A decorator function
     */

    scrollable: function (options = {}) {
        return function (target) {
            let decorations = prepPrototypeDecorations(target.prototype);
            decorations.scrollableOptions = options;
        }
    },

    nativeScrollable: function () {
        return function (target) {
            let decorations = prepPrototypeDecorations(target.prototype);
            decorations.nativeScrollable = true;
        }
    },

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
     *  onTop = new Surface({content: "hello world"});
     *
     *  //Will be displayed without margin since we're using @layout.stick
     *  @layout.stick.bottom
     *  onButtom = new Surface({content: "hey hey"});
     * }
     *

     *
     * @param {Number} firstMargin
     * @param {Number} [secondMargin]
     * @param {Number} [thirdMargin]
     * @param {Number} [fourthMargin]
     * @returns {Function} A decorator function
     */
    dockPadding: function (...margins) {
        return function (target) {
            let decorations;
            if (typeof target == 'function') {
                decorations = prepPrototypeDecorations(target.prototype);
            } else {
                decorations = prepDecoratedRenderable(...arguments).decorations;
            }
            decorations.viewMargins = LayoutUtility.normalizeMargins(margins);
        };
    },

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
     *  onTop = new Surface({content: "hello world"});
     *
     *  //Will be displayed without margin since we're using @layout.stick instead of @layout.dock
     *  @layout.stick.bottom
     *  onButtom = new Surface({content: "hey hey"});
     * }
     *
     * @param {Number} maxContentWidth Maximum width the content should be allowed to be.
     * @param {Array} defaultPadding A 1-D, 2-D, or 4-D array of padding numbers, just like the padding spec in CSS.
     * @returns {Function}
     */
    columnDockPadding: function (maxContentWidth = 720, defaultPadding = [0, 16, 0, 16]) {
        return function (target) {
            let decorations = prepPrototypeDecorations(target.prototype);
            let normalisedPadding = LayoutUtility.normalizeMargins(defaultPadding);

            /* Default to 16px dockPadding */
            layout.dockPadding(normalisedPadding);

            /* Calculate the dockPadding dynamically every time the View's size changes.
             * The results from calling this method are further handled in View.js.
             *
             * The logic behind this is 16px padding by default, unless the screen is
             * wider than 720px. In that case, the padding is increased to make the content
             * in between be at maximum 720px. */
            decorations.dynamicDockPadding = function(size) {
                let sideWidth = size[0] > maxContentWidth + 32 ? (size[0] - maxContentWidth) / 2 : normalisedPadding[1];
                return [normalisedPadding[0], sideWidth, normalisedPadding[2], sideWidth];
            }
        };
    },

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
     *      this.renderables.myRenderable = new Surface({properties: {backgroundColor: 'red'}});
     *  }
     * }
     *
     *
     * @param customLayoutFunction
     * @returns {Function} A decorator function
     */
    custom: function (customLayoutFunction) {
        return function (target) {
            let decorations = prepPrototypeDecorations(target.prototype);
            decorations.customLayoutFunction = customLayoutFunction;
        };
    }
};

export const event = {
    /**
     * Internal function used by the event decorators to generalize the idea of on, once, and off.
     *
     * @param {String} subscriptionType A type of subscription function, e.g. on
     * @param {String} eventName The event name
     * @param {Function} callback that is called when event has happened
     * @returns {Function}
     */
    _subscribe: function (subscriptionType, eventName, callback) {
        return function (view, renderableName, descriptor) {
            let renderable = prepDecoratedRenderable(view, renderableName, descriptor);
            if (!renderable.decorations.eventSubscriptions) {
                renderable.decorations.eventSubscriptions = [];
            }
            renderable.decorations.eventSubscriptions.push({
                subscriptionType: subscriptionType,
                eventName: eventName,
                callback: callback
            });
        };
    },

    /**
     *
     * Adds an event listener to the renderable when specific event happened.
     *
     * @example
     * @layout.on('click', function() {this._handleClick})
     * thing = new Surface({properties: {backgroundColor: 'red'}});
     *
     * _handleClick() { ... }
     *
     *
     * @param eventName
     * @param callback
     * @returns {Function} A decorator function
     */
    on: function (eventName, callback) {
        return event._subscribe('on', eventName, callback);
    },


    /**
     *
     * Adds an event listener to the renderable when specific event happened once.
     *
     * @example
     * @layout.size(100,100)
     * @layout.stick.center()
     * @layout.once('click', function() {this._handleClick})
     * thing = new Surface({properties: {backgroundColor: 'red'}});
     *
     * _handleClick() { ... }
     *
     *
     * @param eventName
     * @param callback
     * @returns {Function} A decorator function
     */
    once: function (eventName, callback) {
        return event._subscribe('once', eventName, callback);
    },

    /**
     * Pipes events from one renderable to another. The other renderable has to be declared above the one that is doing
     * the piping, otherwise an exception will be thrown.
     *
     * @example
     * @layout.fullSize()
     * @layout.pipe('dbsv')
     * //Pipe events to another renderable declared above, called 'dbsv'
     * scrollableSurface = new Surface();
     *
     * @param pipeToName
     * @returns {Function}
     */
    pipe: function (pipeToName) {
        return function (view, renderableName, descriptor) {
            let renderable = prepDecoratedRenderable(view, renderableName, descriptor);
            if (!renderable.decorations.pipes) {
                renderable.decorations.pipes = [];
            }

            renderable.decorations.pipes.push(pipeToName);
        };
    }
};

export const flow = {
    defaultOptions: function (flowOptions = {}) {
        return function (target, renderableName, descriptor) {
            let decorations = prepDecoratedRenderable(...arguments).decorations;
            if (!decorations.flow) {
                decorations.flow = {states: {}};
            }
            decorations.flow.defaults = {...flowOptions};
        }
    },

    defaultState: function (stateName = '', stateOptions = {}, ...transformations) {
        return function (target, renderableName, descriptor) {
            flow.stateStep(stateName, stateOptions, ...transformations)(target, renderableName, descriptor);
            for(let transformation of transformations) {
                transformation(target, renderableName, descriptor);
            }
        }
    },

    stateStep: function (stateName = '', stateOptions = {}, ...transformations) {
        return function (target, renderableName, descriptor) {
            let decorations = prepDecoratedRenderable(...arguments).decorations;
            if (!decorations.flow) {
                decorations.flow = {states: {}};
            }
            if (!decorations.flow.states[stateName]) {
                decorations.flow.states[stateName] = {steps: []};
            }
            decorations.flow.states[stateName].steps.unshift({transformations, options: stateOptions});
        }
    },

    viewStates: function (states = {}) {
        return function (target) {
            let decorations = prepPrototypeDecorations(target.prototype);
            if (!decorations.flow) {
                decorations.flow = {};
            }
            decorations.flow.viewStates = states;
        }
    },

    multipleStateStep: function(stateName = '', states = []){
        return function (target, renderableName, descriptor) {
            for(let {stateOptions, transformations} of states){
                flow.stateStep(stateName, stateOptions, ...transformations)(target, renderableName, descriptor);
            }
        }
    }
};
