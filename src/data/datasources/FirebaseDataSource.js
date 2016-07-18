/**


 @author: Tom Clement (tjclement)
 @license NPOSL-3.0
 @copyright Bizboard, 2015

 */
import _                            from 'lodash';
import firebase                     from 'firebase';
import {DataSource}                 from '../DataSource.js';
import {ObjectHelper}               from '../../utils/ObjectHelper.js';
import {provide}                    from '../../utils/di/Decorators.js';

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
     * @param {String} [options.orderBy] Optional, order all items received through the dataSource.
     *                                   Options are: '.priority', '.value', or a string containing the child key to order by (e.g. 'MyModelProperty')
     * @param {Number} [options.limitToFirst] Optional, only subscribe to the first amount of entries.
     * @param {Number} [options.limitToLast] Optional, only subscribe to the last amount of entries.
     **/
    constructor(path, options = {orderBy: '.priority'}) {
        super(path);
        this._onValueCallback = null;
        this._onAddCallback = null;
        this._onChangeCallback = null;
        this._onMoveCallback = null;
        this._onRemoveCallback = null;
        this._dataReference = firebase.database().ref(path);
        this.handlers = {};
        this.options = options;

        /* Populate the orderedReference, which is the standard Firebase reference with an optional ordering
         * defined. This needs to be saved seperately, because methods like child() and key() can't be called
         * from the ordered reference, and must instead be performed on the standard reference. */

        if (this.options.orderBy && this.options.orderBy === '.priority') {
            this._orderedDataReference = this._dataReference.orderByPriority();
        } else if (this.options.orderBy && this.options.orderBy === '.value') {
            this._orderedDataReference = this._dataReference.orderByValue();
        } else if (this.options.orderBy && this.options.orderBy !== '') {
            this._orderedDataReference = this._dataReference.orderByChild(this.options.orderBy);
        } else {
            this._orderedDataReference = this._dataReference;
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

    /**
     * Returns the full path to this dataSource's source on the remote storage provider.
     * @returns {String} Full resource path.
     */
    toString() {
        return this._dataReference.toString();
    }


    /**
     * Returns a dataSource reference to the given child branch of the current datasource.
     * @param {String} childName Child branch name.
     * @param {Object} options Optional: additional options to pass to new DataSource instance.
     * @returns {DataSource} New dataSource instance pointing to the given child branch.
     */
    child(childName, options = {}) {
        return new FirebaseDataSource(`${this.path()}/${childName}`, options);
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
     * @returns {void}
     */
    set(newData) {
        return this._dataReference.set(newData);
    }

    /**
     * Removes the object and all underlying children that this dataSource points to.
     * @returns {void}
     */
    remove() {
        return this._dataReference.remove();
    }

    /**
     * Writes newData to the path this dataSource was constructed with, appended by a random UID generated by
     * the dataSource.
     * @param {Object} newData New data to append to dataSource.
     * @returns {FirebaseDataSource} A new FirebaseDataSource pointing to the injected data.
     */
    push(newData) {
        return new FirebaseDataSource(`${this.path()}/${this._dataReference.push(newData).key}`);
    }

    /**
     * Writes newData with given priority (ordering) to the path this dataSource was constructed with.
     * @param {Object} newData New data to set.
     * @param {String|Number} priority Priority value by which the data should be ordered.
     * @returns {void}
     */
    setWithPriority(newData, priority) {
        return this._dataReference.setWithPriority(newData, priority);
    }

    /**
     * Sets the priority (ordering) of an object on a given dataSource.
     * @param {String|Number} newPriority New priority value to order data by.
     * @returns {void}
     */
    setPriority(newPriority) {
        return this._dataReference.setPriority(newPriority);
    }

    /**
     * Orders the DataSource's childs by the value in child[key].
     * @param {String} childKey Key of the field to order by.
     * @returns {DataSource} New dataSource instance.
     */
    orderByChild(childKey) {
        return new FirebaseDataSource(this.path(), _.merge({}, this.options, {orderBy: childKey}));
    }

    /**
     * Orders the DataSource's childs by their key names, ignoring their priority.
     * @returns {DataSource} New dataSource instance.
     */
    orderByKey() {
        return new FirebaseDataSource(this.path(), _.merge({}, this.options, {orderBy: '.key'}));
    }

    /**
     * Orders the DataSource's childs by their values, ignoring their priority.
     * @returns {DataSource} New dataSource instance.
     */
    orderByValue() {
        return new FirebaseDataSource(this.path(), _.merge({}, this.options, {orderBy: '.value'}));
    }

    /**
     * Returns a new dataSource reference that will limit the subscription to only the first given amount items.
     * @param {Number} amount Amount of items to limit the dataSource to.
     * @returns {DataSource} New dataSource instance.
     */
    limitToFirst(amount) {
        return new FirebaseDataSource(this.path(), _.merge({}, this.options, {limitToFirst: amount}));
    }

    /**
     * Returns a new dataSource reference that will limit the subscription to only the last given amount items.
     * @param {Number} amount Amount of items to limit the dataSource to.
     * @returns {DataSource} New dataSource instance.
     */
    limitToLast(amount) {
        return new FirebaseDataSource(this.path(), _.merge({}, this.options, {limitToLast: amount}));
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
        credentials.provider = provider;
        return firebase.auth().signInWithCredential(credentials).then((user) => { if(onComplete) { onComplete(user); } return user; });
    }

    /**
     * Authenticates all instances of this DataSource with a custom auth token or secret.
     * @param {String} authToken Authentication token or secret.
     * @param {Function} onComplete Callback, executed when login is completed either successfully or erroneously.
     * On error, first argument is error message.
     * On success, the first argument is null, and the second argument is an object containing the fields uid, provider, auth, and expires.
     * @returns {Promise} A promise that resolves after successful authentication.
     */
    authWithCustomToken(authToken, onComplete) {
        return firebase.auth().signInWithCustomToken(authToken).then((user) => { if(onComplete) { onComplete(user); } return user; });
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
        return firebase.auth().signInWithEmailAndPassword(credentials.email, credentials.password).then((user) => { if(onComplete) { onComplete(user); } return user; });
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
        return firebase.auth().signInAnonymously();
    }

    /**
     * Fetches the current user's authentication state.
     * If the user is authenticated, returns an object containing at least the fields uid, provider, auth, and expires.
     * If the user is not authenticated, returns null.
     * @returns {Object|null} User auth object.
     */
    getAuth() {
        let firebaseAuth = firebase.auth();
        let {currentUser} = firebaseAuth;
        if(!this._authDataPresent){
            if(currentUser){
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
        return firebase.auth().signOut();
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
        this._orderedDataReference.on(event, boundHandler);
    }

    /**
     * Subscribe to an event emitted by the DataSource once, and then immediately unsubscribe again once it has been emitted a single time.
     * @param {String} event Event type to subscribe to. Allowed values are: 'value', 'child_changed', 'child_added', 'child_removed', 'child_moved'.
     * @param {Function} handler Function to call when the subscribed event is emitted.
     * @param {Object} context Context to set 'this' to when calling the handler function.
     * @returns {void}
     */
    once(event, handler, context = this) {
        function onceWrapper() {
            handler.call(context, ...arguments);
            this.off(event, onceWrapper);
        }

        return this.on(event, onceWrapper, this);
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
}