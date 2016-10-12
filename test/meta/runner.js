/**
 * Created by tom on 07/10/16.
 */

// import SystemJS from 'systemjs';

var path = require('path');
var Mocha = require('mocha');
var sinon = require('sinon');
var requestAnimationFrame = require('request-animation-frame-mock');

var runner = new Mocha({ui: 'bdd'});
// set up the global variables
runner.suite.emit('pre-require', global, 'global-mocha-context', runner);


SystemJS.import('./test/meta/AllTests.js')
    .then(function (tests) {

        return new Promise((resolve, reject) => {
            runner.run((failures) => {
                if (failures)
                    reject(failures);
                else
                    resolve();
            });
        });
    })
    .catch(console.error.bind(console));