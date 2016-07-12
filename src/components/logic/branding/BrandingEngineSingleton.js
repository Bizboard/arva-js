/**


 @author: Tom Clement (tjclement)
 @license NPOSL-3.0
 @copyright Bizboard, 2015

 */

import {BrandingEngine}         from './BrandingEngine.js';
import {Injection}              from '../../../utils/Injection.js';

export class BrandingEngineSingleton {
    /**
     * Get a singleton global instance of the BrandingEngine.
     * @returns {BrandingEngine} BrandingEngine instance.
     */
    static getInstance(){
        return Injection.get(BrandingEngine);
    }
}
