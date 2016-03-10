/**
 SystemJS Image Loader that embeds images as data URIs inside the application bundle.

 This Source Code is licensed under the MIT license. If a copy of the
 MIT-license was not distributed with this file, You can obtain one at:
 http://opensource.org/licenses/mit-license.html.

 @author: Tom Clement (tjclement)
 @license MIT
 @copyright Bizboard, 2015

 */

if (typeof window !== 'undefined') {
    /* Unbundled build, loaded dynamically through System.import() */
    exports.build = false;

    exports.fetch = function (load) {
        var absolutePath = load.address.replace('.js', '').substr('file:'.length);
        return new Promise(function (resolve) {
            resolve('module.exports = "' + absolutePath + '"');
        });
    };
} else {
    /* Bundled build, loaded from bundle.js */

    var fs = require('fs');
    var path = require('path');

    exports.build = true;

    exports.fetch = function (load) {
        return new Promise(function (resolve, reject) {
            var absolutePath = load.address.replace('.js', '').substr('file:'.length);
            copyFile(absolutePath, resolve, reject);
        });
    };

    function copyFile(source, resolve, reject) {
        var cbCalled = false;
        var dir = 'img';
        var target = `${dir}/${path.basename(source)}`;

        var absoluteDir = `www/${dir}`;
        var absoluteTarget = `www/${target}`;

        fs.mkdir(absoluteDir, function(mkdirError){

            if(mkdirError && mkdirError.code !== 'EEXIST'){
                return reject(mkdirError);
            }

            var rd = fs.createReadStream(source);
            rd.on('error', function(err) {
                done(err);
            });
            var wr = fs.createWriteStream(absoluteTarget);
            wr.on('error', function(err) {
                done(err);
            });
            wr.on('close', function(ex) {
                done();
            });
            rd.pipe(wr);

            function done(error) {
                if (!cbCalled) {
                    if(!error && resolve){
                        return resolve('module.exports = \'' + target + '\';');
                    } else if(reject) {
                        console.log('Error copying imported image:', error);
                        return reject(error);
                    }
                    cbCalled = true;
                }
            }
        });
    }
}
