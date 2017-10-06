/**


 @author: Tom Clement (tjclement)
 @license NPOSL-3.0
 @copyright Bizboard, 2015

 */
import firebase                     from 'firebase';
import merge                        from 'lodash/merge.js';
import {DataSource}                 from '../DataSource.js';
import {ObjectHelper}               from '../../utils/ObjectHelper.js';
import {provide}                    from '../../utils/di/Decorators.js';
import {combineOptions}             from '../../utils/CombineOptions.js';

@provide(DataSource)
export class FirebaseDataSource extends DataSource {

    get dataReference() {
        return this._orderedDataReference;
    }

    set dataReference(value) {
        this._orderedDataReference = value;
    }

    /**
     * @param {String} path Full path to resource in remote data storage.
     * @return {FirebaseDataSource} FirebaseDataSource instance.
     * @param {Object} options Optional: options to construct the DataSource with.
     * @param {[key: String, value: String]} [options.equalTo] Optional, only subscribe to items with a certain value.
     * @param {String} [options.orderBy] Optional, order all items received through the dataSource.
     *                                   Options are: '.priority', '.value', or a string containing the child key to order by (e.g. 'MyModelProperty')
     * @param {Number} [options.limitToFirst]   Optional, only subscribe to the first amount of entries.
     * @param {Number} [options.limitToLast]    Optional, only subscribe to the last amount of entries.
     * @param {Number} [options.startAt]        Optional, only subscribe to the entries from a certain value onwards
     * @param {Number} [options.endAt]          Optional, only subscribe to the entries towards a certain value
     * @param {Promise} [options.synced]        Optional, a promise to tell the data source that it is only synchronized after this promise is resolved
     **/
    constructor(path, options = { orderBy: '.priority' }) {
        super(path);
        this._onValueCallback = null;
        this._onAddCallback = null;
        this._onChangeCallback = null;
        this._onMoveCallback = null;
        this._onRemoveCallback = null;
        this._firebase = options.customFirebase || firebase;

        this._dataReference = this._firebase.database().ref(path);
        this.handlers = {};
        this.options = combineOptions({ synced: Promise.resolve() }, options);
        this._synced = this.options.synced;

        /* Populate the orderedReference, which is the standard Firebase reference with an optional ordering
         * defined. This needs to be saved seperately, because methods like child() and key() can't be called
         * from the ordered reference, and must instead be performed on the standard reference. */

        if (this.options.orderBy && this.options.orderBy === '.priority' && !this.options.equalTo) {
            this._orderedDataReference = this._dataReference.orderByPriority();
        } else if (this.options.orderBy && this.options.orderBy === '.value') {
            this._orderedDataReference = this._dataReference.orderByValue();
        } else if (this.options.orderBy && this.options.orderBy !== '') {
            let {orderBy} = this.options;
            if(orderBy === 'id'){
                this._orderedDataReference = this._dataReference.orderByKey();
            } else {
                this._orderedDataReference = this._dataReference.orderByChild(this.options.orderBy);
            }
        } else if (this.options.equalTo) {
            let [key, value] = this.options.equalTo;
            if (key === 'id') {
                this._orderedDataReference = this._dataReference.orderByKey().equalTo(value);
            } else {
                this._orderedDataReference = this._dataReference.orderByChild(key).equalTo(value);
            }
        } else {
            this._orderedDataReference = this._dataReference;
        }

        if (this.options.startAt !== undefined) {
            this._orderedDataReference = this._orderedDataReference.startAt(this.options.startAt);
        }
        if (this.options.endAt !== undefined) {
            this._orderedDataReference = this._orderedDataReference.endAt(this.options.endAt);
        }

        if (this.options.limitToFirst !== undefined) {
            this._orderedDataReference = this._orderedDataReference.limitToFirst(this.options.limitToFirst);
        } else if (this.options.limitToLast !== undefined) {
            this._orderedDataReference = this._orderedDataReference.limitToLast(this.options.limitToLast);
        }


        /* Bind all local methods to the current object instance, so we can refer to "this"
         * in the methods as expected, even when they're called from event handlers. */
        ObjectHelper.bindAllMethods(this, this);
    }

    dataExists() {
        return new Promise((resolve) => {
            this._dataReference.once('value', (snapshot) => {
                return resolve(snapshot.exists());
            }, ()=>{
                resolve(false);
            });
        });
    }


