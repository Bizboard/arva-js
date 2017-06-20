/**


 @author: Tom Clement (tjclement)
 @license NPOSL-3.0
 @copyright Bizboard, 2015

 */

import difference               from 'lodash/difference.js';
import {Injection}              from '../utils/Injection.js';
import {ObjectHelper}           from '../utils/ObjectHelper.js';
import {PrioritisedObject}      from '../data/PrioritisedObject.js';
import {DataSource}             from '../data/DataSource.js';

/**
 * A model that has attributes synced with the database.
 *
 * @example
 * export class Box extends Model {
 *  get label() {}
 *  get articleNumber() {}
 * }
 */
export class Model extends PrioritisedObject {

    /**
     * Creates a new instance of a model.
     * @param {String} id Optional: The identifier for this model. For a user model this might be a user ID, for example. It
     *           is used to build the path to the dataSource. This path is <root>/<model name appended with 's'>/<id>.
     *           If no id is given, a randomly generated one will be pushed to the dataSource. You can use this for
     *           creating new objects in the dataSource.
     * @param {Object} data Optional: The initial data to fill the model with. The model will be extended with any
     *                      properties present in the data parameter.
     * @param {Object} options Optional: Additional options. Currently used is "dataSnapshot", which if present is used
     *                          to fetch the initial model data. If not present, the model will add a one-time
     *                          subscription to the dataSource to fetch initial data.
     * @returns {Model} Model Instance.
     */
    constructor(id, data = null, options = {}) {

        /* Retrieve dataSource from the DI context */
        let dataSource = options.dataSource || Injection.get(DataSource);
        super();
        this._id = id;
        /* Replace all stub data fields of any subclass of Model with databinding accessors.
         * This causes changes to be synched to and from the dataSource. */
        this._replaceModelAccessorsWithDatabinding();


        /* Calculate path to model in dataSource, used if no dataSource or path are given.
         *
         * The this._name property can be set by Arva's babel-plugin-transform-runtime-constructor-name plugin.
         * This allows Arva code to be minified and mangled without losing automated model name resolving.
         * If the plugin is not set up to run, which is done e.g. when not minifying your code, we default back to the runtime constructor name. */
        let modelName = this.constructor._name || Object.getPrototypeOf(this).constructor.name;

        let pathRoot = modelName + 's';
        if (options.subBranch) { pathRoot += `/${options.subBranch}`; }

        let dataWasPushed = false;
        let onDataSynced, onDataSyncFailed;
        let dataIsSynced = new Promise((resolve, reject) => {
            onDataSynced = resolve;
            onDataSyncFailed = reject;
        });

        let dataSourceOptions = { synced: dataIsSynced };

        if (options.dataSource && id) {
            this._dataSource = options.dataSource;
        } else if (options.dataSource) {
            /* No id is present, generate a random one by pushing a new entry to the dataSource. */
            dataWasPushed = true;
            this._dataSource = options.dataSource.push(data);
        } else if (options.path && id) {
            this._dataSource = dataSource.child(options.path + '/' + id || '', dataSourceOptions);
        } else if (options.dataSnapshot) {
            let { ref } = options.dataSnapshot;
            /* Getting the path from a snapshot requires some string modifications */
            this._dataSource = dataSource.child(ref.toString().substring(ref.root.toString().length), dataSourceOptions);
        } else if (id) {
            /* If an id is present, use it to locate our model. */
            this._dataSource = dataSource.child(pathRoot + '/' + id, dataSourceOptions);
        } else {
            dataWasPushed = true;
            /* No id is present, generate a random one by pushing a new entry to the dataSource. */
            if (options.path) {
                this._dataSource = dataSource.child(options.path).push(data);
            } else {
                this._dataSource = dataSource.child(pathRoot).push(data);
            }
            /* Get the last part of the path and set to the ID */
            this._id = dataSource.key();
        }

        /* Re-construct core PrioritisedObject with new dataSource */
        if (options.dataSnapshot) {
            this._buildFromSnapshot(options.dataSnapshot);
        } else {
            this._buildFromDataSource(this._dataSource);
        }
        if (!options.noInitialSync && !dataWasPushed) {
            /* Write local data to model, if any data is present. */
            this._writeLocalDataToModel(data)
                .then(onDataSynced)
                .catch(onDataSyncFailed);
        } else {
            onDataSynced();
        }
        if(this._dataSource){
            /* Add the promise to the end of the dataSource synced chain.
             * This enables to catch errors like this:
             * new Model(null, {...data}).synced().catch((error) => /!* Handle error *!/)
             */
            let dataSourceSyncPromise = this._dataSource.synced();
            if (dataSourceSyncPromise) {
                this._dataSource._synced = dataSourceSyncPromise.then(() => dataIsSynced);
            }
        }
    }


    /**
     * Check if the model has been synchonized with the database
     * @returns {Promise} Resolves when the model has been synchonized with the database
     */
    synced() {
        return this._dataSource.synced();
    }

    /**
     * Updates properties of this model to the values of those of another model, or a normal JS Object.
     * @param {Model|Object} newModelOrData Data to replace old data with
     */
    replaceProperties(newModelOrData) {
        this.transaction(() => {
            for (let fieldName in newModelOrData) {
                /* Simple shallow clone */
                this[fieldName] = newModelOrData[fieldName];
            }
        });
    }

    /**
     * Replaces all getters/setters defined on the model implementation with properties that trigger update events to the dataSource.
     * @returns {void}
     * @private
     */
    _replaceModelAccessorsWithDatabinding() {
        let prototype = Object.getPrototypeOf(this);

        if (~Object.getOwnPropertyNames(prototype).indexOf('id')) {
            console.log(`Don't define an id property to ${prototype.constructor.name}, as this property is internally used by the PrioritisedArray`);
        }

        /* If the code is minified, then this.constructor._name is defined, in that case that also goes for the inheriting classes */
        while (prototype && (prototype.constructor._name || (!this.constructor._name && prototype.constructor.name !== 'Model'))) {
            /* Get all properties except the id and constructor of this model */
            let propNames = difference(Object.getOwnPropertyNames(prototype), ['constructor', 'id']);

            for (let name of propNames) {
                let descriptor = Object.getOwnPropertyDescriptor(prototype, name);
                if (descriptor && descriptor.get) {
                    let value = this[name];
                    delete this[name];
                    ObjectHelper.addPropertyToObject(this, name, value, true, true, this._onSetterTriggered);
                }
            }

            prototype = Object.getPrototypeOf(prototype);
        }
    }

    /**
     * Writes data, if present, to the Model's dataSource. Uses a transaction, meaning that only one update is triggered to the dataSource,
     * even though multiple fields change.
     * @param {Object} data Data to write, can be null.
     * @returns {Promise} Resolves when the transaction is complete and synced
     * @private
     */
    _writeLocalDataToModel(data) {
        if (data) {
            let isDataDifferent = false;
            for (let name in data) {
                if (Object.getOwnPropertyDescriptor(this, name) && this[name] !== data[name]) {
                    isDataDifferent = true;
                    break;
                }
            }

            if (isDataDifferent) {
                return this.transaction(function () {
                    for (let name in data) {

                        // only map properties that exists on our model
                        if (Object.getOwnPropertyDescriptor(this, name)) {
                            let value = data[name];
                            this[name] = value;
                        }
                    }
                }.bind(this));
            }
        }
        return Promise.resolve();
    }

}
