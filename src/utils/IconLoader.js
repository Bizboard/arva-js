/**
 * Created by Manuel on 28/07/16.
 */
/*
 Text plugin
 */

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

exports.translate = function (load) {
    if (this.builder && this.transpiler) {
        load.metadata.format = 'esm';
        return 'export default ' + JSON.stringify(load.source) + ';';
    }

    load.metadata.format = 'amd';
    return 'def' + 'ine(function() {\nreturn ' + JSON.stringify(load.source) + ';\n});';
}