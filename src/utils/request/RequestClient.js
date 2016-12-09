/**


 @author: Hans van den Akker (mysim1)
 @license NPOSL-3.0
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

        options.headers.forEach(function(value, key){
            req.setRequestHeader(key, value);
        });

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
        req.onerror = function (error) {
            console.error('A network Error has occured: ' + error);
            reject(Error('Network Error'));
        };

        req.send(options.data);
    });

}


export function ExistsRequest(url) {

    // Do the usual XHR stuff
    var req = new XMLHttpRequest();
    req.open('GET', url, false);

    // Handle network errors
    req.onerror = function (error) {
        console.log('A network Error has occurred: ' + error);
    };

    req.send();
    return req.status !== 404;
}