/**
 * Created by mysim1 on 13/06/15.
 */
import _                from 'lodash';
import EventEmitter     from 'eventemitter3';
import {SoapClient}     from './SoapClient.js';
import {Settings}       from '../Settings.js';
import {ExistsRequest}  from '../../../../../utils/request/RequestClient.js';
import {UrlParser}      from '../../../../../utils/request/UrlParser.js';

// setup the soapClient.
var soapClient = new SoapClient();
var window = this;
var global = this;
var tempKeys = [];

export class SharePointClient extends EventEmitter {

    get refreshTimer() {
        return this._refreshTimer;
    }

    set refreshTimer(value) {
        this._refreshTimer = value;
    }

    constructor(options) {
        super();

        this.settings = options;
        this.interval = 3000;
        this.retriever = null;
        this.cache = [];
        this.hasNoServerResponse = true;
        this._active = false;
    }

    init() {
        try {
            let {settings, isChild} = this._initializeSettings(this.settings);
            this.settings = settings;
            this.isChild = isChild;

            this._handleInit(this.settings);
        } catch (exception) {
            this.dispose();
        }
    }

    set(options) {
        return this._handleSet(options);
    }

    remove(options) {
        return this._handleRemove(options);
    }

    dispose() {
        clearTimeout(this.refreshTimer);
        this.refreshTimer = null;
        this._active = false;
    }

    getAuth() {
        return new Promise((resolve, reject) => {
            /* initialize with SharePoint configuration */
            let configuration = this._getUserGroupDefaultConfiguration();

            /* Append the listName to the URL for easy debugging */
            configuration.url = `${this.settings.endPoint}/${this._getUserGroupService()}?view=getUserGroup`;

            soapClient.call(configuration).then((result) => {
                let data = result.data["soap:Envelope"]["soap:Body"][0].GetCurrentUserInfoResponse[0].GetCurrentUserInfoResult[0].GetUserInfo[0].User[0].$;
                let user = {
                    uid: data.ID,
                    name: data.Name,
                    email: data.Email
                };
                resolve(user);
            }).catch((error) => reject(error));
        });
    }

    subscribeToChanges() {
        if (!this.isChild) {
            /* Don't monitor child item updates/removes. We only do that on parent arrays. */
            if (!this._active) {
                this._active = true;
                this._refresh();
            }
        }
    }

    _initializeSettings(args) {

        // rebuild endpoint from polling server and interpreting response
        let url = UrlParser(args.endPoint);
        if (!url) throw new Error('Invalid DataSource path provided!');

        let newPath = url.protocol + '://' + url.host + '/';
        let pathParts = url.path.split('/');
        let identifiedParts = [];

        let isChild = this._isChildItem(url.path);

        if (!isChild) {
            /* We can always remove the last part of the path, since it will be a list name (which we don't need in the sharepoint URL). */
            identifiedParts.unshift(pathParts.splice(pathParts.length - 1, 1)[0]);

            try {
                while (!ExistsRequest(newPath + pathParts.join('/') + '/' + this._getListService())) {
                    identifiedParts.unshift(pathParts.splice(pathParts.length - 1, 1)[0]);
                }
            } catch (error) {
                console.log('SharePoint URL detection error:', error);
            }
        } else {
            /* We're initializing a child element that has an array-based parent.
             * This means we can't automatically find the correct SharePoint path, and we'll have to assume the listName and itemId. */
            identifiedParts[0] = pathParts[pathParts.length - 2];
            identifiedParts[1] = pathParts[pathParts.length - 1];
            pathParts.splice(pathParts.length - 2, 2);
            /* Remove the child ID from the endpoint so we can modify its value through the parent endpoint. */
        }

        if (identifiedParts.length < 1) {
            throw {
                endPoint: pathParts.join('/') + '/' + identifiedParts[0],
                message: 'Parameters could not be correctly extracted for polling. Assuming invalid state.'
            }
        }
        else {
            let resultconfig = {
                endPoint: newPath + pathParts.join('/'),
                listName: identifiedParts[0],
                itemId: identifiedParts[1]
            };


            _.extend(resultconfig, _.pick(args, ['query', 'limit', 'orderBy', 'pageSize']));

            return {settings: resultconfig, isChild: isChild};
        }
    }