    /**
     * Returns the full path to this dataSource's source on the remote storage provider.
     * @returns {String} Full resource path.
     */
    toString() {
        return this._dataReference.toString();
    }

    /**
     * Resolves when the DataSource is synchronized to the server
     * @returns {Promise} Resolves when the DataSource is synchronized
     */
    synced() {
        return this._synced;
    }

    /**
     * Returns a dataSource reference to the given child branch of the current datasource.
     * @param {String} childName Child branch name.
     * @param {Object} options Optional: additional options to pass to new DataSource instance.
     * @returns {DataSource} New dataSource instance pointing to the given child branch.
     */
    child(childName, options = {}) {
        return new FirebaseDataSource(`${this.path()}/${childName}`, { customFirebase: this.options.customFirebase, ...options });
    }

    /**
     * Returns the full URL to the path on the dataSource. Functionally identical to toString().
     * @returns {String} Full resource path.
     */
    path() {
        let rootUrl = this.root();
        let parentUrl = this.parent();

        let relativePath = parentUrl.replace(rootUrl, '');
        return `${relativePath}/${this.key()}`;
    }

    /**
     * Returns the name of the current branch in the path on the dataSource.
     * @returns {String} Current branch name.
     */
    key() {
        return (this._dataReference.key || '').toString();
    }

    /**
     * Returns the full URL to the parent of the current branch on the dataSource.
     * @returns {String} Full resource path of parent.
     */
    parent() {
        return (this._dataReference.parent || '').toString();
    }

    /**
     * Returns the full URL to the root on the dataSource.
     * @returns {String} Full resource path of root.
     */
    root() {
        return (this._dataReference.root || '').toString();
    }

    /**
     * Writes newData to the path this dataSource was constructed with.
     * @param {Object} newData Data to write to dataSource.
     * @returns {Promise} Resolves when write to server is complete.
     */
    set(newData) {
        let completionPromise = this._dataReference.set(newData).catch((error) => this._rethrowFirebaseError(error, newData));

        /* Append another promise to the chain to keep track of whether it's still synchronized */
        this._synced = this._synced.then(() => completionPromise);
        return completionPromise;
    }

    /**
     * Removes the object and all underlying children that this dataSource points to.
     * @returns {Promise}
     */
    remove() {
        return this._dataReference.remove().catch((error) => this._rethrowFirebaseError(error, null))
    }

    /**
     * Sets data at the specified path(s) without touching unspecified paths
     * @returns {Promise}
     */
    update(data) {
        return this._dataReference.update(data).catch((error) => this._rethrowFirebaseError(error, data));
    }

    /**
     * Writes newData to the path this dataSource was constructed with, appended by a random UID generated by
     * the dataSource.
     * @param {Object} newData New data to append to dataSource.
     * @returns {FirebaseDataSource} A new FirebaseDataSource pointing to the injected data.
     */
    push(newData = {}) {
        newData = (newData === undefined || newData === null) ? {} : newData;
        let pushResult = this._dataReference.push(newData);
        pushResult.catch((error) => this._rethrowFirebaseError(error, newData));
        return new FirebaseDataSource(`${this.path()}/${pushResult.key}`, {
            synced: pushResult,
            customFirebase: this.options.customFirebase
        });
    }

    /**
     * Writes newData with given priority (ordering) to the path this dataSource was constructed with.
     * @param {Object} newData New data to set.
     * @param {String|Number} priority Priority value by which the data should be ordered.
     * @returns {Promise} Resolves when write to server is complete.
     */
    setWithPriority(newData, priority) {
        /* Rethrow the error in order to be able to catch it higher up */
        let completionPromise = this.dataReference.setWithPriority(newData, priority).catch((error) =>
            this._rethrowFirebaseError(error, newData)
        );
        /* Append another promise to the chain to keep track of whether it's still synchronized. Fail silently
         * since we already have error handling above */
        this._synced = this._synced.then(() => completionPromise).catch(() => {
        });
        return completionPromise;
    }

    /**
     * Sets the priority (ordering) of an object on a given dataSource.
     * @param {String|Number} newPriority New priority value to order data by.
     * @returns {void}
     */
    setPriority(newPriority) {
        return this.dataReference.setPriority(newPriority);
    }

    /**
     * Orders the DataSource's childs by the value in child[key].
     * @param {String} childKey Key of the field to order by.
     * @returns {DataSource} New dataSource instance.
     */
    orderByChild(childKey) {
        return new FirebaseDataSource(this.path(), merge({}, this.options, {
            orderBy: childKey,
            customFirebase: this.options.customFirebase
        }));
    }

