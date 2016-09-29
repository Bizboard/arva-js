/**
 * Created by tom on 22/08/16.
 */

import Timer                    from 'famous/utilities/Timer.js';

export function callbackToPromise(functionWithCallback, ...args) {
    return new Promise(function(resolve){ functionWithCallback(...args, resolve); });
}

export function successAndErrorToPromise() {
    return new Promise(function(resolve, reject){ functionWithCallback(...args, resolve, reject); });
}

export function waitMilliseconds(milliseconds) {
    return new Promise((resolve) => Timer.setTimeout(resolve, milliseconds));
}