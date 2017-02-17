/**
 * Created by tom on 07/02/2017.
 */

export class FirebaseFileSource {

    /**
     * @param {String} path Full path to resource in remote data storage.
     * @return {DataSource} DataSource instance.
     **/
    constructor(path) {
        this.path = path;
        this.storage = firebase.storage();
        this.storageRef = this.storage.ref(this.path);
    }

    /**
     * Uploads a new file to the remote store.
     *
     * @param {File|Blob} file
     * @returns {Promise.<void>}
     */
    async push(file) {
        return new Promise((resolve, reject) => {
            let fileRef = this.storageRef.child(`${Date.now()}-${file.name}`);
            let uploadTask = fileRef.put(file);

            uploadTask.on('state_changed', function (snapshot) {
                /* Progress is available here */
            }, function (error) {
                reject(error);
            }, function () {
                if(uploadTask.snapshot && uploadTask.snapshot.downloadURL) {
                    resolve(uploadTask.snapshot.downloadURL);
                } else {
                    reject('No downloadURL in response');
                }
            });
        });
    }
}
