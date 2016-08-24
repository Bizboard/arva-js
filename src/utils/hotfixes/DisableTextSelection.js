/**
 * Created by tom on 08/07/16.
 */

var currentLocation = window.location;
var isWebsite = currentLocation.protocol.indexOf('http') !== -1 && currentLocation.host.indexOf('localhost') === -1;

if(!isWebsite) {
    /* Source: https://developer.mozilla.org/en-US/docs/Web/API/CSSStyleSheet/insertRule */
    var styleElement = document.createElement('style'),
        styleSheet;

    /* Append style element to head */
    document.head.appendChild(styleElement);

    /* Grab style sheet */
    styleSheet = styleElement.sheet;
    styleSheet.insertRule('*:not(input):not(textarea){-webkit-touch-callout: none; -webkit-user-select: none; -moz-user-select: none; -o-user-select: none; user-select: none;}', 0);
}
