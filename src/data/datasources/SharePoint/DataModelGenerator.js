/**


 @author: Hans van den Akker (mysim1)
 @license NPOSL-3.0
 @copyright Bizboard, 2015

 */

import XML2JS               from './xml2js.js';
import template             from 'lodash/template.js';
import {PostRequest}        from '../../../utils/request/RequestClient.js';
import {ObjectHelper}       from '../../../utils/ObjectHelper.js';
import {UrlParser}          from '../../../utils/request/UrlParser.js';
import {ParseStringToXml}   from '../../../utils/request/XmlParser.js';


export class DataModelGenerator {

    constructor(originalPath, schema) {

        // initialize the arguments
        if (!schema) throw 'Schema wasn\'t provided.';
        if (schema && schema.Prefix) {
            this._applicationId = schema.Prefix;
        }

        this.hidden = 'TRUE';
        this._originalPath = originalPath;
        this._Schema = schema.Schema;
        this._Seed = schema.Seed;

        // if the dataspec contains an instruction 'hidden' have this setting override the default
        if (schema &&
            typeof schema.hidden == 'boolean') {
            this.hidden = schema.hidden.toString().toUpperCase();
        }

        /* Bind all local methods to the current object instance, so we can refer to 'this'
         * in the methods as expected, even when they're called from event handlers.        */

        /* Hide all private properties (starting with '_') and methods from enumeration,
         * so when you do for( in ), only actual data properties show up. */
        ObjectHelper.hideMethodsAndPrivatePropertiesFromObject(this);
    }


    Deploy() {
        if (!this._Schema) throw 'There is no schema to deploy.';
        //var listOfPromisesToFullfill = [];

        return new Promise(async function (resolve, reject) {

            // iterate through all tables listed.
            for (let table in this._Schema) {

                try {
                    let listCreated = await this._GetOrCreateList(table);
                    var fields = this._Schema[table];
                    if (fields && fields.length > 0) {
                        let modelCreated = await this._GetOrCreateModel(table, fields, listCreated);
                        let viewCreated = await this._UpdateDefaultView(table, fields, listCreated);
                    }

                } catch (ex) {
                    console.log(ex);
                }
            }

            resolve();

        }.bind(this));
    }

    Seed() {
        if (!this._Seed) throw 'There is no seed to deploy.';


    }


    _UpdateDefaultView(listName, fields, listCreated) {

        return new Promise(async function (resolve, reject) {

            try {

                // resolve correct info
                let firstRequest = this._getDefaultViewRequest(listName);
                let viewResult = await PostRequest(firstRequest);

                // update
                let viewId = this._ResolveViewID(viewResult.response);
                let updateRequest = this._getUpdateViewRequest(listName, viewId, fields);
                let updateResult = await PostRequest(updateRequest);

                resolve(updateResult.response);
            }
            catch (ex) {
                console.log(ex);
                reject(ex);
            }
        }.bind(this));
    }


    _ResolveViewID(response) {

        let data = ParseStringToXml(response);
        let idNode;

        if (typeof(data.selectSingleNode) != 'undefined')
            idNode = data.selectSingleNode('//View[@DefaultView=\'TRUE\']');
        else
            idNode = data.querySelector('View[DefaultView=\'TRUE\']');

        let idAttribute = '';
        if (idNode) idAttribute = idNode.getAttribute('Name');

        return idAttribute;
    }

    _getUpdateViewRequest(listName, viewName, fieldNames) {

        // rough configuration object
        let params = {
            listName: listName,
            viewName: viewName,
            viewFields: {
                ViewFields: {
                    FieldRef: []
                }
            },
            rowLimit: {RowLimit: 100}
        };

        for (let fn = 0; fn < fieldNames.length; fn++) {
            params.viewFields.ViewFields.FieldRef.push({
                '_Name': fieldNames[fn].name
            });
        }

        return {
            url: this._ParsePath(this._originalPath, this._GetViewService),
            headers: new Map([
                ['SOAPAction', 'http://schemas.microsoft.com/sharepoint/soap/UpdateView'],
                ['Content-Type', 'text/xml']
            ]),
            data: this._applySoapTemplate({
                method: 'UpdateView',
                params: this._serializeParams(params)
            })
        };
    }

