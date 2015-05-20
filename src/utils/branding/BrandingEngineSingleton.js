/**
 * Created by tom on 20/05/15.
 */

import {BrandingEngine}         from './BrandingEngine';
import {GetDefaultContext}      from '../../DefaultContext';

export default class BrandingEngineSingleton {
    /**
     * Get a singleton global instance of the BrandingEngine.
     * @returns {BrandingEngine}
     */
    static getInstance(){
        return GetDefaultContext().get(BrandingEngine);
    }
}
