/**
 * Created by tom on 28/06/16.
 */

import {Injector}                   from './di/Injector.js';

export class Injection {
    static injector = new Injector();

    static get(classConstructor, ...constructionParams) {
        return this.injector.get(classConstructor, constructionParams);
    }

    /**
     *
     * @param {Array} classContructorArray Array of classes to instantiate. May also be an array where each item is an array containing
     */
    static getAll(...classContructorArray) {
        let results = [];
        for (let entry of classContructorArray) {
            let [constructor, params] = entry instanceof Array ? [entry[0], entry[1]] : [entry, []];
            results.push(this.get(constructor, params));
        }
        return results;
    }

    static addProviders(...classConstructors) {
        for (let constructor of classConstructors) {
            this.injector._loadFnOrClass(constructor);
        }
    }
}