    /**
     * Orders the DataSource's childs by their key names, ignoring their priority.
     * @returns {DataSource} New dataSource instance.
     */
    orderByKey() {
        return new FirebaseDataSource(this.path(), merge({}, this.options, {
            orderBy: '.key',
            customFirebase: this.options.customFirebase
        }));
    }

    /**
     * Orders the DataSource's childs by their values, ignoring their priority.
     * @returns {DataSource} New dataSource instance.
     */
    orderByValue() {
        return new FirebaseDataSource(this.path(), merge({}, this.options, {
            orderBy: '.value',
            customFirebase: this.options.customFirebase
        }));
    }

    /**
     * Returns a new dataSource reference that will limit the subscription to only the first given amount items.
     * @param {Number} amount Amount of items to limit the dataSource to.
     * @returns {DataSource} New dataSource instance.
     */
    limitToFirst(amount) {
        return new FirebaseDataSource(this.path(), merge({}, this.options, {
            limitToFirst: amount,
            customFirebase: this.options.customFirebase
        }));
    }

    /**
     * Returns a new dataSource reference that will limit the subscription to only the last given amount items.
     * @param {Number} amount Amount of items to limit the dataSource to.
     * @returns {DataSource} New dataSource instance.
     */
    limitToLast(amount) {
        return new FirebaseDataSource(this.path(), merge({}, this.options, { limitToLast: amount }));
    }

    /**
     * Authenticates all instances of this DataSource with the given OAuth provider and credentials.
     * @param {String} provider google, facebook, github, or twitter
     * @param {String|Object} credentials Access token string, or object with key/value pairs with e.g. OAuth 1.1 credentials.
     * @param {Function} onComplete Callback, executed when login is completed either successfully or erroneously.
     * On error, first argument is error message.
     * On success, the first argument is null, and the second argument is an object containing the fields uid, provider, auth, and expires.
     * @returns {Promise} A promise that resolves after successful authentication.
     */
    authWithOAuthToken(provider, credentials, onComplete) {
        let providerObject = this.createProviderFromCredential(provider, credentials);
        return this._firebase.auth().signInWithCredential(providerObject).then((user) => {
            if (onComplete) {
                onComplete(user);
            }
            return user;
        });
    }

    /**
     * Creates a provider with the specified type
     *
     * @param {String} providerType Can be 'password' or 'facebook'
     * @param {String|Object} credential if 'password' providerType, then an object {email:String,password:String}. If
     * 'facebook' providerType, then a string containing the API token.
     * @returns {Provider}
     */
    createProviderFromCredential(providerType, credential) {
        let providerObject;
        switch (providerType) {
            case 'password':
                providerObject = this._firebase.auth.EmailAuthProvider.credential(credential.email, credential.password);
                break;
            case 'facebook':
                providerObject = this._firebase.auth.FacebookAuthProvider.credential(credential);
                break;
            //TODO: Add more here
        }
        return providerObject;
    }

    /**
     * Merges the current user with the specified provider.
     * @param {Provider} provider
     * @returns {Authentication}
     */
    linkCurrentUserWithProvider(provider) {
        return this._firebase.auth().currentUser.link(provider);
    }

    /**
     * Authenticates all instances of this DataSource with a custom auth token or secret.
     * @param {String} authToken Authentication token or secret.
     * @param {Function} onCxomplete Callback, executed when login is completed either successfully or erroneously.
     * On error, first argument is error message.
     * On success, the first argument is null, and the second argument is an object containing the fields uid, provider, auth, and expires.
     * @returns {Promise} A promise that resolves after successful authentication.
     */
    authWithCustomToken(authToken, onComplete) {
        return this._firebase.auth().signInWithCustomToken(authToken).then((user) => {
            if (onComplete) {
                onComplete(user);
            }
            return user;
        });
    }

    /**
     * Registers a user with instances of this DataSource with the given email/password credentials.
     * @param {String|Object} credentials Object with key/value pairs {email: "value", password:"value"}.
     * @param {Function} onComplete Callback, executed when login is completed either successfully or erroneously.
     * On error, first argument is error message.
     * On success, the first argument is null, and the second argument is an object containing the fields uid, provider, auth, and expires.
     * @returns {Promise}
     */
    registerWithPassword(credentials, onComplete) {
        return this._firebase.auth().createUserWithEmailAndPassword(credentials.email, credentials.password);
    }