    /**
     * Start reading the list from SharePoint and only retrieve changes from last polling timestamp.
     * @param args
     * @private
     */
    _handleInit(args) {

        if (!args.listName) return;

        // initialize with SharePoint configuration
        this.retriever = this._getListItemsDefaultConfiguration();

        /* Append the listName to the URL for easy debugging */
        this.retriever.url = this._parsePath(args.endPoint, this._getListService()) + `?view=${args.listName}`;
        this.retriever.params = {
            'listName': args.listName,
            'viewFields': {
                'ViewFields': ''
            },
            //'since': new Date(0).toISOString(),
            'queryOptions': {
                'QueryOptions': {
                    'IncludeMandatoryColumns': 'FALSE',
                    'ViewAttributes': {
                        '_Scope': 'RecursiveAll'
                    }
                }
            }
        };

        if (args.query) {
            this.retriever.params.query = args.query;
        }

        if (args.orderBy) {
            if (this.retriever.params.query) {
                this.retriever.params.query.OrderBy = {
                    "FieldRef": {
                        "_Ascending": "TRUE",
                        "_Name": args.orderBy
                    }
                };
            }
            else {
                this.retriever.params.query = {
                    Query: {
                        OrderBy: {
                            "FieldRef": {
                                "_Ascending": "TRUE",
                                "_Name": args.orderBy
                            }
                        }
                    }
                };
            }
        }


        let rowLimit;
        this.explicitRowLimit = args.limit !== undefined;
        if (this.explicitRowLimit) {
            rowLimit = this.explicitRowLimit = args.limit;
        }
        if (args.pageSize) {
            rowLimit = args.pageSize;
            this.pageSize = args.pageSize;
        }
        if (rowLimit) {
            this.retriever.params.rowLimit = rowLimit;
        }
    }

    _isLimitExceeded() {
        return this.explicitRowLimit !== false && this.cache.length >= this.explicitRowLimit;
    }


    /**
     *
     * Refresh SharePoint with latest changes.
     * @param {Boolean} calledManually If set to false, ignores any existing timer in this.refreshTimer and executes the refresh regardless.
     * @private
     */
    _refresh() {
        if (this.retriever) {
            if (this._isLimitExceeded()) {
                this.retriever.params.rowLimit = this.explicitRowLimit;
            }
            soapClient.call(this.retriever, tempKeys)
                .then((result) => {


                    let listItem = result.data["soap:Envelope"]["soap:Body"][0].GetListItemChangesSinceTokenResponse[0].GetListItemChangesSinceTokenResult[0].listitems[0];
                    let hasDeletions = false;
                    if (listItem.Changes) {
                        let changes = listItem.Changes[0];
                        hasDeletions = this._handleDeleted(changes);
                    }

                    let data = this._getResults(result.data);
                    let messages = this._updateCache(data);

                    this._handleNextToken(listItem);

                    /* If any data is new or modified, emit a 'value' event. */
                    if (hasDeletions || data.length > 0) {
                        this.emit('message', {event: 'value', result: this.cache});

                    } else if (this.hasNoServerResponse) {
                        /* If there is no data, and this is the first time we get a response from the server,
                         * emit a value event that shows subscribers that there is no data at this path. */
                        this.emit('message', {event: 'value', result: null});
                    }

                    if (!this.hasNoServerResponse) {
                        /* Emit any added/changed events. */
                        for (let message of messages) {
                            this.emit('message', message);
                        }
                    }
                    this.hasNoServerResponse = false;
                    if (this._active) {
                        this.refreshTimer = setTimeout(this._refresh.bind(this), this.interval);
                    }

                }).catch((err) => {
                this.emit('error', err);
                if (this._active) {

                    this.refreshTimer = setTimeout(this._refresh.bind(this), this.interval);
                }

            });
        }
    }


