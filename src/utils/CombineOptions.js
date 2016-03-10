/**
 * Created by lundfall on 2/24/16.
 */

import camelCase from 'camelcase';

/**
 * Changes all keys with a dash to camel case, in order to be merge for example 'text-align' with tetxAlign
 * @param param
 */
function camelCaseKeys(param){
    for(let key in param){
        if(~key.indexOf('-')){
            let value = param[key];
            delete param[key];
            param[camelCase(key)] = value;
        }
    }
}

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
                    resultingElement = _.mergeWith(defaultElement, specifiedElement, famousMerge);
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

            if (typeof param === 'object') {

                if(_.isEmpty(param)){
                    return param === specifiedParam ? defaultParam : specifiedParam;
                }

                /*
                 * Make sure that we don't merge instances of classes. You _could_ trick this system by specifying an object
                 * with the parameter constructor {name: 'Object'} or specifying a class named Object (don't)
                 */
                if(param.constructor.name !== 'Object'){
                    return specifiedParam;
                }
                /*
                 * Style parameters can be specified with dash-case or camelCase, which we correct here
                 */
                camelCaseKeys(param);
            }
        }

    }
    return undefined;
}

/**
 *
 * @param defaultOptions
 * @param options
 * @returns {*}
 */
export function combineOptions(defaultOptions, options) {
    /* Add an extra level of depth on the object to make sure we are getting the full object to our specialized
     *  function.
     */

    return _.mergeWith({root: defaultOptions}, {root: options}, famousMerge).root;
}