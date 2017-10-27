/**
 @author: Karl Lundfall (lundfall)
 @license NPOSL-3.0
 @copyright Bizboard, 2015

 Adapted version of the LayoutDockHelper made by Hein Rutjes in famous-flex
 */


import LayoutUtility from 'famous-flex/LayoutUtility';

/**
 * @class
 * @param {LayoutContext} context layout-context
 * @param {Object} [options] additional options
 * @param {Object} [options.margins] margins to start out with (default: 0px)
 * @param {Number} [options.translateZ] z-index to use when translating objects (default: 0)
 * @alias module:LayoutDockHelper
 */
export function TrueSizedLayoutDockHelper(context, options) {
    var size = context.size;
    this._size = size;
    this._context = context;
    this._options = options;
    this._data = {
        z: (options && options.translateZ) ? options.translateZ : 0
    };
    var margins = [0, 0, 0, 0];
    if (options && options.margins) {
        margins = LayoutUtility.normalizeMargins(options.margins);
    }
    this._initialData = {
        left: margins[3],
        top: margins[0],
        right: size[0] - margins[1],
        bottom: size[1] - margins[2]
    };
    this._data.left = this._initialData.left;
    this._data.top = this._initialData.top;
    this._data.right = this._initialData.right;
    this._data.bottom = this._initialData.bottom;
}

/**
 * Parses the layout-rules based on a JSON data object.
 *
 * **Example:**
 *
 * ```JSON
 * [
 *   ['top', 'header', 50],
 *   ['bottom', 'footer', 50, 10], // z-index: 10
 *   ['margins', [10, 5]], // marginate remaining space: 10px top/bottom, 5px left/right
 *   ['fill', 'content']
 * ]
 * ```
 *
 * @param {Object} data JSON object
 */
TrueSizedLayoutDockHelper.prototype.parse = function (data) {
    for (var i = 0; i < data.length; i++) {
        var rule = data[i];
        var value = (rule.length >= 3) ? rule[2] : undefined;
        if (rule[0] === 'top') {
            this.top(rule[1], value, (rule.length >= 4) ? rule[3] : undefined);
        }
        else if (rule[0] === 'left') {
            this.left(rule[1], value, (rule.length >= 4) ? rule[3] : undefined);
        }
        else if (rule[0] === 'right') {
            this.right(rule[1], value, (rule.length >= 4) ? rule[3] : undefined);
        }
        else if (rule[0] === 'bottom') {
            this.bottom(rule[1], value, (rule.length >= 4) ? rule[3] : undefined);
        }
        else if (rule[0] === 'fill') {
            this.fill(rule[1], (rule.length >= 3) ? rule[2] : undefined);
        }
        else if (rule[0] === 'margins') {
            this.margins(rule[1]);
        }
    }
};

/**
 * Dock the node to the top. Sizes can also be specified as ~size, which makes them truesizes
 *
 * @param {LayoutNode|String} [node] layout-node to dock, when omitted the `height` argument argument is used for padding
 * @param {Array}  size of the node. If number, draws only one dimension and leaves the other one undefined
 * @param {Number} [z] z-index to use for the node
 * @param {Number} space the space inserted before this item, defaults to 0
 * @param extraTranslation
 * @return {TrueSizedLayoutDockHelper} this
 */
TrueSizedLayoutDockHelper.prototype.top = function (renderableName, size, space = 0, extraTranslation = [0, 0, 0], innerSize, otherSpecs) {
    let [width, height] = this._setupAccordingToDimension(size, 1);
    if (this._data.top !== this._initialData.top) {
        this._data.top += space;
    }

    this._context.set(renderableName, {
        size: innerSize || ([width || (this._data.right - this._data.left), this._ensureTrueSize(height)]),
        translate: this._addTranslations([this._data.left, this._data.top, this._data.z], extraTranslation),
        ...otherSpecs
    });
    /* If height was negative, then it is true sized and it needs to be tild'd to return to original */
    this._data.top += this._resolveSingleSize(height);
    return this;
};

/**
 * Dock the node to the left. Sizes can also be specified as ~size, which makes them truesizes
 *
 * @param {LayoutNode|String} [node] layout-node to dock, when omitted the `width` argument argument is used for padding
 * @param {Array}  size of the node. If number, draws only one dimension and leaves the other one undefined
 * @param {Number} [z] z-index to use for the node
 * @param {Number} space the space inserted before this item, defaults to 0
 * @param extraTranslation
 * @return {TrueSizedLayoutDockHelper} this
 */
TrueSizedLayoutDockHelper.prototype.left = function (renderableName, size, space = 0, extraTranslation = [0, 0, 0], innerSize, otherSpecs) {
    let [width, height] = this._setupAccordingToDimension(size, 0);
    if (this._data.left !== this._initialData.left) {
        this._data.left += space;
    }
    this._context.set(renderableName, {
        size: innerSize || ([this._ensureTrueSize(width), height || (this._data.bottom - this._data.top)]),
        translate: this._addTranslations([this._data.left, this._data.top, this._data.z], extraTranslation),
        ...otherSpecs
    });
    this._data.left += this._resolveSingleSize(width);
    return this;
};

