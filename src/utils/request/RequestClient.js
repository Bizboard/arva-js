/**
 This Source Code is licensed under the MIT license. If a copy of the
 MIT-license was not distributed with this file, You can obtain one at:
 http://opensource.org/licenses/mit-license.html.

 @author: Hans van den Akker (mysim1)
 @license MIT
 @copyright Bizboard, 2015

 */

/**
 * Prepares a GET request and initiates the communication.
 * @param {String} url
 * @returns {Promise} Returns an asynchronous response object which can be managed to read the response in an chaining proces.
 */
export function GetRequest(url) {

    // Return a new promise.
    return new Promise(function (resolve, reject) {
        // Do the usual XHR stuff
        var req = new XMLHttpRequest();
        req.open('GET', url, true);

        req.onload = function () {
            // This is called even on 404 etc
            // so check the status
            if (req.status === 200) {
                // Resolve the promise with the response text
                resolve(req.response);
            } else {
                // Otherwise reject with the status text
                // which will hopefully be a meaningful error
                reject(Error(req.statusText));
            }
        };

        // Handle network errors
        req.onerror = function () {
            reject(Error('Network Error'));
        };

        // Make the request
        req.send();
    });
}

/**
 * Prepares a POST request and initiates the communication.
 * @param {Object} options Provide properties: { headers: <Map>, data: <string>, url: <string> }
 * @returns {Promise} Returns an asynchronous response object which can be managed to read the response in an chaining proces.
 */
export function PostRequest(options) {

    // make the request dummy proof
    if (!options) {
        options = {};
    }
    if (!options.headers) {
        options.headers = new Map();
    }
    if (!options.data) {
        options.data = '';
    }


    return new Promise((resolve, reject)=> {

        var req = new XMLHttpRequest();
        req.open('POST', options.url, true);

        for (var entry of options.headers.entries())
            req.setRequestHeader(entry[0], entry[1]);


        req.onload = function () {
            // This is called even on 404 etc
            // so check the status
            if (req.status === 200) {
                // Resolve the promise with the response text
                let responseDate = req.getResponseHeader('Date');
                resolve({response: req.response, timestamp: responseDate});
            } else {
                // Otherwise reject with the status text
                // which will hopefully be a meaningful error
                reject(Error(req.statusText));
            }
        };


        // Handle network errors
        req.onerror = function () {
            reject(Error('Network Error'));
        };

        req.send(options.data);
    });

}


export function ExistsRequest(url) {

    // Do the usual XHR stuff
    var req = new XMLHttpRequest();
    req.open('OPTIONS', url, false);
    req.send();

    return req.status !== 404;
}