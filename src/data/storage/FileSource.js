/**
 * Created by tom on 07/02/2017.
 */

export class FileSource {

    /**
     * @param {String} path Full path to resource in remote data storage.
     * @return {DataSource} DataSource instance.
     **/
    constructor(path) {
        this._dataReference = null;
    }

    /**
     * Uploads a new file to the remote store.
     *
     * @param {File|Blob} file
     * @returns {Promise.<void>}
     */
    async push(file) {
        (console.warn || console.log)(`${this.constructor.name}.push() is not yet implemented`);
    }

    /**
     * Downloads an existing file from the remote store.
     * @param {String} fileName file name without the preceeding store path (.e.g picture.jpg).
     * @returns {Promise.File}
     */
    async get(fileName) {
        (console.warn || console.log)(`${this.constructor.name}.get() is not yet implemented`);
    }

    /**
     * Uploads and overwrites a new picture to an existing location.
     * @param {String} fileName Existing file name, and also the name under which the new file will be saved.
     * @param file
     * @returns {Promise.Boolean}
     */
    async set(fileName, file) {
        (console.warn || console.log)(`${this.constructor.name}.set() is not yet implemented`);
    }

    /**
     * Removes the file with the given name, if present.
     * @param fileName
     * @returns {Promise.Boolean}
     */
    async remove(fileName) {
        (console.warn || console.log)(`${this.constructor.name}.remove() is not yet implemented`);
    }
}
