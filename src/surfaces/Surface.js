/**
 * Created by lundfall on 12/07/2017.
 */
import FamousSurface    from 'famous/core/Surface.js';
import {optionMetaData} from '../utils/view/OptionObserver';

/**
 * A base class for viewable content and event
 *   targets inside an Arva application, containing a renderable document
 *   fragment. Like an HTML div, it can accept internal markup,
 *   properties, classes, and handle events.
 *
 * @class Surface
 * @constructor
 *
 * @param {Object} [options] default option overrides
 * @param {Array.Number} [options.size] [width, height] in pixels
 * @param {Array.string} [options.classes] CSS classes to set on target div
 * @param {Array} [options.properties] string dictionary of CSS properties to set on target div
 * @param {Array} [options.attributes] string dictionary of HTML attributes to set on target div
 * @param {string} [options.content] inner (HTML) content of surface
 */
let existingWithFunction = FamousSurface.with;
FamousSurface.with  = function (options) {
    /* If the properties passed are options themselves, we make sure to destructure them in order to make sure that all
    *  necessary listeners are registered */
    if(options && options.properties && options.properties[optionMetaData]){
        let intentionallyUnusedSpreadProperties = {...options.properties};
    }
    return existingWithFunction.call(this, options);
};

export const Surface = FamousSurface;

