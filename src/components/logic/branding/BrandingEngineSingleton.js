/**
 This Source Code is licensed under the MIT license. If a copy of the
 MIT-license was not distributed with this file, You can obtain one at:
 http://opensource.org/licenses/mit-license.html.

 @author: Tom Clement (tjclement)
 @license MIT
 @copyright Bizboard, 2015

 */

import {BrandingEngine}         from './BrandingEngine';
import {Context}                from 'arva-utils/Context';

export class BrandingEngineSingleton {
    /**
     * Get a singleton global instance of the BrandingEngine.
     * @returns {BrandingEngine} BrandingEngine instance.
     */
    static getInstance(){
        return Context.getContext('Default').get(BrandingEngine);
    }
}
