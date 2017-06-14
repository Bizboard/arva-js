/**
 @author: Tom Clement (tjclement)
 @license NPOSL-3.0
 @copyright Bizboard, 2015

 */

/* On Windows, paths are file:///C:/[..], whereas on *NIX the third slash after
 * the protocol means filesystem root. Thus we need to remove this slash on Windows, and keep it elsewhere. */
var protocolToStrip = process && process.platform === 'win32' ? 'file:///' : 'file://';

if (typeof window !== 'undefined') {
    /* Unbundled build, loaded dynamically through System.import() */
    exports.build = false;

    exports.fetch = function (load) {
        var absolutePath = load.address.replace('.js', '').substr(protocolToStrip.length);
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
            var absolutePath = load.address.replace('.js', '').substr(protocolToStrip.length);
            copyFile(absolutePath, resolve, reject);
        });
    };

    function copyFile(source, resolve, reject) {
        var cbCalled = false;
        var dir = 'img';
        var target = `${dir}/${path.basename(source)}`;

        var absoluteDir = `www/${dir}`;
        var absoluteTarget = `www/${target}`;

        fs.mkdir(absoluteDir, function (mkdirError) {

            if (mkdirError && mkdirError.code !== 'EEXIST') {
                return reject(mkdirError);
            }

            var rd = fs.createReadStream(source);
            rd.on('error', function (err) {
                done(err);
            });
            var wr = fs.createWriteStream(absoluteTarget);
            wr.on('error', function (err) {
                done(err);
            });
            wr.on('close', function (ex) {
                done();
            });
            rd.pipe(wr);

            function done(error) {
                if (!cbCalled) {
                    if (!error && resolve) {
                        return resolve('module.exports = \'' + target + '\';');
                    } else if (reject) {
                        console.log('Error copying imported image:', error);
                        return reject(error);
                    }
                    cbCalled = true;
                }
            }
        });
    }
}