    /**
     * Authenticates all instances of this DataSource with the given email/password credentials.
     * @param {String|Object} credentials Object with key/value pairs {email: "value", password:"value"}.
     * @param {Function} onComplete Callback, executed when login is completed either successfully or erroneously.
     * On error, first argument is error message.
     * On success, the first argument is null, and the second argument is an object containing the fields uid, provider, auth, and expires.
     * @returns {Promise} A promise that resolves after successful authentication.
     */
    authWithPassword(credentials, onComplete) {
        return this._firebase.auth().signInWithEmailAndPassword(credentials.email, credentials.password).then((user) => {
            if (onComplete) {
                onComplete(user);
            }
            return user;
        });
    }

    /**
     * Authenticates all instances of this DataSource as an anonymous user.
     * @param {Function} onComplete Callback, executed when login is completed either successfully or erroneously.
     * On error, first argument is error message.
     * On success, the first argument is null, and the second argument is an object containing the fields uid, provider, auth, and expires.
     * @param {Object} options Optional, additional client arguments, such as configuring session persistence.
     * @returns {Promise} A promise that resolves after successful authentication.
     */
    authAnonymously(options) {
        return this._firebase.auth().signInAnonymously();
    }

    /**
     * Send a password reset to the email adress
     * @param emailAddress
     * @returns {Promise}
     */
    sendPasswordResetEmail(emailAddress) {
        return this._firebase.auth().sendPasswordResetEmail(emailAddress);
    }

    /**
     * Fetches the current user's authentication state.
     * If the user is authenticated, returns an object containing at least the fields uid, provider, auth, and expires.
     * If the user is not authenticated, returns null.
     * @returns {Object|null} User auth object.
     */
    getAuth() {
        let firebaseAuth = this._firebase.auth();
        let { currentUser } = firebaseAuth;
        if (!this._authDataPresent) {
            if (currentUser) {
                this._authDataPresent = true;
                return Promise.resolve(currentUser);
            } else {
                return new Promise((resolve) => {
                    firebaseAuth.onAuthStateChanged((newUser) => {
                        this._authDataPresent = true;
                        resolve(newUser);
                    });
                });
            }
        } else {
            return Promise.resolve(currentUser);
        }
    }

    /**
     * Logs out from the datasource, allowing to re-authenticate at a later time.
     * @returns {void}
     */
    unauth() {
        return this._firebase.auth().signOut();
    }

    /**
     * Subscribe to an event emitted by the DataSource.
     * @param {String} event Event type to subscribe to. Allowed values are: 'value', 'child_changed', 'child_added', 'child_removed', 'child_moved'.
     * @param {Function} handler Function to call when the subscribed event is emitted.
     * @param {Object} context Context to set 'this' to when calling the handler function.
     * @returns {void}
     */
    on(event, handler, context = this) {
        let boundHandler = this.handlers[handler] = handler.bind(this);
        this._orderedDataReference.on(event, boundHandler, (reasonForFailure) => {
            console.log(`Read failed: ${reasonForFailure}`);
        });
    }

    /**
     * Subscribe to an event emitted by the DataSource once, and then immediately unsubscribe again once it has been emitted a single time.
     * @param {String} event Event type to subscribe to. Allowed values are: 'value', 'child_changed', 'child_added', 'child_removed', 'child_moved'.
     * @param {Function} handler Function to call when the subscribed event is emitted.
     * @param {Object} context Context to set 'this' to when calling the handler function.
     * @returns {Promise}
     */
    once(event, handler, context = this) {
        return new Promise((resolve) => {
            function onceWrapper() {
                this.off(event, onceWrapper);
                handler && handler.call(context, ...arguments);
                resolve(...arguments);
            }
            this.on(event, onceWrapper, this);
        });
    }


    /**
     * Unsubscribe to a previously subscribed event. If no handler or context is given, all handlers for
     * the given event are removed. If no parameters are given at all, all event types will have their handlers removed.
     * @param {String} event Event type to unsubscribe from. Allowed values are: 'value', 'child_changed', 'child_added', 'child_removed', 'child_moved'.
     * @param {Function} handler Optional: Function that was used in previous subscription.
     * @returns {void}
     */
    off(event, handler) {
        let boundHandler = this.handlers[handler];
        this._orderedDataReference.off(event, boundHandler);
    }

