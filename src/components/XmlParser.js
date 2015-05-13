/**
 This Source Code is licensed under the MIT license. If a copy of the
 MIT-license was not distributed with this file, You can obtain one at:
 http://opensource.org/licenses/mit-license.html.

 @author: Hans van den Akker (mysim1)
 @license MIT
 @copyright Bizboard, 2015

 */

export function ParseStringToXml(text) {
    try {
        var xml = null;

        if (window.DOMParser) {

            var parser = new DOMParser();
            xml = parser.parseFromString(text, 'text/xml');

            var found = xml.getElementsByTagName('parsererror');

            if (!found || !found.length || !found[0].childNodes.length) {
                return xml;
            }

            return null;
        } else {

            if(typeof ActiveXObject !== 'function') { var ActiveXObject = () => {}; }

            xml = new ActiveXObject('Microsoft.XMLDOM');

            xml.async = false;
            xml.loadXML(text);

            return xml;
        }
    } catch (e) {
        // suppress
        console.log('Error parsing the string to xml.');
    }
}