    /**
     * Add or Update a data record.
     * @private
     */
    _handleSet(newData) {
        var configuration = this._updateListItemsDefaultConfiguration();
        /* Append the listName to the URL for easy debugging */
        configuration.url = this._parsePath(this.settings.endPoint, this._getListService()) + `?update=${this.settings.listName}`;
        var fieldCollection = [];
        var method = '';

        let isLocal = _.findIndex(tempKeys, function (key) {
            return key.localId == newData.id;
        });

        if (isLocal > -1) {
            newData.id = tempKeys[isLocal].remoteId;
        }

        if (!newData.id && this.childID) {
            newData.id = this.childID;
        }

        // assume existing record to be updated.
        if (newData.id) {

            fieldCollection.push({
                "_Name": "ID",
                "__text": newData.id
            });

            method = "Update";
        }
        // create a new record, because there is no id.
        else {
            fieldCollection.push({
                "_Name": "ID",
                "__text": 'New'
            });
            method = 'New';
        }

        for (var prop in newData) {
            let fieldValue = newData[prop];
            if (prop == "id" || typeof(fieldValue) == "undefined") continue;
            if (prop == "priority" || prop == "_temporary-identifier" || prop == "remoteId") continue;
            if (typeof fieldValue === 'object') {
                if (fieldValue.id && fieldValue.value) {
                    /* This is a SharePoint lookup type field. We must write it as a specially formatted value instead of an id/value object. */
                    fieldValue = `${fieldValue.id};#`;
                } else if (fieldValue.length !== undefined && fieldValue[0] && fieldValue[0].id && fieldValue[0].value) {
                    /* This is a SharePoint LookupMulti field. It is specially formatted like above. */
                    let IDs = _.pluck(fieldValue, 'id');
                    fieldValue = IDs.join(';#;#');
                } else {
                    continue;
                }
            }


            fieldCollection.push({
                "_Name": prop,
                "__text": fieldValue
            });
        }

        configuration.params = {
            "listName": this.settings.listName,
            "updates": {
                "Batch": {
                    "Method": {
                        "Field": fieldCollection,

                        "_ID": "1",
                        "_Cmd": method
                    },

                    "_OnError": "Continue",
                    "_ListVersion": "1",
                    "_ViewName": ""
                }
            }
        };

        // initial initialisation of the datasource
        (function (newData) {
            soapClient.call(configuration, tempKeys)
                .then((result)=> {

                    let data = this._getResults(result.data);
                    if (data.length == 1) {
                        let remoteId = data[0].id;

                        // push ID mapping for given session to collection of temp keys
                        if (newData['_temporary-identifier']) {
                            tempKeys.push({
                                localId: newData['_temporary-identifier'],
                                remoteId: remoteId,
                                client: this
                            });
                        }
                        let messages = this._updateCache(data);
                        for (let message of messages) {
                            this.emit('message', message);
                        }

                        /* Fire a value/child_changed event with the now available remoteId present */
                        let model = newData;
                        model.id = model['_temporary-identifier'] || model.id;
                        model.remoteId = remoteId;
                        if (this.isChild) {
                            /* TODO: re-enable value emit on children when child subscriptions are implemented */
                            //this.emit('message', {event: 'value', result: model});
                        } else {
                            this.emit('message', {event: 'child_changed', result: model});
                            this.emit('message', {event: 'value', result: this.cache});
                        }
                    }
                }, (error) => {
                    console.log(error);
                });
        }.bind(this))(newData);
    }

    /**
     * Remove a record from SharePoint
     * @param record
     * @private
     */
    _handleRemove(record) {
        var configuration = this._updateListItemsDefaultConfiguration();
        /* Append the listName to the URL for easy debugging */
        configuration.url = this._parsePath(this.settings.endPoint, this._getListService()) + `?remove=${this.settings.listName}`;
        var fieldCollection = [];

        record.remoteId = record.id;

        let isLocal = _.findIndex(tempKeys, function (key) {
            return key.localId == record.id;
        });

        if (isLocal > -1) {
            record.id = tempKeys[isLocal].remoteId;
        }

        fieldCollection.push({
            "_Name": "ID",
            "__text": record.id
        });

        configuration.params = {
            "listName": this.settings.listName,
            "updates": {
                "Batch": {
                    "Method": {
                        "Field": fieldCollection,

                        "_ID": '1',
                        "_Cmd": 'Delete'
                    },

                    "_OnError": 'Continue',
                    "_ListVersion": '1',
                    "_ViewName": ''
                }
            }
        };

        // initial initialisation of the datasource
        soapClient.call(configuration, tempKeys)
            .then(()=> {
                this.emit('message', {event: 'child_removed', result: record});
            }, (error) => {
                console.log(error);
            });
    }