    /**
     * Sets the callback triggered when dataSource updates the data.
     * @param {Function} callback Callback function to call when the subscribed data value changes.
     * @deprecated Use the on() method instead.
     * @returns {void}
     **/
    setValueChangedCallback(callback) {
        this._onValueCallback = callback;
        this.on('value', callback);
    }

    /**
     * Removes the callback set to trigger when dataSource updates the data.
     * @deprecated Use the off() method instead.
     * @returns {void}
     **/
    removeValueChangedCallback() {
        if (this._onValueCallback) {
            this.off('value', this._onValueCallback);
            this._onValueCallback = null;
        }
    }

    /**
     * Set the callback triggered when dataSource adds a data element.
     * @param {Function} callback Callback function to call when a new data child is added.
     * @deprecated Use the on() method instead.
     * @returns {void}
     **/
    setChildAddedCallback(callback) {
        this._onAddCallback = callback;
        this.on('child_added', callback);
    }

    /**
     * Removes the callback set to trigger when dataSource adds a data element.
     * @deprecated Use the off() method instead.
     * @returns {void}
     **/
    removeChildAddedCallback() {
        if (this._onAddCallback) {
            this.off('child_added', this._onAddCallback);
            this._onAddCallback = null;
        }
    }

    /**
     * Set the callback triggered when dataSource changes a data element.
     * @param {Function} callback Callback function to call when a child is changed.
     * @deprecated Use the on() method instead.
     * @returns {void}
     **/
    setChildChangedCallback(callback) {
        this._onChangeCallback = callback;
        this.on('child_changed', callback);
    }

    /**
     * Removes the callback set to trigger when dataSource changes a data element.
     * @deprecated Use the off() method instead.
     * @returns {void}
     **/
    removeChildChangedCallback() {
        if (this._onChangeCallback) {
            this.off('child_changed', this._onChangeCallback);
            this._onChangeCallback = null;
        }
    }

    /**
     * Set the callback triggered when dataSource moves a data element.
     * @param {Function} callback Callback function to call when a child is moved.
     * @deprecated Use the on() method instead.
     * @returns {void}
     **/
    setChildMovedCallback(callback) {
        this._onMoveCallback = callback;
        this.on('child_moved', callback);
    }

    /**
     * Removes the callback set to trigger when dataSource moves a data element.
     * @deprecated Use the off() method instead.
     * @returns {void}
     **/
    removeChildMovedCallback() {
        if (this._onMoveCallback) {
            this.off('child_moved', this._onMoveCallback);
            this._onMoveCallback = null;
        }
    }

    /**
     * Set the callback triggered when dataSource removes a data element.
     * @param {Function} callback Callback function to call when a child is removed.
     * @deprecated Use the on() method instead.
     * @returns {void}
     **/
    setChildRemovedCallback(callback) {
        this._onRemoveCallback = callback;
        this.on('child_removed', this._onRemoveCallback);
    }

    /**
     * Removes the callback set to trigger when dataSource removes a data element.
     * @deprecated Use the off() method instead.
     * @returns {void}
     **/
    removeChildRemovedCallback() {
        if (this._onRemoveCallback) {
            this.off('child_removed', this._onRemoveCallback);
            this._onRemoveCallback = null;
        }
    }


    /**
     * Performs an atomic transaction
     * @param {Function} transactionFunction A function that takes the current value as a single argument, and
     * returns the new value.
     * @returns {Promise} Resolves the new value when the transaction is finished
     */
    atomicTransaction(transactionFunction) {
        return new Promise((resolve, reject) => {
            this._dataReference.transaction(transactionFunction, (error, wasSuccessfullyCommited, snapshot) => {
                if (error) {
                    return this._rethrowFirebaseError(error, {}).catch(reject);
                }
                if (!wasSuccessfullyCommited) {
                    console.log(`Transaction failed, retrying`);
                    return this.atomicTransaction(transactionFunction);
                }
                resolve(snapshot.val());
            });
        });
    }

    /**
     * Rethrows a an error in Firebase to contain some more data to better be able to see the cause of the error
     * @param error
     * @param newData
     * @private
     */
    _rethrowFirebaseError(error, newData) {
        error.data = newData;
        error.path = this.path();
        return Promise.reject(error);
    }

    /**
     * Gets a symbolic representation of a timestamp as being run on the server-side
     * @returns {*}
     */
    getTimestampSymbol() {
        return this._firebase.database.ServerValue.TIMESTAMP;
    }
}