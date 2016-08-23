/**
 * Created by tom on 22/08/16.
 */

export function callbackToPromise(functionWithCallback, ...args) {
    return new Promise(function(resolve){ functionWithCallback(...args, resolve); });
}

export function successAndErrorToPromise() {
    return new Promise(function(resolve, reject){ functionWithCallback(...args, resolve, reject); });
}