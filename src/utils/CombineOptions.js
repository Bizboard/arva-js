/**
 @author: Karl Lundfall (lundfall)
 @license NPOSL-3.0
 @copyright Bizboard, 2015
 */

import camelCase            from 'camelcase';
import isEmpty              from 'lodash/isEmpty.js';
import mergeWith            from 'lodash/mergeWith.js';
import cloneDeepWith        from 'lodash/cloneDeepWith.js';

function famousMerge(defaultParam, specifiedParam) {
    if (Array.isArray(defaultParam) && Array.isArray(specifiedParam)) {
        let i, results = [];
        for (i = 0; i < specifiedParam.length; i++) {
            let defaultElement = defaultParam[i];
            let specifiedElement = specifiedParam[i];

            /* This is one special case that we want to take into account,
             (more spcecifically, we want to be able to set the size to undefined) */
            if (specifiedElement === undefined) {
                results.push(specifiedElement);
            } else {
                let resultingElement;
                if (typeof specifiedElement !== 'object' || typeof resultingElement !== 'object') {
                    resultingElement = specifiedElement;
                } else {
                    resultingElement = mergeWith(defaultElement, specifiedElement, famousMerge);
                }
                results.push(resultingElement);
            }
        }
        for (; i < defaultParam.length; i++) {
            results.push(defaultParam[i]);
        }
        return results;
    }


    for (let param of [specifiedParam, defaultParam]) {
        if (!Array.isArray(param)) {

            if (typeof param === 'object' && !!param) {

                /*
                 * Make sure that we don't merge instances of classes. You _could_ trick this system by specifying an object
                 * with the parameter constructor {name: 'Object'} or specifying a class named Object (don't)
                 */
                if (param.constructor.name !== 'Object') {
                    return specifiedParam;
                }


                if (isEmpty(param)) {
                    return param === specifiedParam ? defaultParam : specifiedParam;
                }


            }
        }
    }
    let hasDashProperty = false;
    /*
     * Style parameters can be specified with dash-case or camelCase, which we correct here
     */
    let shallowParamCopies = [{}, {}];
    for (let [param, shallowCopy] of [[specifiedParam, shallowParamCopies[0]], [defaultParam, shallowParamCopies[1]]]) {
        for (let key in param) {
            let value = param[key];
            /* If there is an array present in one place but not the other, we need to be sure to place an empty
            *  array in the other object in order to prevent the contents in that array from being copied unpromptedly */
            if(defaultParam !== undefined && Array.isArray(value) && ((key in specifiedParam) !== (key in defaultParam))){
                if(!key in specifiedParam){
                    specifiedParam[key] = [];
                }
            }
            if (~key.indexOf('-')) {
                hasDashProperty = true;
                key = camelCase(key);
            }
            shallowCopy[key] = value;
        }
    }
    if (hasDashProperty) {
        return mergeWith(shallowParamCopies[1], shallowParamCopies[0], famousMerge);
    } else {
        return undefined;
    }
}

/**
 * Helper function used to clone without cloning class instances
 * @param value
 * @returns {*}
 */
function dontCloneClassInstances(value) {
    if (typeof value === 'object' && !!value && !Array.isArray(value) && value.constructor.name !== 'Object') {
        return value;
    }
}

/**
 *
 * @param defaultOptions
 * @param options
 * @returns {*}
 */
export function combineOptions(defaultOptions, options) {
    let clonedDefaultOptions = cloneDeepWith(defaultOptions, dontCloneClassInstances);
    return mergeWith({root: clonedDefaultOptions}, {root: options}, famousMerge).root;
}