    _getDefaultViewRequest(listName) {
        // rough configuration object
        let params = {
            listName: listName
        };

        return {
            url: this._ParsePath(this._originalPath, this._GetViewService),
            headers: new Map([
                ['SOAPAction', 'http://schemas.microsoft.com/sharepoint/soap/GetView'],
                ['Content-Type', 'text/xml']
            ]),
            data: this._applySoapTemplate({
                method: 'GetView',
                params: this._serializeParams(params)
            })
        };
    }

    _getListExistRequest(listName) {
        // rough configuration object
        let params = {
            listName: listName
        };

        return {
            url: this._ParsePath(this._originalPath, this._GetListService),
            headers: new Map([
                ['SOAPAction', 'http://schemas.microsoft.com/sharepoint/soap/GetList'],
                ['Content-Type', 'text/xml']
            ]),
            data: this._applySoapTemplate({
                method: 'GetList',
                params: this._serializeParams(params)
            })
        };
    }

    _getListCreationRequest(listName, listDescription) {
        // rough configuration object
        let params = {
            listName: listName,
            description: listDescription,
            templateID: '100'
        };

        return {
            url: this._ParsePath(this._originalPath, this._GetListService),
            headers: new Map([
                ['SOAPAction', 'http://schemas.microsoft.com/sharepoint/soap/AddList'],
                ['Content-Type', 'text/xml']
            ]),
            data: this._applySoapTemplate({
                method: 'AddList',
                params: this._serializeParams(params)
            })
        };
    }

    _getListUpdateRequest(params) {

        return {
            url: this._ParsePath(this._originalPath, this._GetListService),
            headers: new Map([
                ['SOAPAction', 'http://schemas.microsoft.com/sharepoint/soap/UpdateList'],
                ['Content-Type', 'text/xml']
            ]),
            data: this._applySoapTemplate({
                method: 'UpdateList',
                params: this._serializeParams(params)
            })
        };
    }

    /**
     *
     * @param listName
     * @param description
     * @returns {Promise}
     * @constructor
     */
    _GetOrCreateList(listName, description = '') {

        return new Promise(async function (resolve, reject) {

            try {
                let existingListRequest = this._getListExistRequest(listName);
                let existingResult = await PostRequest(existingListRequest);
                resolve(existingResult.response);
            }
            catch (ex) {
                let newListRequest = this._getListCreationRequest(listName, description);
                let creationResult = await PostRequest(newListRequest);
                resolve(creationResult.response);
            }
        }.bind(this));
    }

    async _GetOrCreateModel(listName, modelDescription, listData) {

        let listOfLookups = [];
        let fieldsAdded = 0;
        // rough configuration object
        let params = {
            listName: listName,
            updateFields: {
                Fields: {
                    Method: [{
                        '_ID': 0, /* We automatically add an id field of our own, so we can push our own IDs to SharePoint. */
                        Field: {
                            '_Type': 'Text',
                            '_Name': 'Title',
                            '_DisplayName': 'Title',
                            '_Required': 'FALSE'
                        }
                    }]
                }
            },
            listProperties: {
                List: {
                    _Hidden: this.hidden,
                    _EnableAttachments: 'FALSE'
                }
            }
        };

        if (listData.indexOf(`StaticName="__id"`)) {
            params.newFields = {
                Fields: {
                    Method: [{
                        '_ID': 0, /* We automatically add an id field of our own, so we can push our own IDs to SharePoint. */
                        Field: {
                            '_Type': 'Integer',
                            '_DisplayName': '__id',
                            '_FromBaseType': 'TRUE',
                            '_Hidden': 'TRUE'
                        }
                    }]
                }
            };
        }

        for (let i = 1; i < modelDescription.length; i++) {
            let internalName = modelDescription[i].name;
            if (this._applicationId) internalName = this._applicationId + '_' + internalName;
            if (listData.indexOf(`StaticName="${internalName}"`) != -1) continue;

            // handle Lookups differently
            if (modelDescription[i].type == 'Lookup' || modelDescription[i].type == 'LookupMulti') {
                listOfLookups.push([listName, internalName, modelDescription[i].type, modelDescription[i].source, modelDescription[i].showField]);
            }
            else {
                // handle primitives

                var modelData = {
                    '_ID': i,
                    Field: {
                        '_Type': modelDescription[i].type,
                        '_DisplayName': internalName,
                        '_FromBaseType': 'TRUE'
                    }
                };
                params.newFields.Fields.Method.push(modelData);
            }
        }

        return new Promise(async function (resolve, reject) {

            try {
                // update list with settings and simple fields
                let updateListRequest = this._getListUpdateRequest(params);
                let updateResult = await PostRequest(updateListRequest);

                // go add lookups
                for (let lf = 0; lf < listOfLookups.length; lf++) {
                    try {
                        let lookupResult = await this._CreateLookup(...listOfLookups[lf]);
                    }
                    catch (ex) {
                        console.error('Error creating lookup field');
                    }
                }
                resolve(updateResult.response);
            }
            catch (ex) {
                reject(ex);
            }

        }.bind(this));
    }