    /**
     * Update our cache and bubble child_added or child_changed events
     * @param data
     * @private
     */
    _updateCache(data) {
        let messages = [];
        for (let record in data) {
            let shouldUseRemoteId = false;
            let model = data[record];
            model.remoteId = model.id;

            let localIndex = _.findIndex(tempKeys, function (key) {
                return key.remoteId == model.id;
            });

            if (localIndex > -1) {
                let tempKey = tempKeys[localIndex];

                /* If this SPClient instance created the temp ID, we need to use it in our events.
                 * Otherwise, we should use the remote ID that SharePoint generated. */
                shouldUseRemoteId = tempKey.client !== this;
                model.id = shouldUseRemoteId ? model.remoteId : tempKey.localId;
            }

            let cacheIndex = _.findIndex(this.cache, function (item) {
                return model.id == item.id;
            });

            if (cacheIndex === -1) {
                this.cache.push(model);

                let previousSiblingId = this.cache.length == 0 ? null : this.cache[this.cache.length - 1];
                messages.push({
                    event: 'child_added',
                    result: model,
                    previousSiblingId: previousSiblingId ? previousSiblingId.id : null
                });
            }
            else {
                if (!_.isEqual(model, this.cache[cacheIndex])) {
                    this.cache[cacheIndex] = model;

                    let previousSibling = cacheIndex == 0 ? null : this.cache[cacheIndex - 1];
                    messages.push({
                        event: 'child_changed',
                        result: model,
                        previousSiblingId: previousSibling ? previousSibling.id : null
                    });
                }
            }
        }
        return messages;
    }


    /**
     * Update the last polling timestamp so we only get the latest changes.
     * @param newDate
     * @private
     */
    _activateChangeToken(lastChangeToken) {
        this.retriever.params.changeToken = lastChangeToken;
    }

    _setNextPage(nextPaginationToken) {
        this.retriever.params.queryOptions.QueryOptions.Paging = {_ListItemCollectionPositionNext: nextPaginationToken};
    }

    _clearNextPage() {
        delete this.retriever.params.queryOptions.QueryOptions.Paging;
    }

    _deactivateChangeToken() {
        delete this.retriever.params.changeToken;
    }


    _handleNextToken(listItem) {
        let lastQueryHadPagination = this.retriever.params.queryOptions.QueryOptions.Paging;

        if (!lastQueryHadPagination && listItem.Changes) {
            this.lastChangeToken = listItem.Changes[0].$.LastChangeToken;
        }

        if (this._isLimitExceeded()) {
            this._clearNextPage();
            this._activateChangeToken(this.lastChangeToken);
        } else {
            let {ListItemCollectionPositionNext: nextPaginationToken} = listItem["rs:data"][0].$;

            if (nextPaginationToken !== undefined) {
                this._setNextPage(nextPaginationToken);
                this._deactivateChangeToken();
            } else {
                this._clearNextPage();
                this._activateChangeToken(this.lastChangeToken);
            }
        }
    }


    _handleDeleted(result) {

        let changes = result.Id || null;

        if (changes && changes.length > 0) {

            for (let change in changes) {

                if (changes[change].$.ChangeType == "Delete") {

                    let recordId = changes[change]._;

                    let localIndex = _.findIndex(tempKeys, function (key) {
                        return key.remoteId == recordId;
                    });

                    if (localIndex > -1) {
                        let tempKey = tempKeys[localIndex];
                        let isOurTempKey = tempKey.client === this;
                        recordId = isOurTempKey ? tempKey.localId : tempKey.remoteId;
                    }

                    let cacheItem = _.findIndex(this.cache, function (item) {
                        return item.id == recordId;
                    });

                    this.emit('message', {
                        event: 'child_removed',
                        result: this.cache[cacheItem]
                    });
                    this.cache.splice(cacheItem, 1);
                }
            }

            return true;
        }

        return false;
    }

    /**
     * Parse SharePoint response into formatted records
     * @param result
     * @returns {Array}
     * @private
     */
    _getResults(result) {

        let arrayOfObjects = [];
        let node = null;


        if (result["soap:Envelope"]["soap:Body"][0].GetListItemChangesSinceTokenResponse) {

            node = result["soap:Envelope"]["soap:Body"][0].GetListItemChangesSinceTokenResponse[0].GetListItemChangesSinceTokenResult[0].listitems[0]["rs:data"][0];

            if (node) {
                if (node.$.ItemCount !== '0') {
                    for (let row in node['z:row']) {
                        let raw = node['z:row'][row].$;
                        let record = this._formatRecord(raw);
                        arrayOfObjects.push(record);
                    }
                }
            }
        }
        else if (result["soap:Envelope"]["soap:Body"][0].UpdateListItemsResponse) {

            // check for error
            let error = result["soap:Envelope"]["soap:Body"][0].UpdateListItemsResponse[0].UpdateListItemsResult[0].Results[0].Result[0].ErrorCode;
            if (error == '0x00000000') {
                node = result["soap:Envelope"]["soap:Body"][0].UpdateListItemsResponse[0].UpdateListItemsResult[0].Results[0];
                if (node) {
                    for (let row in node.Result) {
                        let raw = node.Result[row]["z:row"][0].$;
                        let record = this._formatRecord(raw);
                        arrayOfObjects.push(record);
                    }
                }
            }
        }

        return arrayOfObjects;
    }

