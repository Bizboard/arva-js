/**
 * Created by tom on 20/05/15.
 */

import {Inject}         from 'di.js';
import {DataSource}     from 'arva-ds/core/DataSource';
import {ObjectHelper}   from '../../utils/objectHelper';

@Inject(DataSource)
export class BrandingEngine {
    get options(){ return this._options; }
    set options(value){ this._options = value; }

    constructor(dataSource = null){
        this._dataSource = dataSource.child('Branding');

        /* Bind all methods to this object's scoping. */
        ObjectHelper.bindAllMethods(this, this);
    }

    /**
     * Sets the branding options using the local cache and an external dataSource.
     * If a cached version is present, it is used to populate the options, and the function is resolved immediately.
     * Otherwise, the options are populated from the external dataSource.
     * In both cases, the latest options are fetched from the dataSource and saved to cache for use on the next app launch.
     * @returns {Promise}
     */
    setOptionsFromDataSource() {
        return new Promise(function(resolve) {
            let isResolved = false;

            /* If there is a local cached version available, use it. */
            if(Storage && localStorage.getItem('Branding')){
                this.options = JSON.parse(localStorage.getItem('Branding'));
                isResolved = true;
                resolve();
            }

            /* If we didn't get a dataSource injected into this class, don't try to us it. */
            if(!this._dataSource) { resolve(); }

            /* Use the dataSource to populate our branding options if no cache is available,
             * or save the latest options to cache so they are available on the next app launch. */
            this._dataSource.setValueChangedCallback(function(dataSnapshot) {
                this._dataSource.removeValueChangedCallback();
                this.setOptions(dataSnapshot.val());
                if(!isResolved) { resolve(); }
            }.bind(this));
        }.bind(this));
    }

    /**
     * Set the branding options manually.
     * @param {Object} options Dictionary object with wanted branding options. Example: {textColor: 'black', backgroundColor: 'white'}
     */
    setOptions(options) {
        this.options = options;

        if(Storage) { localStorage.setItem('Branding', JSON.stringify(options)); }
    }

    /**
     * Set one branding option manually.
     * @param {String} optionName
     * @param {*} value
     */
    setOption(optionName, value) {
        if(!this.options) { this.options = {}; }

        this.options[optionName] = value;
    }

    /**
     * Get a branding option value by its name.
     * @param {String} optionName
     * @returns {*}
     */
    get(optionName) {
        return this.options[optionName];
    }
}