/**
 * Dock the node to the bottom. Sizes can also be specified as ~size, which makes them truesizes
 *
 * @param {LayoutNode|String} [node] layout-node to dock, when omitted the `height` argument argument is used for padding
 * @param {Array}  size of the node. If number, draws only one dimension and leaves the other one undefined
 * @param {Number} [z] z-index to use for the node
 * @param {Number} space the space inserted before this item, defaults to 0
 * @param extraTranslation
 * @return {TrueSizedLayoutDockHelper} this
 */
TrueSizedLayoutDockHelper.prototype.bottom = function (renderableName, size, space = 0, extraTranslation = [0, 0, 0], innerSize, otherSpecs) {
    let [width, height] = this._setupAccordingToDimension(size, 1);
    if (this._data.bottom !== this._initialData.bottom) {
        this._data.bottom -= space;
    }
    this._data.bottom -= this._resolveSingleSize(height);
    this._context.set(renderableName, {
        size: innerSize || ([width || (this._data.right - this._data.left), this._ensureTrueSize(height)]),
        translate: this._addTranslations([this._data.left, this._data.bottom, this._data.z], extraTranslation),
        ...otherSpecs
    });
    return this;
};

/**
 * Dock the node to the right. Sizes can also be specified as ~size, which makes them truesizes
 *
 * @param {LayoutNode|String} [node] layout-node to dock, when omitted the `width` argument argument is used for padding
 * @param {Array}  size of the node. If number, draws only one dimension and leaves the other one undefined
 * @param {Number} [this._data.z] z-index to use for the node
 * @param {Number} space the space inserted before this item, defaults to 0
 * @param extraTranslation
 * @return {TrueSizedLayoutDockHelper} this
 */
TrueSizedLayoutDockHelper.prototype.right = function (renderableName, size, space = 0, extraTranslation = [0, 0, 0], innerSize, otherSpecs) {
    let [width, height] = this._setupAccordingToDimension(size, 0);
    if (this._data.right !== this._initialData.right) {
        this._data.right -= space;
    }
    this._data.right -= this._resolveSingleSize(width);
    this._context.set(renderableName, {
        size: innerSize || ([this._ensureTrueSize(width), height || (this._data.bottom - this._data.top)]),
        translate: this._addTranslations([this._data.right, this._data.top, this._data.z], extraTranslation),
        ...otherSpecs
    });
    return this;
};

/**
 * Fills the node to the remaining content.
 *
 * @return {TrueSizedLayoutDockHelper} this
 * @param renderableName
 * @param size
 * @param translate
 * @param otherSpecs
 */
TrueSizedLayoutDockHelper.prototype.fill = function (renderableName, size = [0, 0], translate = [0, 0, 0], otherSpecs = {}) {
    var fillSize = this.getFillSize();
    this._context.set(renderableName, {
        size: [size[0] || fillSize[0], size[1] || fillSize[1]],
        translate: this._addTranslations([this._data.left, this._data.top, this._data.z], translate),
        ...otherSpecs
    });
    return this;
};

TrueSizedLayoutDockHelper.prototype.getFillSize = function() {
    return [Math.max(this._data.right - this._data.left, 0), Math.max(this._data.bottom - this._data.top, 0)];
}


/**
 * Applies indent margins to the remaining content.
 *
 * @param {Number|Array} margins margins shorthand (e.g. '5', [10, 10], [5, 10, 5, 10])
 * @return {TrueSizedLayoutDockHelper} this
 */
TrueSizedLayoutDockHelper.prototype.margins = function (margins) {
    margins = LayoutUtility.normalizeMargins(margins);
    this._data.left += margins[3];
    this._data.top += margins[0];
    this._data.right -= margins[1];
    this._data.bottom -= margins[2];
    this._initialData.left = this._data.left;
    this._initialData.right = this._data.right;
    this._initialData.top = this._data.top;
    this._initialData.bottom = this._data.bottom;
    return this;
};

TrueSizedLayoutDockHelper.prototype._resolveSingleSize = function (size) {
    return size < 0 ? ~size : size;
};
TrueSizedLayoutDockHelper.prototype._addTranslations = function (translation1, translation2) {
    return [translation1[0] + translation2[0], translation1[1] + translation2[1], translation1[2] + translation2[2]];
};
TrueSizedLayoutDockHelper.prototype._ensureTrueSize = function (size) {
    return size < 0 ? true : size;
};


TrueSizedLayoutDockHelper.prototype._setupAccordingToDimension = function (size, dim) {
    let height;
    let width;
    if (size instanceof Array) {
        let orthogonalDimension = dim ? 0 : 1;
        let adjustedSize = [size[0], size[1]];
        if (size[orthogonalDimension] < 0) {
            /* If a true size was specified as an orhtogonal dimension, we just set it to true, as we don't need to save the value anywhere here */
            adjustedSize[orthogonalDimension] = true;
        }
        width = adjustedSize[0];
        height = adjustedSize[1];
    } else {
        width = size;
    }
    return [width, height];
};

/**
 * Gets the current left/right/top/bottom/z bounds used by the dock-helper.
 *
 * @return {Object} `{left: x, right: x, top: x, bottom: x, z: x}`
 */
TrueSizedLayoutDockHelper.prototype.get = function () {
    return this._data;
};