    /**
     * Strip SharePoint record from SharePoint specifics
     * @param record
     * @returns {{}}
     * @private
     */
    _formatRecord(record) {
        let result = {};
        for (let attribute in record) {

            let name = attribute.replace('ows_', '');
            if (name == 'xmlns:z') {
                continue;
            }

            let value = record[attribute];
            if (value === '') {
                continue;
            }

            if (name == "ID") {
                name = "id";
                result[name] = value;
            } else if (value.indexOf(";#") > -1) {
                var keys = value.split(";#");
                var pairs = keys.length / 2;
                var assignable = pairs > 1 ? [] : {};
                for (var pair = 0; pair < keys.length; pair += 2) {
                    if (pairs > 1) assignable.push({id: keys[pair], value: keys[pair + 1]});
                    else assignable = {id: keys[pair], value: keys[pair + 1]};
                }
                result[name] = assignable;
            } else if (!isNaN(value)) {
                /* Map a number when that number is detected */
                result[name] = parseFloat(value);
            } else {
                /* By default map the attribute 1:1 */
                result[name] = value;
            }
        }

        return result;
    }


    /**
     * Double check if given path is a valid path
     * @param path
     * @param endPoint
     * @returns {string}
     * @private
     */
    _parsePath(path = '', endPoint = '') {

        var url = UrlParser(path);
        if (!url) console.log('Invalid datasource path provided!');

        var pathParts = url.path.split('/');
        var newPath = url.protocol + '://' + url.host + '/';
        for (var i = 0; i < pathParts.length; i++)
            newPath += pathParts[i] + '/';
        newPath += endPoint;
        return newPath;
    }


    /**
     * Get Default resource for Updating Lists
     * @returns {{url: string, service: string, method: string, params: string, headers: (Map|*)}}
     * @private
     */
    _updateListItemsDefaultConfiguration() {
        return {
            url: '',
            service: 'Lists',
            method: 'UpdateListItems',
            params: '',
            headers: new Map([
                ['SOAPAction', 'http://schemas.microsoft.com/sharepoint/soap/UpdateListItems'],
                ['Content-Type', 'text/xml']
            ])
        };
    }


    /**
     * Get Default resource for Reading Lists
     * @returns {{url: string, service: string, method: string, params: string, headers: (Map|*)}}
     * @private
     */
    _getListItemsDefaultConfiguration() {
        return {
            url: '',
            service: 'Lists',
            method: 'GetListItemChangesSinceToken',
            params: '',
            headers: new Map([
                ['SOAPAction', 'http://schemas.microsoft.com/sharepoint/soap/GetListItemChangesSinceToken'],
                ['Content-Type', 'text/xml']
            ])
        };
    }


    /**
     * Get Default resource for Reading Lists
     * @returns {{url: string, service: string, method: string, params: string, headers: (Map|*)}}
     * @private
     */
    _getUserGroupDefaultConfiguration() {
        return {
            url: '',
            service: 'UserGroup',
            method: 'GetCurrentUserInfo',
            params: '',
            headers: new Map([
                ['SOAPAction', 'http://schemas.microsoft.com/sharepoint/soap/directory/GetCurrentUserInfo'],
                ['Content-Type', 'text/xml']
            ])
        };
    }


    /**
     * Default interface for Get list
     * @returns {string}
     * @private
     */
    _getListService() {
        return '_vti_bin/Lists.asmx';
    }


    /**
     * Default interface for Update list
     * @returns {string}
     * @private
     */
    _getUserGroupService() {
        return '_vti_bin/UserGroup.asmx';
    }

    /* Ignores all paths ending in a numeric value. These paths don't contain an array, but rather a specific child.
     * Binding to specific children is not supported by the SharePoint interface, and shouldn't be necessary either
     * because there is a subscription to child_changed events on the parent array containing this child. */
    _isChildItem(path) {
        if (path[path.length - 1] === '/') {
            path = path.substring(0, path.length - 2);
        }

        let parts = path.split('/');
        if (parts.length) {
            let lastArgument = parts[parts.length - 1];

            let isNumeric = (n) => !isNaN(parseFloat(n)) && isFinite(n);

            if (isNumeric(lastArgument) || lastArgument.indexOf(Settings.localKeyPrefix) === 0) {
                this.childID = lastArgument;
                return true;
            } else {
                return false;
            }
        }
        return true;
    }
}
