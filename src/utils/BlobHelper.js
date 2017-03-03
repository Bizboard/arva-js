/**
 @author: Hans van den Akker (mysim1)
 @license NPOSL-3.0
 @copyright Bizboard, 2015

 */

/**
 * Helper class for converting base64 string data to a HTML5 Blob object.
 **/
export class BlobHelper {

    /**
     * Convert base64 string data to a HTML5 Blob object.
     * @param {String} b64Data Base64 data to convert to Blob
     * @param {String} contentType Content type
     * @param {Number} sliceSize How large the chunks are in which we process the data.
     * @returns {Blob} Blob of raw data.
     */
    static base64toBlob(b64Data, contentType, sliceSize) {
        contentType = contentType || '';
        sliceSize = sliceSize || 512;

        let byteCharacters = atob(b64Data);
        let byteCharLength = byteCharacters.length;
        let byteArrays = [];

        for (var offset = 0; offset < byteCharLength; offset += sliceSize) {
            let slice = byteCharacters.slice(offset, offset + sliceSize);
            let sliceLength = slice.length;
            let byteNumbers = new Array(sliceLength);
            for (var i = 0; i < sliceLength; i++) {
                byteNumbers[i] = slice.charCodeAt(i);
            }

            var byteArray = new Uint8Array(byteNumbers);

            byteArrays.push(byteArray);
        }

        var blob = new Blob(byteArrays, {type: contentType});
        return blob;
    }
}