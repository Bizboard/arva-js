/**
 * Created by lundfall on 01/09/16.
 */

import {Surface}        from 'arva-js/surfaces/Surface.js';
import ImageSurface                 from 'famous/surfaces/ImageSurface.js';


export class Utils {
    static renderableIsSurface(renderable) {
        return renderable instanceof Surface || renderable instanceof ImageSurface;
    }

    /**
     * Returns tru if the object is not a class but still an object
     * @param object
     * @returns {boolean}
     * @private
     */
    static isPlainObject(object) {
        return typeof object == 'object' && object.constructor.name == 'Object';
    }
    
    /**
     * Adds to translations returns the result.
     * @param translate1
     * @param translate2
     * @returns {Array}
     */
    static addTranslations(translate1, translate2) {
        return [translate1[0] + translate2[0], translate1[1] + translate2[1], translate1[2] + translate2[2]];

    }
    /**
     * Returns true if the renderable is complex and its size can be determined. Returns false if it is a surface
     * or something else that doesn't have a getSize function specified
     * @param renderable
     * @private
     */
    static renderableIsComposite(renderable) {
        return renderable.getSize && !(Utils.renderableIsSurface(renderable));
    }

    /**
     * Uses either console.warn() or console.log() to log a mildly serious issue, depending on the user agent's availability.
     * @param {String|Object} message
     * @returns {void}
     * @private
     */
    static warn(message) {
        if (console.warn) {
            console.warn(message);
        } else {
            console.log(message);
        }
    }

    /**
     * Specifying origin for true sized renderables doesn't work. Therefore we do a quick fix to adjust the
     * translation according to the current faulty behaviour of famous.
     * @param {Renderable}renderable The renderable of which we should correct
     * @param {Array|Number} size  The size of this renderable
     * @param {Array|Number} origin The origin
     * @param {Array|Number} translate The current translation
     * @param {SizeResolver} A size resolver that is keeping bookkeeping of the renderable
     * @returns {*[]} The new translation taking this the current famous implementation into account
     * @private
     */
    static adjustPlacementForTrueSize(renderable, size, origin, translate, sizeResolver) {
        let newTranslation = [translate[0], translate[1], translate[2]];
        for (let i = 0; i < 2; i++) {
            if (size[i] === true && origin[i] !== 0) {
                /* Because the size is set to true, it is interpreted as 1 by famous. We have to add 1 pixel
                 *  to make up for this.
                 */
                newTranslation[i] -= (sizeResolver.getResolvedSize(renderable)[i] * origin[i] - 1);
            }
        }
        return newTranslation;
    }

    static getRenderableGroupName(renderable) {
        let { decorations } = renderable;

        if (!!decorations.dock) {
            /* 'filled' is a special subset of 'docked' renderables, that need to be rendered after the normal 'docked' renderables are rendered. */
            return decorations.dock.dockMethod === 'fill' ? 'filled' : 'docked';
        } else if (!!decorations.fullSize) {
            return 'fullSize';
        } else if (decorations.size || decorations.origin || decorations.align || decorations.translate) {
            return 'traditional';
        } else {
            /* This occurs e.g. when a renderable is only marked @renderable, and its parent view has a @layout.custom decorator to define its context. */
            return 'ignored';
        }
    }

    static getRenderableID(renderable) {
        let extractedRenderableID = (renderable.getID ?
            renderable.getID() :
            (renderable.layout ? renderable.layout.id : renderable.id));
        return extractedRenderableID !== undefined ? extractedRenderableID : renderable._id;
    }

    /**
     * For entities that handle options parameters (OptionObserver, LazyLoadedOptionClone) can be important to know whether
     * an object is a plain object or not
     *
     * @param object
     * @returns {boolean}
     */
    static isPlainObject(object) {
        return typeof object === 'object' && object.constructor.name === 'Object'
    }
}
