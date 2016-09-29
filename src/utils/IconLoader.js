/**
 * Created by Manuel on 28/07/16.
 */
/*
 Text plugin
 */

var fs = require('fs');
var path = require('path');
var arvaOptions = System.arvaOptions;
var iconOptions = arvaOptions.iconOptions || {
        form: 'rounded',
        thickness: 'thin'
    };

exports.locate = function (target) {
    var address = target.address;

    // /* Resolve the address of default icons with the options provided */
    if (address.indexOf('default') !== -1) {
        address = address.split('default');
        address = address[0] + iconOptions.form + '_' + iconOptions.thickness + address[1];
    }

    return address;
};

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

    fs.mkdir(absoluteDir, function (mkdirError) {

        if (mkdirError && mkdirError.code !== 'EEXIST') {
            return reject(mkdirError);
        }

        var rd = fs.createReadStream(source);
        rd.on('error', done);
        var wr = fs.createWriteStream(absoluteTarget);
        wr.on('error', done);
        wr.on('close', done);
        rd.pipe(wr);

        function done(error) {
            if (!cbCalled) {
                if (!error && resolve) {
                    return resolve('var SystemJS = require("systemjs"); var config = require("jspm.config.js"); module.exports = SystemJS.import(\'' + absoluteTarget + '!www/systemjs-text.js\');');
                } else if (reject) {
                    console.log('Error copying imported image:', error);
                    return reject(error);
                }
                cbCalled = true;
            }
        }
    });
}