    async _CreateLookup(listName, fieldName, type, sourceName, showField) {

        let listResult = await this._GetOrCreateList(sourceName);

        let listId = this._ResolveListID(listResult);

        // rough configuration object
        let params = {
            listName: listName,
            newFields: {
                Fields: {
                    Method: [{
                        '_ID': 1,
                        Field: {
                            '_Type': type,
                            '_DisplayName': fieldName,
                            '_FromBaseType': 'TRUE',
                            '_List': listId,
                            '_Mult': type === 'LookupMulti' ? 'TRUE' : 'FALSE',
                            '_ShowField': showField || 'ID'
                        }
                    }]
                }
            }
        };

        let updateListRequest = this._getListUpdateRequest(params);
        try {
            let updateListResult = await PostRequest(updateListRequest);
            return updateListResult;
        }
        catch (ex) {
            return '';
        }
    }


    _ResolveListID(response) {

        let data = ParseStringToXml(response);
        let idNode;


        if (typeof(data.selectSingleNode) != 'undefined')
            idNode = data.selectSingleNode('//List');
        else
            idNode = data.querySelector('List');

        let idAttribute = '';
        if (idNode) idAttribute = idNode.getAttribute('ID');

        return idAttribute;
    }


    _applySoapTemplate(properties) {
        return `<?xml version="1.0" encoding="utf-8"?>
              <soap:Envelope
               xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                xmlns:xsd="http://www.w3.org/2001/XMLSchema"
                xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
              <soap:Body>
              <${properties.method} xmlns="http://schemas.microsoft.com/sharepoint/soap/">
                ${properties.params}
              </${properties.method}>
              </soap:Body>
              </soap:Envelope>`;
        /*
         return template(
         '<?xml version="1.0" encoding="utf-8"?>' +
         '<soap:Envelope ' +
         '  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" ' +
         '  xmlns:xsd="http://www.w3.org/2001/XMLSchema" ' +
         '  xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">' +
         '<soap:Body>' +
         '<<%= method %> xmlns="http://schemas.microsoft.com/sharepoint/soap/">' +
         '<%= params %>' +
         '</<%= method %>>' +
         '</soap:Body>' +
         '</soap:Envelope>')(properties);*/
    }

    get _GetListService() {
        return '_vti_bin/Lists.asmx';
    }

    get _GetViewService() {
        return '_vti_bin/Views.asmx';
    }


    _ParsePath(path, endPoint) {
        var url = UrlParser(path);
        if (!url) console.log('Invalid datasource path provided!');

        var pathParts = url.path.split('/');
        var newPath = url.protocol + '://' + url.host + '/';
        for (var i = 0; i < pathParts.length; i++)
            newPath += pathParts[i] + '/';
        newPath += endPoint;
        return newPath;
    }

    _serializeParams(params) {
        if (!params || params.length == 0) return '';
        var data = {root: params};
        var creator = new XML2JS();
        var payload = creator.json2xml_str(data);

        return payload.replace('<root>', '').replace('</root>', '');
    }
}
